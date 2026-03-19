import { commandSource } from "./node/sources/command"
import { fileSource } from "./node/sources/file"
import { sshSource } from "./node/sources/ssh"
import type { DatoolConfig } from "./shared/types"

export * from "./shared/types"
export { startDatoolServer } from "./node/server"

export function defineDatoolConfig<TConfig extends DatoolConfig>(
  config: TConfig
) {
  return config
}

export const sources = {
  command: commandSource,
  file: fileSource,
  ssh: sshSource,
}
