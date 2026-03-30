"use client"

import * as React from "react"

import type { VisibilityState } from "@tanstack/react-table"
import type { DatoolClientSource } from "../../shared/types"
import type { StreamViewerRow } from "../stream-state"
import type { DataTableColumnKind } from "../components/data-table-col-icon"
import type { DataTableSearchFieldSpec } from "../lib/data-table-search"

// ---------------------------------------------------------------------------
// Table state (registered by DatoolDataTable)
// ---------------------------------------------------------------------------

export type DatoolTableState = {
  columnIds: string[]
  columnVisibility: VisibilityState
  groupedColumnIds: string[]
  handleExport: (format: "csv" | "md") => void
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  setGroupedColumnIds: React.Dispatch<React.SetStateAction<string[]>>
  settingsColumns: Array<{
    id: string
    kind?: DataTableColumnKind
    label: string
    visible: boolean
  }>
}

// ---------------------------------------------------------------------------
// Trace state (registered by DatoolTraceViewer)
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Source context
// ---------------------------------------------------------------------------

export type DatoolSourceContextValue<TData extends Record<string, unknown> = Record<string, unknown>> = {
  canLiveUpdate: boolean
  clearRows: () => void
  errorMessage: string | null
  isConnected: boolean
  isConnecting: boolean
  registerSearchFieldSpecs: (fields: DataTableSearchFieldSpec[]) => void
  rows: Array<StreamViewerRow<TData>>
  search: string
  searchFieldSpecs: DataTableSearchFieldSpec[]
  setRows: React.Dispatch<React.SetStateAction<Array<StreamViewerRow<TData>>>>
  setSearch: (value: string) => void
  setShouldConnect: React.Dispatch<React.SetStateAction<boolean>>
  shouldConnect: boolean
  sourceConfig: DatoolClientSource | null
  sourceId: string

  // Registered by DatoolDataTable / DatoolTraceViewer
  table: DatoolTableState | null
  trace: DatoolTraceState | null
  registerTable: (state: DatoolTableState | null) => void
  registerTrace: (state: DatoolTraceState | null) => void
}

export const DatoolSourceContext =
  React.createContext<DatoolSourceContextValue | null>(null)

export function useDatoolSourceContext<
  TData extends Record<string, unknown> = Record<string, unknown>,
>() {
  const context = React.useContext(DatoolSourceContext)

  if (!context) {
    throw new Error(
      "useDatoolSourceContext must be used inside DatoolSourceProvider."
    )
  }

  return context as unknown as DatoolSourceContextValue<TData>
}

export function useOptionalDatoolSourceContext<
  TData extends Record<string, unknown> = Record<string, unknown>,
>() {
  return React.useContext(DatoolSourceContext) as DatoolSourceContextValue<TData> | null
}

// ---------------------------------------------------------------------------
// Convenience hooks for table/trace state
// ---------------------------------------------------------------------------

export function useDatoolTableContext() {
  const ctx = useDatoolSourceContext()
  if (!ctx.table) {
    throw new Error("useDatoolTableContext: no table registered. Place a <DatoolDataTable> inside the provider.")
  }
  return ctx.table
}

export function useDatoolTraceContext() {
  const ctx = useDatoolSourceContext()
  if (!ctx.trace) {
    throw new Error("useDatoolTraceContext: no trace registered. Place a <DatoolTraceViewer> inside the provider.")
  }
  return ctx.trace
}

export function useDatoolTraceGroupPicker() {
  const ctx = useDatoolSourceContext()
  return ctx.trace?.groupPicker ?? null
}
