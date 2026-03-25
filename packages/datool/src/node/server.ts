import fs from "fs"
import fsPromises from "fs/promises"
import path from "path"

import { buildDatoolClient } from "./client"
import { getStreamFromApp, loadDatoolApp, toClientConfig } from "./app"
import { getClientDistDirectory } from "./generated"
import { DatoolInputError, getStreamRows, openStreamRuntime } from "./runtime"
import type {
  DatoolActionRequest,
  DatoolActionRowChange,
  DatoolActionResolveResult,
  DatoolActionResponse,
  DatoolApp,
  DatoolSseEndEvent,
  DatoolSseErrorEvent,
} from "../shared/types"

type StartServerOptions = {
  clientMode?: "auto" | "skip"
  cwd?: string
  host?: string
  port?: number
  streamsPath?: string
}

export type DatoolServerHandle = {
  app: DatoolApp
  host: string
  port: number
  stop: () => void
  streamsPath: string
  url: string
}

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
} as const

const MAX_PORT_ATTEMPTS = 10
const SSE_HEARTBEAT_INTERVAL_MS = 5_000

async function loadClientIndexHtml(clientDistDirectory: string) {
  const indexPath = path.join(clientDistDirectory, "index.html")

  return fsPromises.readFile(indexPath, "utf8")
}

function getClientAssetPath(clientDistDirectory: string, pathname: string) {
  const absolutePath = path.resolve(
    clientDistDirectory,
    pathname.replace(/^\/+/, "")
  )

  if (!absolutePath.startsWith(clientDistDirectory)) {
    return null
  }

  return absolutePath
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
  })
}

function toErrorPayload(error: unknown): DatoolSseErrorEvent {
  if (error instanceof Error) {
    return {
      message: error.message,
    }
  }

  return {
    message: String(error),
  }
}

function toEndPayload(reason: DatoolSseEndEvent["reason"]): DatoolSseEndEvent {
  return {
    reason,
  }
}

function encodeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function isAddressInUseError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "EADDRINUSE"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function toActionResponsePayload(
  result: DatoolActionResolveResult<Record<string, unknown>>,
  rowCount: number
): DatoolActionResponse {
  if (result === undefined || result === true) {
    return {}
  }

  if (result === null || result === false) {
    return {
      rowChanges: Array<boolean>(rowCount).fill(false),
    }
  }

  if (Array.isArray(result)) {
    if (result.length === 0) {
      return {}
    }

    if (result.length !== rowCount) {
      throw new Error(
        `Action results must return either an empty array or exactly ${rowCount} item${rowCount === 1 ? "" : "s"}.`
      )
    }

    return {
      rowChanges: result.map<boolean | Record<string, unknown>>((change, index) =>
        normalizeActionRowChange(change, index)
      ),
    }
  }

  throw new Error(
    "Action results must return true, false, null, undefined, or an array of row changes."
  )
}

function normalizeActionRowChange(
  change: DatoolActionRowChange<Record<string, unknown>>,
  index: number
) {
  if (change === undefined || change === true) {
    return true
  }

  if (change === null || change === false) {
    return false
  }

  if (isRecord(change)) {
    return change
  }

  throw new Error(
    `Action result at index ${index} must be a row object, true, false, null, or undefined.`
  )
}

