# Trace Viewer

`datool` includes a `TraceViewer` page component for turning streamed rows into an interactive trace timeline.

It is useful when your source data already contains workflow, job, request, or step lifecycle information and you want to:

- visualize parent and child spans on a timeline
- show point-in-time events on spans
- inspect span metadata and raw source rows
- keep a live trace updating as new rows arrive
- export both the raw rows and the derived trace JSON

## Public API

```tsx
import { TraceViewer, traceLifecycleSchema, type DatoolTraceSchema } from "datool"
```

```tsx
type DatoolTraceViewerProps<Row, GroupRow = never> = {
  schema: DatoolTraceSchema<Row>
  stream: string
  groups?: DatoolTraceGroupsConfig<GroupRow, Row>
}
```

```tsx
export default function TracePage() {
  return <TraceViewer schema={schema} stream="workflowLogs" />
}
```

`stream` is the stream id from your `source(...)` or bare source export.

`schema` tells the trace viewer how to convert rows into spans and events.

`groups` is optional. Use it when each streamed row is a container object and the actual trace rows live inside a nested array like `workflow.traces`.

## What The Viewer Can Do

The built-in trace page supports:

- live streaming updates
- pause and resume of the stream
- clearing the current in-memory rows
- zoom controls
- search across spans
- span selection
- a side panel with span details
- a custom slice panel showing the source rows that produced the selected span
- resource-based styling and labels
- export of raw source rows as JSON
- export of the derived trace payload as JSON

When a span is selected, the panel can show:

- span id
- resource
- parent span id
- duration
- start and end timestamps
- attributes
- the matched source rows for that span

## How Data Flows

The trace viewer works in three layers:

1. Your stream emits rows.
2. Optionally, `groups` picks one nested trace from those rows.
3. A `DatoolTraceSchema<Row>` converts each trace row, or the full set of trace rows, into `DatoolTraceRecord` values.
4. `datool` accumulates those records into a `Trace` object that the timeline renders.

Conceptually without groups:

```text
rows -> schema.mapRow / schema.mapRows -> trace records -> built trace -> timeline + panel
```

Conceptually with groups:

```text
outer rows -> groups.id / groups.displayName / groups.traces -> selected trace rows -> schema.mapRow / schema.mapRows -> trace records -> built trace -> timeline + panel
```

## Grouped Traces

Use grouped traces when your source returns rows like:

```ts
[
  {
    id: "workflow-1",
    displayName: "Workflow 1",
    traces: [
      { type: "span", spanId: "run-1", startTime: "...", endTime: "..." },
      { type: "event", spanId: "run-1", name: "done", timestamp: "..." },
    ],
  },
]
```

Then render the viewer like this:

```tsx
import {
  TraceViewer,
  type DatoolTraceGroupsConfig,
  type DatoolTraceSchema,
} from "datool"

type TraceRow = {
  type: "span" | "event"
  spanId: string
}

type WorkflowRow = {
  id: string
  displayName: string
  traces: TraceRow[]
}

const schema: DatoolTraceSchema<TraceRow> = {
  mapRow(row) {
    return row
  },
}

const groups: DatoolTraceGroupsConfig<WorkflowRow, TraceRow> = {
  id: "id",
  displayName: "displayName",
  traces: "traces",
  label: "Workflow",
  placeholder: "Select a workflow",
}

export default function TracePage() {
  return <TraceViewer groups={groups} schema={schema} stream="workflows" />
}
```

When `groups` is present, the header shows a combobox so the user can switch between workflows, jobs, or any other grouped traces.

Group config supports:

- `id`: required group id accessor
- `displayName`: optional label accessor for the combobox
- `traces`: required accessor that returns the nested trace rows
- `label`: optional header label above the combobox
- `placeholder`: optional combobox placeholder
- `initialGroupId`: optional initial selection override

## Core Data Structures

### `DatoolTraceRecord`

This is the intermediate record shape produced by your schema. It can be one of two things:

- a `span` record
- an `event` record

### Span records

Use a span record when a row starts, updates, or ends a span.

```ts
type DatoolTraceSpanRecord = {
  type: "span"
  spanId: string
  parentSpanId?: string | null
  name?: string
  kind?: number
  resource?: string
  library?: { name: string; version?: string }
  status?: number | { code: number }
  traceFlags?: number
  attributes?: Record<string, unknown>
  links?: Record<string, unknown>[]
  startTime?: string | number | Date | [number, number]
  endTime?: string | number | Date | [number, number]
  duration?: number | [number, number]
  activeStartTime?: string | number | Date | [number, number]
}
```

Notes:

- `spanId` is required and identifies the span across all rows.
- `parentSpanId` creates nesting.
- `resource` controls grouping and styling semantics.
- `activeStartTime` is useful when queued time and active execution time are different.
- times can be ISO strings, epoch numbers, `Date`, or `[seconds, nanoseconds]`.

### Event records

Use an event record when a row should become a marker attached to a span.

```ts
type DatoolTraceEventRecord = {
  type: "event"
  spanId: string
  name: string
  timestamp: string | number | Date | [number, number]
  attributes?: Record<string, unknown>
  color?: string
  showVerticalLine?: boolean
}
```

Notes:

- `spanId` must point to a real span.
- `color` lets you override marker color.
- `showVerticalLine` is useful for highlighting important events like failures.

## How The Final Trace Is Built

Internally, `datool` merges all records with the same `spanId` into a single rendered span.

During that build:

- source rows are associated back to each span
- span attributes from later records are merged in
- events are sorted by timestamp
- missing times are inferred when possible from events or duration
- a root span is resolved automatically unless you override it
- issues are collected for invalid relationships such as unknown parent spans or events pointing at missing spans

If no valid spans are produced, the viewer shows an empty-state message instead of a trace.

