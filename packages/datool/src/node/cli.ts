#!/usr/bin/env bun
import { startDatoolServer } from "./server"

function parseCliArgs(argv: string[]) {
  const parsedArgs: {
    configPath?: string
    host?: string
    port?: number
  } = {}

  for (let index = 0; index < argv.length; index += 1) {
    const currentArg = argv[index]
    const nextArg = argv[index + 1]

    if (currentArg === "--host" && nextArg) {
      parsedArgs.host = nextArg
      index += 1
      continue
    }

    if (currentArg === "--port" && nextArg) {
      parsedArgs.port = Number.parseInt(nextArg, 10)
      index += 1
      continue
    }

    if (currentArg === "--config" && nextArg) {
      parsedArgs.configPath = nextArg
      index += 1
    }
  }

  return parsedArgs
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const server = await startDatoolServer({
    configPath: args.configPath,
    host: args.host,
    port: args.port,
  })

  console.log(`datool ready`)
  console.log(`config: ${server.configPath}`)
  console.log(`url: ${server.url}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)

  console.error(`Failed to start datool: ${message}`)
  process.exit(1)
})
