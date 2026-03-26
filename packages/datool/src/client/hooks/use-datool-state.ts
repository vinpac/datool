"use client"

import * as React from "react"

import type { DatoolStateManager } from "../lib/state-manager"
import { useOptionalDatoolContext } from "../providers/datool-context"

/**
 * Read a single key from the DatoolStateManager and re-render when it changes
 * (e.g. on popstate for query-params, or on storage event for localStorage).
 *
 * Returns `[value, setValue]` similar to `useState`.
 * `setValue("")` or `setValue(null)` deletes the key.
 */
export function useDatoolState(
  key: string
): [string, (value: string | null) => void] {
  const ctx = useOptionalDatoolContext()
  const stateManager = ctx?.stateManager ?? null

  const [value, setValueInternal] = React.useState(() =>
    stateManager?.get(key) ?? ""
  )

  // Subscribe to external changes (popstate, storage event, etc.)
  React.useEffect(() => {
    if (!stateManager) return

    const unsubscribe = stateManager.subscribe(() => {
      setValueInternal(stateManager.get(key) ?? "")
    })

    return unsubscribe
  }, [key, stateManager])

  const setValue = React.useCallback(
    (next: string | null) => {
      if (!stateManager) return
      if (!next) {
        stateManager.delete(key)
      } else {
        stateManager.set(key, next)
      }
      setValueInternal(next ?? "")
    },
    [key, stateManager]
  )

  return [value, setValue]
}

/**
 * Read a JSON-serialized value from the DatoolStateManager.
 *
 * Writes are debounced by `debounceMs` (default 300) to avoid excessive
 * serialisation / history entries.
 */
export function useDatoolJsonState<T>(
  key: string,
  defaultValue: T,
  debounceMs = 300
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const ctx = useOptionalDatoolContext()
  const stateManager = ctx?.stateManager ?? null

  const [value, setValueInternal] = React.useState<T>(() => {
    const raw = stateManager?.get(key)
    if (raw) {
      try { return JSON.parse(raw) as T } catch { /* ignore */ }
    }
    return defaultValue
  })

  // Subscribe to external changes
  React.useEffect(() => {
    if (!stateManager) return

    const unsubscribe = stateManager.subscribe(() => {
      const raw = stateManager.get(key)
      if (raw) {
        try { setValueInternal(JSON.parse(raw) as T) } catch { /* ignore */ }
      } else {
        setValueInternal(defaultValue)
      }
    })

    return unsubscribe
    // defaultValue intentionally excluded — we only use the initial default
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stateManager])

  // Debounced write-through
  React.useEffect(() => {
    if (!stateManager) return

    const timeoutId = window.setTimeout(() => {
      const serialized = JSON.stringify(value)
      const isDefault = serialized === JSON.stringify(defaultValue)
      if (isDefault) {
        stateManager.delete(key)
      } else {
        stateManager.set(key, serialized)
      }
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
    // defaultValue intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceMs, key, stateManager, value])

  return [value, setValueInternal]
}
