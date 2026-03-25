"use client"

import * as React from "react"
import type { ColumnSizingState, VisibilityState } from "@tanstack/react-table"
import {
  Copy,
  Filter,
  LoaderCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
  Trash2Icon,
} from "lucide-react"

import {
  DataTable,
  DataTableProvider,
  type DataTableColumnConfig,
  type DataTableRowAction,
  useDataTableContext,
} from "./data-table"
import {
  DataTableColIcon,
  type DataTableColumnKind,
} from "./data-table-col-icon"
import {
  DataTableSearchInput,
  type DataTableSearchInputHandle,
} from "./data-table-search-input"
import { Button } from "./ui/button"
import { SidebarTrigger } from "./ui/sidebar"
// import { ConnectionStatus } from "./connection-status"
import { ViewerSettings } from "./viewer-settings"
import {
  getValueAtPath,
  isNestedAccessorKey,
  resolveDatoolColumnId,
} from "../../shared/columns"
import type {
  DatoolActionRequest,
  DatoolActionRowChange,
  DatoolActionResponse,
  DatoolClientSource,
  DatoolDateFormat,
  DatoolRowEvent,
  DatoolSseEndEvent,
  DatoolSseErrorEvent,
} from "../../shared/types"
import { LOG_VIEWER_ICONS } from "../lib/datool-icons"
import {
  quoteSearchTokenValue,
  splitSearchQuery,
} from "../lib/data-table-search"
import {
  readDatoolColumnSizing,
  readDatoolColumnVisibility,
  readDatoolGrouping,
  readDatoolSearch,
  writeDatoolUrlState,
} from "../lib/datool-url-state"
import { downloadTextFile, sanitizeFilePart } from "../lib/file-download"
import { upsertViewerRow } from "../stream-state"
import { useDatoolAppConfig } from "../app-config"
import { useDatoolSource } from "../hooks/use-datool-stream"
import { useDatoolNavigation } from "../navigation"
import type { DatoolColumn, DatoolSortingState } from "../table-types"

type ViewerRow = Record<string, unknown> & {
  __datoolRowId: string
}

type ViewerExportColumn = {
  accessorKey: string
  id: string
  kind?: DataTableColumnKind
  label: string
}

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

