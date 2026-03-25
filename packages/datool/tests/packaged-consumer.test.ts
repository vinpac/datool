import fs from "fs/promises"
import net from "node:net"
import os from "os"
import path from "path"

import { afterEach, describe, expect, test } from "bun:test"

const tempDirs: string[] = []
const workspaceRoot = path.resolve(import.meta.dir, "..", "..", "..")
const packageRoot = path.join(workspaceRoot, "packages", "datool")

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
    env: options.env,
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

function startServer(options: {
  cwd: string
  port: number
}) {
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const child = Bun.spawn(
    [process.execPath, "x", "datool", "serve", "--port", String(options.port)],
    {
      cwd: options.cwd,
      env: {
        ...process.env,
      },
      stderr: "pipe",
      stdout: "pipe",
    }
  )

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

describe("packaged consumer smoke test", () => {
  test(
    "packed datool installs into a fresh project and can build and serve",
    async () => {
      const tempDir = await createTempDir()
      const packDir = path.join(tempDir, "pack")
      const consumerDir = path.join(tempDir, "consumer")

      await fs.mkdir(packDir, {
        recursive: true,
      })
      await fs.mkdir(path.join(consumerDir, ".datool"), {
        recursive: true,
      })

      const packed = await runCommand({
        args: ["npm", "pack", "--json", "--pack-destination", packDir],
        cwd: packageRoot,
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
            dependencies: {
              datool: `file:${tarballPath}`,
            },
            devDependencies: {
              typescript: "^5.9.3",
            },
            name: "datool-packaged-consumer",
            private: true,
            type: "module",
          },
          null,
          2
        ),
        "utf8"
      )

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
        args: [process.execPath, "install"],
        cwd: consumerDir,
      })

      await runCommand({
        args: [process.execPath, "x", "datool", "build"],
        cwd: consumerDir,
      })

      const port = await reservePort()
      const server = startServer({
        cwd: consumerDir,
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
    },
    180_000
  )
})
