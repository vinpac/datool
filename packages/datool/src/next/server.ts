import type { NextRequest } from "next/server"

import {
  createActionResponse,
  createConfigResponse,
  createRowsResponse,
  createSseResponse,
  normalizeDatoolQuery,
} from "../node/api"

function resolveRequiredEnv(name: "DATOOL_APP_ROOT" | "DATOOL_STREAMS_PATH") {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required datool environment variable: ${name}.`)
  }

  return value
}

export function getDatoolRuntimeOptionsFromEnv() {
  return {
    cwd: resolveRequiredEnv("DATOOL_APP_ROOT"),
    streamsPath: resolveRequiredEnv("DATOOL_STREAMS_PATH"),
  }
}

export function handleDatoolConfigRequest() {
  const options = getDatoolRuntimeOptionsFromEnv()

  return createConfigResponse(options)
}

export function handleDatoolSourceRowsRequest(
  request: NextRequest,
  sourceId: string
) {
  const options = getDatoolRuntimeOptionsFromEnv()

  return createRowsResponse({
    ...options,
    query: normalizeDatoolQuery(request.nextUrl.searchParams),
    requestSignal: request.signal,
    sourceId,
  })
}

export function handleDatoolSourceEventsRequest(
  request: NextRequest,
  sourceId: string
) {
  const options = getDatoolRuntimeOptionsFromEnv()

  return createSseResponse({
    ...options,
    query: normalizeDatoolQuery(request.nextUrl.searchParams),
    requestSignal: request.signal,
    sourceId,
  })
}

export function handleDatoolSourceActionRequest(
  request: NextRequest,
  sourceId: string,
  actionId: string
) {
  const options = getDatoolRuntimeOptionsFromEnv()

  return createActionResponse({
    ...options,
    actionId,
    query: normalizeDatoolQuery(request.nextUrl.searchParams),
    request,
    sourceId,
  })
}
