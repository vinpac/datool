import type {
  DatoolGetRowIdContext,
  DatoolStream,
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

async function resolveRowId(
  streamId: string,
  index: number,
  line: string,
  row: Record<string, unknown>,
  query: URLSearchParams,
  getRowId: DatoolStream<Record<string, unknown>>["getRowId"]
) {
  if (!getRowId) {
    return `${streamId}:${index}`
  }

  return getRowId({
    index,
    line,
    query,
    row,
    streamId,
  } satisfies DatoolGetRowIdContext<Record<string, unknown>>)
}

export async function openStreamRuntime(
  streamId: string,
  stream: DatoolStream<Record<string, unknown>>,
  query: URLSearchParams,
  signal: AbortSignal,
  handlers: StreamRuntimeEventHandlers
) {
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
