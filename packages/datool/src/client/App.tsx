import * as React from "react"
import type { VisibilityState } from "@tanstack/react-table"
import { Copy, Filter } from "lucide-react"

import {
  DataTable,
  DataTableProvider,
  type DataTableColumnConfig,
  type DataTableRowAction,
  useDataTableContext,
} from "@/components/data-table"
import {
  DataTableColIcon,
  type DataTableColumnKind,
} from "@/components/data-table-col-icon"
import {
  getValueAtPath,
  isNestedAccessorKey,
  resolveDatoolColumnId,
} from "../shared/columns"
import type {
  DatoolActionRequest,
  DatoolActionRowChange,
  DatoolActionResponse,
  DatoolClientConfig,
  DatoolClientStream,
  DatoolColumn,
  DatoolSseEndEvent,
  DatoolRowEvent,
  DatoolSseErrorEvent,
} from "../shared/types"
import {
  DataTableSearchInput,
  type DataTableSearchInputHandle,
} from "@/components/data-table-search-input"
import { StreamControls } from "@/components/stream-controls"
import { ViewerSettings } from "@/components/viewer-settings"
import {
  quoteSearchTokenValue,
  splitSearchQuery,
} from "@/lib/data-table-search"
import {
  readDatoolColumnVisibility,
  readDatoolGrouping,
  readDatoolSearch,
  readSelectedStreamId,
  writeDatoolUrlState,
} from "@/lib/datool-url-state"
import { LOG_VIEWER_ICONS } from "@/lib/datool-icons"
import { upsertViewerRow } from "./stream-state"

type ViewerRow = Record<string, unknown> & {
  __datoolRowId: string
}

type ViewerExportColumn = {
  accessorKey: string
  id: string
  kind?: DataTableColumnKind
  label: string
}

const GROUPED_ROW_GAP = 32

function toActionRows(rows: ViewerRow[]): Record<string, unknown>[] {
  return rows.map(({ __datoolRowId: _datoolRowId, ...row }) => row)
}

function stringifyGroupingValue(value: unknown) {
  if (value === undefined) {
    return "undefined:"
  }

  if (value === null) {
    return "null:"
  }

  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }

  if (typeof value === "object") {
    try {
      return `object:${JSON.stringify(value)}`
    } catch {
      return `object:${String(value)}`
    }
  }

  return `${typeof value}:${String(value)}`
}

function groupViewerRows(
  rows: ViewerRow[],
  columns: ViewerExportColumn[]
): {
  groupStartRowIds: Set<string>
  rows: ViewerRow[]
} {
  if (columns.length === 0 || rows.length === 0) {
    return {
      groupStartRowIds: new Set<string>(),
      rows,
    }
  }

  const groupOrder: string[] = []
  const rowsByGroup = new Map<string, ViewerRow[]>()

  for (const row of rows) {
    const groupKey = columns
      .map((column) =>
        stringifyGroupingValue(getValueAtPath(row, column.accessorKey))
      )
      .join("\u001f")
    const existingRows = rowsByGroup.get(groupKey)

    if (existingRows) {
      existingRows.push(row)
      continue
    }

    groupOrder.push(groupKey)
    rowsByGroup.set(groupKey, [row])
  }

  const groupedRows: ViewerRow[] = []
  const groupStartRowIds = new Set<string>()

  groupOrder.forEach((groupKey, index) => {
    const groupRows = rowsByGroup.get(groupKey) ?? []

    if (index > 0 && groupRows[0]) {
      groupStartRowIds.add(groupRows[0].__datoolRowId)
    }

    groupedRows.push(...groupRows)
  })

  return {
    groupStartRowIds,
    rows: groupedRows,
  }
}

function applyActionRowChanges(
  currentRows: ViewerRow[],
  targetRowIds: string[],
  rowChanges: Array<DatoolActionRowChange<Record<string, unknown>>> | undefined
) {
  if (!rowChanges || rowChanges.length === 0) {
    return currentRows
  }

  const rowChangeById = new Map(
    targetRowIds.map((rowId, index) => [rowId, rowChanges[index] ?? true])
  )

  return currentRows.flatMap((row) => {
    const change = rowChangeById.get(row.__datoolRowId)

    if (change === undefined || change === true) {
      return [row]
    }

    if (change === false || change === null) {
      return []
    }

    return [
      {
        ...change,
        __datoolRowId: row.__datoolRowId,
      },
    ]
  })
}

