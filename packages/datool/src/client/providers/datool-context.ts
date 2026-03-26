"use client"

import * as React from "react"

import type { QueryClient } from "@tanstack/react-query"
import type { DatoolClientConfig, DatoolClientSource } from "../../shared/types"
import type { DatoolStateManager } from "../lib/state-manager"
import type { StreamViewerRow } from "../stream-state"

export type DatoolClientSourceData<TData extends Record<string, unknown> = Record<string, unknown>> = {
  /** Initial rows to populate the source with. */
  rows?: Array<StreamViewerRow<TData>>
}

export type DatoolContextValue = {
  config: DatoolClientConfig
  defaultSource: string | null
  queryClient: QueryClient
  sourceById: Map<string, DatoolClientSource>
  /** Client-supplied source data keyed by source id. */
  clientSourceData: Map<string, DatoolClientSourceData>
  /** Pluggable state persistence (query-params, localStorage, etc.). */
  stateManager: DatoolStateManager
}

export const DatoolContext = React.createContext<DatoolContextValue | null>(null)

export function useDatoolContext() {
  const context = React.useContext(DatoolContext)

  if (!context) {
    throw new Error("useDatoolContext must be used inside DatoolProvider.")
  }

  return context
}

export function useOptionalDatoolContext() {
  return React.useContext(DatoolContext)
}
