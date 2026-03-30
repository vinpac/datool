"use client"

import * as React from "react"
import {
  QueryClient,
  QueryClientProvider,
  useQueries,
} from "@tanstack/react-query"

import type { DatoolQueryDefinition } from "../../shared/types"
import { DatoolContextProvider } from "./datool-context"
import type {
  DatoolTableState,
  DatoolTraceState,
} from "./datool-context"
import type { DataTableSearchFieldSpec } from "../lib/data-table-search"

export type DatoolProviderProps = {
  children: React.ReactNode
  defaultQuery?: string
  queries: Record<string, DatoolQueryDefinition<any, any, any>>
  queryClient?: QueryClient
}

export function DatoolProvider({
  children,
  defaultQuery,
  queries,
  queryClient: providedQueryClient,
}: DatoolProviderProps) {
  const queryClient = React.useMemo(
    () => providedQueryClient ?? new QueryClient(),
    [providedQueryClient]
  )

  return (
    <QueryClientProvider client={queryClient}>
      <DatoolProviderInner
        defaultQuery={defaultQuery}
        queries={queries}
        queryClient={queryClient}
      >
        {children}
      </DatoolProviderInner>
    </QueryClientProvider>
  )
}

function DatoolProviderInner({
  children,
  defaultQuery,
  queries,
  queryClient,
}: Required<Pick<DatoolProviderProps, "children" | "queries">> & {
  defaultQuery?: string
  queryClient: QueryClient
}) {
  const queryEntries = React.useMemo(() => Object.entries(queries), [queries])

  if (queryEntries.length === 0) {
    throw new Error("DatoolProvider requires at least one query definition.")
  }

  const resolvedDefaultQuery = React.useMemo(() => {
    if (defaultQuery) {
      if (!queries[defaultQuery]) {
        throw new Error(`Unknown default datool query "${defaultQuery}".`)
      }

      return defaultQuery
    }

    if (queryEntries.length === 1) {
      return queryEntries[0]![0]
    }

    throw new Error(
      "DatoolProvider requires a defaultQuery when more than one query is registered."
    )
  }, [defaultQuery, queries, queryEntries])

  const queryResults = useQueries({
    queries: queryEntries.map(([, definition]) => {
      const options = definition.getQueryOptions(definition.filters)

      return {
        ...options,
        refetchInterval:
          definition.pollingIntervalMs === undefined
            ? options.refetchInterval
            : definition.pollingIntervalMs,
      }
    }),
  })

  const [searchFieldSpecsByQueryId, setSearchFieldSpecsByQueryId] =
    React.useState<Record<string, DataTableSearchFieldSpec[]>>({})
  const [tableStateByQueryId, setTableStateByQueryId] = React.useState<
    Record<string, DatoolTableState | null>
  >({})
  const [traceStateByQueryId, setTraceStateByQueryId] = React.useState<
    Record<string, DatoolTraceState | null>
  >({})

  const registerSearchFieldSpecs = React.useCallback(
    (queryId: string, fields: DataTableSearchFieldSpec[]) => {
      setSearchFieldSpecsByQueryId((current) => {
        if (current[queryId] === fields) {
          return current
        }

        return {
          ...current,
          [queryId]: fields,
        }
      })
    },
    []
  )

  const registerTable = React.useCallback(
    (queryId: string, state: DatoolTableState | null) => {
      setTableStateByQueryId((current) => {
        if (current[queryId] === state) {
          return current
        }

        return {
          ...current,
          [queryId]: state,
        }
      })
    },
    []
  )

  const registerTrace = React.useCallback(
    (queryId: string, state: DatoolTraceState | null) => {
      setTraceStateByQueryId((current) => {
        if (current[queryId] === state) {
          return current
        }

        return {
          ...current,
          [queryId]: state,
        }
      })
    },
    []
  )

  const value = React.useMemo(
    () => ({
      defaultQueryId: resolvedDefaultQuery,
      queryClient,
      queryDefinitions: queries,
      queryResults: Object.fromEntries(
        queryEntries.map(([queryId], index) => [queryId, queryResults[index]])
      ),
      registerSearchFieldSpecs,
      registerTable,
      registerTrace,
      searchFieldSpecsByQueryId,
      tableStateByQueryId,
      traceStateByQueryId,
    }),
    [
      queryClient,
      queries,
      queryEntries,
      queryResults,
      registerSearchFieldSpecs,
      registerTable,
      registerTrace,
      resolvedDefaultQuery,
      searchFieldSpecsByQueryId,
      tableStateByQueryId,
      traceStateByQueryId,
    ]
  )

  return (
    <DatoolContextProvider value={value}>{children}</DatoolContextProvider>
  )
}
