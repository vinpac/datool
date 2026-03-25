import { describe, expect, test } from "bun:test"

import { buildTraceFromRows } from "../src/client/lib/trace-accumulator"
import { traceLifecycleSchema } from "../src/client/lib/trace-lifecycle-schema"

type LifecycleRow = {
  ts: string
  event?: string
  level: "error" | "log"
  workflowRunId: string
  workflowName: string
  stepName?: string
  attempt?: number
  message: string
}

function viewerRow(id: string, row: LifecycleRow) {
  return {
    __datoolRowId: id,
    ...row,
  }
}

function inferResource(stepName: string | undefined) {
  if (!stepName) {
    return "workflow"
  }

  if (stepName === "loadBrand") {
    return "database"
  }

  if (stepName === "scrapeUrl") {
    return "function"
  }

  return "step"
}

describe("traceLifecycleSchema", () => {
  test("builds nested spans, attaches log events, and applies resource colors", () => {
    const schema = traceLifecycleSchema<LifecycleRow>({
      attributes(row) {
        return {
          level: row.level,
          message: row.message,
          stepName: row.stepName,
        }
      },
      levels: [
        {
          end: ["workflow_completed", "workflow_failed"],
          id: (row) => row.workflowRunId,
          key: "workflow",
          name: (row) => row.workflowName,
          resource: "workflow",
          start: ["workflow_enqueued", "workflow_started"],
        },
        {
          end: "step_completed",
          error: "step_failed",
          id: (row) =>
            row.stepName ? `${row.workflowRunId}:${row.attempt ?? 1}:${row.stepName}` : null,
          key: "step",
          name: (row) => row.stepName,
          parent: "stack",
          resource: (row) => inferResource(row.stepName),
          start: "step_started",
        },
      ],
      resources: {
        database: {
          color: "emerald",
          label: ({ span }) => `DB: ${span.name}`,
        },
        function: {
          color: "amber",
          label: ({ span }) => `${span.name}()`,
        },
        step: {
          color: "sky",
        },
        workflow: {
          color: "violet",
        },
      },
      timestamp: "ts",
    })

    const result = buildTraceFromRows(
      [
        viewerRow("row-1", {
          event: "workflow_enqueued",
          level: "log",
          message: "",
          ts: "2026-03-23T03:19:49.425Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-2", {
          event: "workflow_started",
          level: "log",
          message: "",
          ts: "2026-03-23T03:19:49.437Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-3", {
          attempt: 1,
          event: "step_started",
          level: "log",
          message: "",
          stepName: "findOrCreateBrandAndProject",
          ts: "2026-03-23T03:19:49.438Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-4", {
          attempt: 1,
          level: "log",
          message: "Loading brand for domain: atados.com.br",
          stepName: "findOrCreateBrandAndProject",
          ts: "2026-03-23T03:19:49.439Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-5", {
          attempt: 1,
          event: "step_started",
          level: "log",
          message: "",
          stepName: "loadBrand",
          ts: "2026-03-23T03:19:49.440Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-6", {
          attempt: 1,
          event: "step_completed",
          level: "log",
          message: "",
          stepName: "loadBrand",
          ts: "2026-03-23T03:19:49.450Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-7", {
          attempt: 1,
          event: "step_started",
          level: "log",
          message: "",
          stepName: "scrapeUrl",
          ts: "2026-03-23T03:19:49.504Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-8", {
          attempt: 1,
          event: "step_failed",
          level: "error",
          message: "",
          stepName: "scrapeUrl",
          ts: "2026-03-23T03:19:49.507Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
        viewerRow("row-9", {
          event: "workflow_failed",
          level: "error",
          message: "",
          ts: "2026-03-23T03:19:49.508Z",
          workflowName: "generate-free-report",
          workflowRunId: "wrun-1",
        }),
      ],
      schema
    )

    expect(result.issues).toEqual([])
    expect(result.trace?.rootSpanId).toBe("wrun-1")

    const parentSpan = result.trace?.spans.find(
      (span) => span.spanId === "wrun-1:1:findOrCreateBrandAndProject"
    )
    const databaseSpan = result.trace?.spans.find((span) => span.spanId === "wrun-1:1:loadBrand")
    const functionSpan = result.trace?.spans.find((span) => span.spanId === "wrun-1:1:scrapeUrl")

    expect(parentSpan?.parentSpanId).toBe("wrun-1")
    expect(parentSpan?.events.map((event) => event.name)).toEqual(["log"])
    expect(databaseSpan).toEqual(
      expect.objectContaining({
        label: "DB: loadBrand",
        parentSpanId: "wrun-1:1:findOrCreateBrandAndProject",
        resource: "database",
      })
    )
    expect(functionSpan).toEqual(
      expect.objectContaining({
        label: "scrapeUrl()",
        parentSpanId: "wrun-1:1:findOrCreateBrandAndProject",
        resource: "function",
        status: {
          code: 2,
        },
      })
    )
    expect(functionSpan?.style).toEqual(
      expect.objectContaining({
        "--span-background": expect.any(String),
        "--span-border": expect.any(String),
      })
    )
  })
})
