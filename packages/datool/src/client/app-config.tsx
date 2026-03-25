"use client"

import * as React from "react"

import type { DatoolClientConfig, DatoolClientSource } from "../shared/types"

type DatoolAppConfigContextValue = {
  config: DatoolClientConfig
  sourceById: Map<string, DatoolClientSource>
  streamById: Map<string, DatoolClientSource>
}

const DatoolAppConfigContext =
  React.createContext<DatoolAppConfigContextValue | null>(null)

export function DatoolAppConfigProvider({
  children,
  config,
}: {
  children: React.ReactNode
  config: DatoolClientConfig
}) {
  const value = React.useMemo<DatoolAppConfigContextValue>(
    () => {
      const sources = config.sources ?? config.streams ?? []

      return {
        config,
        sourceById: new Map(sources.map((source) => [source.id, source])),
        streamById: new Map(sources.map((source) => [source.id, source])),
      }
    },
    [config]
  )

  return (
    <DatoolAppConfigContext.Provider value={value}>
      {children}
    </DatoolAppConfigContext.Provider>
  )
}

export function useDatoolAppConfig() {
  const context = React.useContext(DatoolAppConfigContext)

  if (!context) {
    throw new Error(
      "useDatoolAppConfig must be used inside DatoolAppConfigProvider."
    )
  }

  return context
}
