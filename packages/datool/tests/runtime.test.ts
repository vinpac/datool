import { describe, expect, test } from "bun:test"

import { openStreamRuntime } from "../src/node/runtime"

describe("stream runtime", () => {
  test("passes query params through and generates default row ids", async () => {
    const rows: Array<{ id: string; row: Record<string, unknown> }> = []
    const errors: string[] = []

    await openStreamRuntime(
      "demo",
      {
        columns: [],
        label: "Demo",
        open({ emit, query }) {
          emit(`first:${query.get("history")}`)
          emit(`second:${query.get("history")}`)
        },
        parseLine({ line, query }) {
          return {
            history: query.get("history"),
            line,
          }
        },
      },
      new URLSearchParams("history=25"),
      new AbortController().signal,
      {
        onError(error) {
          errors.push(error instanceof Error ? error.message : String(error))
        },
        onRow(payload) {
          rows.push(payload)
        },
      }
    )

    expect(errors).toEqual([])
    expect(rows.map((row) => row.id)).toEqual(["demo:0", "demo:1"])
    expect(rows[0]?.row).toEqual({
      history: "25",
      line: "first:25",
    })
  })

  test("surfaces parse errors without crashing the stream", async () => {
    const rows: Array<{ id: string; row: Record<string, unknown> }> = []
    const errors: string[] = []

    await openStreamRuntime(
      "demo",
      {
        columns: [],
        label: "Demo",
        open({ emit }) {
          emit("ok")
          emit("bad")
        },
        parseLine({ line }) {
          if (line === "bad") {
            throw new Error("bad line")
          }

          return {
            line,
          }
        },
      },
      new URLSearchParams(),
      new AbortController().signal,
      {
        onError(error) {
          errors.push(error instanceof Error ? error.message : String(error))
        },
        onRow(payload) {
          rows.push(payload)
        },
      }
    )

    expect(rows).toHaveLength(1)
    expect(errors).toEqual(["bad line"])
  })
})
