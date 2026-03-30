"use client"

import * as React from "react"
import type { ColumnSizingState, VisibilityState } from "@tanstack/react-table"
import { Copy, Filter } from "lucide-react"

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
import { useDatoolSourceContext } from "../providers/datool-source-context"
import type { DatoolTableState } from "../providers/datool-source-context"
import { useDatoolAppConfig } from "../app-config"
import { useDatoolNavigation } from "../navigation"
import {
  getValueAtPath,
  isNestedAccessorKey,
  resolveDatoolColumnId,
} from "../../shared/columns"
import type {
  DatoolActionRequest,
  DatoolActionRowChange,
  DatoolActionResponse,
  DatoolDateFormat,
} from "../../shared/types"
import { LOG_VIEWER_ICONS } from "../lib/datool-icons"
import {
  quoteSearchTokenValue,
  splitSearchQuery,
  type DataTableSearchFieldSpec,
} from "../lib/data-table-search"
import { useDatoolState } from "../hooks/use-datool-state"
import { useOptionalDatoolContext } from "../providers/datool-context"
import { downloadTextFile, sanitizeFilePart } from "../lib/file-download"
import type { DatoolColumn, DatoolSortingState } from "../table-types"
import { buildTableSearchFields } from "../lib/filterable-table"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewerRow = Record<string, unknown> & { __datoolRowId: string }

type ViewerExportColumn = {
  accessorKey: string
  id: string
  kind?: DataTableColumnKind
  label: string
}

export type DatoolDataTableProps = {
  columns: DatoolColumn<ViewerRow>[]
  dateFormat?: DatoolDateFormat
  defaultSorting?: DatoolSortingState
  rowClassName?: (row: ViewerRow) => string | undefined
  rowHeight?: number
  rowStyle?: (row: ViewerRow) => React.CSSProperties | undefined
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function toActionRows(rows: ViewerRow[]): Record<string, unknown>[] {
  return rows.map(({ __datoolRowId: _datoolRowId, ...row }) => row)
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

function stringifyGroupingValue(value: unknown) {
  if (value === undefined) return "undefined:"
  if (value === null) return "null:"
  if (value instanceof Date) return `date:${value.toISOString()}`
  if (typeof value === "object") {
    try { return `object:${JSON.stringify(value)}` }
    catch { return `object:${String(value)}` }
  }
  return `${typeof value}:${String(value)}`
}

function groupViewerRows(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  if (columns.length === 0 || rows.length === 0) return rows
  const groupOrder: string[] = []
  const rowsByGroup = new Map<string, ViewerRow[]>()
  for (const row of rows) {
    const groupKey = columns
      .map((c) => stringifyGroupingValue(getValueAtPath(row, c.accessorKey)))
      .join("\u001f")
    const existing = rowsByGroup.get(groupKey)
    if (existing) { existing.push(row) }
    else { groupOrder.push(groupKey); rowsByGroup.set(groupKey, [row]) }
  }
  return groupOrder.flatMap((k) => rowsByGroup.get(k) ?? [])
}

function applyActionRowChanges(
  currentRows: ViewerRow[],
  targetRowIds: string[],
  rowChanges: Array<DatoolActionRowChange<Record<string, unknown>>> | undefined
) {
  if (!rowChanges || rowChanges.length === 0) return currentRows
  const map = new Map(targetRowIds.map((id, i) => [id, rowChanges[i] ?? true]))
  return currentRows.flatMap((row) => {
    const change = map.get(row.__datoolRowId)
    if (change === undefined || change === true) return [row]
    if (change === false || change === null) return []
    return [{ ...change, __datoolRowId: row.__datoolRowId }]
  })
}

function stringifyExportValue(value: unknown, kind?: DataTableColumnKind) {
  if (value === null || value === undefined || value === "") return ""
  if (kind === "date") {
    const d = value instanceof Date ? value : new Date(value as string | number)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function escapeCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function escapeMarkdownValue(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r\n?/g, "\n").replace(/\n/g, "<br />")
}

function buildCsvContent(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(",")
  const data = rows.map((row) =>
    columns.map((c) => escapeCsvValue(stringifyExportValue(getValueAtPath(row, c.accessorKey), c.kind))).join(",")
  )
  return [header, ...data].join("\n")
}

function buildMarkdownContent(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  const header = `| ${columns.map((c) => escapeMarkdownValue(c.label)).join(" | ")} |`
  const divider = `| ${columns.map(() => "---").join(" | ")} |`
  const data = rows.map((row) =>
    `| ${columns.map((c) => escapeMarkdownValue(stringifyExportValue(getValueAtPath(row, c.accessorKey), c.kind))).join(" | ")} |`
  )
  return [header, divider, ...data].join("\n")
}

function buildTableColumns(
  columns: DatoolColumn<ViewerRow>[]
): DataTableColumnConfig<ViewerRow>[] {
  return columns.map((column, index) => {
    const nested = isNestedAccessorKey(column.accessorKey)
    return {
      ...column,
      accessorFn: nested ? (row) => getValueAtPath(row, column.accessorKey) : undefined,
      accessorKey: nested ? undefined : (column.accessorKey as Extract<keyof ViewerRow, string>),
      id: resolveDatoolColumnId(column, index),
    }
  })
}

function stringifyRowActionValue(value: unknown) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function escapeMarkdownCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r\n?/g, "\n").replace(/\n/g, "<br />")
}

function getColumnValue(row: ViewerRow, column: DataTableColumnConfig<ViewerRow>): unknown {
  if (column.accessorFn) return column.accessorFn(row)
  if (column.accessorKey) return row[column.accessorKey]
  return undefined
}

function getColumnLabel(column: DataTableColumnConfig<ViewerRow>, index: number): string {
  return column.header ?? column.id ?? column.accessorKey ?? `Column ${index + 1}`
}

function toMarkdownTable(tableRows: ViewerRow[], tableColumns: DataTableColumnConfig<ViewerRow>[]) {
  const headers = tableColumns.map((c, i) => escapeMarkdownCell(getColumnLabel(c, i)))
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...tableRows.map((row) => {
      const vals = tableColumns.map((c) => escapeMarkdownCell(stringifyRowActionValue(getColumnValue(row, c))))
      return `| ${vals.join(" | ")} |`
    }),
  ].join("\n")
}

