"use client"

import * as React from "react"

import { useDatoolAppConfig } from "../app-config"
import { readJsonResponse } from "../lib/http"
import { useDatoolNavigation } from "../navigation"
import { upsertViewerRow, type StreamViewerRow } from "../stream-state"
import type {
  DatoolClientSource,
  DatoolRowEvent,
  DatoolRowsResponse,
  DatoolSseEndEvent,
  DatoolSseErrorEvent,
} from "../../shared/types"

function parseRowEvent(event: MessageEvent<string>) {
  return JSON.parse(event.data) as DatoolRowEvent
}

function parseErrorEvent(event: MessageEvent<string>) {
  return JSON.parse(event.data) as DatoolSseErrorEvent
}

function parseEndEvent(event: MessageEvent<string>) {
  return JSON.parse(event.data) as DatoolSseEndEvent
}

function isRowsResponse<Row extends Record<string, unknown>>(
  payload: DatoolRowsResponse<Row> | { error?: string }
): payload is DatoolRowsResponse<Row> {
  return "rows" in payload
}

export function useDatoolSource<Row extends Record<string, unknown>>(source: string) {
  const location = useDatoolNavigation()
  const { sourceById } = useDatoolAppConfig()
  const activeSource = (sourceById.get(source) as DatoolClientSource | undefined) ?? null
  const [rows, setRows] = React.useState<Array<StreamViewerRow<Row>>>([])
  const [shouldConnect, setShouldConnect] = React.useState(
    () => activeSource?.supportsLive ?? activeSource?.supportsStream ?? true
  )
  const [isConnected, setIsConnected] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const queryString = location.search

  React.useEffect(() => {
    if (!activeSource) {
      setRows([])
      setErrorMessage(`Unknown source "${source}".`)
      setIsConnected(false)
      return
    }

    setErrorMessage(null)
    setRows([])
  }, [activeSource, queryString, source])

  React.useEffect(() => {
    if (!activeSource?.supportsGet) {
      return
    }

    const controller = new AbortController()

    const fetchRows = () => {
      const url = new URL(
        `/api/sources/${encodeURIComponent(activeSource.id)}/rows`,
        window.location.origin
      )
      const currentParams = new URLSearchParams(queryString)

      for (const [key, value] of currentParams.entries()) {
        url.searchParams.set(key, value)
      }

      void fetch(url, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await readJsonResponse<DatoolRowsResponse<Row>>(
            response
          )) as
            | DatoolRowsResponse<Row>
            | { error?: string }
            | null

          if (!response.ok) {
            throw new Error(
              payload &&
                typeof payload === "object" &&
                "error" in payload &&
                payload.error
                ? payload.error
                : `Request failed with status ${response.status}.`
            )
          }

          if (!payload || !isRowsResponse(payload)) {
            throw new Error("Invalid rows response.")
          }

          setRows(
            payload.rows.map(
              ({ id, row }: DatoolRowsResponse<Row>["rows"][number]) =>
                ({
                  ...row,
                  __datoolRowId: id,
                }) as StreamViewerRow<Row>
            )
          )
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return
          }

          setErrorMessage(error instanceof Error ? error.message : String(error))
        })
    }

    fetchRows()

    const pollIntervalMs = activeSource.pollIntervalMs
    let intervalId: ReturnType<typeof setInterval> | undefined

    if (pollIntervalMs && pollIntervalMs > 0) {
      intervalId = setInterval(fetchRows, pollIntervalMs)
    }

    return () => {
      controller.abort()
      if (intervalId !== undefined) {
        clearInterval(intervalId)
      }
    }
  }, [activeSource, queryString])

  React.useEffect(() => {
    if (
      !shouldConnect ||
      !(activeSource?.supportsLive ?? activeSource?.supportsStream)
    ) {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setIsConnected(false)
      return
    }

    const url = new URL(
      `/api/sources/${encodeURIComponent(activeSource.id)}/events`,
      window.location.origin
    )
    const currentParams = new URLSearchParams(queryString)

    for (const [key, value] of currentParams.entries()) {
      url.searchParams.set(key, value)
    }

    const eventSource = new EventSource(url)

    eventSourceRef.current = eventSource

    const handleRow = (event: MessageEvent<string>) => {
      const payload = parseRowEvent(event)

      setRows((currentRows) =>
        upsertViewerRow(currentRows, {
          ...payload.row,
          __datoolRowId: payload.id,
        } as StreamViewerRow<Row>)
      )
    }

    const handleRuntimeError = (event: MessageEvent<string>) => {
      const payload = parseErrorEvent(event)

      setErrorMessage(payload.message)
    }

    const handleEnd = (event: MessageEvent<string>) => {
      parseEndEvent(event)
      eventSource.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onerror = () => {
      setIsConnected(false)
    }

    eventSource.addEventListener("row", handleRow as EventListener)
    eventSource.addEventListener(
      "runtime-error",
      handleRuntimeError as EventListener
    )
    eventSource.addEventListener("end", handleEnd as EventListener)

    return () => {
      eventSource.removeEventListener("row", handleRow as EventListener)
      eventSource.removeEventListener(
        "runtime-error",
        handleRuntimeError as EventListener
      )
      eventSource.removeEventListener("end", handleEnd as EventListener)
      eventSource.close()
      setIsConnected(false)
    }
  }, [activeSource, queryString, shouldConnect])

  React.useEffect(() => {
    setShouldConnect(activeSource?.supportsLive ?? activeSource?.supportsStream ?? false)
  }, [activeSource?.id, activeSource?.supportsLive, activeSource?.supportsStream])

  return {
    activeSource,
    activeStream: activeSource,
    canFetchRows: activeSource?.supportsGet ?? false,
    canLiveUpdate: activeSource?.supportsLive ?? activeSource?.supportsStream ?? false,
    canStream: activeSource?.supportsLive ?? activeSource?.supportsStream ?? false,
    errorMessage,
    isConnected,
    isConnecting: shouldConnect && !isConnected,
    rows,
    setErrorMessage,
    setRows,
    setShouldConnect,
    shouldConnect,
  }
}

export const useDatoolStream = useDatoolSource
