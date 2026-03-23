import fs from "fs"
import path from "path"

import { build } from "vite"

import { loadDatoolApp } from "./app"
import {
  getClientDistDirectory,
  getGeneratedManifestPath,
  writeDatoolManifest,
} from "./generated"

function packageRootFromImportMeta() {
  return path.resolve(import.meta.dir, "..", "..")
}

function withDatoolClientEnv<T>(
  options: {
    apiProxyTarget?: string
    appRoot: string
    clientOutDir: string
    manifestPath: string
  },
  callback: () => Promise<T>
) {
  const previousValues = {
    DATOOL_API_PROXY_TARGET: process.env.DATOOL_API_PROXY_TARGET,
    DATOOL_APP_ROOT: process.env.DATOOL_APP_ROOT,
    DATOOL_CLIENT_OUTDIR: process.env.DATOOL_CLIENT_OUTDIR,
    DATOOL_MANIFEST_PATH: process.env.DATOOL_MANIFEST_PATH,
  }

  process.env.DATOOL_API_PROXY_TARGET = options.apiProxyTarget
  process.env.DATOOL_APP_ROOT = options.appRoot
  process.env.DATOOL_CLIENT_OUTDIR = options.clientOutDir
  process.env.DATOOL_MANIFEST_PATH = options.manifestPath

  return callback().finally(() => {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })
}

function withDatoolClientEnvSync<T>(
  options: {
    apiProxyTarget?: string
    appRoot: string
    clientOutDir: string
    manifestPath: string
  },
  callback: () => T
) {
  const previousValues = {
    DATOOL_API_PROXY_TARGET: process.env.DATOOL_API_PROXY_TARGET,
    DATOOL_APP_ROOT: process.env.DATOOL_APP_ROOT,
    DATOOL_CLIENT_OUTDIR: process.env.DATOOL_CLIENT_OUTDIR,
    DATOOL_MANIFEST_PATH: process.env.DATOOL_MANIFEST_PATH,
  }

  process.env.DATOOL_API_PROXY_TARGET = options.apiProxyTarget
  process.env.DATOOL_APP_ROOT = options.appRoot
  process.env.DATOOL_CLIENT_OUTDIR = options.clientOutDir
  process.env.DATOOL_MANIFEST_PATH = options.manifestPath

  try {
    return callback()
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

export async function generateDatoolManifest(cwd: string) {
  const { app } = await loadDatoolApp({
    cwd,
  })

  return writeDatoolManifest({
    cwd,
    pages: app.pages,
  })
}

export async function buildDatoolClient(options: {
  cwd: string
  force?: boolean
}) {
  const manifestPath = await generateDatoolManifest(options.cwd)
  const clientOutDir = getClientDistDirectory(options.cwd)
  const indexPath = path.join(clientOutDir, "index.html")

  if (!options.force && fs.existsSync(indexPath)) {
    return {
      clientOutDir,
      manifestPath,
    }
  }

  await withDatoolClientEnv(
    {
      appRoot: options.cwd,
      clientOutDir,
      manifestPath,
    },
    async () => {
      await build({
        configFile: path.join(packageRootFromImportMeta(), "vite.config.ts"),
        mode: "production",
        root: packageRootFromImportMeta(),
      })
    }
  )

  return {
    clientOutDir,
    manifestPath,
  }
}

export function watchDatoolManifest(options: {
  cwd: string
  onError?: (error: unknown) => void
}) {
  const appDirectory = path.join(options.cwd, "datool")
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const writeManifest = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      void generateDatoolManifest(options.cwd).catch((error) => {
        options.onError?.(error)
      })
    }, 50)
  }

  const watcher = fs.watch(
    appDirectory,
    {
      recursive: true,
    },
    () => {
      writeManifest()
    }
  )

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    watcher.close()
  }
}

export async function startDatoolViteDevServer(options: {
  apiProxyTarget: string
  cwd: string
  host: string
  port: number
}) {
  const manifestPath =
    fs.existsSync(getGeneratedManifestPath(options.cwd))
      ? getGeneratedManifestPath(options.cwd)
      : await generateDatoolManifest(options.cwd)
  const clientOutDir = getClientDistDirectory(options.cwd)
  const viteConfigPath = path.join(packageRootFromImportMeta(), "vite.config.ts")
  return withDatoolClientEnvSync(
    {
      apiProxyTarget: options.apiProxyTarget,
      appRoot: options.cwd,
      clientOutDir,
      manifestPath,
    },
    () =>
      Bun.spawn(
        [
          process.execPath,
          "x",
          "vite",
          "--config",
          viteConfigPath,
          "--host",
          options.host,
          "--port",
          String(options.port),
        ],
        {
          cwd: packageRootFromImportMeta(),
          env: {
            ...process.env,
            DATOOL_API_PROXY_TARGET: options.apiProxyTarget,
            DATOOL_APP_ROOT: options.cwd,
            DATOOL_CLIENT_OUTDIR: clientOutDir,
            DATOOL_MANIFEST_PATH: manifestPath,
          },
          stderr: "inherit",
          stdout: "inherit",
        }
      )
  )
}