function getInitialStreamId() {
  return readSelectedStreamId()
}

function formatColumnLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getTableId(streamId: string | null) {
  return streamId ? `datool-${streamId}` : "datool"
}

function stringifyExportValue(value: unknown, kind?: DataTableColumnKind) {
  if (value === null || value === undefined || value === "") {
    return ""
  }

  if (kind === "date") {
    const date =
      value instanceof Date ? value : new Date(value as string | number)

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

function escapeCsvValue(value: string) {
  if (!/[",\n]/.test(value)) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

function escapeMarkdownValue(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r\n?/g, "\n").replace(/\n/g, "<br />")
}

function sanitizeFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "log-view"
  )
}

function downloadTextFile(
  content: string,
  fileName: string,
  contentType: string
) {
  const blob = new Blob([content], {
    type: `${contentType};charset=utf-8`,
  })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl)
  }, 0)
}

function buildCsvContent(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  const headerRow = columns.map((column) => escapeCsvValue(column.label)).join(",")
  const dataRows = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsvValue(
          stringifyExportValue(getValueAtPath(row, column.accessorKey), column.kind)
        )
      )
      .join(",")
  )

  return [headerRow, ...dataRows].join("\n")
}

function buildMarkdownContent(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  const headerRow = `| ${columns
    .map((column) => escapeMarkdownValue(column.label))
    .join(" | ")} |`
  const dividerRow = `| ${columns.map(() => "---").join(" | ")} |`
  const dataRows = rows.map((row) =>
    `| ${columns
      .map((column) =>
        escapeMarkdownValue(
          stringifyExportValue(getValueAtPath(row, column.accessorKey), column.kind)
        )
      )
      .join(" | ")} |`
  )

  return [headerRow, dividerRow, ...dataRows].join("\n")
}

function buildTableColumns(
  columns: DatoolColumn[]
): DataTableColumnConfig<ViewerRow>[] {
  return columns.map((column, index) => {
    const nestedAccessor = isNestedAccessorKey(column.accessorKey)

    return {
      accessorFn: nestedAccessor
        ? (row) => getValueAtPath(row, column.accessorKey)
        : undefined,
      accessorKey: nestedAccessor
        ? undefined
        : (column.accessorKey as Extract<keyof ViewerRow, string>),
      align: column.align,
      enumColors: column.enumColors,
      header: column.header,
      id: resolveDatoolColumnId(column, index),
      kind: column.kind,
      maxWidth: column.maxWidth,
      minWidth: column.minWidth,
      truncate: column.truncate,
      width: column.width,
    } satisfies DataTableColumnConfig<ViewerRow>
  })
}

function parseRowEvent(event: MessageEvent<string>) {
  return JSON.parse(event.data) as DatoolRowEvent
}

function parseErrorEvent(event: MessageEvent<string>) {
  return JSON.parse(event.data) as DatoolSseErrorEvent
}

function parseEndEvent(event: MessageEvent<string>) {
  return JSON.parse(event.data) as DatoolSseEndEvent
}

function stringifyRowActionValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

function escapeMarkdownCell(value: string) {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "<br />")
}

function getColumnValue(
  row: ViewerRow,
  column: DataTableColumnConfig<ViewerRow>
): unknown {
  if (column.accessorFn) {
    return column.accessorFn(row)
  }

  if (column.accessorKey) {
    return row[column.accessorKey]
  }

  return undefined
}

function getColumnLabel(
  column: DataTableColumnConfig<ViewerRow>,
  index: number
): string {
  return column.header ?? column.id ?? column.accessorKey ?? `Column ${index + 1}`
}

function toMarkdownTable(
  tableRows: ViewerRow[],
  tableColumns: DataTableColumnConfig<ViewerRow>[]
) {
  const headers = tableColumns.map((column, index) =>
    escapeMarkdownCell(getColumnLabel(column, index))
  )
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...tableRows.map((row) => {
      const values = tableColumns.map((column) =>
        escapeMarkdownCell(stringifyRowActionValue(getColumnValue(row, column)))
      )

      return `| ${values.join(" | ")} |`
    }),
  ]

  return lines.join("\n")
}

