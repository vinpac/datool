import fs from "fs/promises"
import os from "os"
import path from "path"

import { afterEach, describe, expect, test } from "bun:test"

import { discoverDatoolPages, findStreamsPath, loadDatoolApp, toClientConfig } from "../src/node/app"
import { writeDatoolManifest } from "../src/node/generated"
import { openStreamRuntime } from "../src/node/runtime"

const tempDirs: string[] = []

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "datool-app-"))

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

describe("datool app discovery", () => {
  test("discovers streams, pages, and client config metadata", async () => {
    const tempDir = await createTempDir()
    const datoolDir = path.join(tempDir, "datool")

    await fs.mkdir(path.join(datoolDir, "runs"), {
      recursive: true,
    })
    await fs.writeFile(
      path.join(datoolDir, "streams.ts"),
      `export const dateFormat = {
        dateStyle: "short",
        timeStyle: "medium",
      }

      export const demo = {
        actions: {
          abort: {
            button: "outline",
            icon: "Trash",
            label: "Abort Run",
            resolve({ rows }) {
              return rows.map((row) => ({ ...row, message: "[aborted]" }))
            },
          },
        },
        label: "Demo Stream",
        open({ emit }) { emit('{"message":"hello"}') },
      }`,
      "utf8"
    )
    await fs.writeFile(
      path.join(datoolDir, "index.tsx"),
      `export default function HomePage() { return null }`,
      "utf8"
    )
    await fs.writeFile(
      path.join(datoolDir, "runs", "logs.tsx"),
      `export default function LogsPage() { return null }`,
      "utf8"
    )

    expect(findStreamsPath(tempDir)).toBe(path.join(datoolDir, "streams.ts"))

    const pages = await discoverDatoolPages(tempDir)

    expect(pages.map((page) => page.path)).toEqual(["/", "/runs/logs"])
    expect(pages.map((page) => page.title)).toEqual(["Home", "Logs"])

    const loaded = await loadDatoolApp({
      cwd: tempDir,
    })

    expect(loaded.streamsPath).toBe(path.join(datoolDir, "streams.ts"))
    expect(Object.keys(loaded.app.streams)).toEqual(["demo"])
    expect(loaded.app.dateFormat).toEqual({
      dateStyle: "short",
      timeStyle: "medium",
    })
    expect(toClientConfig(loaded.app)).toEqual({
      dateFormat: {
        dateStyle: "short",
        timeStyle: "medium",
      },
      pages: [
        {
          filePath: path.join(datoolDir, "index.tsx"),
          id: "index",
          path: "/",
          title: "Home",
        },
        {
          filePath: path.join(datoolDir, "runs", "logs.tsx"),
          id: "runs-logs",
          path: "/runs/logs",
          title: "Logs",
        },
      ],
      streams: [
        {
          actions: [
            {
              button: "outline",
              icon: "Trash",
              id: "abort",
              label: "Abort Run",
            },
          ],
          id: "demo",
          label: "Demo Stream",
        },
      ],
    })
  })

  test("writes a manifest for discovered pages", async () => {
    const tempDir = await createTempDir()
    const datoolDir = path.join(tempDir, "datool")

    await fs.mkdir(datoolDir, {
      recursive: true,
    })
    await fs.writeFile(
      path.join(datoolDir, "streams.ts"),
      `export const demo = { open() {} }`,
      "utf8"
    )
    await fs.writeFile(
      path.join(datoolDir, "logs.tsx"),
      `export default function LogsPage() { return null }`,
      "utf8"
    )

    const { app } = await loadDatoolApp({
      cwd: tempDir,
    })
    const manifestPath = await writeDatoolManifest({
      cwd: tempDir,
      pages: app.pages,
    })
    const manifestContents = await fs.readFile(manifestPath, "utf8")

    expect(manifestContents).toContain(path.join(datoolDir, "logs.tsx"))
    expect(manifestContents).toContain('path: "/logs"')
  })

  test("normalizes bare source exports with default JSONL parsing", async () => {
    const tempDir = await createTempDir()
    const datoolDir = path.join(tempDir, "datool")

    await fs.mkdir(datoolDir, {
      recursive: true,
    })
    await fs.writeFile(
      path.join(datoolDir, "streams.ts"),
      `export const logs = {
        open({ emit }) {
          emit('{"message":"hello"}')
        },
      }`,
      "utf8"
    )
    await fs.writeFile(
      path.join(datoolDir, "index.tsx"),
      `export default function HomePage() { return null }`,
      "utf8"
    )

    const { app } = await loadDatoolApp({
      cwd: tempDir,
    })
    const rows: Array<{ id: string; row: Record<string, unknown> }> = []

    await openStreamRuntime(
      "logs",
      app.streams.logs!,
      new URLSearchParams(),
      new AbortController().signal,
      {
        onError(error) {
          throw error
        },
        onRow(payload) {
          rows.push(payload)
        },
      }
    )

    expect(rows).toEqual([
      {
        id: "logs:0",
        row: {
          message: "hello",
        },
      },
    ])
  })

  test("supports advanced stream descriptors with custom parsing and actions", async () => {
    const tempDir = await createTempDir()
    const datoolDir = path.join(tempDir, "datool")

    await fs.mkdir(datoolDir, {
      recursive: true,
    })
    await fs.writeFile(
      path.join(datoolDir, "streams.ts"),
      `export const logs = {
        actions: {
          clear: {
            button: "destructive",
            label: "Clear",
            resolve() {
              return false
            },
          },
        },
        parseLine({ line }) {
          return { message: line.toUpperCase() }
        },
        source: {
          open({ emit }) {
            emit("hello")
          },
        },
      }`,
      "utf8"
    )
    await fs.writeFile(
      path.join(datoolDir, "index.tsx"),
      `export default function HomePage() { return null }`,
      "utf8"
    )

    const { app } = await loadDatoolApp({
      cwd: tempDir,
    })
    const rows: Array<{ id: string; row: Record<string, unknown> }> = []

    await openStreamRuntime(
      "logs",
      app.streams.logs!,
      new URLSearchParams(),
      new AbortController().signal,
      {
        onError(error) {
          throw error
        },
        onRow(payload) {
          rows.push(payload)
        },
      }
    )

    expect(rows[0]?.row).toEqual({
      message: "HELLO",
    })
    expect(toClientConfig(app).streams[0]?.actions).toEqual([
      {
        button: "destructive",
        icon: undefined,
        id: "clear",
        label: "Clear",
      },
    ])
  })
})
