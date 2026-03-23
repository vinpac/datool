#!/usr/bin/env bun
import path from "path"

import { buildDatoolClient, startDatoolViteDevServer, watchDatoolManifest } from "./client"
import { getClientDistDirectory } from "./generated"
import { startDatoolServer } from "./server"

function parseCliArgs(argv: string[]) {
  const parsedArgs: {
    command: "build" | "dev" | "serve"
    frontendHost?: string
    frontendPort?: number
    streamsPath?: string
  } = {
    command: "serve",
  }

  const firstArg = argv[0]

  if (firstArg === "build" || firstArg === "dev" || firstArg === "serve") {
    parsedArgs.command = firstArg
    argv = argv.slice(1)
  }

  for (let index = 0; index < argv.length; index += 1) {
    const currentArg = argv[index]
    const nextArg = argv[index + 1]

    if (currentArg === "--host" && nextArg) {
      parsedArgs.frontendHost = nextArg
      index += 1
      continue
    }

    if (currentArg === "--port" && nextArg) {
      parsedArgs.frontendPort = Number.parseInt(nextArg, 10)
      index += 1
      continue
    }

    if ((currentArg === "--config" || currentArg === "--streams") && nextArg) {
      parsedArgs.streamsPath = path.resolve(nextArg)
      index += 1
    }
  }

  return parsedArgs
}

async function startServeCommand(args: ReturnType<typeof parseCliArgs>) {
  const server = await startDatoolServer({
    cwd: process.cwd(),
    host: args.frontendHost,
    port: args.frontendPort,
    streamsPath: args.streamsPath,
  })

  console.log("datool ready")
  console.log(`streams: ${server.streamsPath}`)
  console.log(`url: ${server.url}`)
}

async function startBuildCommand(args: ReturnType<typeof parseCliArgs>) {
  const result = await buildDatoolClient({
    cwd: process.cwd(),
    force: true,
  })

  console.log("datool build complete")
  console.log(`manifest: ${result.manifestPath}`)
  console.log(`client: ${getClientDistDirectory(process.cwd())}`)

  if (args.streamsPath) {
    console.log(`streams: ${args.streamsPath}`)
  }
}

async function startDevCommand(args: ReturnType<typeof parseCliArgs>) {
  const host = args.frontendHost ?? "127.0.0.1"
  const frontendPort = args.frontendPort ?? 5173
  const backendPort = frontendPort + 1
  const backendServer = await startDatoolServer({
    clientMode: "skip",
    cwd: process.cwd(),
    host,
    port: backendPort,
    streamsPath: args.streamsPath,
  })
  const closeManifestWatcher = watchDatoolManifest({
    cwd: process.cwd(),
    onError(error) {
      const message = error instanceof Error ? error.message : String(error)

      console.error(`Manifest generation failed: ${message}`)
    },
  })
  const viteProcess = await startDatoolViteDevServer({
    apiProxyTarget: backendServer.url,
    cwd: process.cwd(),
    host,
    port: frontendPort,
  })
  let hasClosed = false

  const close = () => {
    if (hasClosed) {
      return
    }

    hasClosed = true
    closeManifestWatcher()
    backendServer.stop()

    try {
      viteProcess.kill()
    } catch {
      // Ignore duplicate shutdown races.
    }
  }

  process.on("SIGINT", close)
  process.on("SIGTERM", close)

  console.log("datool dev ready")
  console.log(`streams: ${backendServer.streamsPath}`)
  console.log(`frontend: http://${host}:${frontendPort}`)
  console.log(`backend: ${backendServer.url}`)

  const exitCode = await viteProcess.exited

  close()

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))

  if (args.command === "build") {
    await startBuildCommand(args)
    return
  }

  if (args.command === "dev") {
    await startDevCommand(args)
    return
  }

  await startServeCommand(args)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)

  console.error(`Failed to start datool: ${message}`)
  process.exit(1)
})