function buildFieldFilterToken(fieldId: string, value: unknown) {
  const serializedValue = stringifyRowActionValue(value)

  if (!serializedValue.trim()) {
    return null
  }

  return `${fieldId}:${quoteSearchTokenValue(serializedValue)}`
}

function replaceFieldFilter(query: string, fieldId: string, nextToken: string) {
  const escapedFieldId = fieldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const nextTokens = splitSearchQuery(query).filter(
    (token) => !token.match(new RegExp(`^${escapedFieldId}(:|>|<)`))
  )

  nextTokens.push(nextToken)

  return nextTokens.join(" ")
}

function DatoolTable({
  activeStream,
  columns,
  config,
  errorMessage,
  isConnected,
  isConnecting,
  isLoadingConfig,
  rows,
  settingsColumns,
  groupedColumnIds,
  groupedRowStartIds,
  selectedStreamId,
  setGroupedColumnIds,
  setColumnVisibility,
  searchInputRef,
  handleExport,
  setRows,
  setSelectedStreamId,
  setShouldConnect,
}: {
  activeStream: DatoolClientStream | null
  columns: DataTableColumnConfig<ViewerRow>[]
  config: DatoolClientConfig | null
  errorMessage: string | null
  isConnected: boolean
  isConnecting: boolean
  isLoadingConfig: boolean
  rows: ViewerRow[]
  settingsColumns: Array<{
    id: string
    kind?: DataTableColumnKind
    label: string
    visible: boolean
  }>
  groupedColumnIds: string[]
  groupedRowStartIds: Set<string>
  selectedStreamId: string | null
  setGroupedColumnIds: React.Dispatch<React.SetStateAction<string[]>>
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  searchInputRef: React.RefObject<DataTableSearchInputHandle | null>
  handleExport: (format: "csv" | "md") => void
  setRows: React.Dispatch<React.SetStateAction<ViewerRow[]>>
  setSelectedStreamId: React.Dispatch<React.SetStateAction<string | null>>
  setShouldConnect: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const { search, setSearch } = useDataTableContext<ViewerRow>()
  const resolveRowStyle = React.useCallback(
    (row: ViewerRow) => {
      if (!groupedRowStartIds.has(row.__datoolRowId)) {
        return undefined
      }

      return {
        borderTop: `${GROUPED_ROW_GAP}px solid var(--color-table-gap)`,
        boxShadow: `inset 0 1px 0 0 var(--color-border)`,
      } satisfies React.CSSProperties
    },
    [groupedRowStartIds]
  )
  const rowActions = React.useMemo<DataTableRowAction<ViewerRow>[]>(
    () => {
      const configActions =
        activeStream?.actions.map(
          (action): DataTableRowAction<ViewerRow> => ({
            button: action.button,
            icon: action.icon ? LOG_VIEWER_ICONS[action.icon] : undefined,
            id: `config-${action.id}`,
            label: action.label,
            onSelect: async ({ actionRowIds, actionRows }) => {
              if (!activeStream) {
                return
              }

              const url = new URL(
                `/api/streams/${encodeURIComponent(activeStream.id)}/actions/${encodeURIComponent(action.id)}`,
                window.location.origin
              )
              const currentParams = new URL(window.location.href).searchParams

              for (const [key, value] of currentParams.entries()) {
                url.searchParams.set(key, value)
              }

              const requestBody: DatoolActionRequest = {
                rows: toActionRows(actionRows),
              }
              const response = await fetch(url, {
                body: JSON.stringify(requestBody),
                headers: {
                  "Content-Type": "application/json",
                },
                method: "POST",
              })
              const payload = (await response
                .json()
                .catch(() => null)) as
                | (DatoolActionResponse & {
                    error?: string
                  })
                | null

              if (!response.ok) {
                throw new Error(
                  payload?.error ?? `Failed to run action "${action.label}".`
                )
              }

              if (
                payload?.rowChanges !== undefined &&
                !Array.isArray(payload.rowChanges)
              ) {
                throw new Error(
                  `Action "${action.label}" returned an invalid response.`
                )
              }

              setRows((currentRows) =>
                applyActionRowChanges(
                  currentRows,
                  actionRowIds,
                  payload?.rowChanges
                )
              )
            },
            scope: "selection",
          })
        ) ?? []

      return [
        ...configActions,
        {
          icon: Copy,
          id: "copy-markdown",
          label: ({ actionRows }) =>
            actionRows.length > 1
              ? `Copy ${actionRows.length} rows as Markdown`
              : "Copy row as Markdown",
          onSelect: async ({ actionRows }) => {
            await navigator.clipboard.writeText(
              toMarkdownTable(actionRows, columns)
            )
          },
          scope: "selection",
        },
        {
          icon: Filter,
          id: "filter-matching",
          items: ({ anchorRow }) =>
            columns.map((column, index) => {
              const value = getColumnValue(anchorRow, column)
              const token = buildFieldFilterToken(
                column.id ?? `column-${index}`,
                value
              )

              return {
                disabled: token === null,
                icon: (props) => (
                  <DataTableColIcon kind={column.kind ?? "text"} {...props} />
                ),
                id: `filter-${column.id ?? index}`,
                label: `${getColumnLabel(column, index)}: ${
                  stringifyRowActionValue(value) || "(empty)"
                }`,
                onSelect: () => {
                  if (!token) {
                    return
                  }

                  setSearch(
                    replaceFieldFilter(
                      search,
                      column.id ?? `column-${index}`,
                      token
                    )
                  )
                },
                scope: "row",
              } satisfies DataTableRowAction<ViewerRow>
            }),
          label: "Filter matching",
          scope: "row",
        },
      ]
    },
    [activeStream, columns, search, setSearch]
  )

  return (
    <main className="flex h-svh min-h-0 w-full min-w-0 flex-col gap-3 bg-background px-0 pt-3 pb-0">
      <header className="flex w-full flex-wrap items-start gap-3 px-4">
        <DataTableSearchInput inputRef={searchInputRef} />
        <div className="flex min-w-20 items-start gap-3">
          <StreamControls
            streams={config?.streams ?? []}
            selectedStreamId={selectedStreamId}
            isConnected={isConnected}
            isConnecting={isConnecting}
            isDisabled={isLoadingConfig || !config}
            canClear={rows.length > 0}
            onSelectStream={setSelectedStreamId}
            onPlay={() => setShouldConnect(true)}
            onPause={() => setShouldConnect(false)}
            onClear={() => setRows([])}
          />
          <ViewerSettings
            columns={settingsColumns}
            groupedColumnIds={groupedColumnIds}
            isDisabled={isLoadingConfig || !activeStream}
            onExportCsv={() => handleExport("csv")}
            onExportMarkdown={() => handleExport("md")}
            onClearGrouping={() => setGroupedColumnIds([])}
            onToggleGrouping={(columnId, grouped) =>
              setGroupedColumnIds((current) => {
                if (grouped) {
                  return current.includes(columnId)
                    ? current
                    : [...current, columnId]
                }

                return current.filter(
                  (currentColumnId) => currentColumnId !== columnId
                )
              })
            }
            onToggleColumn={(columnId, visible) =>
              setColumnVisibility((current) => ({
                ...current,
                [columnId]: visible,
              }))
            }
          />
        </div>
      </header>

      {errorMessage ? (
        <div className="px-4 text-sm text-destructive">{errorMessage}</div>
      ) : null}

      <div className="min-h-0 flex-1">
        {activeStream ? (
          <DataTable rowActions={rowActions} rowStyle={resolveRowStyle} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No stream selected.
          </div>
        )}
      </div>
    </main>
  )
}

export default function App() {
  const [initialUrlState] = React.useState(() => {
    const streamId = getInitialStreamId()
    const tableId = getTableId(streamId)

    return {
      search: readDatoolSearch(tableId),
      streamId,
      tableId,
    }
  })
  const [config, setConfig] = React.useState<DatoolClientConfig | null>(null)
  const [rows, setRows] = React.useState<ViewerRow[]>([])
  const [selectedStreamId, setSelectedStreamId] = React.useState<string | null>(
    () => initialUrlState.streamId
  )
  const [shouldConnect, setShouldConnect] = React.useState(() =>
    Boolean(initialUrlState.streamId)
  )
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true)
  const [isConnected, setIsConnected] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState(() => initialUrlState.search)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    {}
  )
  const [groupedColumnIds, setGroupedColumnIds] = React.useState<string[]>([])
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const hasInitializedStreamRef = React.useRef(false)
  const [hydratedTableId, setHydratedTableId] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    let cancelled = false

    void fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load log viewer config.")
        }

        return (await response.json()) as DatoolClientConfig
      })
      .then((nextConfig) => {
        if (cancelled) {
          return
        }

        setConfig(nextConfig)
        setSelectedStreamId((currentValue) => {
          if (
            currentValue &&
            nextConfig.streams.some((stream) => stream.id === currentValue)
          ) {
            return currentValue
          }

          return nextConfig.streams[0]?.id ?? null
        })
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : String(error)
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingConfig(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const activeStream = React.useMemo<DatoolClientStream | null>(() => {
    if (!config || !selectedStreamId) {
      return null
    }

    return (
      config.streams.find((stream) => stream.id === selectedStreamId) ?? null
    )
  }, [config, selectedStreamId])

  const columns = React.useMemo(
    () => (activeStream ? buildTableColumns(activeStream.columns) : []),
    [activeStream]
  )
  const tableId = React.useMemo(
    () => getTableId(selectedStreamId),
    [selectedStreamId]
  )
  const exportColumns = React.useMemo(
    () =>
      activeStream?.columns.map((column, index) => ({
        accessorKey: column.accessorKey,
        id: resolveDatoolColumnId(column, index),
        kind: column.kind,
        label: column.header ?? formatColumnLabel(column.accessorKey),
      })) ?? [],
    [activeStream]
  )
  const settingsColumns = React.useMemo(
    () =>
      exportColumns.map((column) => ({
        id: column.id,
        kind: column.kind,
        label: column.label,
        visible: columnVisibility[column.id] !== false,
      })),
    [columnVisibility, exportColumns]
  )
  const visibleExportColumns = React.useMemo(
    () =>
      exportColumns.filter((column) => columnVisibility[column.id] !== false),
    [columnVisibility, exportColumns]
  )
  const exportColumnsById = React.useMemo(
    () => new Map(exportColumns.map((column) => [column.id, column])),
    [exportColumns]
  )
  const groupedExportColumns = React.useMemo(
    () =>
      groupedColumnIds.flatMap((columnId) => {
        const column = exportColumnsById.get(columnId)

        return column ? [column] : []
      }),
    [exportColumnsById, groupedColumnIds]
  )
  const groupedRowsState = React.useMemo(
    () => groupViewerRows(rows, groupedExportColumns),
    [groupedExportColumns, rows]
  )
  const isConnecting = Boolean(selectedStreamId) && shouldConnect && !isConnected
  const columnIds = React.useMemo(
    () => exportColumns.map((column) => column.id),
    [exportColumns]
  )

  React.useEffect(() => {
    if (hasInitializedStreamRef.current) {
      setRows([])
      setErrorMessage(null)
    }

    hasInitializedStreamRef.current = true
  }, [selectedStreamId])

  React.useEffect(() => {
    if (!activeStream) {
      setGroupedColumnIds([])
      setHydratedTableId(null)
      return
    }

    setSearch(readDatoolSearch(tableId))
    setColumnVisibility(readDatoolColumnVisibility(tableId, columnIds))
    setGroupedColumnIds(readDatoolGrouping(tableId, columnIds))
    setHydratedTableId(tableId)
  }, [activeStream, columnIds, tableId])

  React.useEffect(() => {
    if (!activeStream || hydratedTableId !== tableId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      writeDatoolUrlState({
        columnIds,
        columnVisibility,
        groupBy: groupedColumnIds,
        search,
        selectedStreamId,
        tableId,
      })
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [
    activeStream,
    columnIds,
    columnVisibility,
    groupedColumnIds,
    hydratedTableId,
    search,
    selectedStreamId,
    tableId,
  ])

  React.useEffect(() => {
    const handlePopState = () => {
      const nextStreamId = readSelectedStreamId()
      const nextTableId = getTableId(nextStreamId)

      setSelectedStreamId((currentValue) => {
        if (currentValue === nextStreamId) {
          setSearch(readDatoolSearch(nextTableId))
          setColumnVisibility(
            readDatoolColumnVisibility(nextTableId, columnIds)
          )
          setGroupedColumnIds(readDatoolGrouping(nextTableId, columnIds))
          setHydratedTableId(nextTableId)
        }

        return nextStreamId
      })
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [columnIds])

  React.useEffect(() => {
    if (!selectedStreamId || !shouldConnect) {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setIsConnected(false)
      return
    }

    setErrorMessage(null)
    setRows([])

    const url = new URL(
      `/api/streams/${encodeURIComponent(selectedStreamId)}/events`,
      window.location.origin
    )
    const currentParams = new URL(window.location.href).searchParams

    for (const [key, value] of currentParams.entries()) {
      url.searchParams.set(key, value)
    }

    const eventSource = new EventSource(url)

    eventSourceRef.current = eventSource

    const handleRow = (event: MessageEvent<string>) => {
      const payload = parseRowEvent(event)

      setRows((currentRows) =>
        upsertViewerRow(currentRows, {
          ...payload.row,
          __datoolRowId: payload.id,
        })
      )
    }

    const handleRuntimeError = (event: MessageEvent<string>) => {
      const payload = parseErrorEvent(event)

      setErrorMessage(payload.message)
    }

    const handleEnd = (event: MessageEvent<string>) => {
      parseEndEvent(event)
      eventSource.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onerror = () => {
      setIsConnected(false)
    }

    eventSource.addEventListener("row", handleRow as EventListener)
    eventSource.addEventListener(
      "runtime-error",
      handleRuntimeError as EventListener
    )
    eventSource.addEventListener("end", handleEnd as EventListener)

    return () => {
      eventSource.removeEventListener("row", handleRow as EventListener)
      eventSource.removeEventListener(
        "runtime-error",
        handleRuntimeError as EventListener
      )
      eventSource.removeEventListener("end", handleEnd as EventListener)
      eventSource.close()
      setIsConnected(false)
    }
  }, [selectedStreamId, shouldConnect])

  const searchInputRef = React.useRef<DataTableSearchInputHandle>(null)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.selectAll()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleExport = React.useCallback(
    (format: "csv" | "md") => {
      if (!activeStream || visibleExportColumns.length === 0) {
        return
      }

      const timeStamp = new Date().toISOString().replaceAll(":", "-")
      const fileBaseName = `${sanitizeFilePart(activeStream.label)}-${timeStamp}`
      const content =
        format === "csv"
          ? buildCsvContent(groupedRowsState.rows, visibleExportColumns)
          : buildMarkdownContent(groupedRowsState.rows, visibleExportColumns)

      downloadTextFile(
        content,
        `${fileBaseName}.${format}`,
        format === "csv" ? "text/csv" : "text/markdown"
      )
    },
    [activeStream, groupedRowsState.rows, visibleExportColumns]
  )

  return (
    <DataTableProvider
      autoScrollToBottom={groupedColumnIds.length === 0}
      columnVisibility={columnVisibility}
      columns={columns}
      data={groupedRowsState.rows}
      dateFormat={config?.dateFormat}
      getRowId={(row) => row.__datoolRowId}
      height="100%"
      id={tableId}
      onColumnVisibilityChange={setColumnVisibility}
      onSearchChange={setSearch}
      search={search}
      rowHeight={20}
      statePersistence="none"
    >
      <DatoolTable
        activeStream={activeStream}
        columns={columns}
        config={config}
        errorMessage={errorMessage}
        handleExport={handleExport}
        isConnected={isConnected}
        isConnecting={isConnecting}
        isLoadingConfig={isLoadingConfig}
        groupedColumnIds={groupedColumnIds}
        groupedRowStartIds={groupedRowsState.groupStartRowIds}
        rows={rows}
        settingsColumns={settingsColumns}
        setGroupedColumnIds={setGroupedColumnIds}
        setColumnVisibility={setColumnVisibility}
        searchInputRef={searchInputRef}
        selectedStreamId={selectedStreamId}
        setRows={setRows}
        setSelectedStreamId={setSelectedStreamId}
        setShouldConnect={setShouldConnect}
      />
    </DataTableProvider>
  )
}
