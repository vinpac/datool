"use client"

import * as React from "react"
import {
  QueryClient,
  QueryClientProvider,
  useQueries,
  type UseQueryResult,
} from "@tanstack/react-query"

import type { DatoolQueryDefinition } from "./types"

type DatoolContextValue = {
  defaultQueryId: string
  queryDefinitions: Record<string, DatoolQueryDefinition<any, any, any>>
  queryResults: Record<string, UseQueryResult<unknown>>
  resetView: (queryId: string) => void
  viewRevisionByQueryId: Record<string, number>
}

export type DatoolQueryValue<
  TData = unknown,
  TFilters = unknown,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  definition: DatoolQueryDefinition<TData, TFilters, TRow>
  id: string
  resetView: () => void
  result: UseQueryResult<TData>
  rows: TRow[]
  viewRevision: number
}

export type DatoolProviderProps = {
  children: React.ReactNode
  defaultQuery?: string
  queries: Record<string, DatoolQueryDefinition<any, any, any>>
  queryClient?: QueryClient
}

const DatoolContext = React.createContext<DatoolContextValue | null>(null)

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
      <DatoolProviderInner defaultQuery={defaultQuery} queries={queries}>
        {children}
      </DatoolProviderInner>
    </QueryClientProvider>
  )
}

function DatoolProviderInner({
  children,
  defaultQuery,
  queries,
}: Required<Pick<DatoolProviderProps, "children" | "queries">> & {
  defaultQuery?: string
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

  const [viewRevisionByQueryId, setViewRevisionByQueryId] = React.useState<
    Record<string, number>
  >({})

  const resetView = React.useCallback((queryId: string) => {
    setViewRevisionByQueryId((current) => ({
      ...current,
      [queryId]: (current[queryId] ?? 0) + 1,
    }))
  }, [])

  const value = React.useMemo(
    () => ({
      defaultQueryId: resolvedDefaultQuery,
      queryDefinitions: queries,
      queryResults: Object.fromEntries(
        queryEntries.map(([queryId], index) => [queryId, queryResults[index]])
      ),
      resetView,
      viewRevisionByQueryId,
    }),
    [
      queries,
      queryEntries,
      queryResults,
      resetView,
      resolvedDefaultQuery,
      viewRevisionByQueryId,
    ]
  )

  return <DatoolContext.Provider value={value}>{children}</DatoolContext.Provider>
}

export function useDatool() {
  const context = React.useContext(DatoolContext)

  if (!context) {
    throw new Error("useDatool must be used inside DatoolProvider.")
  }

  return context
}

export function useDatoolQuery<
  TData = unknown,
  TFilters = unknown,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(queryId?: string) {
  const context = useDatool()
  const resolvedQueryId = queryId ?? context.defaultQueryId
  const definition = context.queryDefinitions[resolvedQueryId] as
    | DatoolQueryDefinition<TData, TFilters, TRow>
    | undefined
  const result = context.queryResults[resolvedQueryId] as
    | UseQueryResult<TData>
    | undefined

  if (!definition || !result) {
    throw new Error(`Unknown datool query "${resolvedQueryId}".`)
  }

  const rows =
    definition.kind === "collection"
      ? definition.getRows(result.data)
      : ([] as TRow[])

  return React.useMemo(
    () =>
      ({
        definition,
        id: resolvedQueryId,
        resetView: () => context.resetView(resolvedQueryId),
        result,
        rows,
        viewRevision: context.viewRevisionByQueryId[resolvedQueryId] ?? 0,
      }) satisfies DatoolQueryValue<TData, TFilters, TRow>,
    [context, definition, resolvedQueryId, result, rows]
  )
}

export function useDatoolCollectionQuery<
  TData = unknown,
  TFilters = unknown,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(queryId?: string) {
  const query = useDatoolQuery<TData, TFilters, TRow>(queryId)

  if (query.definition.kind !== "collection") {
    throw new Error(
      `Datool query "${query.id}" is not a collection query and cannot be used here.`
    )
  }

  return query as DatoolQueryValue<TData, TFilters, TRow> & {
    definition: Extract<
      DatoolQueryDefinition<TData, TFilters, TRow>,
      { kind: "collection" }
    >
  }
}