async function resolveActionResponsePayload(
  result: DatoolActionResolveResult<Record<string, unknown>>,
  rowCount: number
) {
  try {
    return toActionResponsePayload(result, rowCount)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function createActionResponse(
  app: DatoolApp,
  streamId: string,
  actionId: string,
  query: URLSearchParams,
  request: Request
) {
  const stream = getStreamFromApp(app, streamId)

  if (!stream) {
    return jsonResponse(
      {
        error: `Unknown source "${streamId}".`,
      },
      404
    )
  }

  const action = stream.actions?.[actionId]

  if (!action) {
    return jsonResponse(
      {
        error: `Unknown action "${actionId}" for source "${streamId}".`,
      },
      404
    )
  }

  let body: DatoolActionRequest

  try {
    body = (await request.json()) as DatoolActionRequest
  } catch {
    return jsonResponse(
      {
        error: "Invalid JSON body.",
      },
      400
    )
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return jsonResponse(
      {
        error: "Action requests must include a non-empty rows array.",
      },
      400
    )
  }

  try {
    const result = await action.resolve({
      actionId,
      query,
      rows: body.rows,
      sourceId: streamId,
      streamId,
    })

    const payload = await resolveActionResponsePayload(result, body.rows.length)

    if ("error" in payload) {
      return jsonResponse(
        {
          error: payload.error,
        },
        500
      )
    }

    return jsonResponse(payload)
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
}

function createSseResponse(
  app: DatoolApp,
  streamId: string,
  query: URLSearchParams,
  requestSignal: AbortSignal
) {
  const stream = getStreamFromApp(app, streamId)

  if (!stream) {
    return jsonResponse(
      {
        error: `Unknown source "${streamId}".`,
      },
      404
    )
  }

  const responseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const abortController = new AbortController()

      const forwardAbort = () => abortController.abort()

      requestSignal.addEventListener("abort", forwardAbort, {
        once: true,
      })

      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event, payload)))
      }

      const heartbeat = setInterval(() => {
        if (!abortController.signal.aborted) {
          send("heartbeat", { ok: true })
        }
      }, SSE_HEARTBEAT_INTERVAL_MS)

      void openStreamRuntime(
        streamId,
        stream,
        query,
        abortController.signal,
        {
          async onError(error) {
            send("runtime-error", toErrorPayload(error))
          },
          async onRow(payload) {
            send("row", payload)
          },
        }
      )
        .then(() => {
          if (!abortController.signal.aborted) {
            send("end", toEndPayload("completed"))
          }
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            send("runtime-error", toErrorPayload(error))
            send("end", toEndPayload("error"))
          }
        })
        .finally(() => {
          clearInterval(heartbeat)
          requestSignal.removeEventListener("abort", forwardAbort)
          try {
            controller.close()
          } catch {
            // The client may have already closed the SSE stream.
          }
        })
    },
    cancel() {
      // The request signal already drives stream shutdown.
    },
  })

  return new Response(responseStream, {
    headers: SSE_HEADERS,
  })
}

async function createRowsResponse(
  app: DatoolApp,
  streamId: string,
  query: URLSearchParams,
  requestSignal: AbortSignal
) {
  const stream = getStreamFromApp(app, streamId)

  if (!stream) {
    return jsonResponse(
      {
        error: `Unknown source "${streamId}".`,
      },
      404
    )
  }

  if (!stream.get) {
    return jsonResponse(
      {
        error: `Source "${streamId}" does not define get().`,
      },
      404
    )
  }

  try {
    return jsonResponse(await getStreamRows(streamId, stream, query, requestSignal))
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof DatoolInputError ? 400 : 500
    )
  }
}

