import type { CSSProperties } from "react"

import type {
  Span,
  SpanEvent,
  Trace,
} from "../components/trace-viewer/types"
import { getHighResInMs, getMsInHighRes } from "../components/trace-viewer/util/timing"
import { stripViewerRowId, type StreamViewerRow } from "../stream-state"
import type {
  DatoolTraceDuration,
  DatoolTraceEventRecord,
  DatoolTraceRecord,
  DatoolTraceResourceConfig,
  DatoolTraceSchema,
  DatoolTraceSpanRecord,
  DatoolTraceTime,
} from "../trace-types"
import type { DatoolEnumBadgeColor } from "../../shared/types"

type TraceSpanState<Row extends Record<string, unknown>> = {
  hasSpanRecord: boolean
  spanId: string
  parentSpanId?: string
  name?: string
  kind?: number
  resource?: string
  library?: {
    name: string
    version?: string
  }
  status?: {
    code: number
  }
  traceFlags?: number
  attributes: Record<string, unknown>
  links: Record<string, unknown>[]
  startTimeMs?: number
  endTimeMs?: number
  durationMs?: number
  activeStartTimeMs?: number
  sourceRows: Array<StreamViewerRow<Row>>
  sourceRowIds: Set<string>
  events: Array<{
    event: SpanEvent
    sourceRow: StreamViewerRow<Row>
  }>
}

export type DatoolTraceIssue = {
  message: string
  rowId?: string
}

export type DatoolBuiltTrace<Row extends Record<string, unknown>> = {
  issues: DatoolTraceIssue[]
  spanRowsById: Map<string, Array<StreamViewerRow<Row>>>
  trace: Trace | null
}

const TRACE_COLOR_RGB: Record<DatoolEnumBadgeColor, string> = {
  amber: "245 158 11",
  blue: "59 130 246",
  coral: "251 113 133",
  cyan: "6 182 212",
  emerald: "16 185 129",
  fuchsia: "217 70 239",
  green: "34 197 94",
  indigo: "99 102 241",
  lime: "132 204 22",
  orange: "249 115 22",
  pink: "236 72 153",
  purple: "168 85 247",
  red: "239 68 68",
  rose: "244 63 94",
  sky: "14 165 233",
  stone: "120 113 108",
  teal: "20 184 166",
  violet: "139 92 246",
  yellow: "234 179 8",
  zinc: "113 113 122",
}

function toArray<T>(value: T | T[] | null | undefined) {
  if (value === null || value === undefined) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function toEpochMs(value: DatoolTraceTime | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (Array.isArray(value)) {
    return getHighResInMs(value)
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value)

    return Number.isNaN(parsed) ? undefined : parsed
  }

  return Number.isFinite(value) ? value : undefined
}

function toDurationMs(value: DatoolTraceDuration | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (Array.isArray(value)) {
    return getHighResInMs(value)
  }

  return Number.isFinite(value) ? value : undefined
}

function createSpanState<Row extends Record<string, unknown>>(
  spanId: string
): TraceSpanState<Row> {
  return {
    attributes: {},
    events: [],
    hasSpanRecord: false,
    links: [],
    sourceRows: [],
    sourceRowIds: new Set<string>(),
    spanId,
  }
}

function mergeSourceRow<Row extends Record<string, unknown>>(
  state: TraceSpanState<Row>,
  sourceRow: StreamViewerRow<Row>
) {
  if (state.sourceRowIds.has(sourceRow.__datoolRowId)) {
    return
  }

  state.sourceRowIds.add(sourceRow.__datoolRowId)
  state.sourceRows.push(sourceRow)
}

function applySpanRecord<Row extends Record<string, unknown>>(
  state: TraceSpanState<Row>,
  record: DatoolTraceSpanRecord,
  sourceRow: StreamViewerRow<Row>
) {
  mergeSourceRow(state, sourceRow)
  state.hasSpanRecord = true

  if (record.parentSpanId !== undefined) {
    state.parentSpanId = record.parentSpanId ?? undefined
  }

  if (record.name !== undefined) {
    state.name = record.name
  }

  if (record.kind !== undefined) {
    state.kind = record.kind
  }

  if (record.resource !== undefined) {
    state.resource = record.resource
  }

  if (record.library !== undefined) {
    state.library = record.library
  }

  if (record.status !== undefined) {
    state.status =
      typeof record.status === "number"
        ? {
            code: record.status,
          }
        : record.status
  }

  if (record.traceFlags !== undefined) {
    state.traceFlags = record.traceFlags
  }

  if (record.attributes) {
    state.attributes = {
      ...state.attributes,
      ...record.attributes,
    }
  }

  if (record.links) {
    state.links = record.links
  }

  const startTimeMs = toEpochMs(record.startTime)
  const endTimeMs = toEpochMs(record.endTime)
  const durationMs = toDurationMs(record.duration)
  const activeStartTimeMs = toEpochMs(record.activeStartTime)

  if (startTimeMs !== undefined) {
    state.startTimeMs = startTimeMs
  }

  if (endTimeMs !== undefined) {
    state.endTimeMs = endTimeMs
  }

  if (durationMs !== undefined) {
    state.durationMs = durationMs
  }

  if (activeStartTimeMs !== undefined) {
    state.activeStartTimeMs = activeStartTimeMs
  }
}

