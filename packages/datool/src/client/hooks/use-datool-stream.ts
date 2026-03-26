"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

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

async function fetchSourceRows<Row extends Record<string, unknown>>(
  activeSource: DatoolClientSource,
  queryString: string,
  signal: AbortSignal
): Promise<Array<StreamViewerRow<Row>>> {
  const url = new URL(
    `/api/sources/${encodeURIComponent(activeSource.id)}/rows`,
    window.location.origin
  )
  const currentParams = new URLSearchParams(queryString)

  for (const [key, value] of currentParams.entries()) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, { signal })
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

  return payload.rows.map(
    ({ id, row }: DatoolRowsResponse<Row>["rows"][number]) =>
      ({
        ...row,
        __datoolRowId: id,
      }) as StreamViewerRow<Row>
  )
}

export function useDatoolSource<Row extends Record<string, unknown>>(
  source: string,
  initialRows?: Array<StreamViewerRow<Row>>
) {
  const location = useDatoolNavigation()
  const { sourceById } = useDatoolAppConfig()
  const activeSource = (sourceById.get(source) as DatoolClientSource | undefined) ?? null
  const initialRowsRef = React.useRef(initialRows)
  const [rows, setRows] = React.useState<Array<StreamViewerRow<Row>>>(
    () => initialRows ?? []
  )
  const [shouldConnect, setShouldConnect] = React.useState(
    () => activeSource?.supportsLive ?? activeSource?.supportsStream ?? true
  )
  const [isConnected, setIsConnected] = React.useState(false)
  const [sseErrorMessage, setSseErrorMessage] = React.useState<string | null>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const queryString = location.search

  // REST polling via react-query
  const rowsQuery = useQuery({
    queryKey: ["datool-rows", source, queryString],
    queryFn: ({ signal }) =>
      fetchSourceRows<Row>(activeSource!, queryString, signal),
    enabled: !!activeSource?.supportsGet,
    refetchInterval: activeSource?.pollIntervalMs || false,
  })

  // Sync REST data into local rows state
  React.useEffect(() => {
    if (rowsQuery.data) {
      setRows(rowsQuery.data)
    }
  }, [rowsQuery.data])

  // Reset on source/query change
  React.useEffect(() => {
    if (!activeSource) {
      setRows(initialRowsRef.current ?? [])
      setSseErrorMessage(`Unknown source "${source}".`)
      setIsConnected(false)
      return
    }

    setSseErrorMessage(null)

    if (!activeSource.supportsGet) {
      setRows(initialRowsRef.current ?? [])
    }
  }, [activeSource, queryString, source])

  // SSE streaming
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

      setSseErrorMessage(payload.message)
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

  const errorMessage = sseErrorMessage ?? (rowsQuery.error ? rowsQuery.error.message : null)

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
    setErrorMessage: setSseErrorMessage,
    setRows,
    setShouldConnect,
    shouldConnect,
  }
}

export const useDatoolStream = useDatoolSource