export async function startDatoolServer(
  options: StartServerOptions = {}
): Promise<DatoolServerHandle> {
  const cwd = options.cwd ?? process.cwd()
  const clientMode = options.clientMode ?? "auto"
  const { app, streamsPath } = await loadDatoolApp({
    cwd,
    streamsPath: options.streamsPath,
  })
  const host = options.host ?? app.server?.host ?? "127.0.0.1"
  const requestedPort = options.port ?? app.server?.port ?? 4000
  const clientDistDirectory = getClientDistDirectory(cwd)

  if (clientMode === "auto") {
    await buildDatoolClient({
      cwd,
      force: true,
    })
  }

  const indexHtml =
    clientMode === "auto" && fs.existsSync(path.join(clientDistDirectory, "index.html"))
      ? await loadClientIndexHtml(clientDistDirectory)
      : null
  const loadApp = () =>
    loadDatoolApp({
      cwd,
      streamsPath,
    })
  const fetch = async (
    request: Request,
    server: { timeout: (request: Request, seconds: number) => void }
  ) => {
    const url = new URL(request.url)
    const sourcePathPrefix = "/api/sources/"
    const streamPathPrefix = "/api/streams/"
    const sourcePathPrefixInUse = url.pathname.startsWith(sourcePathPrefix)
    const streamPathPrefixInUse = url.pathname.startsWith(streamPathPrefix)
    const resourcePathPrefix = sourcePathPrefixInUse
      ? sourcePathPrefix
      : streamPathPrefixInUse
        ? streamPathPrefix
        : null

    if (url.pathname === "/api/config") {
      const { app: nextApp } = await loadApp()

      return jsonResponse(toClientConfig(nextApp))
    }

    if (
      request.method === "GET" &&
      resourcePathPrefix &&
      url.pathname.endsWith("/rows")
    ) {
      const streamId = decodeURIComponent(
        url.pathname
          .slice(resourcePathPrefix.length, -"/rows".length)
          .replace(/\/+$/, "")
      )
      const query = new URLSearchParams(url.searchParams)

      query.delete("source")
      query.delete("stream")

      const { app: nextApp } = await loadApp()

      return createRowsResponse(nextApp, streamId, query, request.signal)
    }

    if (
      resourcePathPrefix &&
      url.pathname.endsWith("/events")
    ) {
      const streamId = decodeURIComponent(
        url.pathname
          .slice(resourcePathPrefix.length, -"/events".length)
          .replace(/\/+$/, "")
      )
      const query = new URLSearchParams(url.searchParams)

      query.delete("source")
      query.delete("stream")

      const { app: nextApp } = await loadApp()

      server.timeout(request, 0)
      return createSseResponse(nextApp, streamId, query, request.signal)
    }

    if (
      request.method === "POST" &&
      resourcePathPrefix &&
      url.pathname.includes("/actions/")
    ) {
      const actionPathPattern = sourcePathPrefixInUse
        ? /^\/api\/sources\/(.+?)\/actions\/(.+?)\/?$/
        : /^\/api\/streams\/(.+?)\/actions\/(.+?)\/?$/
      const pathMatch = url.pathname.match(actionPathPattern)

      if (!pathMatch) {
        return new Response("Not found", {
          status: 404,
        })
      }

      const streamId = decodeURIComponent(pathMatch[1] ?? "")
      const actionId = decodeURIComponent(pathMatch[2] ?? "")
      const query = new URLSearchParams(url.searchParams)

      query.delete("source")
      query.delete("stream")

      const { app: nextApp } = await loadApp()

      return createActionResponse(nextApp, streamId, actionId, query, request)
    }

    if (!indexHtml) {
      return new Response("Not found", {
        status: 404,
      })
    }

    const assetPath = getClientAssetPath(clientDistDirectory, url.pathname)

    if (assetPath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return new Response(Bun.file(assetPath))
    }

    if (request.method === "GET" || request.method === "HEAD") {
      return new Response(indexHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      })
    }

    return new Response("Not found", {
      status: 404,
    })
  }
  if (requestedPort === 0) {
    const server = Bun.serve({
      fetch,
      hostname: host,
      port: 0,
    })
    const resolvedPort = server.port ?? 0

    return {
      app,
      host,
      port: resolvedPort,
      stop: () => server.stop(true),
      streamsPath,
      url: `http://${host}:${resolvedPort}`,
    }
  }

  const maxPort = Math.min(requestedPort + MAX_PORT_ATTEMPTS - 1, 65_535)
  let server: ReturnType<typeof Bun.serve> | null = null

  for (
    let port = requestedPort;
    port <= maxPort && server === null;
    port += 1
  ) {
    try {
      server = Bun.serve({
        fetch,
        hostname: host,
        port,
      })
    } catch (error) {
      if (isAddressInUseError(error) && port < maxPort) {
        continue
      }

      if (isAddressInUseError(error)) {
        throw new Error(
          `No available ports from ${requestedPort} to ${maxPort}.`
        )
      }

      throw error
    }
  }

  if (!server) {
    throw new Error(`No available ports from ${requestedPort} to ${maxPort}.`)
  }
  const resolvedPort = server.port ?? requestedPort

  return {
    app,
    host,
    port: resolvedPort,
    stop: () => server.stop(true),
    streamsPath,
    url: `http://${host}:${resolvedPort}`,
  }
}
