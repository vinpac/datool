"use client"

import * as React from "react"

import { useDatoolSource } from "../hooks/use-datool-stream"
import { useOptionalDatoolContext } from "./datool-context"
import {
  DatoolSourceContext,
  type DatoolSourceContextValue,
  type DatoolTableState,
  type DatoolTraceState,
} from "./datool-source-context"
import type { DataTableSearchFieldSpec } from "../lib/data-table-search"

export type DatoolSourceProviderProps = {
  children: React.ReactNode
  source?: string
}

export function DatoolSourceProvider({
  children,
  source,
}: DatoolSourceProviderProps) {
  const datoolContext = useOptionalDatoolContext()
  const resolvedSource = source ?? datoolContext?.defaultSource

  if (!resolvedSource) {
    throw new Error(
      "DatoolSourceProvider requires a 'source' prop or a defaultSource on DatoolProvider."
    )
  }

  return (
    <DatoolSourceProviderInner source={resolvedSource}>
      {children}
    </DatoolSourceProviderInner>
  )
}

function DatoolSourceProviderInner({
  children,
  source,
}: {
  children: React.ReactNode
  source: string
}) {
  const datoolContext = useOptionalDatoolContext()
  const clientData = datoolContext?.clientSourceData.get(source)

  const {
    activeSource,
    canLiveUpdate,
    errorMessage,
    isConnected,
    isConnecting,
    rows,
    setRows,
    setShouldConnect,
    shouldConnect,
  } = useDatoolSource(source, clientData?.rows)

  const [search, setSearch] = React.useState("")
  const [searchFieldSpecs, setSearchFieldSpecs] = React.useState<
    DataTableSearchFieldSpec[]
  >([])
  const [table, setTable] = React.useState<DatoolTableState | null>(null)
  const [trace, setTrace] = React.useState<DatoolTraceState | null>(null)

  const clearRows = React.useCallback(() => setRows([]), [setRows])

  const value = React.useMemo<DatoolSourceContextValue>(
    () => ({
      canLiveUpdate,
      clearRows,
      errorMessage,
      isConnected,
      isConnecting,
      registerSearchFieldSpecs: setSearchFieldSpecs,
      registerTable: setTable,
      registerTrace: setTrace,
      rows,
      search,
      searchFieldSpecs,
      setRows,
      setSearch,
      setShouldConnect,
      shouldConnect,
      sourceConfig: activeSource,
      sourceId: source,
      table,
      trace,
    }),
    [
      activeSource,
      canLiveUpdate,
      clearRows,
      errorMessage,
      isConnected,
      isConnecting,
      rows,
      search,
      searchFieldSpecs,
      setRows,
      setShouldConnect,
      shouldConnect,
      source,
      table,
      trace,
    ]
  )

  return (
    <DatoolSourceContext.Provider value={value}>
      {children}
    </DatoolSourceContext.Provider>
  )
}
