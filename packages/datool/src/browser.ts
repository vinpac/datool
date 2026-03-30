import type { CommandSourceOptions } from "./node/sources/command.ts"
import type { FileSourceOptions } from "./node/sources/file.ts"
import type { SshSourceOptions } from "./node/sources/ssh.ts"
import type {
  DatoolSource,
  DatoolSourceDefinition,
  DatoolStreamDefinition,
} from "./shared/types.ts"

export * from "./root-public.tsx"
export * from "./shared/types.ts"

export function defineStream<
  Row extends Record<string, unknown>,
  TStream extends DatoolStreamDefinition<Row> = DatoolStreamDefinition<Row>,
>(stream: TStream) {
  return stream
}

export function defineSource<
  Row extends Record<string, unknown>,
  TSource extends DatoolSourceDefinition<Row> = DatoolSourceDefinition<Row>,
>(sourceDefinition: TSource) {
  return sourceDefinition
}

export function source<
  Row extends Record<string, unknown>,
  TSource extends DatoolSourceDefinition<Row> = DatoolSourceDefinition<Row>,
>(definition: TSource) {
  return definition
}

export function defineDatoolConfig<TConfig>(config: TConfig) {
  return config
}

function unsupportedBrowserSource(sourceName: string): DatoolSource {
  throw new Error(
    `datool sources.${sourceName} is only available in Node runtimes. Import it from server-side code such as .datool/sources.ts instead of a client bundle.`
  )
}

export const sources = {
  command(_options: CommandSourceOptions) {
    return unsupportedBrowserSource("command")
  },
  file(_options: FileSourceOptions) {
    return unsupportedBrowserSource("file")
  },
  ssh(_options: SshSourceOptions) {
    return unsupportedBrowserSource("ssh")
  },
}