function buildFieldFilterToken(fieldId: string, value: unknown) {
  const s = stringifyRowActionValue(value)
  return s.trim() ? `${fieldId}:${quoteSearchTokenValue(s)}` : null
}

function replaceFieldFilter(query: string, fieldId: string, nextToken: string) {
  const escaped = fieldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const tokens = splitSearchQuery(query).filter(
    (t) => !t.match(new RegExp(`^${escaped}(:|>|<)`))
  )
  tokens.push(nextToken)
  return tokens.join(" ")
}

// ---------------------------------------------------------------------------
// Inner component (renders inside DataTableProvider, builds row actions)
// ---------------------------------------------------------------------------

function DatoolDataTableInner({
  columns,
}: {
  columns: DataTableColumnConfig<ViewerRow>[]
}) {
  const { search, setSearch } = useDataTableContext<ViewerRow>()
  const { setRows, sourceConfig: activeSource } = useDatoolSourceContext<ViewerRow>()
  const searchRef = React.useRef(search)

  React.useEffect(() => { searchRef.current = search }, [search])

  const rowActions = React.useMemo<DataTableRowAction<ViewerRow>[]>(() => {
    const configActions =
      activeSource?.actions.map(
        (action): DataTableRowAction<ViewerRow> => ({
          button: action.button,
          icon: action.icon ? LOG_VIEWER_ICONS[action.icon] : undefined,
          id: `config-${action.id}`,
          label: action.label,
          onSelect: async ({ actionRowIds, actionRows }) => {
            if (!activeSource) return
            const url = new URL(
              `/api/sources/${encodeURIComponent(activeSource.id)}/actions/${encodeURIComponent(action.id)}`,
              window.location.origin
            )
            const currentParams = new URL(window.location.href).searchParams
            for (const [key, value] of currentParams.entries()) url.searchParams.set(key, value)
            const requestBody: DatoolActionRequest = { rows: toActionRows(actionRows) }
            const response = await fetch(url, {
              body: JSON.stringify(requestBody),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            })
            const payload = (await response.json().catch(() => null)) as
              | (DatoolActionResponse & { error?: string })
              | null
            if (!response.ok) {
              throw new Error(payload?.error ?? `Failed to run action "${action.label}".`)
            }
            if (payload?.rowChanges !== undefined && !Array.isArray(payload.rowChanges)) {
              throw new Error(`Action "${action.label}" returned an invalid response.`)
            }
            setRows((currentRows) =>
              applyActionRowChanges(currentRows, actionRowIds, payload?.rowChanges)
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
          await navigator.clipboard.writeText(toMarkdownTable(actionRows, columns))
        },
        scope: "selection",
      },
      {
        icon: Filter,
        id: "filter-matching",
        items: ({ anchorRow }) =>
          columns.map((column, index) => {
            const value = getColumnValue(anchorRow, column)
            const token = buildFieldFilterToken(column.id ?? `column-${index}`, value)
            return {
              disabled: token === null,
              icon: (props) => <DataTableColIcon kind={column.kind ?? "text"} {...props} />,
              id: `filter-${column.id ?? index}`,
              label: `${getColumnLabel(column, index)}: ${stringifyRowActionValue(value) || "(empty)"}`,
              onSelect: () => {
                if (!token) return
                setSearch(replaceFieldFilter(searchRef.current, column.id ?? `column-${index}`, token))
              },
              scope: "row",
            } satisfies DataTableRowAction<ViewerRow>
          }),
        label: "Filter matching",
        scope: "row",
      },
    ]
  }, [activeSource, columns, setRows, setSearch])

  return (
    <div className="min-h-0 flex-1">
      <DataTable rowActions={rowActions} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connected DataTable (level 2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// State key helpers
// ---------------------------------------------------------------------------

type PersistedTableState = {
  columnSizing?: Record<string, number>
  columnVisibility?: VisibilityState
  groupBy?: string[]
}

function sanitizeColumnVisibility(
  raw: VisibilityState | undefined,
  columnIds: string[]
) {
  const valid = new Set(columnIds)
  return Object.fromEntries(
    Object.entries(raw ?? {}).filter(([id]) => valid.has(id))
  )
}

function sanitizeColumnSizing(
  raw: Record<string, number> | undefined,
  columnIds: string[]
) {
  const valid = new Set(columnIds)
  return Object.fromEntries(
    Object.entries(raw ?? {}).filter(
      ([id, w]) => valid.has(id) && typeof w === "number" && Number.isFinite(w) && w > 0
    )
  )
}

function sanitizeGroupBy(raw: string[] | undefined, columnIds: string[]) {
  const valid = new Set(columnIds)
  return (raw ?? []).filter((id, i, a) => valid.has(id) && a.indexOf(id) === i)
}

// ---------------------------------------------------------------------------
// Connected DataTable (level 2)
// ---------------------------------------------------------------------------

export function DatoolDataTable({
  columns: declaredColumns,
  dateFormat,
  defaultSorting,
  rowClassName,
  rowHeight = 20,
  rowStyle,
}: DatoolDataTableProps) {
  const location = useDatoolNavigation()
  const { config } = useDatoolAppConfig()
  const sourceCtx = useDatoolSourceContext<ViewerRow>()
  const {
    registerSearchFieldSpecs,
    registerTable,
    rows,
    search: sourceSearch,
    setSearch: setSourceSearch,
  } = sourceCtx

  const tableId = React.useMemo(
    () => getTableId(location.pathname),
    [location.pathname]
  )

  // ---- State manager (direct access for compound table state) ----
  const datoolCtx = useOptionalDatoolContext()
  const stateManager = datoolCtx?.stateManager ?? null

  const searchStateKey = `${tableId}-search`
  const tableStateKey = `datatable-${tableId}`

  const [persistedSearch, setPersistedSearch] = useDatoolState(searchStateKey)

  // Read initial table state directly from state manager (avoids object-ref cycles)
  function readTableState(ids: string[]): PersistedTableState {
    const raw = stateManager?.get(tableStateKey)
    if (!raw) return {}
    try { return JSON.parse(raw) as PersistedTableState } catch { return {} }
  }

  const columns = React.useMemo(() => buildTableColumns(declaredColumns), [declaredColumns])
  const searchFieldSpecs = React.useMemo<DataTableSearchFieldSpec[]>(
    () =>
      buildTableSearchFields(columns, rows.slice(0, 200)).map(
        ({ getValue: _getValue, ...field }) => field
      ),
    [columns, rows]
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

  const columnIds = React.useMemo(
    () => exportColumns.map((c) => c.id),
    [exportColumns]
  )

  // ---- Local state (initialized from state manager) ----
  const [search, setSearchInternal] = React.useState(persistedSearch)
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    () => sanitizeColumnSizing(readTableState(columnIds).columnSizing, columnIds)
  )
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => sanitizeColumnVisibility(readTableState(columnIds).columnVisibility, columnIds)
  )
  const [groupedColumnIds, setGroupedColumnIds] = React.useState<string[]>(
    () => sanitizeGroupBy(readTableState(columnIds).groupBy, columnIds)
  )

  // Subscribe to state manager for back/forward nav (popstate, storage, etc.)
  React.useEffect(() => {
    if (!stateManager) return
    return stateManager.subscribe(() => {
      const tableState = readTableState(columnIds)
      setColumnSizing(sanitizeColumnSizing(tableState.columnSizing, columnIds))
      setColumnVisibility(sanitizeColumnVisibility(tableState.columnVisibility, columnIds))
      setGroupedColumnIds(sanitizeGroupBy(tableState.groupBy, columnIds))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateManager, tableStateKey, columnIds])

  // Sync persisted search → local (back/forward)
  const [prevPersistedSearch, setPrevPersistedSearch] = React.useState(persistedSearch)
  if (persistedSearch !== prevPersistedSearch) {
    setPrevPersistedSearch(persistedSearch)
    setSearchInternal(persistedSearch)
    setSourceSearch(persistedSearch)
  }

  // Init: sync persisted search to source context on mount
  React.useEffect(() => {
    if (persistedSearch) {
      setSourceSearch(persistedSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external sourceSearch changes (e.g. from SearchFilter)
  const [prevSourceSearch, setPrevSourceSearch] = React.useState(sourceSearch)
  if (sourceSearch !== prevSourceSearch) {
    setPrevSourceSearch(sourceSearch)
    setSearchInternal(sourceSearch)
    setPersistedSearch(sourceSearch || null)
  }

  const setSearch = React.useCallback(
    (value: string) => {
      setSearchInternal(value)
      setSourceSearch(value)
      setPersistedSearch(value || null)
    },
    [setSourceSearch, setPersistedSearch]
  )

  // Debounced write-through for table state
  React.useEffect(() => {
    if (!stateManager) return
    const timeoutId = window.setTimeout(() => {
      const nextColumnSizing = sanitizeColumnSizing(columnSizing, columnIds)
      const nextColumnVisibility = sanitizeColumnVisibility(columnVisibility, columnIds)
      const nextGroupBy = sanitizeGroupBy(groupedColumnIds, columnIds)

      const next: PersistedTableState = {}
      if (Object.keys(nextColumnSizing).length > 0) next.columnSizing = nextColumnSizing
      if (Object.keys(nextColumnVisibility).length > 0) next.columnVisibility = nextColumnVisibility
      if (nextGroupBy.length > 0) next.groupBy = nextGroupBy

      if (Object.keys(next).length > 0) {
        stateManager.set(tableStateKey, JSON.stringify(next))
      } else {
        stateManager.delete(tableStateKey)
      }
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [columnIds, columnSizing, columnVisibility, groupedColumnIds, stateManager, tableStateKey])

  // Cmd+F
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

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
    () => exportColumns.filter((c) => columnVisibility[c.id] !== false),
    [columnVisibility, exportColumns]
  )

  const exportColumnsById = React.useMemo(
    () => new Map(exportColumns.map((c) => [c.id, c])),
    [exportColumns]
  )

  const groupedExportColumns = React.useMemo(
    () =>
      groupedColumnIds.flatMap((id) => {
        const c = exportColumnsById.get(id)
        return c ? [c] : []
      }),
    [exportColumnsById, groupedColumnIds]
  )

  const groupedRows = React.useMemo(
    () => groupViewerRows(rows, groupedExportColumns),
    [groupedExportColumns, rows]
  )

  const handleExport = React.useCallback(
    (format: "csv" | "md") => {
      if (visibleExportColumns.length === 0) return
      const fileBaseName = `${sanitizeFilePart(
        location.pathname
      )}-${new Date().toISOString().replaceAll(":", "-")}`
      const content =
        format === "csv"
          ? buildCsvContent(groupedRows, visibleExportColumns)
          : buildMarkdownContent(groupedRows, visibleExportColumns)
      downloadTextFile(
        content,
        `${fileBaseName}.${format}`,
        format === "csv" ? "text/csv" : "text/markdown"
      )
    },
    [groupedRows, location.pathname, visibleExportColumns]
  )

  // Register table state on source context
  const tableState = React.useMemo<DatoolTableState>(
    () => ({
      columnIds,
      columnVisibility,
      groupedColumnIds,
      handleExport,
      setColumnVisibility,
      setGroupedColumnIds,
      settingsColumns,
    }),
    [columnIds, columnVisibility, groupedColumnIds, handleExport, settingsColumns]
  )

  React.useEffect(() => {
    registerTable(tableState)
    return () => registerTable(null)
  }, [registerTable, tableState])

  React.useEffect(() => {
    registerSearchFieldSpecs(searchFieldSpecs)
    return () => registerSearchFieldSpecs([])
  }, [registerSearchFieldSpecs, searchFieldSpecs])

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
      rowHeight={rowHeight}
      statePersistence="none"
    >
      <DatoolDataTableInner columns={columns} />
    </DataTableProvider>
  )
}
