import fs from "fs/promises"

import { waitForDelay } from "../lines"
import type { DatoolSource } from "../../shared/types"

type Resolver<T> = T | ((context: { query: URLSearchParams }) => T)

export type FileSourceOptions = {
  defaultHistory?: number
  historyParam?: string
  path: Resolver<string>
  pollIntervalMs?: number
}

function resolveValue<T>(value: Resolver<T>, query: URLSearchParams) {
  if (typeof value === "function") {
    return (value as (context: { query: URLSearchParams }) => T)({
      query,
    })
  }

  return value
}

function normalizeHistoryLineCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.floor(value)
}

function resolveHistoryLineCount(
  query: URLSearchParams,
  historyParam: string,
  defaultHistory: number
) {
  const rawValue = query.get(historyParam)

  if (!rawValue) {
    return normalizeHistoryLineCount(defaultHistory)
  }

  const parsedValue = Number.parseInt(rawValue, 10)

  return normalizeHistoryLineCount(parsedValue)
}

function normalizeLines(content: string) {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
}

async function emitHistoryLines(
  filePath: string,
  lineCount: number,
  emit: (line: string) => void
) {
  if (lineCount <= 0) {
    return
  }

  const content = await fs.readFile(filePath, "utf8")
  const lines = normalizeLines(content).filter(Boolean)

  for (const line of lines.slice(-lineCount)) {
    emit(line)
  }
}

async function readAppendedText(filePath: string, start: number, end: number) {
  const fileHandle = await fs.open(filePath, "r")

  try {
    const length = end - start
    const buffer = Buffer.alloc(length)

    await fileHandle.read(buffer, 0, length, start)

    return buffer.toString("utf8")
  } finally {
    await fileHandle.close()
  }
}

export function fileSource(options: FileSourceOptions): DatoolSource {
  return {
    async open(context) {
      const defaultHistory = options.defaultHistory ?? 0
      const historyParam = options.historyParam ?? "history"
      const pollIntervalMs = options.pollIntervalMs ?? 250
      const filePath = resolveValue(options.path, context.query)
      const historyLineCount = resolveHistoryLineCount(
        context.query,
        historyParam,
        defaultHistory
      )
      let stat = await fs.stat(filePath)
      let position = stat.size
      let remainder = ""

      await emitHistoryLines(filePath, historyLineCount, context.emit)

      while (!context.signal.aborted) {
        stat = await fs.stat(filePath)

        if (stat.size < position) {
          position = 0
          remainder = ""
        }

        if (stat.size > position) {
          const appendedText = await readAppendedText(filePath, position, stat.size)
          const normalized = (remainder + appendedText).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
          const parts = normalized.split("\n")

          remainder = parts.pop() ?? ""
          position = stat.size

          for (const line of parts) {
            if (line.length > 0) {
              context.emit(line)
            }
          }
        }

        await waitForDelay(pollIntervalMs, context.signal)
      }
    },
  }
}
