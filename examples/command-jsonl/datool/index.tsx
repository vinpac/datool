import { Table, type DatoolColumns } from "datool"

type CommandLogRow = {
  level: "error" | "info" | "warn"
  message: string
  payload: {
    attempt: number
    host: string
  }
  service: string
  ts: string
}

const columns: DatoolColumns<CommandLogRow>[] = [
  {
    accessorKey: "level",
    enumColors: {
      error: "red",
      info: "blue",
      warn: "amber",
    },
    header: "Level",
    kind: "enum",
    width: 100,
  },
  {
    accessorKey: "message",
    cell({ children, row }) {
      return (
        <div className="flex flex-col gap-1 py-1">
          <span className="font-medium">{children}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.service} · attempt {row.payload.attempt}
          </span>
        </div>
      )
    },
    header: "Message",
    minWidth: 320,
    width: 360,
  },
  {
    accessorKey: "service",
    header: "Service",
    kind: "enum",
    width: 140,
  },
  {
    accessorKey: "ts",
    header: "Timestamp",
    kind: "date",
    width: 220,
  },
  {
    accessorKey: "payload",
    header: "Payload",
    kind: "json",
    minWidth: 280,
    truncate: false,
    width: 420,
  },
]

export const title = "Command Logs"

export default function CommandLogsPage() {
  return <Table columns={columns} stream="demo" />
}
