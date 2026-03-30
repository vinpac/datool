import { describe, expect, test } from "bun:test"

import { buildTraceSearchFieldSpecs } from "../src/client/lib/trace-search-fields"
import type { Trace } from "../src/client/components/trace-viewer/types"

const trace: Trace = {
  rootSpanId: "root",
  spans: [
    {
      attributes: {
        level: "info",
        message: "started",
        workflowName: "build",
      },
      duration: [0, 0],
      endTime: [0, 0],
      events: [],
      kind: 0,
      library: { name: "datool" },
      links: [],
      name: "workflow",
      resource: "workflow",
      spanId: "root",
      startTime: [0, 0],
      status: { code: 0 },
      traceFlags: 1,
    },
    {
      attributes: {
        level: "error",
        message: "failed",
        workflowName: "build",
      },
      duration: [0, 0],
      endTime: [0, 0],
      events: [],
      kind: 0,
      library: { name: "datool" },
      links: [],
      name: "step",
      parentSpanId: "root",
      resource: "step",
      spanId: "child",
      startTime: [0, 0],
      status: { code: 2 },
      traceFlags: 1,
    },
  ],
  traceId: "trace-1",
}

describe("trace search fields", () => {
  test("builds suggestions from resolved span attributes", () => {
    expect(buildTraceSearchFieldSpecs(trace)).toEqual([
      {
        id: "level",
        kind: "enum",
        options: ["info", "error"],
      },
      {
        id: "message",
        kind: "enum",
        options: ["started", "failed"],
      },
      {
        id: "workflowName",
        kind: "enum",
        options: ["build"],
      },
    ])
  })

  test("falls back to text fields when attribute values are too varied", () => {
    const variedTrace: Trace = {
      ...trace,
      spans: Array.from({ length: 13 }, (_, index) => ({
        ...trace.spans[0]!,
        attributes: {
          message: `message-${index}`,
        },
        spanId: `span-${index}`,
      })),
    }

    expect(buildTraceSearchFieldSpecs(variedTrace)).toEqual([
      {
        id: "message",
        kind: "text",
      },
    ])
  })
})
