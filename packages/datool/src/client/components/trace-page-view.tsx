"use client"

import * as React from "react"
import {
  LoaderCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
  Trash2Icon,
} from "lucide-react"

import { ConnectionStatus } from "./connection-status"
import { ViewerSettings } from "./viewer-settings"
import { Button } from "./ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "./ui/combobox"
import { SidebarTrigger } from "./ui/sidebar"
import { TraceViewerContextProvider, TraceViewerTimeline, useTraceViewer } from "./trace-viewer"
import { useDatoolSource } from "../hooks/use-datool-stream"
import { useDatoolNavigation } from "../navigation"
import {
  buildTraceFromRows,
  type DatoolBuiltTrace,
} from "../lib/trace-accumulator"
import { downloadTextFile, sanitizeFilePart } from "../lib/file-download"
import {
  readDatoolTraceGroup,
  writeDatoolTraceGroup,
} from "../lib/datool-url-state"
import {
  buildGroupedTraceRows,
  buildTraceGroupsFromRows,
  resolveInitialTraceGroupId,
  type ResolvedDatoolTraceGroup,
} from "../lib/trace-groups"
import type {
  DatoolTraceSchema,
  DatoolTraceGroupsConfig,
  DatoolTraceSliceColumn,
} from "../trace-types"
import { stripViewerRowId, type StreamViewerRow } from "../stream-state"
import { getValueAtPath } from "../../shared/columns"
import { formatDuration, formatWallClockTime, getHighResInMs } from "./trace-viewer/util/timing"

type TracePageViewProps<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
> = {
  groups?: DatoolTraceGroupsConfig<GroupRow, Row>
  schema: DatoolTraceSchema<Row>
  source: string
}

type ResolvedSliceColumn<Row extends Record<string, unknown>> =
  DatoolTraceSliceColumn<Row> & {
    label: string
  }

function formatFieldLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—"
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

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

  return Array.from(keys).map((accessorKey) => ({
    accessorKey,
    label: formatFieldLabel(accessorKey),
  }))
}

function renderMaybeFunction<TContext>(
  value: React.ReactNode | ((context: TContext) => React.ReactNode) | undefined,
  context: TContext
) {
  return typeof value === "function" ? value(context) : value
}

function buildJsonExportFileName(source: string, kind: "raw" | "trace") {
  const timestamp = new Date().toISOString().replaceAll(":", "-")

  return `${sanitizeFilePart(source)}-${kind}-${timestamp}.json`
}

function getTraceViewId(pathname: string) {
  return `datool-${pathname === "/" ? "index" : pathname.replace(/[^a-z0-9/-]+/gi, "-")}`
}

