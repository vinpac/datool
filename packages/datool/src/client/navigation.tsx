"use client"

import * as React from "react"

type DatoolNavigationContextValue = {
  pathname: string
  search: string
}

const DatoolNavigationContext =
  React.createContext<DatoolNavigationContextValue | null>(null)

export function DatoolNavigationProvider({
  children,
  pathname,
  search,
}: {
  children: React.ReactNode
  pathname: string
  search: string
}) {
  const value = React.useMemo<DatoolNavigationContextValue>(
    () => ({
      pathname,
      search,
    }),
    [pathname, search]
  )

  return (
    <DatoolNavigationContext.Provider value={value}>
      {children}
    </DatoolNavigationContext.Provider>
  )
}

export function useDatoolNavigation() {
  const context = React.useContext(DatoolNavigationContext)

  if (!context) {
    throw new Error(
      "useDatoolNavigation must be used inside DatoolNavigationProvider."
    )
  }

  return context
}

export function useOptionalDatoolNavigation() {
  return React.useContext(DatoolNavigationContext)
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

import { useOptionalDatoolContext } from "./providers/datool-context"
import type { DatoolStateManager } from "./lib/state-manager"

export function pathnameToViewId(pathname: string) {
  return `datool-${pathname === "/" ? "index" : pathname.replace(/[^a-z0-9/-]+/gi, "-")}`
}

/**
 * Resolve the state keys for a given page. Useful for programmatic pre-fill.
 */
export function getDatoolStateKeys(page: string) {
  const viewId = pathnameToViewId(page)
  return {
    search: `${viewId}-search`,
    traceGroup: `traceviewer-${viewId}-group`,
  }
}

export type DatoolLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  /** Target page path (e.g. "/" or "/traces"). */
  page: string
  /** Pre-select a trace-viewer group on the target page. */
  traceGroup?: string
  /** Pre-fill the data-table search on the target page. */
  search?: string
  /** Arbitrary extra search params appended to the URL. */
  params?: Record<string, string>
}

/**
 * Build a full URL string for a datool page with optional filter params.
 *
 * When a `stateManager` is provided, filter state (search, traceGroup)
 * is written to the state manager on click instead of being embedded
 * in the URL. Pass `null` to build a plain URL with all params inline
 * (useful for external / copy-paste links).
 */
export function buildDatoolHref({
  page,
  traceGroup,
  search,
  params,
}: Pick<DatoolLinkProps, "page" | "traceGroup" | "search" | "params">) {
  const url = new URL(page, "http://localhost")

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  const qs = url.searchParams.toString()
  return qs ? `${url.pathname}?${qs}` : url.pathname
}

/**
 * Pre-fill datool state for a target page using the state manager.
 *
 * Call this before navigation (or in an onClick handler) so the target
 * page picks up the values from the shared state manager.
 */
export function prefillDatoolState(
  stateManager: DatoolStateManager,
  { page, traceGroup, search }: Pick<DatoolLinkProps, "page" | "traceGroup" | "search">
) {
  const keys = getDatoolStateKeys(page)

  if (search) {
    stateManager.set(keys.search, search)
  } else {
    stateManager.delete(keys.search)
  }

  if (traceGroup) {
    stateManager.set(keys.traceGroup, traceGroup)
  } else {
    stateManager.delete(keys.traceGroup)
  }
}

/**
 * Typesafe link to a datool page with optional filter props.
 *
 * When used inside a `DatoolProvider`, filter state (search, traceGroup)
 * is written to the state manager on click, ensuring consistency
 * regardless of which state backend is in use.
 *
 * ```tsx
 * <DatoolLink page="/traces" traceGroup="workflow-abc">
 *   View workflow
 * </DatoolLink>
 *
 * <DatoolLink page="/" search="level:error">
 *   Error logs
 * </DatoolLink>
 * ```
 */
export const DatoolLink = React.forwardRef<HTMLAnchorElement, DatoolLinkProps>(
  function DatoolLink(
    { page, traceGroup, search, params, onClick, ...rest },
    ref,
  ) {
    const ctx = useOptionalDatoolContext()
    const href = buildDatoolHref({ page, params })

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (ctx?.stateManager && (search || traceGroup)) {
          prefillDatoolState(ctx.stateManager, { page, traceGroup, search })
        }
        onClick?.(e)
      },
      [ctx?.stateManager, onClick, page, search, traceGroup]
    )

    return <a ref={ref} href={href} onClick={handleClick} {...rest} />
  },
)
