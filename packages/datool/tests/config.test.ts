import fs from "fs/promises"
import os from "os"
import path from "path"

import { afterEach, describe, expect, test } from "bun:test"

import { findConfigPath, loadDatoolConfig, toClientConfig } from "../src/node/config"

const tempDirs: string[] = []

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "datool-config-"))

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

describe("config loader", () => {
  test("discovers and loads datool.config.ts", async () => {
    const tempDir = await createTempDir()
    const configPath = path.join(tempDir, "datool.config.ts")

    await fs.writeFile(
      configPath,
      `export default {
        dateFormat: {
          dateStyle: "short",
          timeStyle: "medium",
        },
        streams: {
          demo: {
            actions: {
              abort: {
                button: "outline",
                icon: "Trash",
                label: "Abort Run",
                resolve({ rows }) {
                  return rows.map((row) => ({ ...row, line: "aborted" }))
                },
              },
            },
            label: "Demo",
            columns: [{ accessorKey: "line", header: "Line" }],
            open({ emit }) { emit("hello") },
            parseLine({ line }) { return { line } },
          },
        },
      }`,
      "utf8"
    )

    expect(findConfigPath(tempDir)).toBe(configPath)

    const loaded = await loadDatoolConfig({
      cwd: tempDir,
    })

    expect(loaded.configPath).toBe(configPath)
    expect(toClientConfig(loaded.config).streams[0]?.id).toBe("demo")
    expect(toClientConfig(loaded.config).dateFormat).toEqual({
      dateStyle: "short",
      timeStyle: "medium",
    })
    expect(toClientConfig(loaded.config).streams[0]?.actions).toEqual([
      {
        button: "outline",
        icon: "Trash",
        id: "abort",
        label: "Abort Run",
      },
    ])
  })

  test("fails fast for invalid configs", async () => {
    const tempDir = await createTempDir()

    await fs.writeFile(
      path.join(tempDir, "datool.config.ts"),
      `export default { streams: {} }`,
      "utf8"
    )

    await expect(
      loadDatoolConfig({
        cwd: tempDir,
      })
    ).rejects.toThrow("at least one stream")
  })

  test("fails fast for invalid action metadata", async () => {
    const tempDir = await createTempDir()

    await fs.writeFile(
      path.join(tempDir, "datool.config.ts"),
      `export default {
        streams: {
          demo: {
            actions: {
              abort: {
                icon: "NotARealIcon",
                label: "Abort",
                resolve() { return undefined },
              },
            },
            label: "Demo",
            columns: [{ accessorKey: "line", header: "Line" }],
            open({ emit }) { emit("hello") },
            parseLine({ line }) { return { line } },
          },
        },
      }`,
      "utf8"
    )

    await expect(
      loadDatoolConfig({
        cwd: tempDir,
      })
    ).rejects.toThrow("invalid icon")
  })

  test("fails fast for invalid dateFormat", async () => {
    const tempDir = await createTempDir()

    await fs.writeFile(
      path.join(tempDir, "datool.config.ts"),
      `export default {
        dateFormat: "short",
        streams: {
          demo: {
            label: "Demo",
            columns: [{ accessorKey: "line", header: "Line" }],
            open({ emit }) { emit("hello") },
            parseLine({ line }) { return { line } },
          },
        },
      }`,
      "utf8"
    )

    await expect(
      loadDatoolConfig({
        cwd: tempDir,
      })
    ).rejects.toThrow("dateFormat must be an object")
  })
})
