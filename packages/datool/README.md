# datool

`datool` is a local-first data app toolkit. Projects define sources in `.datool/sources.ts`, build pages with `.datool/**/*.tsx`, and run them with `datool dev`, `datool build`, or `datool serve`.

## Install

```bash
bun add -d datool
```

## Quick Start

Create `.datool/sources.ts`:

```ts
import { source, sources } from "datool"

export const logs = source({
  source: sources.file({
    path: "./app.log",
    defaultHistory: 100,
  }),
})
```

Create a page in `.datool/logs.tsx`:

```tsx
import { Table, type DatoolColumn } from "datool"

const columns: DatoolColumn[] = [
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
  return <Table columns={columns} source="logs" />
}
```

Then run:

```bash
bunx datool dev
```

## CLI

### `datool dev`

- discovers `.datool/sources.ts` (or legacy `datool/sources.ts` / `datool/streams.ts`)
- discovers all `.datool/**/*.tsx` pages
- generates a small Next.js app in `.datool/generated/next-app`
- runs `next dev` for the generated app
- rewrites generated config and manifest files when sources or pages change

### `datool build`

- regenerates the generated Next app
- runs `next build` inside `.datool/generated/next-app`

### `datool serve`

- builds the generated Next app if needed
- runs `next start` for the generated app

## Sources

Each named export in `.datool/sources.ts` becomes a source id.

### Bare source exports

Bare sources default to JSONL parsing:

```ts
import { sources } from "datool"

export const logs = sources.file({
  path: "./app.log",
})
```

### Source descriptors

Use `source(...)` when you need paginated reads, custom parsing, labels, or actions.
`source()` is typed, so it validates the source shape and can carry your row type into `get()`, `getRowId()`, and `actions.resolve(...)`.

```ts
import { source, sources } from "datool"

type LogRow = {
  id: string
  level: "info" | "error"
  message: string
}

export const logs = source<LogRow>({
  get({ limit = 50, offset = 0 }) {
    const rows = readRowsFromSomewhere()

    return {
      nextOffset:
        offset + limit < rows.length ? offset + limit : undefined,
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
    }
  },
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

`source()` must define at least one read entry point:

- `get(...)` for request/response reads like pagination
- `source: { open(...) }` for live updates
- `open(...)` or `stream: { open(...) }` for backward-compatible live definitions

If your source is purely live, you can still omit the generic and let the source parser shape rows later:

```ts
import { source, sources } from "datool"

export const logs = source({
  source: sources.file({
    path: "./app.log",
    defaultHistory: 100,
  }),
})
```

If you want typed action rows or typed `get()` results, pass the row generic explicitly:

```ts
type WorkflowRow = {
  message: string
  status: "running" | "failed" | "completed"
}

export const workflows = source<WorkflowRow>({
  actions: {
    retry: {
      label: "Retry",
      resolve({ rows }) {
        return rows.map((row) => ({
          ...row,
          status: "running",
        }))
      },
    },
  },
  get() {
    return fetchWorkflowRows()
  },
})
```

Optional named exports:

- `dateFormat`: global `Intl.DateTimeFormatOptions` or a `date-fns` pattern string
- `server`: `{ host?: string; port?: number }`

```ts
export const dateFormat = {
  dateStyle: "short",
  timeStyle: "medium",
}
```

```ts
export const dateFormat = "HH:MM:SS DD/MM/YYYY"
```

String date formats use `date-fns`. Native `date-fns` patterns work, and common uppercase patterns like `HH:MM:SS DD/MM/YYYY` are normalized automatically.

## Pages And Routing

- every `.datool/**/*.tsx` file becomes a route
- `.datool/index.tsx` maps to `/`
- `.datool/logs.tsx` maps to `/logs`
- `.datool/runs/logs.tsx` maps to `/runs/logs`
- the app renders inside the built-in sidebar shell

## Runtime Compatibility

`sources.ts` now runs under a Next.js Node runtime. Prefer Node-compatible path helpers like:

```ts
import path from "path"
import { fileURLToPath } from "url"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
```

Avoid Bun-only helpers like `import.meta.dir` in source files.

`Table` pages can define custom cell rendering through `DatoolColumn`:

```tsx
import { Table, type DatoolColumn } from "datool"

const columns: DatoolColumn[] = [
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
  return <Table columns={columns} source="logs" />
}
```

You can also override date formatting and row styling directly on the page:

```tsx
import { Table, type DatoolColumn } from "datool"

type LogRow = {
  color?: string
  level: string
  ts: string
}

const columns: DatoolColumn<LogRow>[] = [
  {
    accessorKey: "ts",
    header: "Timestamp",
    kind: "date",
    dateFormat: "HH:MM:SS DD/MM/YYYY",
  },
  {
    accessorKey: "level",
    header: "Level",
    kind: "enum",
  },
]

export default function RunsPage() {
  return (
    <Table
      columns={columns}
      dateFormat={{
        dateStyle: "medium",
      }}
      rowStyle={(row) =>
        row.color
          ? {
              borderLeft: `3px solid ${row.color}`,
            }
          : undefined
      }
      source="logs"
    />
  )
}
```

Date cells support both global `dateFormat` and per-column `dateFormat`.

- Object values use `Intl.DateTimeFormat`.
- String values use `date-fns`.
- Hovering a rendered date shows the full UTC timestamp.
- Clicking a rendered date copies the displayed value to the clipboard.

Examples:

```ts
dateFormat: {
  dateStyle: "short",
  timeStyle: "medium",
}
```

```ts
dateFormat: "yyyy-MM-dd HH:mm:ss"
```

```ts
dateFormat: "HH:MM:SS DD/MM/YYYY"
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
source({
  source: sources.command({
    command: ({ query }) =>
      `bun run ./scripts/logs.ts ${query.get("history") ?? "10"}`,
  }),
})
```

### `sources.ssh(...)`

```ts
source({
  source: sources.ssh({
    host: "example.com",
    user: "dokku",
    command: ({ query }) =>
      `tail -n ${query.get("history") ?? "500"} -F /var/log/app.log`,
  }),
})
```

## URL Query Params

Table state stays in the URL, and source backends still receive the full query string. `get()` also receives parsed `page`, `offset`, and `limit` values when those params are present. For example:

```text
http://127.0.0.1:5173/logs?history=500
```

`history=500` is available to sources and parse functions, while table search/grouping/visibility state is stored in route-scoped URL params.

## Examples

- [examples/command-jsonl](/Users/vinpac/lab/vite-app/examples/command-jsonl)
- [examples/file-tail](/Users/vinpac/lab/vite-app/examples/file-tail)
