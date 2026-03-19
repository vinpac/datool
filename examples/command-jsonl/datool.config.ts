import path from "path"

import { defineDatoolConfig, sources } from "datool"

export default defineDatoolConfig({
  streams: {
    demo: {
      ...sources.command({
        command: ({ query }) =>
          `bun run ${path.join(import.meta.dir, "scripts/emit-jsonl.ts")} ${
            query.get("history") ?? "5"
          }`,
      }),
      columns: [
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
            info: "blue",
            warn: "amber",
          },
          header: "Level",
          kind: "enum",
          width: 100,
        },
        {
          accessorKey: "message",
          header: "Message",
          width: 360,
        },
        {
          accessorKey: "service",
          header: "Service",
          kind: "enum",
          width: 140,
        },
        {
          accessorKey: "payload",
          header: "Payload",
          kind: "json",
          minWidth: 280,
          truncate: false,
          width: 420,
        },
      ],
      actions: {
        delete: {
          button: "destructive",
          icon: "Trash",
          label: "Abort Run",
          async resolve({ rows }) {
            await Promise.resolve(new Promise((resolve) => setTimeout(resolve, 1000)))
            return rows.map(() => false)
          },
        },
        abort: {
          button: "outline",
          icon: "Trash",
          label: "Abort Run",
          resolve({ rows }) {
            return rows.map((row) => ({
              ...row,
              message: `[aborted] ${String(row.message ?? "")}`,
            }))
          },
        },
      },
      label: "Command JSONL",
      parseLine({ line }) {
        return JSON.parse(line) as Record<string, unknown>
      },
    },
  },
})
