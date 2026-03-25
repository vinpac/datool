import { TraceViewer, traceLifecycleSchema, type DatoolTraceSchema } from "datool"

import { SAMPLE_JSONL, type SampleWorkflowRow } from "./sample-workflow-data"

function inferStepResource(stepName: string | undefined) {
  if (!stepName) {
    return "workflow"
  }

  if (
    stepName === "loadBrand" ||
    stepName === "loadProject" ||
    stepName === "findBrandAnalysisDocument"
  ) {
    return "database"
  }

  if (stepName === "scrapeUrl") {
    return "function"
  }

  return "step"
}

const rows = SAMPLE_JSONL.trim().split("\n")

const schema: DatoolTraceSchema<SampleWorkflowRow> = traceLifecycleSchema({
  attributes(row) {
    return {
      attempt: row.attempt,
      data: row.data,
      event: row.event,
      level: row.level,
      message: row.message,
      stepName: row.stepName,
      workflowName: row.workflowName,
    }
  },
  event: "event",
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
      resource: (row) => inferStepResource(row.stepName),
      start: "step_started",
    },
  ],
  logs: {
    color: (row) => {
      if (row.level === "error") {
        return "#ef4444"
      }

      if (inferStepResource(row.stepName) === "database") {
        return "#10b981"
      }

      return "#64748b"
    },
    name: (row) => {
      if (row.level === "error") {
        return row.event || row.message || "error"
      }

      return row.event || row.message || "log"
    },
    showVerticalLine: (row) => row.level === "error",
    span: "current",
  },
  message: "message",
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
  slice: {
    columns: [
      {
        accessorKey: "event",
        label: "Event",
      },
      {
        accessorKey: "stepName",
        label: "Step",
      },
      {
        accessorKey: "message",
        label: "Message",
      },
      {
        accessorKey: "level",
        label: "Level",
      },
      {
        accessorKey: "data.errorMessage",
        label: "Error",
      },
    ],
    description: `${rows.length} JSONL rows parsed into nested workflow spans.`,
    title: ({ selectedSpan }) => `${selectedSpan.name} logs`,
  },
  timestamp: "ts",
})

export const title = "Static Workflow Trace"

export default function SampleWorkflowTracePage() {
  return <TraceViewer schema={schema} source="sampleWorkflow" />
}
