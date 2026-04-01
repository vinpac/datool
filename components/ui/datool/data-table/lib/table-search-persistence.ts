export type SearchStatePersistence = "localStorage" | "url"

function getSearchLocalStorageKey(tableId: string) {
  return `${tableId}:search`
}

function getSearchUrlParam(tableId: string) {
  return `${tableId}-search`
}

function getTableUrlParam(tableId: string) {
  return `datatable-${tableId}`
}

export function hasSearchUrlPersistence(tableId: string) {
  if (typeof window === "undefined") {
    return false
  }

  const params = new URL(window.location.href).searchParams

  return (
    params.has(getSearchUrlParam(tableId)) ||
    params.has(getTableUrlParam(tableId))
  )
}

export function getInitialSearchPersistence(
  tableId: string
): SearchStatePersistence {
  return hasSearchUrlPersistence(tableId) ? "url" : "localStorage"
}

export function readPersistedSearch(
  tableId: string,
  statePersistence: SearchStatePersistence
) {
  if (typeof window === "undefined") {
    return ""
  }

  if (statePersistence === "url") {
    return (
      new URL(window.location.href).searchParams.get(
        getSearchUrlParam(tableId)
      ) ?? ""
    )
  }

  return window.localStorage.getItem(getSearchLocalStorageKey(tableId)) ?? ""
}

export function writePersistedSearch(
  tableId: string,
  statePersistence: SearchStatePersistence,
  value: string
) {
  if (typeof window === "undefined") {
    return
  }

  if (statePersistence === "url") {
    const url = new URL(window.location.href)

    if (value.trim()) {
      url.searchParams.set(getSearchUrlParam(tableId), value)
    } else {
      url.searchParams.delete(getSearchUrlParam(tableId))
    }

    window.history.replaceState(window.history.state, "", url)
    return
  }

  if (value) {
    window.localStorage.setItem(getSearchLocalStorageKey(tableId), value)
    return
  }

  window.localStorage.removeItem(getSearchLocalStorageKey(tableId))
}

export function clearUrlSearchPersistence(tableId: string) {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)

  url.searchParams.delete(getSearchUrlParam(tableId))
  url.searchParams.delete(getTableUrlParam(tableId))

  window.history.replaceState(window.history.state, "", url)
}
