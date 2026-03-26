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
      registerTable: setTable,
      registerTrace: setTrace,
      rows,
      search,
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