function groupViewerRows(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  if (columns.length === 0 || rows.length === 0) {
    return rows
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

  return groupOrder.flatMap((groupKey) => rowsByGroup.get(groupKey) ?? [])
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

function formatColumnLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getTableId(pathname: string) {
  return `datool-${pathname === "/" ? "index" : pathname.replace(/[^a-z0-9/-]+/gi, "-")}`
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
  columns: DatoolColumn<ViewerRow>[]
): DataTableColumnConfig<ViewerRow>[] {
  return columns.map((column, index) => {
    const nestedAccessor = isNestedAccessorKey(column.accessorKey)

    return {
      ...column,
      accessorFn: nestedAccessor
        ? (row) => getValueAtPath(row, column.accessorKey)
        : undefined,
      accessorKey: nestedAccessor
        ? undefined
        : (column.accessorKey as Extract<keyof ViewerRow, string>),
      id: resolveDatoolColumnId(column, index),
    }
  })
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

  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...tableRows.map((row) => {
      const values = tableColumns.map((column) =>
        escapeMarkdownCell(stringifyRowActionValue(getColumnValue(row, column)))
      )

      return `| ${values.join(" | ")} |`
    }),
  ].join("\n")
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

const StreamPageTable = React.memo(function StreamPageTable({
  activeSource,
  columns,
  canLiveUpdate,
  errorMessage,
  groupedColumnIds,
  handleExport,
  isConnected,
  isConnecting,
  searchInputRef,
  setColumnVisibility,
  setGroupedColumnIds,
  setRows,
  setShouldConnect,
  settingsColumns,
}: {
  activeSource: DatoolClientSource | null
  columns: DataTableColumnConfig<ViewerRow>[]
  canLiveUpdate: boolean
  errorMessage: string | null
  groupedColumnIds: string[]
  handleExport: (format: "csv" | "md") => void
  isConnected: boolean
  isConnecting: boolean
  searchInputRef: React.RefObject<DataTableSearchInputHandle | null>
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  setGroupedColumnIds: React.Dispatch<React.SetStateAction<string[]>>
  setRows: React.Dispatch<React.SetStateAction<ViewerRow[]>>
  setShouldConnect: React.Dispatch<React.SetStateAction<boolean>>
  settingsColumns: Array<{
    id: string
    kind?: DataTableColumnKind
    label: string
    visible: boolean
  }>
}) {
  const { search, setSearch } = useDataTableContext<ViewerRow>()
  const searchRef = React.useRef(search)

  React.useEffect(() => {
    searchRef.current = search
  }, [search])

  const rowActions = React.useMemo<DataTableRowAction<ViewerRow>[]>(
    () => {
      const configActions =
        activeSource?.actions.map(
          (action): DataTableRowAction<ViewerRow> => ({
            button: action.button,
            icon: action.icon ? LOG_VIEWER_ICONS[action.icon] : undefined,
            id: `config-${action.id}`,
            label: action.label,
            onSelect: async ({ actionRowIds, actionRows }) => {
              if (!activeSource) {
                return
              }

              const url = new URL(
                `/api/sources/${encodeURIComponent(activeSource.id)}/actions/${encodeURIComponent(action.id)}`,
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
                      searchRef.current,
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
    [activeSource, columns, setRows, setSearch]
  )

  return (
    <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden bg-background pt-3">
      <header className="flex w-full flex-wrap items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <SidebarTrigger className="shrink-0" />
          <div className="min-w-0 flex-1">
            <DataTableSearchInput inputRef={searchInputRef} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* <ConnectionStatus
            className="rounded-md border border-border bg-muted/40 px-3 py-2"
            isConnected={isConnected}
            isConnecting={isConnecting}
          /> */}
          <Button
            aria-label="Clear rows"
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
            columns={settingsColumns}
            exportActions={[
              {
                id: "csv",
                label: "Export CSV",
                onSelect: () => handleExport("csv"),
              },
              {
                id: "markdown",
                label: "Export Markdown",
                onSelect: () => handleExport("md"),
              },
            ]}
            groupedColumnIds={groupedColumnIds}
            isDisabled={!activeSource}
            onClearGrouping={() => setGroupedColumnIds([])}
            onToggleColumn={(columnId, visible) =>
              setColumnVisibility((current) => ({
                ...current,
                [columnId]: visible,
              }))
            }
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
          />
        </div>
      </header>

      {errorMessage ? (
        <div className="px-4 text-sm text-destructive">{errorMessage}</div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTable rowActions={rowActions} />
      </div>
    </main>
  )
})

export function TablePageView({
  columns: declaredColumns,
  dateFormat,
  defaultSorting,
  rowClassName,
  rowStyle,
  source,
}: {
  columns: DatoolColumn<ViewerRow>[]
  dateFormat?: DatoolDateFormat
  defaultSorting?: DatoolSortingState
  rowClassName?: (row: ViewerRow) => string | undefined
  rowStyle?: (row: ViewerRow) => React.CSSProperties | undefined
  source: string
}) {
  const location = useDatoolNavigation()
  const { config } = useDatoolAppConfig()
  const {
    activeSource,
    canLiveUpdate,
    errorMessage,
    isConnected,
    isConnecting,
    rows,
    setRows,
    setShouldConnect,
  } = useDatoolSource<ViewerRow>(source)
  const tableId = React.useMemo(
    () => getTableId(location.pathname),
    [location.pathname]
  )
  const [search, setSearch] = React.useState("")
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    {}
  )
  const [groupedColumnIds, setGroupedColumnIds] = React.useState<string[]>([])
  const [hydratedTableId, setHydratedTableId] = React.useState<string | null>(
    null
  )
  const searchInputRef = React.useRef<DataTableSearchInputHandle>(null)

  const columns = React.useMemo(
    () => buildTableColumns(declaredColumns),
    [declaredColumns]
  )
  const exportColumns = React.useMemo(
    () =>
      declaredColumns.map((column, index) => ({
        accessorKey: column.accessorKey,
        id: resolveDatoolColumnId(column, index),
        kind: column.kind,
        label: column.header ?? formatColumnLabel(column.accessorKey),
      })),
    [declaredColumns]
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
  const columnIds = React.useMemo(
    () => exportColumns.map((column) => column.id),
    [exportColumns]
  )
  React.useEffect(() => {
    setRows([])
    setSearch(readDatoolSearch(tableId))
    setColumnSizing(readDatoolColumnSizing(tableId, columnIds))
    setColumnVisibility(readDatoolColumnVisibility(tableId, columnIds))
    setGroupedColumnIds(readDatoolGrouping(tableId, columnIds))
    setHydratedTableId(tableId)
  }, [columnIds, setRows, tableId])

  React.useEffect(() => {
    if (hydratedTableId !== tableId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      writeDatoolUrlState({
        columnIds,
        columnSizing,
        columnVisibility,
        groupBy: groupedColumnIds,
        search,
        tableId,
      })
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [
    columnIds,
    columnSizing,
    columnVisibility,
    groupedColumnIds,
    hydratedTableId,
    search,
    tableId,
  ])

  React.useEffect(() => {
    const handlePopState = () => {
      setSearch(readDatoolSearch(tableId))
      setColumnSizing(readDatoolColumnSizing(tableId, columnIds))
      setColumnVisibility(readDatoolColumnVisibility(tableId, columnIds))
      setGroupedColumnIds(readDatoolGrouping(tableId, columnIds))
      setHydratedTableId(tableId)
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [columnIds, tableId])

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
      if (visibleExportColumns.length === 0) {
        return
      }

      const fileBaseName = `${sanitizeFilePart(source)}-${new Date()
        .toISOString()
        .replaceAll(":", "-")}`
      const content =
        format === "csv"
          ? buildCsvContent(groupedRowsState, visibleExportColumns)
          : buildMarkdownContent(groupedRowsState, visibleExportColumns)

      downloadTextFile(
        content,
        `${fileBaseName}.${format}`,
        format === "csv" ? "text/csv" : "text/markdown"
      )
    },
    [groupedRowsState, source, visibleExportColumns]
  )

  return (
    <DataTableProvider
      autoScrollToBottom={groupedColumnIds.length === 0}
      columnSizing={columnSizing}
      columnVisibility={columnVisibility}
      columns={columns}
      data={rows}
      dateFormat={dateFormat ?? config.dateFormat}
      defaultSorting={defaultSorting}
      getRowId={(row) => row.__datoolRowId}
      grouping={groupedColumnIds}
      height="100%"
      id={tableId}
      onColumnSizingChange={setColumnSizing}
      onColumnVisibilityChange={setColumnVisibility}
      onGroupingChange={setGroupedColumnIds}
      onSearchChange={setSearch}
      rowClassName={rowClassName}
      rowStyle={rowStyle}
      search={search}
      rowHeight={20}
      statePersistence="none"
    >
      <StreamPageTable
        activeSource={activeSource}
        canLiveUpdate={canLiveUpdate}
        columns={columns}
        errorMessage={errorMessage}
        groupedColumnIds={groupedColumnIds}
        handleExport={handleExport}
        isConnected={isConnected}
        isConnecting={isConnecting}
        searchInputRef={searchInputRef}
        setColumnVisibility={setColumnVisibility}
        setGroupedColumnIds={setGroupedColumnIds}
        setRows={setRows}
        setShouldConnect={setShouldConnect}
        settingsColumns={settingsColumns}
      />
    </DataTableProvider>
  )
}
