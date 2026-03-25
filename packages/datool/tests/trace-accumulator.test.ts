import { describe, expect, test } from "bun:test"

import { buildTraceFromRows } from "../src/client/lib/trace-accumulator"
import type { DatoolTraceSchema } from "../src/client/trace-types"

type DemoRow = {
  className?: string
  level?: "error" | "info" | "warn"
  message: string
  name?: string
  parentSpanId?: string
  spanId: string
  ts?: string
  type: "event" | "span" | "throw"
  endTs?: string
}

function viewerRow(id: string, row: DemoRow) {
  return {
    __datoolRowId: id,
    ...row,
  }
}

const schema: DatoolTraceSchema<DemoRow> = {
  mapRow(row) {
    if (row.type === "throw") {
      throw new Error("boom")
    }

    if (row.type === "event") {
      return {
        type: "event",
        attributes: {
          message: row.message,
        },
        name: row.name ?? row.message,
        spanId: row.spanId,
        timestamp: row.ts ?? 0,
      }
    }

    return {
      type: "span",
      attributes: {
        className: row.className,
        level: row.level,
        message: row.message,
      },
      endTime: row.endTs,
      name: row.name ?? row.message,
      parentSpanId: row.parentSpanId,
      spanId: row.spanId,
      startTime: row.ts ?? 0,
    }
  },
  rootSpanId({ spans }) {
    return spans.find((span) => !span.parentSpanId)?.spanId
  },
  spanClassName({ sourceRows }) {
    return sourceRows.at(-1)?.className
  },
  spanLabel({ sourceRows, span }) {
    return sourceRows.at(-1)?.level === "error" ? `${span.name} (error)` : undefined
  },
}

describe("trace accumulator", () => {
  test("merges span patches, events, labels, and slice rows", () => {
    const result = buildTraceFromRows(
      [
        viewerRow("row-1", {
          message: "Run started",
          name: "Run",
          spanId: "run-1",
          ts: "2026-03-22T12:00:00.000Z",
          type: "span",
        }),
        viewerRow("row-2", {
          message: "Task started",
          name: "Task",
          parentSpanId: "run-1",
          spanId: "task-1",
          ts: "2026-03-22T12:00:01.000Z",
          type: "span",
        }),
        viewerRow("row-3", {
          message: "Task output",
          name: "stdout",
          spanId: "task-1",
          ts: "2026-03-22T12:00:01.500Z",
          type: "event",
        }),
        viewerRow("row-4", {
          className: "ring-1 ring-red-500/40",
          level: "error",
          message: "Task failed",
          name: "Task",
          parentSpanId: "run-1",
          spanId: "task-1",
          ts: "2026-03-22T12:00:01.000Z",
          endTs: "2026-03-22T12:00:03.000Z",
          type: "span",
        }),
      ],
      schema
    )

    expect(result.issues).toEqual([])
    expect(result.trace?.rootSpanId).toBe("run-1")
    expect(result.trace?.spans).toHaveLength(2)

    const taskSpan = result.trace?.spans.find((span) => span.spanId === "task-1")

    expect(taskSpan).toEqual(
      expect.objectContaining({
        className: "ring-1 ring-red-500/40",
        label: "Task (error)",
        parentSpanId: "run-1",
      })
    )
    expect(taskSpan?.events).toHaveLength(1)
    expect(result.spanRowsById.get("task-1")?.map((row) => row.__datoolRowId)).toEqual([
      "row-2",
      "row-3",
      "row-4",
    ])
  })

  test("handles out-of-order rows while still resolving the root span", () => {
    const result = buildTraceFromRows(
      [
        viewerRow("child-finish", {
          message: "Child completed",
          name: "Child",
          parentSpanId: "root",
          spanId: "child",
          ts: "2026-03-22T12:00:05.000Z",
          endTs: "2026-03-22T12:00:08.000Z",
          type: "span",
        }),
        viewerRow("root-start", {
          message: "Root started",
          name: "Root",
          spanId: "root",
          ts: "2026-03-22T12:00:00.000Z",
          type: "span",
        }),
      ],
      schema
    )

    expect(result.issues).toEqual([])
    expect(result.trace?.rootSpanId).toBe("root")
    expect(result.trace?.spans.find((span) => span.spanId === "child")?.parentSpanId).toBe(
      "root"
    )
  })

  test("reports schema failures and unknown event-only spans", () => {
    const result = buildTraceFromRows(
      [
        viewerRow("bad-row", {
          message: "broken",
          spanId: "root",
          type: "throw",
        }),
        viewerRow("orphan-event", {
          message: "orphan",
          name: "stderr",
          spanId: "missing-span",
          ts: "2026-03-22T12:00:00.000Z",
          type: "event",
        }),
        viewerRow("valid-root", {
          message: "root",
          name: "Root",
          spanId: "root",
          ts: "2026-03-22T12:00:01.000Z",
          type: "span",
        }),
      ],
      schema
    )

    expect(result.trace?.spans.map((span) => span.spanId)).toEqual(["root"])
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'Trace schema failed for row "bad-row": boom',
      'Trace event rows referenced unknown span "missing-span".',
    ])
  })
})
