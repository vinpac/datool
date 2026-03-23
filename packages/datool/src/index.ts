import { commandSource } from "./node/sources/command"
import { fileSource } from "./node/sources/file"
import { sshSource } from "./node/sources/ssh"

export * from "./shared/types"
export { startDatoolServer } from "./node/server"
export { Table, type DatoolColumns, type DatoolTableProps } from "./client/public"

export function defineStream<TStream>(stream: TStream) {
  return stream
}

export function defineDatoolConfig<TConfig>(config: TConfig) {
  return config
}

export const sources = {
  command: commandSource,
  file: fileSource,
  ssh: sshSource,
}
