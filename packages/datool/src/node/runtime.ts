import type {
  DatoolGetContext,
  DatoolGetRowIdContext,
  DatoolRowsResponse,
  DatoolResolvedSource,
} from "../shared/types"

export type StreamRuntimeEventHandlers = {
  onError: (error: unknown) => void | Promise<void>
  onRow: (payload: {
    id: string
    row: Record<string, unknown>
  }) => void | Promise<void>
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseOptionalInteger(
  value: string | null,
  name: "limit" | "offset" | "page",
  minimum: number
) {
  if (value === null || value === "") {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw new DatoolInputError(`Query param "${name}" must be an integer.`)
  }

  const parsedValue = Number.parseInt(value, 10)

  if (parsedValue < minimum) {
    throw new DatoolInputError(
      `Query param "${name}" must be at least ${minimum}.`
    )
  }

  return parsedValue
}

function normalizeRowsResult(
  streamId: string,
  value: unknown
): {
  nextOffset?: number
  nextPage?: number
  prevOffset?: number
  prevPage?: number
  rows: Record<string, unknown>[]
  total?: number
} {
  if (Array.isArray(value)) {
    return {
      rows: value as Record<string, unknown>[],
    }
  }

  if (!isRecord(value) || !Array.isArray(value.rows)) {
    throw new Error(
      `Source "${streamId}" get() must return an array of rows or an object with a rows array.`
    )
  }

  return {
    nextOffset:
      typeof value.nextOffset === "number" ? value.nextOffset : undefined,
    nextPage: typeof value.nextPage === "number" ? value.nextPage : undefined,
    prevOffset:
      typeof value.prevOffset === "number" ? value.prevOffset : undefined,
    prevPage: typeof value.prevPage === "number" ? value.prevPage : undefined,
    rows: value.rows as Record<string, unknown>[],
    total: typeof value.total === "number" ? value.total : undefined,
  }
}

async function resolveRowId(
  streamId: string,
  index: number,
  line: string | undefined,
  row: Record<string, unknown>,
  query: URLSearchParams,
  getRowId: DatoolResolvedSource<Record<string, unknown>>["getRowId"]
) {
  if (!getRowId) {
    return `${streamId}:${index}`
  }

  return getRowId({
    index,
    line,
    query,
    row,
    sourceId: streamId,
    streamId,
  } satisfies DatoolGetRowIdContext<Record<string, unknown>>)
}

export class DatoolInputError extends Error {}

export async function getStreamRows(
  streamId: string,
  stream: DatoolResolvedSource<Record<string, unknown>>,
  query: URLSearchParams,
  signal: AbortSignal
): Promise<DatoolRowsResponse> {
  if (!stream.get) {
    throw new Error(`Source "${streamId}" does not define get().`)
  }

  const page = parseOptionalInteger(query.get("page"), "page", 1)
  const offset = parseOptionalInteger(query.get("offset"), "offset", 0)
  const limit = parseOptionalInteger(query.get("limit"), "limit", 1)
  const result = normalizeRowsResult(
    streamId,
    await stream.get({
      limit,
      offset,
      page,
      query,
      signal,
      sourceId: streamId,
      streamId,
    } satisfies DatoolGetContext)
  )
  const rows = await Promise.all(
    result.rows.map(async (row, index) => ({
      id: await resolveRowId(
        streamId,
        index,
        undefined,
        row,
        query,
        stream.getRowId
      ),
      row,
    }))
  )

  return {
    nextOffset: result.nextOffset,
    nextPage: result.nextPage,
    prevOffset: result.prevOffset,
    prevPage: result.prevPage,
    rows,
    total: result.total,
  }
}

export async function openStreamRuntime(
  streamId: string,
  stream: DatoolResolvedSource<Record<string, unknown>>,
  query: URLSearchParams,
  signal: AbortSignal,
  handlers: StreamRuntimeEventHandlers
) {
  if (!stream.open) {
    throw new Error(`Source "${streamId}" does not define source.open().`)
  }

  let emittedRowCount = 0
  let queue = Promise.resolve()

  const emit = (line: string) => {
    queue = queue.then(async () => {
      if (signal.aborted) {
        return
      }

      try {
        const parsedRow = await stream.parseLine({
          line,
          query,
          sourceId: streamId,
          streamId,
        })

        if (!parsedRow) {
          return
        }

        const id = await resolveRowId(
          streamId,
          emittedRowCount,
          line,
          parsedRow,
          query,
          stream.getRowId
        )

        emittedRowCount += 1

        await handlers.onRow({
          id,
          row: parsedRow,
        })
      } catch (error) {
        await handlers.onError(new Error(toErrorMessage(error)))
      }
    })
  }

  const cleanup = await stream.open({
    emit,
    query,
    signal,
  })

  await queue

  if (typeof cleanup === "function") {
    await cleanup()
  }
}
