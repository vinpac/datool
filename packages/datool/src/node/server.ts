import fs from "fs"
import fsPromises from "fs/promises"
import path from "path"

import { getStreamFromConfig, loadDatoolConfig, toClientConfig } from "./config"
import { openStreamRuntime } from "./runtime"
import type {
  DatoolActionRequest,
  DatoolActionRowChange,
  DatoolActionResolveResult,
  DatoolActionResponse,
  DatoolConfig,
  DatoolSseEndEvent,
  DatoolSseErrorEvent,
} from "../shared/types"

type StartServerOptions = {
  configPath?: string
  cwd?: string
  host?: string
  port?: number
}

export type DatoolServerHandle = {
  config: DatoolConfig
  configPath: string
  host: string
  port: number
  stop: () => void
  url: string
}

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
} as const

function packageRootFromImportMeta() {
  return path.resolve(import.meta.dir, "..", "..")
}

async function loadClientIndexHtml(packageRoot: string) {
  const indexPath = path.join(packageRoot, "client-dist", "index.html")

  return fsPromises.readFile(indexPath, "utf8")
}

function getClientAssetPath(packageRoot: string, pathname: string) {
  const clientRoot = path.join(packageRoot, "client-dist")
  const absolutePath = path.resolve(clientRoot, pathname.replace(/^\/+/, ""))

  if (!absolutePath.startsWith(clientRoot)) {
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
  config: DatoolConfig,
  streamId: string,
  actionId: string,
  query: URLSearchParams,
  request: Request
) {
  const stream = getStreamFromConfig(config, streamId)

  if (!stream) {
    return jsonResponse(
      {
        error: `Unknown stream "${streamId}".`,
      },
      404
    )
  }

  const action = stream.actions?.[actionId]

  if (!action) {
    return jsonResponse(
      {
        error: `Unknown action "${actionId}" for stream "${streamId}".`,
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
  config: DatoolConfig,
  streamId: string,
  query: URLSearchParams,
  requestSignal: AbortSignal
) {
  const stream = getStreamFromConfig(config, streamId)

  if (!stream) {
    return jsonResponse(
      {
        error: `Unknown stream "${streamId}".`,
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
      }, 15_000)

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

export async function startDatoolServer(
  options: StartServerOptions = {}
): Promise<DatoolServerHandle> {
  const cwd = options.cwd ?? process.cwd()
  const packageRoot = packageRootFromImportMeta()
  const { config, configPath } = await loadDatoolConfig({
    configPath: options.configPath,
    cwd,
  })
  const host = options.host ?? config.server?.host ?? "127.0.0.1"
  const port = options.port ?? config.server?.port ?? 3210
  const indexHtml = await loadClientIndexHtml(packageRoot)
  const server = Bun.serve({
    async fetch(request) {
      const url = new URL(request.url)

      if (url.pathname === "/api/config") {
        return jsonResponse(toClientConfig(config))
      }

      if (
        url.pathname.startsWith("/api/streams/") &&
        url.pathname.endsWith("/events")
      ) {
        const streamId = decodeURIComponent(
          url.pathname
            .slice("/api/streams/".length, -"/events".length)
            .replace(/\/+$/, "")
        )
        const query = new URLSearchParams(url.searchParams)

        query.delete("stream")

        return createSseResponse(config, streamId, query, request.signal)
      }

      if (
        request.method === "POST" &&
        url.pathname.startsWith("/api/streams/") &&
        url.pathname.includes("/actions/")
      ) {
        const pathMatch = url.pathname.match(
          /^\/api\/streams\/(.+?)\/actions\/(.+?)\/?$/
        )

        if (!pathMatch) {
          return new Response("Not found", {
            status: 404,
          })
        }

        const streamId = decodeURIComponent(pathMatch[1] ?? "")
        const actionId = decodeURIComponent(pathMatch[2] ?? "")
        const query = new URLSearchParams(url.searchParams)

        query.delete("stream")

        return createActionResponse(config, streamId, actionId, query, request)
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(indexHtml, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        })
      }

      const assetPath = getClientAssetPath(packageRoot, url.pathname)

      if (assetPath && fs.existsSync(assetPath)) {
        return new Response(Bun.file(assetPath))
      }

      return new Response("Not found", {
        status: 404,
      })
    },
    hostname: host,
    port,
  })
  const resolvedPort = server.port ?? port

  return {
    config,
    configPath,
    host,
    port: resolvedPort,
    stop: () => server.stop(true),
    url: `http://${host}:${resolvedPort}`,
  }
}
