import { Table, type DatoolColumn } from "datool"

const columns: DatoolColumn[] = [
  {
    accessorKey: "ts",
    header: "Timestamp",
    kind: "date",
    width: 220,
  },
  {
    accessorKey: "level",
    enumColors: {
      error: "red",
      info: "sky",
      warn: "amber",
    },
    header: "Level",
    kind: "enum",
    width: 100,
  },
  {
    accessorKey: "message",
    header: "Message",
    minWidth: 280,
    width: 360,
  },
  {
    accessorKey: "data",
    header: "Data",
    kind: "json",
    truncate: false,
    width: 320,
  },
  {
    accessorKey: "event",
    header: "Event",
    kind: "enum",
    width: 120,
  },
  {
    accessorKey: "workflowRunId",
    header: "Workflow Run ID",
    kind: "text",
    width: 120,
  },
  {
    accessorKey: "workflowName",
    header: "Workflow Name",
    kind: "text",
    width: 120,
  },
  {
    accessorKey: "stepName",
    header: "Step Name",
    kind: "enum",
    width: 120,
  },
]

export const title = "Run Logs"

export default function RunLogsPage() {
  return <Table columns={columns} source="sampleWorkflow" />
}
