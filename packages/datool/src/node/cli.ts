#!/usr/bin/env bun
import path from "path"

import {
  buildDatoolNextProject,
  startDatoolNextDevServer,
  startDatoolNextServer,
  watchDatoolNextApp,
} from "./next"

function parseCliArgs(argv: string[]) {
  const parsedArgs: {
    command: "build" | "dev" | "serve"
    frontendHost?: string
    ignoreTypecheck?: boolean
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

    if (currentArg === "--no-typecheck") {
      parsedArgs.ignoreTypecheck = true
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
  const host = args.frontendHost ?? "127.0.0.1"
  const port = args.frontendPort ?? 4000
  const nextServer = await startDatoolNextServer({
    cwd: process.cwd(),
    host,
    ignoreTypecheck: args.ignoreTypecheck,
    port,
    streamsPath: args.streamsPath,
  })
  const url = `http://${host}:${port}`

  console.log("datool ready")
  console.log(`sources: ${nextServer.generated.streamsPath}`)
  console.log(`app: ${nextServer.generated.nextAppDirectory}`)
  console.log(`url: ${url}`)

  const exitCode = await nextServer.process.exited

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

async function startBuildCommand(args: ReturnType<typeof parseCliArgs>) {
  const result = await buildDatoolNextProject({
    cwd: process.cwd(),
    ignoreTypecheck: args.ignoreTypecheck,
    streamsPath: args.streamsPath,
  })

  console.log("datool build complete")
  console.log(`manifest: ${result.manifestPath}`)
  console.log(`config: ${result.clientConfigPath}`)
  console.log(`app: ${result.nextAppDirectory}`)

  console.log(`sources: ${result.streamsPath}`)
}

async function startDevCommand(args: ReturnType<typeof parseCliArgs>) {
  const host = args.frontendHost ?? "127.0.0.1"
  const frontendPort = args.frontendPort ?? 4000
  const nextServer = await startDatoolNextDevServer({
    cwd: process.cwd(),
    host,
    ignoreTypecheck: args.ignoreTypecheck,
    port: frontendPort,
    streamsPath: args.streamsPath,
  })
  const closeGeneratedWatcher = watchDatoolNextApp({
    cwd: process.cwd(),
    onError(error) {
      const message = error instanceof Error ? error.message : String(error)

      console.error(`Next app generation failed: ${message}`)
    },
    streamsPath: args.streamsPath,
  })
  let hasClosed = false

  const close = () => {
    if (hasClosed) {
      return
    }

    hasClosed = true
    closeGeneratedWatcher()

    try {
      nextServer.process.kill()
    } catch {
      // Ignore duplicate shutdown races.
    }
  }

  process.on("SIGINT", close)
  process.on("SIGTERM", close)

  console.log("datool dev ready")
  console.log(`sources: ${nextServer.generated.streamsPath}`)
  console.log(`app: ${nextServer.generated.nextAppDirectory}`)
  console.log(`url: http://${host}:${frontendPort}`)

  const exitCode = await nextServer.process.exited

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
