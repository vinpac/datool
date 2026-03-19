export type SplitLinesResult = {
  lines: string[]
  remainder: string
}

export function splitLines(input: string): SplitLinesResult {
  if (!input) {
    return {
      lines: [],
      remainder: "",
    }
  }

  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const parts = normalized.split("\n")
  const remainder = parts.pop() ?? ""

  return {
    lines: parts,
    remainder,
  }
}

export async function readLinesFromStream(
  stream: ReadableStream<Uint8Array>,
  options: {
    onLine: (line: string) => void | Promise<void>
    signal: AbortSignal
  }
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let remainder = ""

  try {
    while (!options.signal.aborted) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      remainder += decoder.decode(value, {
        stream: true,
      })

      const splitResult = splitLines(remainder)

      remainder = splitResult.remainder

      for (const line of splitResult.lines) {
        await options.onLine(line)
      }
    }

    remainder += decoder.decode()

    if (remainder) {
      await options.onLine(remainder)
    }
  } finally {
    reader.releaseLock()
  }
}

export function waitForDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort)
      resolve()
    }, ms)

    const handleAbort = () => {
      clearTimeout(timeout)
      resolve()
    }

    signal.addEventListener("abort", handleAbort, {
      once: true,
    })
  })
}
