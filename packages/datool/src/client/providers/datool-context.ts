"use client"

import * as React from "react"

import type { QueryClient, UseQueryResult } from "@tanstack/react-query"

import type { DatoolQueryDefinition } from "../../shared/types"
import type { DataTableSearchFieldSpec } from "../lib/data-table-search"
import type { DataTableColumnKind } from "../components/data-table-col-icon"

export type DatoolTableState = {
  columnIds: string[]
  columnVisibility: Record<string, boolean>
  groupedColumnIds: string[]
  handleExport: (format: "csv" | "md") => void
  reset: () => void
  setColumnVisibility: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >
  setGroupedColumnIds: React.Dispatch<React.SetStateAction<string[]>>
  settingsColumns: Array<{
    id: string
    kind?: DataTableColumnKind
    label: string
    visible: boolean
  }>
}

export type DatoolTraceGroupPickerState = {
  groups: Array<{ displayName: string; id: string }>
  onValueChange: (value: string | undefined) => void
  selectedGroupId: string | undefined
}

export type DatoolTraceState = {
  groupPicker: DatoolTraceGroupPickerState | null
  handleExportRawData: () => void
  handleExportTraceData: () => void
  hasTrace: boolean
  issues: Array<{ message: string }>
  rawRowCount: number
  reset: () => void
}

type DatoolContextValue = {
  defaultQueryId: string
  queryClient: QueryClient
  queryDefinitions: Record<string, DatoolQueryDefinition<any, any, any>>
  queryResults: Record<string, UseQueryResult<unknown>>
  registerSearchFieldSpecs: (
    queryId: string,
    fields: DataTableSearchFieldSpec[]
  ) => void
  registerTable: (queryId: string, state: DatoolTableState | null) => void
  registerTrace: (queryId: string, state: DatoolTraceState | null) => void
  searchFieldSpecsByQueryId: Record<string, DataTableSearchFieldSpec[]>
  tableStateByQueryId: Record<string, DatoolTableState | null>
  traceStateByQueryId: Record<string, DatoolTraceState | null>
}

export type DatoolQueryValue<
  TData = unknown,
  TFilters = unknown,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  definition: DatoolQueryDefinition<TData, TFilters, TRow>
  id: string
  registerSearchFieldSpecs: (fields: DataTableSearchFieldSpec[]) => void
  registerTable: (state: DatoolTableState | null) => void
  registerTrace: (state: DatoolTraceState | null) => void
  result: UseQueryResult<TData>
  rows: TRow[]
  searchFieldSpecs: DataTableSearchFieldSpec[]
  table: DatoolTableState | null
  trace: DatoolTraceState | null
}

const DatoolContext = React.createContext<DatoolContextValue | null>(null)

export function DatoolContextProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: DatoolContextValue
}) {
  return React.createElement(DatoolContext.Provider, { value }, children)
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
  const registerSearchFieldSpecs = React.useCallback(
    (fields: DataTableSearchFieldSpec[]) =>
      context.registerSearchFieldSpecs(resolvedQueryId, fields),
    [context.registerSearchFieldSpecs, resolvedQueryId]
  )
  const registerTable = React.useCallback(
    (state: DatoolTableState | null) =>
      context.registerTable(resolvedQueryId, state),
    [context.registerTable, resolvedQueryId]
  )
  const registerTrace = React.useCallback(
    (state: DatoolTraceState | null) =>
      context.registerTrace(resolvedQueryId, state),
    [context.registerTrace, resolvedQueryId]
  )

  return React.useMemo(
    () =>
      ({
        definition,
        id: resolvedQueryId,
        registerSearchFieldSpecs,
        registerTable,
        registerTrace,
        result,
        rows,
        searchFieldSpecs:
          context.searchFieldSpecsByQueryId[resolvedQueryId] ?? [],
        table: context.tableStateByQueryId[resolvedQueryId] ?? null,
        trace: context.traceStateByQueryId[resolvedQueryId] ?? null,
      }) satisfies DatoolQueryValue<TData, TFilters, TRow>,
    [
      context.searchFieldSpecsByQueryId,
      context.tableStateByQueryId,
      context.traceStateByQueryId,
      definition,
      registerSearchFieldSpecs,
      registerTable,
      registerTrace,
      resolvedQueryId,
      result,
      rows,
    ]
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

export function useDatoolTableContext(queryId?: string) {
  const query = useDatoolQuery(queryId)

  if (!query.table) {
    throw new Error(
      "useDatoolTableContext: no table is registered for this datool query."
    )
  }

  return query.table
}

export function useDatoolTraceContext(queryId?: string) {
  const query = useDatoolQuery(queryId)

  if (!query.trace) {
    throw new Error(
      "useDatoolTraceContext: no trace viewer is registered for this datool query."
    )
  }

  return query.trace
}

export function useDatoolTraceGroupPicker(queryId?: string) {
  return useDatoolQuery(queryId).trace?.groupPicker ?? null
}
