import fs from "fs"
import path from "path"
import { createRequire } from "module"

import { loadDatoolApp, resolveDatoolAppDirectory, toClientConfig } from "./app"
import {
  getGeneratedNextAppDirectory,
  getGeneratedNextClientConfigPath,
  getGeneratedNextManifestPath,
  writeDatoolNextApp,
  writeDatoolNextClientConfig,
  writeDatoolNextManifest,
} from "./generated"

function resolveNextBinPath() {
  const require = createRequire(import.meta.url)

  return require.resolve("next/dist/bin/next")
}

function resolveNodeBinPath() {
  const nodePath = Bun.which("node")

  if (!nodePath) {
    throw new Error(
      "Could not find a Node.js executable on PATH. datool's Next.js runtime requires node."
    )
  }

  return nodePath
}

export async function generateDatoolNextApp(options: {
  cwd: string
  streamsPath?: string
}) {
  const { app } = await loadDatoolApp({
    cwd: options.cwd,
    streamsPath: options.streamsPath,
  })

  await writeDatoolNextApp({
    cwd: options.cwd,
  })
  const manifestPath = await writeDatoolNextManifest({
    cwd: options.cwd,
    pages: app.pages,
  })
  const clientConfigPath = await writeDatoolNextClientConfig({
    config: toClientConfig(app),
    cwd: options.cwd,
  })

  return {
    clientConfigPath,
    manifestPath,
    nextAppDirectory: getGeneratedNextAppDirectory(options.cwd),
    streamsPath: app.streamsPath,
  }
}

export function watchDatoolNextApp(options: {
  cwd: string
  onError?: (error: unknown) => void
  streamsPath?: string
}) {
  const appDirectory = options.streamsPath
    ? path.dirname(options.streamsPath)
    : resolveDatoolAppDirectory(options.cwd)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const writeGeneratedFiles = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      void generateDatoolNextApp({
        cwd: options.cwd,
        streamsPath: options.streamsPath,
      }).catch((error) => {
        options.onError?.(error)
      })
    }, 50)
  }

  const watcher = fs.watch(
    appDirectory,
    {
      recursive: true,
    },
    (_, filename) => {
      const relativePath = filename?.toString()
      const [rootSegment] = relativePath
        ? relativePath.split(path.sep)
        : []

      if (rootSegment === "generated") {
        return
      }

      writeGeneratedFiles()
    }
  )

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    watcher.close()
  }
}

function createNextEnv(options: {
  cwd: string
  host?: string
  ignoreTypecheck?: boolean
  port?: number
  streamsPath: string
}) {
  const nodeEnv = process.env.NODE_ENV
  const normalizedNodeEnv =
    nodeEnv === "development" || nodeEnv === "production" || nodeEnv === "test"
      ? nodeEnv
      : undefined

  return {
    ...process.env,
    DATOOL_APP_ROOT: options.cwd,
    DATOOL_IGNORE_TYPECHECK: options.ignoreTypecheck ? "1" : undefined,
    DATOOL_STREAMS_PATH: options.streamsPath,
    HOSTNAME: options.host,
    NODE_ENV: normalizedNodeEnv,
    PORT: options.port ? String(options.port) : process.env.PORT,
  }
}

async function spawnNextProcess(options: {
  command: "build" | "dev" | "start"
  cwd: string
  host?: string
  ignoreTypecheck?: boolean
  port?: number
  streamsPath?: string
}) {
  const generated = await generateDatoolNextApp({
    cwd: options.cwd,
    streamsPath: options.streamsPath,
  })
  const nodeBinPath = resolveNodeBinPath()
  const nextBinPath = resolveNextBinPath()
  const args = [nodeBinPath, nextBinPath, options.command]

  if (options.host) {
    args.push("--hostname", options.host)
  }

  if (options.port) {
    args.push("--port", String(options.port))
  }

  return {
    generated,
    process: Bun.spawn(args, {
      cwd: generated.nextAppDirectory,
      env: createNextEnv({
        cwd: options.cwd,
        host: options.host,
        ignoreTypecheck: options.ignoreTypecheck,
        port: options.port,
        streamsPath: generated.streamsPath,
      }),
      stderr: "inherit",
      stdout: "inherit",
    }),
  }
}

export async function buildDatoolNextProject(options: {
  cwd: string
  host?: string
  ignoreTypecheck?: boolean
  port?: number
  streamsPath?: string
}) {
  const { generated, process: child } = await spawnNextProcess({
    command: "build",
    cwd: options.cwd,
    ignoreTypecheck: options.ignoreTypecheck,
    streamsPath: options.streamsPath,
  })
  const exitCode = await child.exited

  if (exitCode !== 0) {
    throw new Error(`Next.js build exited with code ${exitCode}.`)
  }

  return {
    clientConfigPath: getGeneratedNextClientConfigPath(options.cwd),
    manifestPath: getGeneratedNextManifestPath(options.cwd),
    nextAppDirectory: generated.nextAppDirectory,
    streamsPath: generated.streamsPath,
  }
}

export async function startDatoolNextDevServer(options: {
  cwd: string
  host: string
  ignoreTypecheck?: boolean
  port: number
  streamsPath?: string
}) {
  return spawnNextProcess({
    command: "dev",
    cwd: options.cwd,
    host: options.host,
    ignoreTypecheck: options.ignoreTypecheck,
    port: options.port,
    streamsPath: options.streamsPath,
  })
}

export async function startDatoolNextServer(options: {
  cwd: string
  host: string
  ignoreTypecheck?: boolean
  port: number
  streamsPath?: string
}) {
  const nextAppDirectory = getGeneratedNextAppDirectory(options.cwd)
  const buildIdPath = path.join(nextAppDirectory, ".next", "BUILD_ID")

  if (!fs.existsSync(buildIdPath)) {
    await buildDatoolNextProject(options)
  } else {
    await generateDatoolNextApp({
      cwd: options.cwd,
      streamsPath: options.streamsPath,
    })
  }

  return spawnNextProcess({
    command: "start",
    cwd: options.cwd,
    host: options.host,
    ignoreTypecheck: options.ignoreTypecheck,
    port: options.port,
    streamsPath: options.streamsPath,
  })
}
