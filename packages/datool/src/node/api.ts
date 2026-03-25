import type {
  DatoolActionRequest,
  DatoolActionResolveResult,
  DatoolActionResponse,
  DatoolSseEndEvent,
  DatoolSseErrorEvent,
} from "../shared/types"
import { getStreamFromApp, loadDatoolApp, toClientConfig } from "./app"
import { DatoolInputError, getStreamRows, openStreamRuntime } from "./runtime"

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
} as const

const SSE_HEARTBEAT_INTERVAL_MS = 5_000

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
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

function normalizeActionRowChange(
  change: unknown,
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

async function loadApp(options: {
  cwd: string
  streamsPath: string
}) {
  return loadDatoolApp(options)
}

export function normalizeDatoolQuery(
  searchParams: URLSearchParams | Iterable<[string, string]>
) {
  const query =
    searchParams instanceof URLSearchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams(Array.from(searchParams))

  query.delete("source")
  query.delete("stream")

  return query
}

export async function createConfigResponse(options: {
  cwd: string
  streamsPath: string
}) {
  const { app } = await loadApp(options)

  return jsonResponse(toClientConfig(app))
}

export async function createRowsResponse(options: {
  cwd: string
  query: URLSearchParams
  requestSignal: AbortSignal
  sourceId: string
  streamsPath: string
}) {
  const { app } = await loadApp(options)
  const source = getStreamFromApp(app, options.sourceId)

  if (!source) {
    return jsonResponse(
      {
        error: `Unknown source "${options.sourceId}".`,
      },
      404
    )
  }

  if (!source.get) {
    return jsonResponse(
      {
        error: `Source "${options.sourceId}" does not define get().`,
      },
      404
    )
  }

  try {
    return jsonResponse(
      await getStreamRows(
        options.sourceId,
        source,
        options.query,
        options.requestSignal
      )
    )
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof DatoolInputError ? 400 : 500
    )
  }
}

export async function createActionResponse(options: {
  actionId: string
  cwd: string
  query: URLSearchParams
  request: Request
  sourceId: string
  streamsPath: string
}) {
  const { app } = await loadApp(options)
  const source = getStreamFromApp(app, options.sourceId)

  if (!source) {
    return jsonResponse(
      {
        error: `Unknown source "${options.sourceId}".`,
      },
      404
    )
  }

  const action = source.actions?.[options.actionId]

  if (!action) {
    return jsonResponse(
      {
        error: `Unknown action "${options.actionId}" for source "${options.sourceId}".`,
      },
      404
    )
  }

  let body: DatoolActionRequest

  try {
    body = (await options.request.json()) as DatoolActionRequest
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
      actionId: options.actionId,
      query: options.query,
      rows: body.rows,
      sourceId: options.sourceId,
      streamId: options.sourceId,
    })

    const payload = toActionResponsePayload(result, body.rows.length)

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

export async function createSseResponse(options: {
  cwd: string
  query: URLSearchParams
  requestSignal: AbortSignal
  sourceId: string
  streamsPath: string
}) {
  const { app } = await loadApp(options)
  const source = getStreamFromApp(app, options.sourceId)

  if (!source) {
    return jsonResponse(
      {
        error: `Unknown source "${options.sourceId}".`,
      },
      404
    )
  }

  const responseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const abortController = new AbortController()

      const forwardAbort = () => abortController.abort()

      options.requestSignal.addEventListener("abort", forwardAbort, {
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
        options.sourceId,
        source,
        options.query,
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
          options.requestSignal.removeEventListener("abort", forwardAbort)
          try {
            controller.close()
          } catch {
            // The client may have already closed the SSE stream.
          }
        })
    },
  })

  return new Response(responseStream, {
    headers: SSE_HEADERS,
  })
}
