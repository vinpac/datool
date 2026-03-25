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

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

function pathnameToViewId(pathname: string) {
  return `datool-${pathname === "/" ? "index" : pathname.replace(/[^a-z0-9/-]+/gi, "-")}`
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
 * Useful when you need the raw href without rendering an anchor element.
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

  const viewId = pathnameToViewId(page)

  if (traceGroup) {
    url.searchParams.set(`traceviewer-${viewId}-group`, traceGroup)
  }

  if (search) {
    url.searchParams.set(`${viewId}-search`, search)
  }

  const qs = url.searchParams.toString()

  return qs ? `${url.pathname}?${qs}` : url.pathname
}

/**
 * Typesafe link to a datool page with optional filter props.
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
    { page, traceGroup, search, params, ...rest },
    ref,
  ) {
    const href = buildDatoolHref({ page, traceGroup, search, params })

    return <a ref={ref} href={href} {...rest} />
  },
)
