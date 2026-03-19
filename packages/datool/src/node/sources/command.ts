import { readLinesFromStream } from "../lines"
import type { DatoolSource } from "../../shared/types"

type Resolver<T> = T | ((context: { query: URLSearchParams }) => T)

export type CommandSourceOptions = {
  args?: Resolver<string[]>
  command: Resolver<string>
  cwd?: Resolver<string>
  env?: Resolver<Record<string, string | undefined>>
}

function resolveValue<T>(value: Resolver<T>, query: URLSearchParams) {
  if (typeof value === "function") {
    return (value as (context: { query: URLSearchParams }) => T)({
      query,
    })
  }

  return value
}

function toSpawnArgs(options: CommandSourceOptions, query: URLSearchParams) {
  const command = resolveValue(options.command, query)
  const args = options.args ? resolveValue(options.args, query) : undefined

  if (args && args.length > 0) {
    return [command, ...args]
  }

  return ["/bin/sh", "-lc", command]
}

export function commandSource(options: CommandSourceOptions): DatoolSource {
  return {
    async open(context) {
      const cmd = toSpawnArgs(options, context.query)
      const env = options.env ? resolveValue(options.env, context.query) : undefined
      const cwd = options.cwd ? resolveValue(options.cwd, context.query) : undefined
      const child = Bun.spawn(cmd, {
        cwd,
        env,
        stderr: "pipe",
        stdout: "pipe",
      })

      const abortChild = () => {
        try {
          child.kill()
        } catch {
          // Ignore process termination races during shutdown.
        }
      }

      context.signal.addEventListener("abort", abortChild, {
        once: true,
      })

      try {
        await Promise.all([
          readLinesFromStream(child.stdout, {
            onLine: context.emit,
            signal: context.signal,
          }),
          child.exited,
        ])

        const exitCode = await child.exited

        if (exitCode !== 0 && !context.signal.aborted) {
          const stderrText = await new Response(child.stderr).text()

          throw new Error(
            stderrText.trim() || `Command exited with code ${exitCode}.`
          )
        }
      } finally {
        context.signal.removeEventListener("abort", abortChild)
      }
    },
  }
}
