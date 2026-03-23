import * as React from "react"

import type { DatoolClientConfig, DatoolClientStream } from "../shared/types"

type DatoolAppConfigContextValue = {
  config: DatoolClientConfig
  streamById: Map<string, DatoolClientStream>
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
    () => ({
      config,
      streamById: new Map(config.streams.map((stream) => [stream.id, stream])),
    }),
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
