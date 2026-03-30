"use client"

import * as React from "react"

import {
  TraceViewerContextProvider,
  TraceViewerTimeline,
  useTraceViewer,
} from "./trace-viewer"
import {
  useDatoolCollectionQuery,
  type DatoolTraceState,
} from "../providers/datool-context"
import {
  buildTraceFromRows,
  type DatoolBuiltTrace,
} from "../lib/trace-accumulator"
import { downloadTextFile, sanitizeFilePart } from "../lib/file-download"
import {
  buildGroupedTraceRows,
  buildTraceGroupsFromRows,
  resolveInitialTraceGroupId,
} from "../lib/trace-groups"
import { buildTraceSearchFieldSpecs } from "../lib/trace-search-fields"
import type {
  DatoolTraceGroupsConfig,
  DatoolTraceSchema,
  DatoolTraceSliceColumn,
} from "../trace-types"
import {
  stripViewerRowId,
  type StreamViewerRow,
} from "../stream-state"
import { getValueAtPath } from "../../shared/columns"
import { formatDuration, formatWallClockTime, getHighResInMs } from "./trace-viewer/util/timing"

export type DatoolTraceViewerProps<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
> = {
  groups?: DatoolTraceGroupsConfig<GroupRow, Row>
  query?: string
  schema: DatoolTraceSchema<Row>
}

type ResolvedSliceColumn<Row extends Record<string, unknown>> =
  DatoolTraceSliceColumn<Row> & { label: string }

function formatFieldLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "\u2014"
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function resolveSliceColumns<Row extends Record<string, unknown>>(
  matchedRows: Row[],
  declaredColumns: DatoolTraceSliceColumn<Row>[] | undefined
): ResolvedSliceColumn<Row>[] {
  if (declaredColumns && declaredColumns.length > 0) {
    return declaredColumns.map((column) => ({
      ...column,
      label: column.label ?? formatFieldLabel(column.accessorKey),
    }))
  }

  const keys = new Set<string>()

  for (const row of matchedRows.slice(0, 10)) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }

  return Array.from(keys).map((key) => ({
    accessorKey: key,
    label: formatFieldLabel(key),
  }))
}

function renderMaybeFunction<TContext>(
  value: React.ReactNode | ((context: TContext) => React.ReactNode) | undefined,
  context: TContext
) {
  return typeof value === "function" ? value(context) : value
}

function buildJsonExportFileName(queryId: string, kind: "raw" | "trace") {
  return `${sanitizeFilePart(queryId)}-${kind}-${new Date()
    .toISOString()
    .replaceAll(":", "-")}.json`
}

