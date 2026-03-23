import fs from "fs/promises"
import net from "node:net"
import path from "path"

import { describe, expect, test } from "bun:test"

import { startDatoolServer } from "../src/node/server"

type SseEvent = {
  data: string
  event: string
}

const workspaceRoot = path.resolve(import.meta.dir, "..", "..", "..")

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

async function reserveConsecutivePorts(count: number) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const servers: net.Server[] = []

    try {
      const firstServer = await listenOnPort(0)
      const firstAddress = firstServer.address()

      if (!firstAddress || typeof firstAddress === "string") {
        throw new Error("Unable to resolve reserved port block.")
      }

      servers.push(firstServer)

      for (let offset = 1; offset < count; offset += 1) {
        servers.push(await listenOnPort(firstAddress.port + offset))
      }

      return {
        port: firstAddress.port,
        servers,
      }
    } catch {
      await Promise.allSettled(servers.map((server) => closeNetServer(server)))
    }
  }

  throw new Error("Unable to reserve consecutive ports for test.")
}

async function collectSseEvents(
  response: Response,
  wantedEvents: number
): Promise<SseEvent[]> {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("Missing response body.")
  }

  const decoder = new TextDecoder()
  const events: SseEvent[] = []
  let buffer = ""

  while (events.length < wantedEvents) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, {
      stream: true,
    })

    let boundaryIndex = buffer.indexOf("\n\n")

    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex)

      buffer = buffer.slice(boundaryIndex + 2)
      boundaryIndex = buffer.indexOf("\n\n")

      const lines = rawEvent.split("\n")
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7)
      const data = lines.find((line) => line.startsWith("data: "))?.slice(6)

      if (event && data) {
        events.push({
          data,
          event,
        })
      }

      if (events.length >= wantedEvents) {
        await reader.cancel()
        return events
      }
    }
  }

  await reader.cancel()

  return events
}

describe("server integration", () => {
  test("serves config and streams command rows", async () => {
    const cwd = path.join(workspaceRoot, "examples/command-jsonl")
    const server = await startDatoolServer({
      cwd,
      port: 0,
    })

    try {
      expect(server.url.startsWith("http://127.0.0.1:")).toBe(true)

      const configResponse = await fetch(`${server.url}/api/config`)
      const config = (await configResponse.json()) as {
        pages: Array<{
          path: string
          title: string
        }>
        streams: Array<{
          actions: Array<{
            button?: string | false
            icon?: string
            id: string
            label: string
          }>
          id: string
        }>
      }

      expect(config.pages).toEqual([
        expect.objectContaining({
          path: "/",
          title: "Home",
        }),
      ])
      expect(config.streams.map((stream) => stream.id)).toEqual(["demo"])
      expect(config.streams[0]?.actions).toEqual([
        {
          button: "destructive",
          icon: "Trash",
          id: "delete",
          label: "Abort Run",
        },
        {
          button: "outline",
          icon: "Trash",
          id: "abort",
          label: "Abort Run",
        },
      ])

      const response = await fetch(
        `${server.url}/api/streams/demo/events?stream=demo&history=3`
      )
      const events = await collectSseEvents(response, 3)
      const rows = events
        .filter((event) => event.event === "row")
        .map((event) => JSON.parse(event.data) as { row: { message: string } })

      expect(rows).toHaveLength(3)
      expect(rows[0]?.row.message).toContain("Command event")
    } finally {
      server.stop()
    }
  })

  test("runs configured row actions", async () => {
    const cwd = path.join(workspaceRoot, "examples/command-jsonl")
    const server = await startDatoolServer({
      cwd,
      port: 0,
    })

    try {
      const response = await fetch(
        `${server.url}/api/streams/demo/actions/abort?stream=demo&history=2`,
        {
          body: JSON.stringify({
            rows: [
              {
                message: "one",
              },
              {
                message: "two",
              },
            ],
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      )

      expect(response.ok).toBe(true)
      expect(await response.json()).toEqual({
        rowChanges: [
          {
            message: "[aborted] one",
          },
          {
            message: "[aborted] two",
          },
        ],
      })
    } finally {
      server.stop()
    }
  })

  test("streams file history and appended lines", async () => {
    const projectDir = path.join(workspaceRoot, "examples/file-tail")
    const fixturePath = path.join(projectDir, "fixtures/app.log")
    const originalFixture = await fs.readFile(fixturePath, "utf8")

    const server = await startDatoolServer({
      cwd: projectDir,
      port: 0,
    })

    try {
      const response = await fetch(
        `${server.url}/api/streams/file/events?stream=file&history=5`
      )

      const collectPromise = collectSseEvents(response, 6)

      await Bun.sleep(100)
      await fs.appendFile(
        fixturePath,
        `{"ts":"2026-03-18T17:00:06.000Z","level":"info","message":"Fresh line","meta":{"worker":"delta","attempt":5}}\n`,
        "utf8"
      )

      const events = await collectPromise
      const rows = events
        .filter((event) => event.event === "row")
        .map((event) => JSON.parse(event.data) as { row: { message: string } })

      expect(rows).toHaveLength(6)
      expect(rows.at(0)?.row.message).toBe("Connecting queue")
      expect(rows.at(-1)?.row.message).toBe("Fresh line")
    } finally {
      await fs.writeFile(fixturePath, originalFixture, "utf8")
      server.stop()
    }
  })

  test("serves the app shell for deep linked routes", async () => {
    const cwd = path.join(workspaceRoot, "examples/file-tail")
    const server = await startDatoolServer({
      cwd,
      port: 0,
    })

    try {
      const response = await fetch(`${server.url}/runs/logs`)
      const html = await response.text()

      expect(response.ok).toBe(true)
      expect(html).toContain('<div id="root"></div>')
    } finally {
      server.stop()
    }
  })

  test("retries the next ports when the requested port is busy", async () => {
    const cwd = path.join(workspaceRoot, "examples/command-jsonl")
    const reserved = await reserveConsecutivePorts(1)

    try {
      const server = await startDatoolServer({
        cwd,
        port: reserved.port,
      })

      try {
        expect(server.port).toBeGreaterThan(reserved.port)
        expect(server.port).toBeLessThanOrEqual(reserved.port + 9)
      } finally {
        server.stop()
      }
    } finally {
      await Promise.allSettled(
        reserved.servers.map((server) => closeNetServer(server))
      )
    }
  })

  test("fails after trying 10 consecutive ports", async () => {
    const cwd = path.join(workspaceRoot, "examples/command-jsonl")
    const reserved = await reserveConsecutivePorts(10)

    try {
      await expect(
        startDatoolServer({
          cwd,
          port: reserved.port,
        })
      ).rejects.toThrow(
        `No available ports from ${reserved.port} to ${reserved.port + 9}.`
      )
    } finally {
      await Promise.allSettled(
        reserved.servers.map((server) => closeNetServer(server))
      )
    }
  })
})