function applyEventRecord<Row extends Record<string, unknown>>(
  state: TraceSpanState<Row>,
  record: DatoolTraceEventRecord,
  sourceRow: StreamViewerRow<Row>
) {
  mergeSourceRow(state, sourceRow)

  state.events.push({
    event: {
      attributes: record.attributes ?? {},
      color: record.color,
      name: record.name,
      showVerticalLine: record.showVerticalLine,
      timestamp: getMsInHighRes(toEpochMs(record.timestamp) ?? 0),
    },
    sourceRow,
  })
}

function finalizeSpanTimes<Row extends Record<string, unknown>>(
  state: TraceSpanState<Row>
) {
  const eventTimes = state.events.map(({ event }) => getHighResInMs(event.timestamp))
  const eventStartMs = eventTimes.length > 0 ? Math.min(...eventTimes) : undefined
  const eventEndMs = eventTimes.length > 0 ? Math.max(...eventTimes) : undefined

  let startTimeMs = state.startTimeMs ?? eventStartMs
  let endTimeMs = state.endTimeMs ?? eventEndMs
  let durationMs = state.durationMs

  if (startTimeMs === undefined && endTimeMs !== undefined && durationMs !== undefined) {
    startTimeMs = endTimeMs - durationMs
  }

  if (endTimeMs === undefined && startTimeMs !== undefined && durationMs !== undefined) {
    endTimeMs = startTimeMs + durationMs
  }

  if (durationMs === undefined && startTimeMs !== undefined && endTimeMs !== undefined) {
    durationMs = Math.max(0, endTimeMs - startTimeMs)
  }

  if (startTimeMs === undefined) {
    startTimeMs = 0
  }

  if (endTimeMs === undefined) {
    endTimeMs = durationMs !== undefined ? startTimeMs + durationMs : startTimeMs
  }

  if (durationMs === undefined) {
    durationMs = Math.max(0, endTimeMs - startTimeMs)
  }

  return {
    activeStartTimeMs: state.activeStartTimeMs,
    durationMs,
    endTimeMs,
    startTimeMs,
  }
}