function TraceSelectionPanel<Row extends Record<string, unknown>>({
  schema,
  traceState,
}: {
  schema: DatoolTraceSchema<Row>
  traceState: DatoolBuiltTrace<Row>
}) {
  const {
    state: { selected },
  } = useTraceViewer()

  if (!selected) return null

  const matchedViewerRows = traceState.spanRowsById.get(selected.span.spanId) ?? []
  const matchedRows = matchedViewerRows.map((row) => stripViewerRowId(row))
  const sliceContext = { matchedRows, selectedSpan: selected.span }
  const title = renderMaybeFunction(schema.slice?.title, sliceContext) ?? "Slice"
  const description = renderMaybeFunction(schema.slice?.description, sliceContext)
  const sliceColumns = resolveSliceColumns(matchedRows, schema.slice?.columns)
  const attributeEntries = Object.entries(selected.span.attributes ?? {})

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Span
        </h3>
        <div className="grid gap-2">
          {([
            ["ID", selected.span.spanId],
            ["Resource", selected.span.resource],
            ["Parent", selected.span.parentSpanId ?? "\u2014"],
            ["Duration", formatDuration(selected.duration)],
            ["Started", formatWallClockTime(getHighResInMs(selected.span.startTime))],
            ["Ended", formatWallClockTime(getHighResInMs(selected.span.endTime))],
          ] as Array<[string, React.ReactNode]>).map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[minmax(0,88px)_1fr] gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="min-w-0 break-words text-sm text-foreground">
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {attributeEntries.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attributes
          </h3>
          <div className="space-y-2">
            {attributeEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {key}
                </div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                  {stringifyValue(value)}
                </pre>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          <span className="text-xs text-muted-foreground">
            {matchedRows.length} row{matchedRows.length === 1 ? "" : "s"}
          </span>
        </div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
        {matchedRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            No source rows matched this span.
          </div>
        ) : (
          <div className="space-y-3">
            {matchedRows.map((row, index) => (
              <div
                key={matchedViewerRows[index]?.__datoolRowId ?? `${selected.span.spanId}-${index}`}
                className="rounded-lg border border-border bg-card p-3"
              >
                {sliceColumns.length > 0 ? (
                  <div className="grid gap-3">
                    {sliceColumns.map((column) => {
                      const value = getValueAtPath(row, column.accessorKey)

                      return (
                        <div key={column.accessorKey} className="space-y-1">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {column.label}
                          </div>
                          <div className="text-sm text-foreground">
                            {column.render
                              ? column.render(value, row)
                              : value !== null &&
                                  value !== undefined &&
                                  typeof value === "object"
                                ? (
                                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
                                      {stringifyValue(value)}
                                    </pre>
                                  )
                                : stringifyValue(value)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                    {stringifyValue(row)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TraceSearchSync({ search }: { search: string }) {
  const { dispatch } = useTraceViewer()

  React.useEffect(() => {
    dispatch({ type: "setFilter", filter: search })
  }, [dispatch, search])

  return null
}

function toViewerRows<TRow extends Record<string, unknown>>(
  rows: TRow[],
  getRowId: (row: TRow, index: number) => string
) {
  return rows.map(
    (row, index) =>
      ({
        ...row,
        __datoolRowId: getRowId(row, index),
      }) as StreamViewerRow<TRow>
  )
}

export function DatoolTraceViewer<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
>({
  groups,
  query,
  schema,
}: DatoolTraceViewerProps<Row, GroupRow>) {
  const collection = useDatoolCollectionQuery<Row[], unknown, Row>(query)
  const viewerRows = React.useMemo(
    () => toViewerRows(collection.rows, collection.definition.getRowId),
    [collection.definition, collection.rows]
  )
  const groupedTraceState = React.useMemo(
    () =>
      groups
        ? buildTraceGroupsFromRows(
            viewerRows as unknown as Array<StreamViewerRow<GroupRow>>,
            groups
          )
        : null,
    [groups, viewerRows]
  )
  const traceGroups = groupedTraceState?.groups ?? []
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | undefined>()

  React.useEffect(() => {
    if (!groups) {
      setSelectedGroupId(undefined)
      return
    }

    setSelectedGroupId((current) => {
      if (current && traceGroups.some((group) => group.id === current)) {
        return current
      }
      if (traceGroups.length === 0) {
        return current
      }
      const next = resolveInitialTraceGroupId(groups, traceGroups)
      return next && traceGroups.some((group) => group.id === next)
        ? next
        : traceGroups[0]?.id
    })
  }, [groups, traceGroups])

  const selectedGroup = React.useMemo(
    () => traceGroups.find((group) => group.id === selectedGroupId),
    [selectedGroupId, traceGroups]
  )

  const traceRows = React.useMemo(
    () =>
      groups
        ? buildGroupedTraceRows(selectedGroup)
        : (viewerRows as Array<StreamViewerRow<Row>>),
    [groups, selectedGroup, viewerRows]
  )

  const traceState = React.useMemo(
    () => buildTraceFromRows(traceRows, schema),
    [traceRows, schema]
  )
  const searchFieldSpecs = React.useMemo(
    () => buildTraceSearchFieldSpecs(traceState.trace),
    [traceState.trace]
  )
  const rawRows = React.useMemo(
    () => traceRows.map((row) => stripViewerRowId(row)),
    [traceRows]
  )
  const issues = React.useMemo(
    () => [...(groupedTraceState?.issues ?? []), ...traceState.issues],
    [groupedTraceState?.issues, traceState.issues]
  )
  const search = collection.definition.search?.value ?? ""
  const traceKey = selectedGroup?.id ?? traceState.trace?.traceId ?? collection.id

  const handleExportRawData = React.useCallback(() => {
    if (rawRows.length === 0) return
    downloadTextFile(
      JSON.stringify(rawRows, null, 2),
      buildJsonExportFileName(collection.id, "raw"),
      "application/json"
    )
  }, [collection.id, rawRows])

  const handleExportTraceData = React.useCallback(() => {
    if (!traceState.trace) return
    downloadTextFile(
      JSON.stringify(traceState.trace, null, 2),
      buildJsonExportFileName(collection.id, "trace"),
      "application/json"
    )
  }, [collection.id, traceState.trace])

  const reset = React.useCallback(() => {
    setSelectedGroupId(() => {
      if (!groups || traceGroups.length === 0) {
        return undefined
      }

      const next = resolveInitialTraceGroupId(groups, traceGroups)
      return next && traceGroups.some((group) => group.id === next)
        ? next
        : traceGroups[0]?.id
    })
  }, [groups, traceGroups])

  const traceContextValue = React.useMemo<DatoolTraceState>(
    () => ({
      groupPicker: groups
        ? {
            groups: traceGroups.map((group) => ({
              displayName: group.displayName,
              id: group.id,
            })),
            onValueChange: setSelectedGroupId,
            selectedGroupId,
          }
        : null,
      handleExportRawData,
      handleExportTraceData,
      hasTrace: !!traceState.trace,
      issues,
      rawRowCount: rawRows.length,
      reset,
    }),
    [
      groups,
      handleExportRawData,
      handleExportTraceData,
      issues,
      rawRows.length,
      reset,
      selectedGroupId,
      traceGroups,
      traceState.trace,
    ]
  )

  React.useEffect(() => {
    collection.registerTrace(traceContextValue)
    return () => collection.registerTrace(null)
  }, [collection.registerTrace, traceContextValue])

  React.useEffect(() => {
    collection.registerSearchFieldSpecs(searchFieldSpecs)
    return () => collection.registerSearchFieldSpecs([])
  }, [collection.registerSearchFieldSpecs, searchFieldSpecs])

  return (
    <>
      {issues.length > 0 ? (
        <div className="px-4 text-sm text-amber-700 dark:text-amber-400">
          {issues[0]?.message}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {!traceState.trace ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            {traceRows.length > 0
              ? "No trace spans were produced by the provided schema."
              : "No trace rows were returned by this query."}
          </div>
        ) : (
          <TraceViewerContextProvider
            key={traceKey}
            customPanelComponent={
              <TraceSelectionPanel schema={schema} traceState={traceState} />
            }
            customSpanClassNameFunc={(node) => node.span.className ?? ""}
            withPanel
          >
            <TraceSearchSync search={search} />
            <TraceViewerTimeline
              eagerRender
              height="100%"
              hideSearchBar
              isLive={false}
              trace={traceState.trace}
              withPanel
            />
          </TraceViewerContextProvider>
        )}
      </div>
    </>
  )
}