function TraceGroupPicker<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
>({
  groups,
  label,
  onValueChange,
  placeholder,
  selectedGroupId,
}: {
  groups: Array<ResolvedDatoolTraceGroup<GroupRow, TraceRow>>
  label: string
  onValueChange: (value: string | undefined) => void
  placeholder: string
  selectedGroupId: string | undefined
}) {
  const items = React.useMemo(
    () =>
      groups.map((group) => ({
        label: group.displayName,
        value: group.id,
      })),
    [groups]
  )
  const selectedItem =
    items.find((item) => item.value === selectedGroupId) ?? null

  return (
      <Combobox
        items={items}
        value={selectedItem}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        isItemEqualToValue={(item, value) => item.value === value.value}
        onValueChange={(item) => onValueChange(item?.value)}
      >
          <Button asChild variant="ghost" size="xl" className="flex items-center cursor-pointer text-lg!">

        <ComboboxTrigger>
          <ComboboxValue>
            {selectedItem?.label}
          </ComboboxValue>
        </ComboboxTrigger>
        </Button>

        <ComboboxContent className="md:min-w-[500px]">
          <ComboboxInput />
          <ComboboxEmpty>No groups found.</ComboboxEmpty>
          <ComboboxList>
            {(item: { label: string; value: string }) => (
              <ComboboxItem key={item.value} value={item} className="text-sm py-2 px-3">
                <span className="truncate">{item.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
  )
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

  if (!selected) {
    return null
  }

  const matchedViewerRows = traceState.spanRowsById.get(selected.span.spanId) ?? []
  const matchedRows = matchedViewerRows.map((row) => stripViewerRowId(row))
  const sliceContext = {
    matchedRows,
    selectedSpan: selected.span,
  }
  const title =
    renderMaybeFunction(schema.slice?.title, sliceContext) ?? "Slice"
  const description = renderMaybeFunction(
    schema.slice?.description,
    sliceContext
  )
  const sliceColumns = resolveSliceColumns(matchedRows, schema.slice?.columns)
  const attributeEntries = Object.entries(selected.span.attributes ?? {})

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <section className="space-y-2">
        <PanelSectionTitle>Span</PanelSectionTitle>
        <PanelKeyValue
          items={[
            ["ID", selected.span.spanId],
            ["Resource", selected.span.resource],
            ["Parent", selected.span.parentSpanId ?? "—"],
            ["Duration", formatDuration(selected.duration)],
            ["Started", formatWallClockTime(getHighResInMs(selected.span.startTime))],
            ["Ended", formatWallClockTime(getHighResInMs(selected.span.endTime))],
          ]}
        />
      </section>

      {attributeEntries.length > 0 ? (
        <section className="space-y-2">
          <PanelSectionTitle>Attributes</PanelSectionTitle>
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
          <PanelSectionTitle>{title}</PanelSectionTitle>
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

function PanelSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  )
}

function PanelKeyValue({
  items,
}: {
  items: Array<[label: string, value: React.ReactNode]>
}) {
  return (
    <div className="grid gap-2">
      {items.map(([label, value]) => (
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
  )
}

function TraceTimeline<Row extends Record<string, unknown>>({
  schema,
  traceState,
  hasRows,
  isLive,
  traceKey,
}: {
  schema: DatoolTraceSchema<Row>
  traceState: DatoolBuiltTrace<Row>
  hasRows: boolean
  isLive: boolean
  traceKey: string
}) {
  if (!traceState.trace) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
        {hasRows
          ? "No trace spans were produced by the provided schema."
          : "Waiting for trace rows…"}
      </div>
    )
  }

  return (
    <TraceViewerContextProvider
      key={traceKey}
      customPanelComponent={
        <TraceSelectionPanel schema={schema} traceState={traceState} />
      }
      customSpanClassNameFunc={(node) => node.span.className ?? ""}
      withPanel
    >
      <TraceViewerTimeline
        eagerRender
        height="100%"
        isLive={isLive}
        trace={traceState.trace}
        withPanel
      />
    </TraceViewerContextProvider>
  )
}

export function TracePageView<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
>({
  groups,
  schema,
  source,
}: TracePageViewProps<Row, GroupRow>) {
  const location = useDatoolNavigation()
  const {
    canLiveUpdate,
    errorMessage,
    isConnected,
    isConnecting,
    rows,
    setRows,
    setShouldConnect,
  } = useDatoolSource<Row | GroupRow>(source)

  const groupedTraceState = React.useMemo(
    () =>
      groups
        ? buildTraceGroupsFromRows(
            rows as Array<StreamViewerRow<GroupRow>>,
            groups
          )
        : null,
    [groups, rows]
  )
  const traceGroups = groupedTraceState?.groups ?? []
  const traceViewId = React.useMemo(
    () => getTraceViewId(location.pathname),
    [location.pathname]
  )
  const [selectedGroupId, setSelectedGroupId] = React.useState<
    string | undefined
  >(undefined)

  React.useEffect(() => {
    if (!groups) {
      setSelectedGroupId(undefined)
      return
    }

    setSelectedGroupId(readDatoolTraceGroup(traceViewId))
  }, [groups, traceViewId])

  React.useEffect(() => {
    if (!groups) {
      setSelectedGroupId(undefined)
      return
    }

    setSelectedGroupId((current) => {
      if (current && traceGroups.some((group) => group.id === current)) {
        return current
      }

      // Data hasn't loaded yet — keep the current value (may be from URL)
      if (traceGroups.length === 0) {
        return current
      }

      const nextGroupId = resolveInitialTraceGroupId(groups, traceGroups)

      return nextGroupId && traceGroups.some((group) => group.id === nextGroupId)
        ? nextGroupId
        : traceGroups[0]?.id
    })
  }, [groups, traceGroups])

  React.useEffect(() => {
    if (!groups) {
      return
    }

    writeDatoolTraceGroup({
      groupId: selectedGroupId,
      viewId: traceViewId,
    })
  }, [groups, selectedGroupId, traceViewId])

  const selectedGroup = React.useMemo(
    () => traceGroups.find((group) => group.id === selectedGroupId),
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
  const traceKey =
    selectedGroup?.id ??
    traceState.trace?.traceId ??
    source

  const handleExportRawData = React.useCallback(() => {
    if (rawRows.length === 0) {
      return
    }

    downloadTextFile(
      JSON.stringify(rawRows, null, 2),
      buildJsonExportFileName(source, "raw"),
      "application/json"
    )
  }, [rawRows, source])

  const handleExportTraceData = React.useCallback(() => {
    if (!traceState.trace) {
      return
    }

    downloadTextFile(
      JSON.stringify(traceState.trace, null, 2),
      buildJsonExportFileName(source, "trace"),
      "application/json"
    )
  }, [source, traceState.trace])

  return (
    <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden bg-background pt-3">
      <header className="flex w-full flex-wrap items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <SidebarTrigger className="shrink-0" />
          {groups ? (
            <TraceGroupPicker
              groups={traceGroups}
              label={groups.label ?? "Trace Group"}
              onValueChange={setSelectedGroupId}
              placeholder={groups.placeholder ?? "Select a trace group"}
              selectedGroupId={selectedGroupId}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* <ConnectionStatus
            className="rounded-md border border-border bg-muted/40 px-3 py-2"
            isConnected={isConnected}
            isConnecting={isConnecting}
          /> */}
          <Button
            aria-label="Clear trace rows"
            onClick={() => setRows([])}
            size="icon-xl"
            type="button"
            variant="outline"
          >
            <Trash2Icon className="size-4" />
          </Button>
          <Button
            aria-label={isConnected ? "Pause live updates" : "Resume live updates"}
            className="gap-2"
            disabled={!canLiveUpdate}
            onClick={() => setShouldConnect((current) => !current)}
            size="xl"
            type="button"
            variant="outline"
          >
            {isConnecting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : isConnected ? (
              <StopCircleIcon className="size-4" />
            ) : (
              <PlayCircleIcon className="size-4" />
            )}
            Live
          </Button>
          <ViewerSettings
            exportActions={[
              {
                id: "raw-data",
                label: "Export Raw Data",
                disabled: rawRows.length === 0,
                onSelect: handleExportRawData,
              },
              {
                id: "trace-data",
                label: "Export Trace Data",
                disabled: !traceState.trace,
                onSelect: handleExportTraceData,
              },
            ]}
            isDisabled={rows.length === 0 && !traceState.trace}
          />
        </div>
      </header>

      {errorMessage ? (
        <div className="px-4 text-sm text-destructive">{errorMessage}</div>
      ) : null}

      {issues.length > 0 ? (
        <div className="px-4 text-sm text-amber-700 dark:text-amber-400">
          {issues[0]?.message}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <TraceTimeline
          hasRows={traceRows.length > 0}
          isLive={isConnected || isConnecting}
          schema={schema}
          traceKey={traceKey}
          traceState={traceState}
        />
      </div>
    </main>
  )
}
