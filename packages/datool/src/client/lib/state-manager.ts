/**
 * DatoolStateManager — pluggable key-value persistence used by every datool
 * component that needs to read or write view state (search filters, column
 * visibility, trace-group selection, etc.).
 *
 * Two built-in factories are provided:
 *  - `createQueryParamsStateManager()`  — URL search-params (Next.js friendly)
 *  - `createLocalStorageStateManager()` — window.localStorage
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type DatoolStateManager = {
  /** Return the stored value, or `null` if absent. */
  get(key: string): string | null
  /** Persist a value. */
  set(key: string, value: string): void
  /** Remove a key. */
  delete(key: string): void
  /** Check if a key exists. */
  has(key: string): boolean
  /**
   * Subscribe to external mutations (e.g. browser back/forward for query-params,
   * or the `storage` event for localStorage).
   * Returns an unsubscribe function.
   */
  subscribe(callback: () => void): () => void
}

// ---------------------------------------------------------------------------
// Query-params implementation
// ---------------------------------------------------------------------------

export function createQueryParamsStateManager(): DatoolStateManager {
  if (typeof window === "undefined") {
    return createNoopStateManager()
  }

  const listeners = new Set<() => void>()

  function currentParams() {
    return new URL(window.location.href).searchParams
  }

  function notify() {
    for (const cb of listeners) cb()
  }

  // Listen to popstate so React components re-read after back/forward nav.
  const onPopState = () => notify()
  window.addEventListener("popstate", onPopState)

  return {
    get(key) {
      return currentParams().get(key)
    },

    set(key, value) {
      const url = new URL(window.location.href)
      url.searchParams.set(key, value)
      window.history.replaceState(window.history.state, "", url)
    },

    delete(key) {
      const url = new URL(window.location.href)
      if (!url.searchParams.has(key)) return
      url.searchParams.delete(key)
      window.history.replaceState(window.history.state, "", url)
    },

    has(key) {
      return currentParams().has(key)
    },

    subscribe(callback) {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// localStorage implementation
// ---------------------------------------------------------------------------

export function createLocalStorageStateManager(
  prefix = "datool:"
): DatoolStateManager {
  if (typeof window === "undefined") {
    return createNoopStateManager()
  }

  const listeners = new Set<() => void>()

  function prefixed(key: string) {
    return `${prefix}${key}`
  }

  function notify() {
    for (const cb of listeners) cb()
  }

  // Cross-tab reactivity via the storage event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(prefix)) {
      notify()
    }
  }
  window.addEventListener("storage", onStorage)

  return {
    get(key) {
      return window.localStorage.getItem(prefixed(key))
    },

    set(key, value) {
      window.localStorage.setItem(prefixed(key), value)
    },

    delete(key) {
      window.localStorage.removeItem(prefixed(key))
    },

    has(key) {
      return window.localStorage.getItem(prefixed(key)) !== null
    },

    subscribe(callback) {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Noop (SSR-safe)
// ---------------------------------------------------------------------------

function createNoopStateManager(): DatoolStateManager {
  return {
    get() { return null },
    set() {},
    delete() {},
    has() { return false },
    subscribe() { return () => {} },
  }
}
