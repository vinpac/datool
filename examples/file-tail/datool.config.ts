import path from "path"

import { defineDatoolConfig, sources } from "datool"

export default defineDatoolConfig({
  streams: {
    file: {
      ...sources.file({
        defaultHistory: 5,
        path: path.join(import.meta.dir, "fixtures/app.log"),
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
      ],
      label: "Local File",
      parseLine({ line }) {
        return JSON.parse(line) as Record<string, unknown>
      },
    },
  },
})
