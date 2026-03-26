"use client"

import * as React from "react"

import { TraceViewerContextProvider, TraceViewerTimeline, useTraceViewer } from "./trace-viewer"
import { useDatoolSourceContext } from "../providers/datool-source-context"
import type { DatoolTraceState } from "../providers/datool-source-context"
import { useDatoolNavigation } from "../navigation"
import {
  buildTraceFromRows,
  type DatoolBuiltTrace,
} from "../lib/trace-accumulator"
import { downloadTextFile, sanitizeFilePart } from "../lib/file-download"
import { useDatoolState } from "../hooks/use-datool-state"
import {
  buildGroupedTraceRows,
  buildTraceGroupsFromRows,
  resolveInitialTraceGroupId,
} from "../lib/trace-groups"
import type {
  DatoolTraceSchema,
  DatoolTraceGroupsConfig,
  DatoolTraceSliceColumn,
} from "../trace-types"
import { stripViewerRowId, type StreamViewerRow } from "../stream-state"
import { getValueAtPath } from "../../shared/columns"
import { formatDuration, formatWallClockTime, getHighResInMs } from "./trace-viewer/util/timing"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DatoolTraceViewerProps<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
> = {
  groups?: DatoolTraceGroupsConfig<GroupRow, Row>
  schema: DatoolTraceSchema<Row>
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function resolveSliceColumns<Row extends Record<string, unknown>>(
  matchedRows: Row[],
  declaredColumns: DatoolTraceSliceColumn<Row>[] | undefined
): ResolvedSliceColumn<Row>[] {
  if (declaredColumns && declaredColumns.length > 0) {
    return declaredColumns.map((c) => ({ ...c, label: c.label ?? formatFieldLabel(c.accessorKey) }))
  }
  const keys = new Set<string>()
  for (const row of matchedRows.slice(0, 10)) {
    for (const key of Object.keys(row)) keys.add(key)
  }
  return Array.from(keys).map((k) => ({ accessorKey: k, label: formatFieldLabel(k) }))
}

function renderMaybeFunction<TContext>(
  value: React.ReactNode | ((context: TContext) => React.ReactNode) | undefined,
  context: TContext
) {
  return typeof value === "function" ? value(context) : value
}

function buildJsonExportFileName(source: string, kind: "raw" | "trace") {
  return `${sanitizeFilePart(source)}-${kind}-${new Date().toISOString().replaceAll(":", "-")}.json`
}

function getTraceViewId(pathname: string) {
  return `datool-${pathname === "/" ? "index" : pathname.replace(/[^a-z0-9/-]+/gi, "-")}`
}

// ---------------------------------------------------------------------------
// Selection panel (rendered inside TraceViewerContextProvider)
// ---------------------------------------------------------------------------

function TraceSelectionPanel<Row extends Record<string, unknown>>({
  schema,
  traceState,
}: {
  schema: DatoolTraceSchema<Row>
  traceState: DatoolBuiltTrace<Row>
}) {
  const { state: { selected } } = useTraceViewer()
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Span</h3>
        <div className="grid gap-2">
          {([
            ["ID", selected.span.spanId],
            ["Resource", selected.span.resource],
            ["Parent", selected.span.parentSpanId ?? "\u2014"],
            ["Duration", formatDuration(selected.duration)],
            ["Started", formatWallClockTime(getHighResInMs(selected.span.startTime))],
            ["Ended", formatWallClockTime(getHighResInMs(selected.span.endTime))],
          ] as Array<[string, React.ReactNode]>).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,88px)_1fr] gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="min-w-0 break-words text-sm text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {attributeEntries.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attributes</h3>
          <div className="space-y-2">
            {attributeEntries.map(([key, value]) => (
              <div key={key} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{key}</div>
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {matchedRows.length} row{matchedRows.length === 1 ? "" : "s"}
          </span>
        </div>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
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
                              : value !== null && value !== undefined && typeof value === "object"
                                ? <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">{stringifyValue(value)}</pre>
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

// ---------------------------------------------------------------------------
// Sync external search → trace viewer filter
// ---------------------------------------------------------------------------

function TraceSearchSync({ search }: { search: string }) {
  const { dispatch } = useTraceViewer()
  React.useEffect(() => {
    dispatch({ type: 'setFilter', filter: search })
  }, [dispatch, search])
  return null
}

// ---------------------------------------------------------------------------
// Connected TraceViewer (level 2)
// ---------------------------------------------------------------------------

export function DatoolTraceViewer<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
>({
  groups,
  schema,
}: DatoolTraceViewerProps<Row, GroupRow>) {
  const location = useDatoolNavigation()
  const {
    isConnected,
    isConnecting,
    registerTrace,
    rows,
    search: sourceSearch,
    setSearch: setSourceSearch,
    sourceId,
  } = useDatoolSourceContext<Row | GroupRow>()

  const traceViewId = React.useMemo(
    () => getTraceViewId(location.pathname),
    [location.pathname]
  )

  // ---- Persisted search (consistent with DatoolDataTable) ----
  const searchStateKey = `${traceViewId}-search`
  const [persistedSearch, setPersistedSearch] = useDatoolState(searchStateKey)

  // Init: sync persisted search to source context on mount
  React.useEffect(() => {
    if (persistedSearch) {
      setSourceSearch(persistedSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist source search changes
  const [prevSourceSearch, setPrevSourceSearch] = React.useState(sourceSearch)
  if (sourceSearch !== prevSourceSearch) {
    setPrevSourceSearch(sourceSearch)
    setPersistedSearch(sourceSearch || null)
  }

  // Sync persisted search → source (handles back/forward)
  const [prevPersistedSearch, setPrevPersistedSearch] = React.useState(persistedSearch)
  if (persistedSearch !== prevPersistedSearch) {
    setPrevPersistedSearch(persistedSearch)
    setSourceSearch(persistedSearch)
  }

  const search = sourceSearch

  const groupedTraceState = React.useMemo(
    () =>
      groups
        ? buildTraceGroupsFromRows(rows as Array<StreamViewerRow<GroupRow>>, groups)
        : null,
    [groups, rows]
  )
  const traceGroups = groupedTraceState?.groups ?? []

  const traceGroupStateKey = `traceviewer-${traceViewId}-group`
  const [persistedGroupId, setPersistedGroupId] = useDatoolState(traceGroupStateKey)

  const [selectedGroupId, setSelectedGroupIdInternal] = React.useState<string | undefined>(
    () => persistedGroupId || undefined
  )

  const setSelectedGroupId = React.useCallback(
    (value: string | undefined) => {
      setSelectedGroupIdInternal(value)
      setPersistedGroupId(value ?? null)
    },
    [setPersistedGroupId]
  )

  // Sync persisted → local (handles back/forward via state manager subscribe)
  const [prevPersistedGroupId, setPrevPersistedGroupId] = React.useState(persistedGroupId)
  if (persistedGroupId !== prevPersistedGroupId) {
    setPrevPersistedGroupId(persistedGroupId)
    setSelectedGroupIdInternal(persistedGroupId || undefined)
  }

  // Auto-select a group when groups change
  React.useEffect(() => {
    if (!groups) { setSelectedGroupIdInternal(undefined); return }
    setSelectedGroupIdInternal((current) => {
      if (current && traceGroups.some((g) => g.id === current)) return current
      if (traceGroups.length === 0) return current
      const next = resolveInitialTraceGroupId(groups, traceGroups)
      return next && traceGroups.some((g) => g.id === next) ? next : traceGroups[0]?.id
    })
  }, [groups, traceGroups])

  const selectedGroup = React.useMemo(
    () => traceGroups.find((g) => g.id === selectedGroupId),
    [selectedGroupId, traceGroups]
  )

  const traceRows = React.useMemo(
    () =>
      groups
        ? buildGroupedTraceRows(selectedGroup)
        : (rows as Array<StreamViewerRow<Row>>),
    [groups, rows, selectedGroup]
  )

  const traceState = React.useMemo(
    () => buildTraceFromRows(traceRows, schema),
    [traceRows, schema]
  )

  const rawRows = React.useMemo(
    () => traceRows.map((row) => stripViewerRowId(row)),
    [traceRows]
  )

  const issues = React.useMemo(
    () => [...(groupedTraceState?.issues ?? []), ...traceState.issues],
    [groupedTraceState?.issues, traceState.issues]
  )

  const traceKey = selectedGroup?.id ?? traceState.trace?.traceId ?? sourceId

  const handleExportRawData = React.useCallback(() => {
    if (rawRows.length === 0) return
    downloadTextFile(
      JSON.stringify(rawRows, null, 2),
      buildJsonExportFileName(sourceId, "raw"),
      "application/json"
    )
  }, [rawRows, sourceId])

  const handleExportTraceData = React.useCallback(() => {
    if (!traceState.trace) return
    downloadTextFile(
      JSON.stringify(traceState.trace, null, 2),
      buildJsonExportFileName(sourceId, "trace"),
      "application/json"
    )
  }, [sourceId, traceState.trace])

  // Register trace state on source context
  const traceContextValue = React.useMemo<DatoolTraceState>(
    () => ({
      groupPicker: groups
        ? {
            groups: traceGroups.map((g) => ({ displayName: g.displayName, id: g.id })),
            onValueChange: setSelectedGroupId,
            selectedGroupId,
          }
        : null,
      handleExportRawData,
      handleExportTraceData,
      hasTrace: !!traceState.trace,
      issues,
      rawRowCount: rawRows.length,
    }),
    [groups, handleExportRawData, handleExportTraceData, issues, rawRows.length, selectedGroupId, traceGroups, traceState.trace]
  )

  React.useEffect(() => {
    registerTrace(traceContextValue)
    return () => registerTrace(null)
  }, [registerTrace, traceContextValue])

  const isLive = isConnected || isConnecting

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
              : "Waiting for trace rows\u2026"}
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
              isLive={isLive}
              trace={traceState.trace}
              withPanel
            />
          </TraceViewerContextProvider>
        )}
      </div>
    </>
  )
}