## Authoring A Schema

You have two main options.

### Option 1: Manual `mapRow` or `mapRows`

Use this when your data already has explicit trace semantics.

```tsx
import { TraceViewer, type DatoolTraceSchema } from "datool"

type Row = {
  id: string
  parentId?: string
  kind: "start" | "end" | "log"
  ts: string
  message: string
}

const schema: DatoolTraceSchema<Row> = {
  mapRow(row) {
    if (row.kind === "start") {
      return {
        type: "span",
        spanId: row.id,
        parentSpanId: row.parentId,
        name: row.message,
        resource: "task",
        startTime: row.ts,
      }
    }

    if (row.kind === "end") {
      return {
        type: "span",
        spanId: row.id,
        endTime: row.ts,
        status: { code: 0 },
      }
    }

    return {
      type: "event",
      spanId: row.id,
      name: row.message,
      timestamp: row.ts,
    }
  },
}
```

Use `mapRows` instead of `mapRow` when the conversion depends on surrounding rows or full-stream context.

### Option 2: `traceLifecycleSchema(...)`

Use this when your rows look like lifecycle logs with start, end, and error events.

```tsx
import { TraceViewer, traceLifecycleSchema } from "datool"

const schema = traceLifecycleSchema({
  timestamp: "ts",
  event: "event",
  message: "message",
  levels: [
    {
      key: "workflow",
      id: (row) => row.workflowRunId,
      name: (row) => row.workflowName,
      resource: "workflow",
      start: ["workflow_enqueued", "workflow_started"],
      end: ["workflow_completed", "workflow_failed"],
    },
    {
      key: "step",
      id: (row) => row.stepId,
      name: (row) => row.stepName,
      parent: "stack",
      resource: "step",
      start: "step_started",
      end: "step_completed",
      error: "step_failed",
    },
  ],
  logs: {
    span: "current",
  },
})
```

This helper:

- watches each row for lifecycle transitions
- creates span records for start, end, and error rows
- optionally emits log rows as trace events
- tracks nested parentage with `parent: "stack"`
- picks the first top-level span as the default root

## Schema Customization Points

### `rootSpanId`

Use this when automatic root detection is not enough.

```ts
rootSpanId: "root-span-id"
```

or:

```ts
rootSpanId: ({ rows, spans }) => spans.find((span) => !span.parentSpanId)?.spanId
```

### `resources`

Resource config lets you change the appearance of spans by resource name.

```ts
resources: {
  database: {
    color: "emerald",
    label: ({ span }) => `DB: ${span.name}`,
  },
  workflow: {
    color: "violet",
  },
}
```

Each resource supports:

- `color`
- `label(context)`
- `className(context)`
- `style(context)`

### `spanLabel`, `spanClassName`, `spanStyle`

These hooks customize spans regardless of resource.

They receive:

```ts
{
  span: Span
  sourceRows: Row[]
}
```

Typical uses:

- rewrite verbose names into shorter labels
- add classes for failed or slow spans
- inject inline style overrides

### `slice`

The slice config controls the selected-span panel that shows source rows.

```ts
slice: {
  title: ({ selectedSpan }) => `${selectedSpan.name} logs`,
  description: ({ matchedRows }) => `${matchedRows.length} source rows`,
  columns: [
    { accessorKey: "event", label: "Event" },
    { accessorKey: "message", label: "Message" },
    { accessorKey: "level", label: "Level" },
  ],
}
```

If you do not provide `slice.columns`, `datool` infers columns from the matched rows.

## Lifecycle Helper Details

`traceLifecycleSchema(...)` is especially good for event logs.

Important fields:

- `timestamp`: how to read row time
- `event`: how to read the event name used for matching
- `message`: optional message accessor used by default log naming
- `attributes(row)`: span and event attributes to attach
- `levels`: the lifecycle definitions that create spans
- `logs`: how non-lifecycle rows become span events
- `resources`: resource-specific visual config
- `slice`: selected-span source row panel config

Each `level` supports:

- `key`: fallback resource name
- `id`: how to build the span id
- `name`: how to build the span name
- `start`: event matcher for opening the span
- `end`: event matcher for closing the span
- `error`: event matcher for failed completion
- `resource`: optional override for the resource name
- `parent`: `"stack"`, a string accessor, or a function
- `when`: optional row predicate to enable the level only for matching rows

The `logs` block supports:

- `false` to disable log-to-event conversion
- `when(row)` to filter log events
- `span: "current"` to attach to the currently active span
- `span: "root"` to attach to the root span
- `span: accessor | function` to attach logs to a custom span id
- `name`, `color`, and `showVerticalLine` for marker customization

## Export Behavior

The built-in trace page currently exposes two exports from the settings menu:

- raw data: the streamed rows after removing the internal `__datoolRowId` field
- trace data: the derived `Trace` JSON that the timeline renders

This is useful when you want to:

- inspect whether the issue is in the source stream or in your schema mapping
- snapshot a live trace for debugging
- save the exact rendered trace structure for tests or fixtures

## Practical Advice

- Prefer stable `spanId` values. If ids change between rows, the viewer will treat them as different spans.
- If you attach events to spans, make sure the corresponding span record exists somewhere in the stream.
- Use `mapRows` when parent-child relationships depend on full ordering or shared context.
- Keep `attributes` useful but not huge. They appear in the selection panel.
- Use `resource` names intentionally. They are the easiest hook for visual differentiation.
- Add a `slice` config early. It makes debugging much easier because you can see the exact rows behind a span.

## Example

See the sample trace page at:

- `examples/command-jsonl/datool/traces.tsx`

It demonstrates:

- `traceLifecycleSchema(...)`
- nested workflow and step spans
- log rows rendered as span events
- resource colors and labels
- a custom slice panel layout
