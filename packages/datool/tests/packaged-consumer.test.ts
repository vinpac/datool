import fs from "fs/promises"
import net from "node:net"
import os from "os"
import path from "path"

import { afterEach, describe, expect, test } from "bun:test"

const tempDirs: string[] = []
const workspaceRoot = path.resolve(import.meta.dir, "..", "..", "..")
const packageRoot = path.join(workspaceRoot, "packages", "datool")
const workspaceNodeModulesRoot = path.join(workspaceRoot, "node_modules")

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "datool-packaged-"))

  tempDirs.push(tempDir)

  return tempDir
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      fs.rm(tempDir, {
        force: true,
        recursive: true,
      })
    )
  )
})

async function runCommand(options: {
  args: string[]
  cwd: string
  env?: Record<string, string | undefined>
}) {
  const child = Bun.spawn(options.args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stderr: "pipe",
    stdout: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])

  if (exitCode !== 0) {
    throw new Error(
      [
        `Command failed: ${options.args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    )
  }

  return {
    stderr,
    stdout,
  }
}

async function listenOnPort(port: number) {
  const server = net.createServer()

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      reject(error)
    }

    server.once("error", handleError)
    server.listen(port, "127.0.0.1", () => {
      server.off("error", handleError)
      resolve()
    })
  })

  return server
}

async function closeNetServer(server: net.Server) {
  if (!server.listening) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

async function reservePort() {
  const server = await listenOnPort(0)
  const address = server.address()

  if (!address || typeof address === "string") {
    await closeNetServer(server)
    throw new Error("Unable to resolve reserved port.")
  }

  const port = address.port

  await closeNetServer(server)

  return port
}

async function waitForJson(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      const responseText = await response.text()

      if (!response.ok) {
        lastError = new Error(
          `Request failed with status ${response.status}: ${responseText}`
        )
        await Bun.sleep(250)
        continue
      }

      return JSON.parse(responseText) as unknown
    } catch (error) {
      lastError = error
      await Bun.sleep(250)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${url}`)
}

async function waitForText(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      const responseText = await response.text()

      if (!response.ok) {
        lastError = new Error(
          `Request failed with status ${response.status}: ${responseText}`
        )
        await Bun.sleep(250)
        continue
      }

      return responseText
    } catch (error) {
      lastError = error
      await Bun.sleep(250)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${url}`)
}

async function unpackPackageTarball(options: {
  cwd: string
  packageName: string
  tarballPath: string
}) {
  const nodeModulesDir = path.join(options.cwd, "node_modules")

  await fs.mkdir(nodeModulesDir, {
    recursive: true,
  })

  await runCommand({
    args: ["tar", "-xzf", options.tarballPath, "-C", nodeModulesDir],
    cwd: options.cwd,
  })

  await fs.rm(path.join(nodeModulesDir, options.packageName), {
    force: true,
    recursive: true,
  })
  await fs.rename(
    path.join(nodeModulesDir, "package"),
    path.join(nodeModulesDir, options.packageName)
  )
}

async function linkWorkspacePackage(options: {
  consumerDir: string
  packageName: string
}) {
  const sourcePath = path.join(workspaceNodeModulesRoot, ...options.packageName.split("/"))
  const targetPath = path.join(
    options.consumerDir,
    "node_modules",
    ...options.packageName.split("/")
  )

  await fs.mkdir(path.dirname(targetPath), {
    recursive: true,
  })
  await fs.rm(targetPath, {
    force: true,
    recursive: true,
  })
  await fs.symlink(sourcePath, targetPath, "dir")
}

async function installPackedDatool(options: {
  consumerDir: string
  extraWorkspacePackages?: string[]
  tarballPath: string
}) {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8")
  ) as {
    dependencies?: Record<string, string>
  }
  const packageNames = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...(options.extraWorkspacePackages ?? []),
  ])

  await unpackPackageTarball({
    cwd: options.consumerDir,
    packageName: "datool",
    tarballPath: options.tarballPath,
  })

  for (const packageName of packageNames) {
    await linkWorkspacePackage({
      consumerDir: options.consumerDir,
      packageName,
    })
  }
}

function startCommand(options: {
  args: string[]
  cwd: string
  env?: Record<string, string | undefined>
}) {
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const child = Bun.spawn(options.args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stderr: "pipe",
    stdout: "pipe",
  })

  if (child.stdout) {
    void new Response(child.stdout)
      .text()
      .then((output) => {
        if (output) {
          stdoutChunks.push(output)
        }
      })
  }

  if (child.stderr) {
    void new Response(child.stderr)
      .text()
      .then((output) => {
        if (output) {
          stderrChunks.push(output)
        }
      })
  }

  return {
    child,
    getLogs() {
      return {
        stderr: stderrChunks.join(""),
        stdout: stdoutChunks.join(""),
      }
    },
  }
}

function startServer(options: {
  cwd: string
  env?: Record<string, string | undefined>
  port: number
}) {
  return startCommand({
    args: [
      process.execPath,
      path.join(options.cwd, "node_modules", "datool", "dist", "node", "cli.js"),
      "serve",
      "--port",
      String(options.port),
    ],
    cwd: options.cwd,
    env: options.env,
  })
}

async function stopServer(server: ReturnType<typeof startCommand>) {
  try {
    server.child.kill()
  } catch {
    // Ignore shutdown races in cleanup.
  }

  const didExit = await Promise.race([
    server.child.exited.then(() => true),
    Bun.sleep(5_000).then(() => false),
  ])

  if (!didExit) {
    try {
      server.child.kill("SIGKILL")
    } catch {
      // Ignore duplicate shutdown races.
    }

    await server.child.exited
  }
}

describe("packaged consumer smoke test", () => {
  test(
    "packed datool installs into a fresh project and can build and serve",
    async () => {
      const tempDir = await createTempDir()
      const packDir = path.join(tempDir, "pack")
      const consumerDir = path.join(tempDir, "consumer")
      const npmCacheDir = path.join(tempDir, "npm-cache")
      const commandEnv = {
        TMPDIR: tempDir,
      }

      await fs.mkdir(packDir, {
        recursive: true,
      })
      await fs.mkdir(path.join(consumerDir, ".datool"), {
        recursive: true,
      })

      const packed = await runCommand({
        args: ["npm", "pack", "--json", "--pack-destination", packDir],
        cwd: packageRoot,
        env: {
          NPM_CONFIG_CACHE: npmCacheDir,
        },
      })
      const packedArtifacts = JSON.parse(packed.stdout) as Array<{
        filename: string
      }>
      const tarballName = packedArtifacts[0]?.filename

      if (!tarballName) {
        throw new Error(`Unable to resolve packed tarball from:\n${packed.stdout}`)
      }

      const tarballPath = path.join(packDir, tarballName)

      await fs.writeFile(
        path.join(consumerDir, "package.json"),
        JSON.stringify(
          {
            name: "datool-packaged-consumer",
            private: true,
            type: "module",
          },
          null,
          2
        ),
        "utf8"
      )

      await installPackedDatool({
        consumerDir,
        extraWorkspacePackages: [
          "@types/node",
          "@types/react",
          "@types/react-dom",
          "typescript",
        ],
        tarballPath,
      })

      await fs.writeFile(
        path.join(consumerDir, ".datool", "sources.ts"),
        `import { source } from "datool"

export const logs = source({
  get() {
    return {
      rows: [
        {
          level: "info",
          message: "hello from packaged consumer",
          ts: "2026-03-24T00:00:00.000Z",
        },
      ],
      total: 1,
    }
  },
})
`,
        "utf8"
      )

      await fs.writeFile(
        path.join(consumerDir, ".datool", "index.tsx"),
        `import { Table, type DatoolColumn } from "datool"

const columns: DatoolColumn[] = [
  {
    accessorKey: "ts",
    header: "Timestamp",
    kind: "date",
    width: 220,
  },
  {
    accessorKey: "level",
    header: "Level",
    kind: "enum",
    width: 120,
  },
  {
    accessorKey: "message",
    header: "Message",
    width: 320,
  },
]

export default function HomePage() {
  return <Table columns={columns} source="logs" />
}
`,
        "utf8"
      )

      await runCommand({
        args: [
          process.execPath,
          path.join(consumerDir, "node_modules", "datool", "dist", "node", "cli.js"),
          "build",
        ],
        cwd: consumerDir,
        env: commandEnv,
      })

      const port = await reservePort()
      const server = startServer({
        cwd: consumerDir,
        env: commandEnv,
        port,
      })

      try {
        const [config, rowsResponse] = await Promise.all([
          waitForJson(`http://127.0.0.1:${port}/api/config`, 60_000),
          waitForJson(
            `http://127.0.0.1:${port}/api/sources/logs/rows`,
            60_000
          ),
        ])

        expect(config).toEqual(
          expect.objectContaining({
            pages: [
              expect.objectContaining({
                path: "/",
                title: "Home",
              }),
            ],
            sources: [
              expect.objectContaining({
                id: "logs",
                supportsGet: true,
              }),
            ],
          })
        )
        expect(rowsResponse).toEqual(
          expect.objectContaining({
            rows: [
              expect.objectContaining({
                row: expect.objectContaining({
                  message: "hello from packaged consumer",
                }),
              }),
            ],
          })
        )
      } catch (error) {
        const logs = server.getLogs()

        throw new Error(
          [
            error instanceof Error ? error.message : String(error),
            logs.stdout ? `server stdout:\n${logs.stdout}` : "",
            logs.stderr ? `server stderr:\n${logs.stderr}` : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        )
      } finally {
        await stopServer(server)
      }
    },
    180_000
  )

  test(
    "packed datool builds inside a fresh Next app using the composable client API",
    async () => {
      const tempDir = await createTempDir()
      const packDir = path.join(tempDir, "pack")
      const nextAppDir = path.join(tempDir, "next-consumer")
      const npmCacheDir = path.join(tempDir, "npm-cache")
      const commandEnv = {
        TMPDIR: tempDir,
      }

      await fs.mkdir(packDir, {
        recursive: true,
      })
      await fs.mkdir(path.join(nextAppDir, "app"), {
        recursive: true,
      })

      const packed = await runCommand({
        args: ["npm", "pack", "--json", "--pack-destination", packDir],
        cwd: packageRoot,
        env: {
          NPM_CONFIG_CACHE: npmCacheDir,
        },
      })
      const packedArtifacts = JSON.parse(packed.stdout) as Array<{
        filename: string
      }>
      const tarballName = packedArtifacts[0]?.filename

      if (!tarballName) {
        throw new Error(`Unable to resolve packed tarball from:\n${packed.stdout}`)
      }

      const tarballPath = path.join(packDir, tarballName)

      await fs.writeFile(
        path.join(nextAppDir, "package.json"),
        JSON.stringify(
          {
            name: "datool-next-consumer",
            private: true,
            scripts: {
              build: "next build",
              start: "next start",
            },
            type: "module",
          },
          null,
          2
        ),
        "utf8"
      )

      await installPackedDatool({
        consumerDir: nextAppDir,
        extraWorkspacePackages: [
          "@types/node",
          "@types/react",
          "@types/react-dom",
          "typescript",
        ],
        tarballPath,
      })

      await fs.writeFile(
        path.join(nextAppDir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              allowJs: true,
              esModuleInterop: true,
              incremental: true,
              isolatedModules: true,
              jsx: "preserve",
              lib: ["dom", "dom.iterable", "esnext"],
              module: "esnext",
              moduleResolution: "bundler",
              noEmit: true,
              plugins: [{ name: "next" }],
              resolveJsonModule: true,
              skipLibCheck: true,
              strict: true,
              target: "es2017",
            },
            include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          },
          null,
          2
        ),
        "utf8"
      )

      await fs.writeFile(
        path.join(nextAppDir, "next-env.d.ts"),
        `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
        "utf8"
      )

      await fs.writeFile(
        path.join(nextAppDir, "app", "layout.tsx"),
        `import type { ReactNode } from "react"
import "datool/next/styles.css"

export const metadata = {
  title: "Datool Next Consumer",
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
        "utf8"
      )

      await fs.writeFile(
        path.join(nextAppDir, "app", "page.tsx"),
        `'use client'

import * as React from "react"
import {
  ClearButton,
  DatoolDataTable,
  DatoolProvider,
  ErrorMessage,
  RefreshButton,
  SearchFilter,
  type DatoolClientConfig,
  type DatoolColumn,
} from "datool"

type WorkflowRow = {
  __datoolRowId: string
  id: string
  status: "running" | "completed" | "failed" | "queued"
  workflow: string
  duration: number
  startedAt: string
  triggeredBy: string
  branch: string
  commit: string
}

const WORKFLOWS = [
  "deploy-api",
  "run-tests",
  "build-image",
  "lint-check",
  "integration-tests",
  "release-notes",
]
const USERS = ["alice", "bob", "carol", "dave", "eve"]
const BRANCHES = ["main", "feat/auth", "fix/timeout", "refactor/db", "chore/deps"]
const STATUSES: WorkflowRow["status"][] = [
  "running",
  "completed",
  "failed",
  "queued",
]

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function generateRows(count: number) {
  const now = Date.now()

  return Array.from({ length: count }, (_, index) => {
    const startedAt = new Date(
      now - (count - index) * 60_000 - Math.random() * 300_000
    )
    const id = \`run-\${String(index + 1).padStart(4, "0")}\`

    return {
      __datoolRowId: id,
      branch: randomItem(BRANCHES),
      commit: Math.random().toString(36).slice(2, 9),
      duration: Math.round(Math.random() * 300),
      id,
      startedAt: startedAt.toISOString(),
      status: randomItem(STATUSES),
      triggeredBy: randomItem(USERS),
      workflow: randomItem(WORKFLOWS),
    }
  })
}

const config: DatoolClientConfig = {
  pages: [],
  sources: [
    {
      actions: [],
      id: "workflows",
      label: "Workflows",
      supportsGet: false,
      supportsLive: false,
      supportsStream: false,
    },
  ],
  streams: [],
}

type ViewerRow = Record<string, unknown> & { __datoolRowId: string }

const columns: DatoolColumn<ViewerRow>[] = [
  { accessorKey: "id", header: "Run ID", kind: "text", width: 120 },
  {
    accessorKey: "status",
    enumColors: {
      completed: "green",
      failed: "red",
      queued: "zinc",
      running: "sky",
    },
    enumVariant: "outline",
    header: "Status",
    kind: "enum",
    width: 120,
  },
  { accessorKey: "workflow", header: "Workflow", kind: "enum", width: 180 },
  { accessorKey: "duration", header: "Duration (s)", kind: "number", width: 120 },
  { accessorKey: "startedAt", header: "Started At", kind: "date", width: 220 },
  { accessorKey: "triggeredBy", header: "Triggered By", kind: "text", width: 140 },
  { accessorKey: "branch", header: "Branch", kind: "enum", width: 160 },
  { accessorKey: "commit", header: "Commit", kind: "text", width: 100 },
]

const workflowRows = generateRows(24)

export default function ComposableExamplePage() {
  return (
    <DatoolProvider
      config={config}
      defaultSource="workflows"
      sources={{ workflows: { rows: workflowRows } }}
    >
      <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden bg-background pt-3">
        <div className="px-4">
          <h1>Composable API</h1>
        </div>
        <header className="flex w-full flex-wrap items-start justify-between gap-3 px-4">
          <SearchFilter />
          <RefreshButton />
          <ClearButton />
        </header>

        <ErrorMessage />

        <DatoolDataTable columns={columns} />
      </main>
    </DatoolProvider>
  )
}
`,
        "utf8"
      )

      await runCommand({
        args: [
          process.execPath,
          path.join(nextAppDir, "node_modules", "next", "dist", "bin", "next"),
          "build",
        ],
        cwd: nextAppDir,
        env: commandEnv,
      })

      const port = await reservePort()
      const server = startCommand({
        args: [
          process.execPath,
          path.join(nextAppDir, "node_modules", "next", "dist", "bin", "next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        cwd: nextAppDir,
        env: commandEnv,
      })

      try {
        const html = await waitForText(`http://127.0.0.1:${port}`, 60_000)

        expect(html).toContain("Composable API")
        expect(html).toContain("Run ID")
      } catch (error) {
        const logs = server.getLogs()

        throw new Error(
          [
            error instanceof Error ? error.message : String(error),
            logs.stdout ? `server stdout:\n${logs.stdout}` : "",
            logs.stderr ? `server stderr:\n${logs.stderr}` : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        )
      } finally {
        await stopServer(server)
      }
    },
    240_000
  )
})
