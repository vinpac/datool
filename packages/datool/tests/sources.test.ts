import fs from "fs/promises"
import os from "os"
import path from "path"

import { afterEach, describe, expect, test } from "bun:test"

import { commandSource } from "../src/node/sources/command"
import { fileSource } from "../src/node/sources/file"
import { buildSshArgs } from "../src/node/sources/ssh"

const tempDirs: string[] = []

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "datool-source-"))

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

describe("sources", () => {
  test("file source emits history and appended lines", async () => {
    const tempDir = await createTempDir()
    const filePath = path.join(tempDir, "app.log")

    await fs.writeFile(filePath, "a\nb\nc\n", "utf8")

    const source = fileSource({
      path: filePath,
      pollIntervalMs: 25,
    })
    const controller = new AbortController()
    const lines: string[] = []
    const openPromise = source.open({
      emit(line) {
        lines.push(line)

        if (lines.length >= 3) {
          controller.abort()
        }
      },
      query: new URLSearchParams("history=2"),
      signal: controller.signal,
    })

    await Bun.sleep(80)
    await fs.appendFile(filePath, "d\n", "utf8")
    await openPromise

    expect(lines).toEqual(["b", "c", "d"])
  })

  test("file source emits default history when query is missing", async () => {
    const tempDir = await createTempDir()
    const filePath = path.join(tempDir, "app.log")

    await fs.writeFile(filePath, "a\nb\nc\n", "utf8")

    const source = fileSource({
      defaultHistory: 2,
      path: filePath,
      pollIntervalMs: 25,
    })
    const controller = new AbortController()
    const lines: string[] = []

    const openPromise = source.open({
      emit(line) {
        lines.push(line)

        if (lines.length >= 2) {
          controller.abort()
        }
      },
      query: new URLSearchParams(),
      signal: controller.signal,
    })

    await openPromise

    expect(lines).toEqual(["b", "c"])
  })

  test("command source streams stdout and stops on abort", async () => {
    const lines: string[] = []
    const controller = new AbortController()
    const source = commandSource({
      command:
        "bun -e \"console.log('one'); setTimeout(() => console.log('two'), 20); const id = setInterval(() => console.log('tick'), 20); process.on('SIGTERM', () => { clearInterval(id); process.exit(0) })\"",
    })

    const openPromise = source.open({
      emit(line) {
        lines.push(line)

        if (lines.length >= 2) {
          controller.abort()
        }
      },
      query: new URLSearchParams(),
      signal: controller.signal,
    })

    await openPromise

    expect(lines.slice(0, 2)).toEqual(["one", "two"])
  })

  test("ssh source builds the expected ssh argv", () => {
    expect(
      buildSshArgs(
        {
          command: ({ query }) => `tail -n ${query.get("history") ?? "5"} app.log`,
          host: "example.com",
          options: {
            StrictHostKeyChecking: "no",
          },
          port: 2222,
          user: "vin",
        },
        new URLSearchParams("history=12")
      )
    ).toEqual([
      "-p",
      "2222",
      "-o",
      "StrictHostKeyChecking=no",
      "vin@example.com",
      "tail -n 12 app.log",
    ])
  })
})
