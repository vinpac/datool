import type {
  DatoolTraceLifecycleAccessor,
  DatoolTraceLifecycleContext,
  DatoolTraceLifecycleLogs,
  DatoolTraceLifecycleMatcher,
  DatoolTraceLifecycleParent,
  DatoolTraceLifecycleSchemaConfig,
  DatoolTraceRecord,
  DatoolTraceSchema,
  DatoolTraceTime,
} from "../trace-types"
import { getValueAtPath } from "../../shared/columns"

function resolveAccessor<Row, TValue>(
  row: Row,
  accessor: DatoolTraceLifecycleAccessor<Row, TValue> | undefined
) {
  if (accessor === undefined) {
    return undefined
  }

  if (typeof accessor === "function") {
    return accessor(row)
  }

  return getValueAtPath(row as Record<string, unknown>, accessor) as TValue
}

function matchesWithAccessor<Row>(
  row: Row,
  matcher: DatoolTraceLifecycleMatcher<Row> | undefined,
  eventAccessor: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
) {
  if (matcher === undefined) {
    return false
  }

  if (typeof matcher === "function") {
    return matcher(row)
  }

  const values = Array.isArray(matcher) ? matcher : [matcher]
  const event = resolveAccessor(row, eventAccessor)

  return typeof event === "string" && values.includes(event)
}

function resolveParent<Row>(
  row: Row,
  parent: DatoolTraceLifecycleParent<Row> | undefined,
  context: DatoolTraceLifecycleContext<Row>
) {
  if (parent === undefined) {
    return undefined
  }

  if (parent === "stack") {
    return context.activeSpanIds.at(-1)
  }

  if (typeof parent === "function") {
    return parent(row, context) ?? undefined
  }

  const value = getValueAtPath(row as Record<string, unknown>, parent)

  return typeof value === "string" ? value : undefined
}

function resolveLogSpanId<Row>(
  row: Row,
  logs: DatoolTraceLifecycleLogs<Row>,
  context: DatoolTraceLifecycleContext<Row>
) {
  if (logs === false) {
    return undefined
  }

  if (logs.span === undefined || logs.span === "current") {
    return context.activeSpanIds.at(-1) ?? context.rootSpanId
  }

  if (logs.span === "root") {
    return context.rootSpanId
  }

  if (typeof logs.span === "function") {
    return logs.span(row, context) ?? undefined
  }

  const value = resolveAccessor(row, logs.span)

  return typeof value === "string" ? value : undefined
}

function defaultLogName<Row>(
  row: Row,
  eventAccessor: DatoolTraceLifecycleSchemaConfig<Row>["event"],
  messageAccessor: DatoolTraceLifecycleSchemaConfig<Row>["message"]
) {
  const message = resolveAccessor(row, messageAccessor)
  if (typeof message === "string" && message.trim()) {
    return "log"
  }

  const event = resolveAccessor(row, eventAccessor)
  if (typeof event === "string" && event.trim()) {
    return event
  }

  return "log"
}

export function traceLifecycleSchema<Row extends Record<string, unknown>>(
  config: DatoolTraceLifecycleSchemaConfig<Row>
): DatoolTraceSchema<Row> {
  return {
    mapRows(rows) {
      const mapped: Array<DatoolTraceRecord | DatoolTraceRecord[] | null> = []
      const activeSpanIds: string[] = []
      let rootSpanId: string | undefined

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]!
        const context: DatoolTraceLifecycleContext<Row> = {
          activeSpanIds,
          rootSpanId,
          rowIndex,
          rows,
        }
        const timestamp = resolveAccessor(row, config.timestamp) as
          | DatoolTraceTime
          | undefined

        let handled = false

        for (const level of config.levels) {
          if (level.when && !level.when(row)) {
            continue
          }

          const isStart = matchesWithAccessor(row, level.start, config.event ?? "event")
          const isEnd = matchesWithAccessor(row, level.end, config.event ?? "event")
          const isError = matchesWithAccessor(row, level.error, config.event ?? "event")

          if (!isStart && !isEnd && !isError) {
            continue
          }

          const spanId = resolveAccessor(row, level.id)
          if (typeof spanId !== "string" || !spanId) {
            handled = true
            mapped.push(null)
            break
          }

          const record: DatoolTraceRecord = {
            type: "span",
            attributes: config.attributes?.(row),
            endTime: isEnd || isError ? timestamp : undefined,
            name: resolveAccessor(row, level.name) ?? spanId,
            parentSpanId: isStart ? resolveParent(row, level.parent, context) : undefined,
            resource: resolveAccessor(row, level.resource) ?? level.key,
            spanId,
            startTime: isStart ? timestamp : undefined,
            status: isError ? { code: 2 } : { code: 0 },
          }

          if (!rootSpanId) {
            rootSpanId = record.parentSpanId ? context.rootSpanId : spanId
          }

          if (isStart) {
            for (let stackIndex = activeSpanIds.length - 1; stackIndex >= 0; stackIndex -= 1) {
              if (activeSpanIds[stackIndex] === spanId) {
                activeSpanIds.splice(stackIndex, 1)
                break
              }
            }

            activeSpanIds.push(spanId)
          }

          if (isEnd || isError) {
            for (let stackIndex = activeSpanIds.length - 1; stackIndex >= 0; stackIndex -= 1) {
              if (activeSpanIds[stackIndex] === spanId) {
                activeSpanIds.splice(stackIndex, 1)
                break
              }
            }
          }

          mapped.push(record)
          handled = true
          break
        }

        if (handled) {
          continue
        }

        const logs = config.logs === undefined
          ? {
              span: "current" as const,
            }
          : config.logs

        if (logs === false) {
          mapped.push(null)
          continue
        }

        if (logs.when && !logs.when(row)) {
          mapped.push(null)
          continue
        }

        const spanId = resolveLogSpanId(row, logs, {
          activeSpanIds,
          rootSpanId,
          rowIndex,
          rows,
        })

        if (!spanId || !timestamp) {
          mapped.push(null)
          continue
        }

        mapped.push({
          type: "event",
          attributes: config.attributes?.(row),
          color: resolveAccessor(row, logs.color),
          name:
            resolveAccessor(row, logs.name) ??
            defaultLogName(row, config.event, config.message),
          showVerticalLine:
            typeof logs.showVerticalLine === "function"
              ? logs.showVerticalLine(row)
              : logs.showVerticalLine,
          spanId,
          timestamp,
        })
      }

      return mapped
    },
    resources: config.resources,
    rootSpanId: (state) => state.spans.find((span) => !span.parentSpanId)?.spanId,
    slice: config.slice,
  }
}