function formatIssue(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function resolveResourceColorStyle(
  color: DatoolEnumBadgeColor | undefined
): CSSProperties | undefined {
  if (!color) {
    return undefined
  }

  const rgb = TRACE_COLOR_RGB[color]

  return {
    "--span-background": `rgb(${rgb} / 0.2)`,
    "--span-border": `rgb(${rgb})`,
    "--span-line": `rgb(${rgb} / 0.78)`,
    "--span-secondary": `rgb(${rgb} / 0.92)`,
    "--span-text": "var(--ds-gray-1000)",
  } as CSSProperties
}

function resolveResourceConfig<Row extends Record<string, unknown>>(
  span: Span,
  schema: DatoolTraceSchema<Row>
) {
  if (!span.resource) {
    return undefined
  }

  return schema.resources?.[span.resource] as DatoolTraceResourceConfig<Row> | undefined
}

function buildResolvedSpan<Row extends Record<string, unknown>>(
  state: TraceSpanState<Row>,
  schema: DatoolTraceSchema<Row>
) {
  const times = finalizeSpanTimes(state)
  const span: Span = {
    attributes: state.attributes,
    duration: getMsInHighRes(times.durationMs),
    endTime: getMsInHighRes(times.endTimeMs),
    events: state.events
      .map(({ event }) => event)
      .sort((left, right) => getHighResInMs(left.timestamp) - getHighResInMs(right.timestamp)),
    kind: state.kind ?? 0,
    library: state.library ?? {
      name: "datool",
    },
    links: state.links,
    name: state.name ?? state.spanId,
    parentSpanId: state.parentSpanId,
    resource: state.resource ?? "datool",
    spanId: state.spanId,
    startTime: getMsInHighRes(times.startTimeMs),
    status: state.status ?? {
      code: 0,
    },
    traceFlags: state.traceFlags ?? 1,
  }

  if (times.activeStartTimeMs !== undefined) {
    span.activeStartTime = getMsInHighRes(times.activeStartTimeMs)
  }

  const sourceRows = state.sourceRows.map((row) => stripViewerRowId(row))
  const context = {
    sourceRows,
    span,
  }
  const resourceConfig = resolveResourceConfig(span, schema)
  const resourceContext =
    span.resource === undefined
      ? undefined
      : {
          ...context,
          resource: span.resource,
        }
  const label =
    resourceContext && resourceConfig?.label
      ? resourceConfig.label(resourceContext)
      : schema.spanLabel?.(context)
  const className = [
    schema.spanClassName?.(context),
    resourceContext && resourceConfig?.className
      ? resourceConfig.className(resourceContext)
      : undefined,
  ]
    .filter(Boolean)
    .join(" ")
  const style = {
    ...resolveResourceColorStyle(resourceConfig?.color),
    ...(resourceContext && resourceConfig?.style
      ? resourceConfig.style(resourceContext)
      : undefined),
    ...schema.spanStyle?.(context),
  }

  if (label) {
    span.label = label
  }

  if (className) {
    span.className = className
  }

  if (Object.keys(style).length > 0) {
    span.style = style
  }

  return span
}

function resolveRowRecords<Row extends Record<string, unknown>>(
  rows: Array<StreamViewerRow<Row>>,
  schema: DatoolTraceSchema<Row>,
  issues: DatoolTraceIssue[]
) {
  const strippedRows = rows.map((row) => stripViewerRowId(row))

  if (schema.mapRows) {
    try {
      const mappedRows = schema.mapRows(strippedRows)

      if (mappedRows.length !== rows.length) {
        issues.push({
          message: `Trace schema mapRows returned ${mappedRows.length} entries for ${rows.length} rows.`,
        })
      }

      return rows.map((_, index) => mappedRows[index] ?? null)
    } catch (error) {
      issues.push({
        message: `Trace schema failed while mapping rows: ${formatIssue(error)}`,
      })

      return rows.map(() => null)
    }
  }

  return rows.map((row) => {
    const sourceRow = stripViewerRowId(row)

    try {
      return schema.mapRow?.(sourceRow) ?? null
    } catch (error) {
      issues.push({
        message: `Trace schema failed for row "${row.__datoolRowId}": ${formatIssue(error)}`,
        rowId: row.__datoolRowId,
      })

      return null
    }
  })
}

function resolveRootSpanId<Row extends Record<string, unknown>>(
  schema: DatoolTraceSchema<Row>,
  rows: Array<StreamViewerRow<Row>>,
  spanStates: Map<string, TraceSpanState<Row>>
) {
  const resolvedStates = Array.from(spanStates.values()).filter(
    (state) => state.hasSpanRecord
  )

  if (typeof schema.rootSpanId === "string") {
    return schema.rootSpanId
  }

  if (typeof schema.rootSpanId === "function") {
    return schema.rootSpanId({
      rows: rows.map((row) => stripViewerRowId(row)),
      spans: resolvedStates.map((state) => ({
        name: state.name,
        parentSpanId: state.parentSpanId,
        spanId: state.spanId,
      })),
    })
  }

  const roots = resolvedStates.filter((state) => !state.parentSpanId)

  if (roots.length === 1) {
    return roots[0]?.spanId
  }

  return roots
    .slice()
    .sort((left, right) => {
      const leftStart = left.startTimeMs ?? 0
      const rightStart = right.startTimeMs ?? 0

      return leftStart - rightStart
    })[0]?.spanId
}

export function buildTraceFromRows<Row extends Record<string, unknown>>(
  rows: Array<StreamViewerRow<Row>>,
  schema: DatoolTraceSchema<Row>
): DatoolBuiltTrace<Row> {
  const issues: DatoolTraceIssue[] = []
  const spanStates = new Map<string, TraceSpanState<Row>>()
  const rowRecords = resolveRowRecords(rows, schema, issues)

  rows.forEach((row, index) => {
    const records = toArray<DatoolTraceRecord>(rowRecords[index])

    for (const record of records) {
      const existingState = spanStates.get(record.spanId) ?? createSpanState<Row>(record.spanId)

      if (record.type === "span") {
        applySpanRecord(existingState, record, row)
      } else {
        applyEventRecord(existingState, record, row)
      }

      spanStates.set(record.spanId, existingState)
    }
  })

  const spans = Array.from(spanStates.values())
    .filter((state) => state.hasSpanRecord)
    .map((state) => buildResolvedSpan(state, schema))

  const resolvedSpanIds = new Set(spans.map((span) => span.spanId))

  for (const [spanId, state] of spanStates.entries()) {
    if (state.hasSpanRecord) {
      continue
    }

    issues.push({
      message: `Trace event rows referenced unknown span "${spanId}".`,
    })
  }

  for (const span of spans) {
    if (span.parentSpanId && !resolvedSpanIds.has(span.parentSpanId)) {
      issues.push({
        message: `Span "${span.spanId}" references unknown parent span "${span.parentSpanId}".`,
      })
    }
  }

  if (spans.length === 0) {
    return {
      issues,
      spanRowsById: new Map(),
      trace: null,
    }
  }

  const rootSpanId = resolveRootSpanId(schema, rows, spanStates)

  if (rootSpanId && !resolvedSpanIds.has(rootSpanId)) {
    issues.push({
      message: `Trace root span "${rootSpanId}" was not produced by the trace schema.`,
    })
  }

  return {
    issues,
    spanRowsById: new Map(
      Array.from(spanStates.entries()).map(([spanId, state]) => [spanId, state.sourceRows])
    ),
    trace: {
      resources: [
        {
          attributes: {
            "service.name": "datool",
          },
          name: "datool",
        },
      ],
      rootSpanId: rootSpanId && resolvedSpanIds.has(rootSpanId) ? rootSpanId : undefined,
      spans,
      traceId:
        (rootSpanId && resolvedSpanIds.has(rootSpanId) ? rootSpanId : undefined) ??
        spans[0]?.spanId ??
        "datool-trace",
    },
  }
}
