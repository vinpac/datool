# datool

`datool` is a local-first streaming data app toolkit. Projects define stream backends in `datool/streams.ts`, build pages with `datool/**/*.tsx`, and run them with `datool dev`, `datool build`, or `datool`.

## Install

```bash
bun add -d datool
```

## Quick Start

Create `datool/streams.ts`:

```ts
import { sources } from "datool"

export const logs = sources.file({
  path: "./app.log",
  defaultHistory: 100,
})
```

Create a page in `datool/logs.tsx`:

```tsx
import { Table, type DatoolColumns } from "datool"

const columns: DatoolColumns[] = [
  {
    accessorKey: "level",
    header: "Level",
    kind: "enum",
    enumColors: {
      error: "red",
      warning: "yellow",
      info: "blue",
      log: "zinc",
    },
    width: 76,
  },
  {
    accessorKey: "message",
    header: "Message",
    truncate: true,
    width: 320,
  },
  {
    accessorKey: "ts",
    header: "Timestamp",
    kind: "date",
    width: 220,
  },
]

export default function LogsPage() {
  return <Table columns={columns} stream="logs" />
}
```

Then run:

```bash
bunx datool dev
```

## CLI

### `datool dev`

- discovers `datool/streams.ts`
- discovers all `datool/**/*.tsx` pages
- generates `.datool/generated/manifest.ts`
- starts the Bun API server
- starts a Vite dev server for the routed app

### `datool build`

- regenerates the manifest
- builds the project-specific client bundle into `.datool/client-dist`

### `datool`

- builds the client bundle if needed
- serves the built app and streaming API from the Bun server

## Streams

Each named export in `datool/streams.ts` becomes a stream id.

### Bare source exports

Bare sources default to JSONL parsing:

```ts
import { sources } from "datool"

export const logs = sources.file({
  path: "./app.log",
})
```

### Advanced streams

Use `defineStream(...)` when you need custom parsing, row ids, labels, or actions:

```ts
import { defineStream, sources } from "datool"

export const logs = defineStream({
  label: "Workflow Logs",
  source: sources.file({
    path: "./workflow.log",
    defaultHistory: 50,
  }),
  parseLine({ line }) {
    return JSON.parse(line) as Record<string, unknown>
  },
  actions: {
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
})
```

Optional named exports:

- `dateFormat`: global `Intl.DateTimeFormatOptions`
- `server`: `{ host?: string; port?: number }`

## Pages And Routing

- every `datool/**/*.tsx` file becomes a route
- `datool/index.tsx` maps to `/`
- `datool/logs.tsx` maps to `/logs`
- `datool/runs/logs.tsx` maps to `/runs/logs`
- the app renders inside the built-in sidebar shell

`Table` pages can define custom cell rendering through `DatoolColumns`:

```tsx
import { Table, type DatoolColumns } from "datool"

const columns: DatoolColumns[] = [
  {
    accessorKey: "workflowRunId",
    header: "Run ID",
    truncate: true,
    cell({ value }) {
      return <span className="font-mono text-xs">{String(value ?? "")}</span>
    },
  },
]

export default function RunsPage() {
  return <Table columns={columns} stream="logs" />
}
```

## Built-In Sources

### `sources.file(...)`

```ts
sources.file({
  path: "./app.log",
  defaultHistory: 5,
})
```

### `sources.command(...)`

```ts
sources.command({
  command: ({ query }) =>
    `bun run ./scripts/logs.ts ${query.get("history") ?? "10"}`,
})
```

### `sources.ssh(...)`

```ts
sources.ssh({
  host: "example.com",
  user: "dokku",
  command: ({ query }) =>
    `tail -n ${query.get("history") ?? "500"} -F /var/log/app.log`,
})
```

## URL Query Params

Table state stays in the URL, and stream backends still receive the full query string. For example:

```text
http://127.0.0.1:5173/logs?history=500
```

`history=500` is available to sources and parse functions, while table search/grouping/visibility state is stored in route-scoped URL params.

## Examples

- [examples/command-jsonl](/Users/vinpac/lab/vite-app/examples/command-jsonl)
- [examples/file-tail](/Users/vinpac/lab/vite-app/examples/file-tail)
