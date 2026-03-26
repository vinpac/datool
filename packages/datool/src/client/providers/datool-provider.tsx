"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { DatoolAppConfigProvider } from "../app-config"
import { DatoolContext, type DatoolClientSourceData, type DatoolContextValue } from "./datool-context"
import { DatoolSourceProvider } from "./datool-source-provider"
import type { DatoolClientConfig, DatoolClientSource } from "../../shared/types"
import type { DatoolStateManager } from "../lib/state-manager"
import { createLocalStorageStateManager } from "../lib/state-manager"

export type DatoolProviderProps = {
  children: React.ReactNode
  client?: QueryClient
  config: DatoolClientConfig
  /** When provided, an implicit DatoolSourceProvider is created for this source. */
  defaultSource?: string
  /** Client-supplied source data keyed by source id (e.g. `{ workflows: { rows: [...] } }`). */
  sources?: Record<string, DatoolClientSourceData>
  /**
   * Pluggable state persistence.
   *
   * Pass a `DatoolStateManager` (or use the built-in factories
   * `createQueryParamsStateManager()` / `createLocalStorageStateManager()`).
   *
   * Defaults to `createLocalStorageStateManager()`.
   */
  state?: DatoolStateManager
}

export function DatoolProvider({
  children,
  client,
  config,
  defaultSource,
  sources,
  state,
}: DatoolProviderProps) {
  const queryClient = React.useMemo(
    () => client ?? new QueryClient(),
    [client]
  )

  const stateManager = React.useMemo(
    () => state ?? createLocalStorageStateManager(),
    [state]
  )

  const value = React.useMemo<DatoolContextValue>(() => {
    const configSources = config.sources ?? config.streams ?? []

    return {
      clientSourceData: new Map<string, DatoolClientSourceData>(
        sources ? Object.entries(sources) : []
      ),
      config,
      defaultSource: defaultSource ?? null,
      queryClient,
      sourceById: new Map<string, DatoolClientSource>(
        configSources.map((s) => [s.id, s])
      ),
      stateManager,
    }
  }, [config, defaultSource, queryClient, sources, stateManager])

  let content = children

  if (defaultSource) {
    content = (
      <DatoolSourceProvider source={defaultSource}>
        {children}
      </DatoolSourceProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DatoolAppConfigProvider config={config}>
        <DatoolContext.Provider value={value}>
          {content}
        </DatoolContext.Provider>
      </DatoolAppConfigProvider>
    </QueryClientProvider>
  )
}
