"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ComponentType } from "react"

import { DatoolAppConfigProvider } from "../client/app-config"
import { AppSidebar } from "../client/components/app-sidebar"
import { ThemeProvider } from "../client/components/theme-provider"
import { TooltipProvider } from "../client/components/ui/tooltip"
import { SidebarInset, SidebarProvider } from "../client/components/ui/sidebar"
import { DatoolNavigationProvider } from "../client/navigation"
import type { DatoolClientConfig } from "../shared/types"

export type DatoolManifestPage = {
  component: ComponentType
  id: string
  path: string
  title: string
}

export function DatoolNextApp({
  config,
  manifestPages,
}: {
  config: DatoolClientConfig
  manifestPages: DatoolManifestPage[]
}) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""
  const activePage = React.useMemo(
    () => manifestPages.find((page) => page.path === pathname) ?? null,
    [manifestPages, pathname]
  )

  React.useEffect(() => {
    if (!activePage && manifestPages[0]) {
      router.replace(manifestPages[0].path)
    }
  }, [activePage, manifestPages, router])

  const ActivePageComponent = activePage?.component ?? null

  return (
    <ThemeProvider storageKey="datool-theme">
      <TooltipProvider>
        <DatoolNavigationProvider pathname={pathname} search={search}>
          <DatoolAppConfigProvider config={config}>
            <SidebarProvider>
              <AppSidebar pages={config.pages} />
              <SidebarInset className="min-h-svh overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col">
                  {ActivePageComponent ? (
                    <ActivePageComponent />
                  ) : (
                    <div className="flex min-h-svh items-center justify-center px-6 text-sm text-muted-foreground">
                      No datool page matched this route.
                    </div>
                  )}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </DatoolAppConfigProvider>
        </DatoolNavigationProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
