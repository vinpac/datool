import type { VisibilityState } from "@tanstack/react-table"

type PersistedTableState = {
  columnFilters?: unknown[]
  columnSizing?: Record<string, number>
  columnVisibility?: VisibilityState
  globalFilter?: string
  groupBy?: string[]
  highlightedColumns?: Record<string, boolean>
  sorting?: unknown[]
}

const STREAM_PARAM = "stream"
const DATA_TABLE_URL_PARAM_PREFIX = "datatable-"
const LOG_VIEWER_TABLE_ID_PREFIX = "datool"

function getSearchUrlParam(tableId: string) {
  return `${tableId}-search`
}

function getTableUrlParam(tableId: string) {
  return `${DATA_TABLE_URL_PARAM_PREFIX}${tableId}`
}

function isDatoolUrlParam(key: string) {
  return (
    key.startsWith(
      `${DATA_TABLE_URL_PARAM_PREFIX}${LOG_VIEWER_TABLE_ID_PREFIX}`
    ) ||
    (key.startsWith(`${LOG_VIEWER_TABLE_ID_PREFIX}-`) && key.endsWith("-search"))
  )
}

function readPersistedTableState(tableId: string) {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const rawValue = new URL(window.location.href).searchParams.get(
      getTableUrlParam(tableId)
    )

    return rawValue ? (JSON.parse(rawValue) as PersistedTableState) : null
  } catch {
    return null
  }
}

function sanitizeColumnVisibility(
  columnVisibility: VisibilityState | undefined,
  columnIds: string[]
) {
  const validIds = new Set(columnIds)

  return Object.fromEntries(
    Object.entries(columnVisibility ?? {}).filter(([columnId]) =>
      validIds.has(columnId)
    )
  )
}

function sanitizeGroupBy(groupBy: string[] | undefined, columnIds: string[]) {
  const validIds = new Set(columnIds)

  return (groupBy ?? []).filter((columnId, index, values) => {
    return validIds.has(columnId) && values.indexOf(columnId) === index
  })
}

function cleanUpDatoolParams(url: URL, tableId: string) {
  const activeSearchParam = getSearchUrlParam(tableId)
  const activeTableParam = getTableUrlParam(tableId)

  for (const key of Array.from(url.searchParams.keys())) {
    if (
      key === STREAM_PARAM ||
      key === activeSearchParam ||
      key === activeTableParam
    ) {
      continue
    }

    if (isDatoolUrlParam(key)) {
      url.searchParams.delete(key)
    }
  }
}

export function readSelectedStreamId() {
  if (typeof window === "undefined") {
    return null
  }

  return new URL(window.location.href).searchParams.get(STREAM_PARAM)
}

export function readDatoolSearch(tableId: string) {
  if (typeof window === "undefined") {
    return ""
  }

  return (
    new URL(window.location.href).searchParams.get(getSearchUrlParam(tableId)) ??
    ""
  )
}

export function readDatoolColumnVisibility(
  tableId: string,
  columnIds: string[]
) {
  return sanitizeColumnVisibility(
    readPersistedTableState(tableId)?.columnVisibility,
    columnIds
  )
}

export function readDatoolGrouping(tableId: string, columnIds: string[]) {
  return sanitizeGroupBy(readPersistedTableState(tableId)?.groupBy, columnIds)
}

export function writeDatoolUrlState({
  columnIds,
  columnVisibility,
  groupBy,
  search,
  selectedStreamId,
  tableId,
}: {
  columnIds: string[]
  columnVisibility: VisibilityState
  groupBy: string[]
  search: string
  selectedStreamId: string | null
  tableId: string
}) {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  const searchValue = search.trim()
  const nextColumnVisibility = sanitizeColumnVisibility(
    columnVisibility,
    columnIds
  )
  const nextGroupBy = sanitizeGroupBy(groupBy, columnIds)
  const nextTableState = {
    ...readPersistedTableState(tableId),
  } satisfies PersistedTableState

  cleanUpDatoolParams(url, tableId)

  if (selectedStreamId) {
    url.searchParams.set(STREAM_PARAM, selectedStreamId)
  } else {
    url.searchParams.delete(STREAM_PARAM)
  }

  if (searchValue) {
    url.searchParams.set(getSearchUrlParam(tableId), search)
  } else {
    url.searchParams.delete(getSearchUrlParam(tableId))
  }

  if (Object.keys(nextColumnVisibility).length > 0) {
    nextTableState.columnVisibility = nextColumnVisibility
  } else {
    delete nextTableState.columnVisibility
  }

  if (nextGroupBy.length > 0) {
    nextTableState.groupBy = nextGroupBy
  } else {
    delete nextTableState.groupBy
  }

  if (Object.keys(nextTableState).length > 0) {
    url.searchParams.set(getTableUrlParam(tableId), JSON.stringify(nextTableState))
  } else {
    url.searchParams.delete(getTableUrlParam(tableId))
  }

  window.history.replaceState(window.history.state, "", url)
}
