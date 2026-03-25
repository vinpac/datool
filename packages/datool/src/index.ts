import { commandSource } from "./node/sources/command.ts"
import { fileSource } from "./node/sources/file.ts"
import { sshSource } from "./node/sources/ssh.ts"
import type { DatoolSourceDefinition, DatoolStreamDefinition } from "./shared/types.ts"

export * from "./shared/types.ts"

export function defineStream<
  Row extends Record<string, unknown>,
  TStream extends DatoolStreamDefinition<Row>,
>(stream: TStream) {
  return stream
}

export function defineSource<
  Row extends Record<string, unknown>,
  TSource extends DatoolSourceDefinition<Row>,
>(sourceDefinition: TSource) {
  return sourceDefinition
}

export function source<
  Row extends Record<string, unknown>,
  TSource extends DatoolSourceDefinition<Row>,
>(definition: TSource) {
  return definition
}

export function defineDatoolConfig<TConfig>(config: TConfig) {
  return config
}

export const sources = {
  command: commandSource,
  file: fileSource,
  ssh: sshSource,
}
