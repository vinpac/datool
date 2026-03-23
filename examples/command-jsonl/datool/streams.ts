import path from "path"

import { defineStream, sources } from "datool"

export const demo = defineStream({
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
  source: sources.command({
    command: ({ query }) =>
      `bun run ${path.join(import.meta.dir, "..", "scripts/emit-jsonl.ts")} ${
        query.get("history") ?? "5"
      }`,
  }),
})
