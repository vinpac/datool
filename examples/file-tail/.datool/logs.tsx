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
    accessorKey: "meta.worker",
    header: "Worker",
    kind: "enum",
    width: 120,
  },
  {
    accessorKey: "meta",
    header: "Meta",
    kind: "json",
    truncate: false,
    width: 320,
  },
]

export const title = "Run Logs"

export default function RunLogsPage() {
  return <Table columns={columns} source="file" />
}
