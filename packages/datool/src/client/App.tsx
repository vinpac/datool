import * as React from "react"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import { DatoolAppConfigProvider } from "./app-config"
import { AppSidebar } from "./components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type { DatoolClientConfig } from "../shared/types"
import { manifestPages } from "@datool-manifest"

function DatoolRoutes() {
  const firstPage = manifestPages[0]

  if (!firstPage) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No datool pages were discovered.
      </div>
    )
  }

  return (
    <Routes>
      {manifestPages.map((page) => (
        <Route
          element={<page.component />}
          key={page.id}
          path={page.path}
        />
      ))}
      <Route element={<Navigate replace to={firstPage.path} />} path="*" />
    </Routes>
  )
}

function DatoolAppShell({ config }: { config: DatoolClientConfig }) {
  return (
    <BrowserRouter>
      <DatoolAppConfigProvider config={config}>
        <SidebarProvider>
          <AppSidebar pages={config.pages} />
          <SidebarInset className="min-h-svh overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <DatoolRoutes />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DatoolAppConfigProvider>
    </BrowserRouter>
  )
}

export default function App() {
  const [config, setConfig] = React.useState<DatoolClientConfig | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    void fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load datool app config.")
        }

        return (await response.json()) as DatoolClientConfig
      })
      .then((nextConfig) => {
        if (!cancelled) {
          setConfig(nextConfig)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : String(error)
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (errorMessage) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-sm text-destructive">
        {errorMessage}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-sm text-muted-foreground">
        Loading datool app...
      </div>
    )
  }

  return <DatoolAppShell config={config} />
}
