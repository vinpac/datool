import { commandSource } from "./command.ts"
import type { DatoolSource } from "../../shared/types.ts"

type Resolver<T> = T | ((context: { query: URLSearchParams }) => T)

export type SshSourceOptions = {
  command: Resolver<string>
  host: string
  identityFile?: string
  options?: Record<string, string>
  port?: number
  user?: string
}

function resolveValue<T>(value: Resolver<T>, query: URLSearchParams) {
  if (typeof value === "function") {
    return (value as (context: { query: URLSearchParams }) => T)({
      query,
    })
  }

  return value
}

export function buildSshArgs(
  options: SshSourceOptions,
  query: URLSearchParams
) {
  const sshArgs: string[] = []

  if (options.port) {
    sshArgs.push("-p", String(options.port))
  }

  if (options.identityFile) {
    sshArgs.push("-i", options.identityFile)
  }

  for (const [key, value] of Object.entries(options.options ?? {})) {
    sshArgs.push("-o", `${key}=${value}`)
  }

  const target = options.user ? `${options.user}@${options.host}` : options.host

  sshArgs.push(target, resolveValue(options.command, query))

  return sshArgs
}

export function sshSource(options: SshSourceOptions): DatoolSource {
  return {
    open(context) {
      return commandSource({
        args: buildSshArgs(options, context.query),
        command: "ssh",
      }).open(context)
    },
  }
}
