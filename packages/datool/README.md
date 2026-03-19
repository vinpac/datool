# datool

`datool` is a local-only log inspection package and CLI for arbitrary line-oriented streams. Projects define stream wiring in `datool.config.ts`, and `bunx datool` serves a minimal table UI backed by SSE.

## Install

```bash
bun add -d datool
```

## Quick start

Create `datool.config.ts` in your project root:

```ts
import { defineDatoolConfig, sources } from "datool"

export default defineDatoolConfig({
  dateFormat: {
    dateStyle: "short",
    timeStyle: "medium",
  },
  streams: {
    file: {
      ...sources.file({
        path: "./app.log",
      }),
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
      columns: [
        { accessorKey: "ts", header: "Timestamp", kind: "date" },
        {
          accessorKey: "level",
          enumColors: {
            error: "red",
            info: "blue",
            warn: "amber",
          },
          header: "Level",
          kind: "enum",
        },
        { accessorKey: "message", header: "Message" },
        { accessorKey: "meta", header: "Meta", kind: "json", truncate: false },
      ],
      label: "Local File",
      parseLine({ line }) {
        return JSON.parse(line) as Record<string, unknown>
      },
    },
  },
})
```

Then run:

```bash
bunx datool
```

The CLI will:

1. discover `datool.config.ts` in the current working directory
2. bind to `127.0.0.1` by default
3. print the local URL
4. serve the table UI and SSE endpoints

## Config API

```ts
import { defineDatoolConfig, sources } from "datool"

export default defineDatoolConfig({
  dateFormat: {
    dateStyle: "short",
    timeStyle: "medium",
  },
  server: {
    port: 3210,
  },
  streams: {
    prod: {
      ...sources.ssh({
        host: "example.com",
        user: "dokku",
        command: ({ query }) => {
          const history = query.get("history") ?? "500"
          return `tail -n ${history} -F /var/log/my-app.log`
        },
      }),
      actions: {
        restart: {
          button: {
            size: "sm",
            variant: "outline",
          },
          icon: "RefreshCcw",
          label: "Restart workers",
          async resolve({ rows }) {
            return rows.map((row) => ({
              ...row,
              level: "info",
              message: `Restart requested for ${String(row.message ?? "")}`,
            }))
          },
        },
      },
      columns: [
        { accessorKey: "ts", header: "Timestamp", kind: "date" },
        {
          accessorKey: "level",
          enumColors: {
            error: "red",
            info: "blue",
            warn: "amber",
          },
          header: "Level",
          kind: "enum",
        },
        { accessorKey: "message", header: "Message" },
        { accessorKey: "payload", header: "Payload", kind: "json" },
      ],
      label: "Production",
      parseLine({ line }) {
        return JSON.parse(line) as Record<string, unknown>
      },
    },
  },
})
```

Top-level config options include:

- `dateFormat`: optional global `Intl.DateTimeFormatOptions` for `kind: "date"` columns
- `server`: optional server overrides such as `host` and `port`
- `streams`: stream definitions

Each stream defines:

- `label`: UI label
- `columns`: serializable table schema
- `actions`: optional config-driven row actions exposed in the actions column and row context menu
- `parseLine({ line, query, streamId })`: converts each raw line into a row object or returns `null` to skip it
- `open({ emit, query, signal })`: opens the underlying line stream
- `getRowId(...)`: optional custom row id function

Enum columns can also define `enumColors` to pin specific values to named badge colors:

```ts
{
  accessorKey: "level",
  kind: "enum",
  enumColors: {
    error: "red",
    info: "blue",
    warn: "amber",
  },
}
```

Available `enumColors` values:
`"emerald"`, `"purple"`, `"sky"`, `"pink"`, `"red"`, `"zinc"`, `"lime"`, `"violet"`, `"fuchsia"`, `"teal"`, `"amber"`, `"rose"`, `"orange"`, `"cyan"`, `"indigo"`, `"yellow"`, `"green"`, `"coral"`, `"blue"`, `"stone"`.

Any enum values not listed in `enumColors` continue using the default rotating color assignment.

## Row actions

Define stream actions in `actions`. Each action:

- receives `rows`, `query`, `streamId`, and `actionId` on the backend
- always runs against an array of rows
- always appears in the row context menu
- appears in the actions column when `button` is not `false`

```ts
actions: {
  abort: {
    button: "outline",
    icon: "Trash",
    label: "Abort Run",
    async resolve({ rows }) {
      return rows.map((row) => ({
        ...row,
        message: `[aborted] ${String(row.message ?? "")}`,
      }))
    },
  },
}
```

`button` can be:

- `false` to hide the inline button while keeping the context menu action
- a variant string such as `"outline"`
- an object like `{ variant: "outline", size: "sm", label: "Abort" }`

Action return values are interpreted like this:

- `true` or `undefined`: no row changes
- `false` or `null`: remove the targeted rows
- `[]`: no row changes
- `[nextRow, false, true]`: replace the first row, remove the second, keep the third
- anything else: the frontend shows an error state

## Built-in sources

### `sources.file(...)`

Tails a local file and optionally honors `history`.

```ts
sources.file({
  defaultHistory: 5,
  path: "./app.log",
})
```

`defaultHistory` lets the file source emit existing lines on startup when the URL
does not include a `history` query param.

### `sources.command(...)`

Spawns a local process and streams stdout lines.

```ts
sources.command({
  command: ({ query }) => `bun run ./scripts/logs.ts ${query.get("history") ?? "10"}`,
})
```

### `sources.ssh(...)`

Runs a remote command over SSH and streams stdout lines.

```ts
sources.ssh({
  host: "example.com",
  user: "dokku",
  command: ({ query }) => `tail -n ${query.get("history") ?? "500"} -F /var/log/app.log`,
})
```

## URL query params

The UI and stream runtime share URL query params. Example:

```text
http://127.0.0.1:3210/?stream=prod&history=500
```

- `stream` selects the active stream
- any other query params are passed to both `open` and `parseLine`

## Security model

- default bind host is `127.0.0.1`
- the package is intended for local-only use
- it will not expose publicly unless you explicitly set `server.host` or pass `--host`

## Examples in this repo

- [examples/command-jsonl](/Users/vinpac/lab/vite-app/examples/command-jsonl)
- [examples/file-tail](/Users/vinpac/lab/vite-app/examples/file-tail)
