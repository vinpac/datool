/* eslint-disable react-hooks/incompatible-library, react-refresh/only-export-components */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import {
  getExpandedRowModel,
  getGroupedRowModel,
  functionalUpdate,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ExpandedState,
  type FilterFn,
  type GroupingState,
  type OnChangeFn,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  LoaderCircle,
} from "lucide-react"
import * as React from "react"
import { useDeferredValue } from "react"

import {
  DataTableBodyCell,
  DataTableCheckbox,
} from "./data-table-cell"
import { resolveDataTableCellEditor } from "./cell-editors"
import { renderDataCellValue } from "./data-cell"
import {
  addRangeToSelectionState,
  createSelectionState,
  getSelectedRowIds,
  isCellInSelectionRanges,
  normalizeSelectionState,
  removeRangeFromSelectionState,
  type DataTableSelectionCell,
  type DataTableSelectionRange,
  type DataTableSelectionState,
  type NormalizedSelectionRange,
} from "./selection"
import { DataTableHeaderCol } from "./data-table-header-col"
import { inferDataTableColumnKind } from "./data-table-col-icon"
import { downloadFile, formatDuration } from "./lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  getColumnHighlightTerms,
  parseSearchQuery,
  type DataTableSearchField,
} from "./lib/data-table-text-search"
import {
  buildTableSearchFields,
  withColumnSearchFilters,
} from "./lib/data-table-filters"
import {
  readPersistedSearch,
  writePersistedSearch,
} from "./lib/table-search-persistence"
import type {
  DataTableAlign,
  DataTableColumnConfig,
  DataTableColumnKind,
  DataTableColumnMeta,
  DataTableProps,
  DataTableProviderProps,
  DataTableRow,
  DataTableRowAction,
  DataTableRowActionContext,
  DataTableRowActionButtonConfig,
  DataTableSelectionMode,
  DatoolDateFormat,
} from "./types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createPortal } from "react-dom"

export type {
  DataTableAlign,
  DataTableCellEditorComponent,
  DataTableCellEditorProps,
  DataTableColumnConfig,
  DataTableColumnKind,
  DataTableColumnMeta,
  DataTableProps,
  DataTableProviderProps,
  DataTableRowAction,
  DataTableRowActionContext,
  DataTableRowActionScope,
  DataTableRowActionButtonConfig,
  DataTableSelectionMode,
} from "./types"
export { DataCell, renderDataCellValue } from "./data-cell"
export {
  BooleanCellEditor,
  EnumCellEditor,
  TextCellEditor,
} from "./cell-editors"

export type DataTableViewerSettingsColumn = {
  id: string
  kind?: DataTableColumnKind
  label: string
  visible: boolean
}

export type DataTableViewerSettingsExportAction = {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
}

export type DataTableViewerSettings = {
  columns: DataTableViewerSettingsColumn[]
  exportActions: DataTableViewerSettingsExportAction[]
  groupedColumnIds: string[]
  onClearGrouping: () => void
  onToggleGrouping: (columnId: string, grouped: boolean) => void
  onToggleColumn: (columnId: string, visible: boolean) => void
}

export const DataTableViewerSettingsContext = React.createContext<
  ((settings: DataTableViewerSettings | null) => void) | null
>(null)

const EMPTY_HIGHLIGHT_TERMS: string[] = []

type DataTableContextValue<TData extends DataTableRow> = {
  search: string
  searchFields: DataTableSearchField<TData>[]
  setSearch: (value: string) => void
  tableProps: DataTableProps<TData>
}

type PersistedTableState = {
  columnFilters?: ColumnFiltersState
  columnOrder?: string[]
  columnSizing?: ColumnSizingState
  highlightedColumns?: Record<string, boolean>
  columnVisibility?: VisibilityState
  globalFilter?: string
  grouping?: GroupingState
  sorting?: SortingState
}

const LOCAL_STORAGE_PREFIX = "datatable:"
const URL_PARAM_PREFIX = "datatable-"
const DataTableContext =
  React.createContext<DataTableContextValue<DataTableRow> | null>(null)

export function useOptionalDataTableContext<TData extends DataTableRow>() {
  return React.useContext(
    DataTableContext
  ) as DataTableContextValue<TData> | null
}

export function useDataTableContext<TData extends DataTableRow>() {
  const context = useOptionalDataTableContext<TData>()

  if (!context) {
    throw new Error(
      "useDataTableContext must be used inside DataTableProvider."
    )
  }

  return context
}

export function DataTableProvider<TData extends DataTableRow>({
  children,
  columns,
  data,
  fieldOptions,
  id,
  onSearchChange,
  persistSearch = false,
  search: controlledSearch,
  searchPersistence,
  statePersistence,
  ...tableProps
}: DataTableProviderProps<TData>) {
  const resolvedSearchPersistence =
    searchPersistence ?? (persistSearch ? "localStorage" : "none")
  const isSearchControlled = controlledSearch !== undefined
  const [search, setSearch] = React.useState("")

  const resolvedSearch = controlledSearch ?? search
  const handleSearchChange = React.useCallback(
    (value: string) => {
      if (!isSearchControlled) {
        setSearch(value)
      }

      onSearchChange?.(value)
    },
    [isSearchControlled, onSearchChange]
  )

  React.useEffect(() => {
    if (isSearchControlled || resolvedSearchPersistence === "none") {
      setSearch("")
      return
    }

    setSearch(readPersistedSearch(id, resolvedSearchPersistence))
  }, [id, isSearchControlled, resolvedSearchPersistence])

  React.useEffect(() => {
    if (isSearchControlled || resolvedSearchPersistence === "none") {
      return
    }

    writePersistedSearch(id, resolvedSearchPersistence, search)
  }, [id, isSearchControlled, resolvedSearchPersistence, search])

  const searchFieldRows = useStableLeadingRows(data, 200, columns)
  const searchFields = React.useMemo(
    () =>
      buildTableSearchFields(columns, searchFieldRows, {
        fieldOptions,
      }),
    [columns, fieldOptions, searchFieldRows]
  )
  const parsedSearch = React.useMemo(
    () => parseSearchQuery(resolvedSearch, searchFields),
    [resolvedSearch, searchFields]
  )
  const resolvedColumns = React.useMemo(
    () => withColumnSearchFilters(columns, searchFields),
    [columns, searchFields]
  )
  const resolvedTableProps = React.useMemo(
    () =>
      ({
        ...tableProps,
        columnFilters: parsedSearch.columnFilters,
        columns: resolvedColumns,
        data,
        globalFilter: parsedSearch.globalFilter,
        highlightQuery: resolvedSearch,
        id,
        resolveColumnHighlightTerms: (columnId: string, query: string) =>
          getColumnHighlightTerms(query, columnId, searchFields),
        statePersistence:
          statePersistence ??
          (resolvedSearchPersistence === "none"
            ? "none"
            : resolvedSearchPersistence),
      }) satisfies DataTableProps<TData>,
    [
      data,
      id,
      parsedSearch.columnFilters,
      parsedSearch.globalFilter,
      resolvedColumns,
      resolvedSearchPersistence,
      resolvedSearch,
      searchFields,
      statePersistence,
      tableProps,
    ]
  )
  const contextValue = React.useMemo(
    () =>
      ({
        search: resolvedSearch,
        searchFields,
        setSearch: handleSearchChange,
        tableProps: resolvedTableProps,
      }) satisfies DataTableContextValue<TData>,
    [handleSearchChange, resolvedSearch, resolvedTableProps, searchFields]
  )

  return (
    <DataTableContext.Provider
      value={contextValue as DataTableContextValue<DataTableRow>}
    >
      {children}
    </DataTableContext.Provider>
  )
}

function formatHeaderLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function useStableLeadingRows<T>(
  rows: T[],
  limit: number,
  resetToken: unknown
) {
  const snapshotRef = React.useRef<T[]>([])
  const previousResetTokenRef = React.useRef(resetToken)

  if (previousResetTokenRef.current !== resetToken) {
    previousResetTokenRef.current = resetToken
    snapshotRef.current = []
  }

  const nextLength = Math.min(rows.length, limit)
  let shouldUpdate = snapshotRef.current.length !== nextLength

  if (!shouldUpdate) {
    for (let index = 0; index < nextLength; index += 1) {
      if (snapshotRef.current[index] !== rows[index]) {
        shouldUpdate = true
        break
      }
    }
  }

  if (shouldUpdate) {
    snapshotRef.current = rows.slice(0, nextLength)
  }

  return snapshotRef.current
}

function stringifyFilterValue(value: unknown) {
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

function getPersistedUrlParam(id: string) {
  return `${URL_PARAM_PREFIX}${id}`
}

function isPersistedStateEmpty(state: PersistedTableState) {
  return (
    (state.sorting?.length ?? 0) === 0 &&
    (state.grouping?.length ?? 0) === 0 &&
    (state.columnFilters?.length ?? 0) === 0 &&
    (state.columnOrder?.length ?? 0) === 0 &&
    Object.keys(state.highlightedColumns ?? {}).length === 0 &&
    Object.keys(state.columnVisibility ?? {}).length === 0 &&
    Object.keys(state.columnSizing ?? {}).length === 0 &&
    !state.globalFilter
  )
}

function readPersistedState(
  id: string,
  statePersistence: DataTableProps<DataTableRow>["statePersistence"]
): PersistedTableState {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    if (statePersistence === "none") {
      return {}
    }

    const rawValue =
      statePersistence === "url"
        ? new URL(window.location.href).searchParams.get(
            getPersistedUrlParam(id)
          )
        : window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${id}`)

    return rawValue ? (JSON.parse(rawValue) as PersistedTableState) : {}
  } catch {
    return {}
  }
}

function writePersistedState(
  id: string,
  statePersistence: DataTableProps<DataTableRow>["statePersistence"],
  state: PersistedTableState
) {
  if (typeof window === "undefined") {
    return
  }

  if (statePersistence === "none") {
    return
  }

  if (statePersistence === "url") {
    const url = new URL(window.location.href)

    if (isPersistedStateEmpty(state)) {
      url.searchParams.delete(getPersistedUrlParam(id))
    } else {
      url.searchParams.set(getPersistedUrlParam(id), JSON.stringify(state))
    }

    window.history.replaceState(window.history.state, "", url)
    return
  }

  window.localStorage.setItem(
    `${LOCAL_STORAGE_PREFIX}${id}`,
    JSON.stringify(state)
  )
}

function inferAlignment(kind: DataTableColumnKind): DataTableAlign {
  if (kind === "number") {
    return "right"
  }

  if (kind === "boolean" || kind === "selection") {
    return "center"
  }

  return "left"
}

function inferWidth(kind: DataTableColumnKind) {
  switch (kind) {
    case "boolean":
    case "selection":
      return 76
    case "number":
      return 132
    case "date":
      return 168
    case "json":
      return 240
    default:
      return 220
  }
}

type DateRangeAggregate = {
  durationMs: number
  endMs: number
  startMs: number
}

function toTimestamp(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value)

    return Number.isNaN(timestamp) ? null : timestamp
  }

  return null
}

function buildDateRangeAggregate<TData extends DataTableRow>(
  columnId: string,
  leafRows: Row<TData>[]
) {
  let startMs = Number.POSITIVE_INFINITY
  let endMs = Number.NEGATIVE_INFINITY

  for (const row of leafRows) {
    const timestamp = toTimestamp(row.getValue(columnId))

    if (timestamp === null) {
      continue
    }

    startMs = Math.min(startMs, timestamp)
    endMs = Math.max(endMs, timestamp)
  }

  if (
    startMs === Number.POSITIVE_INFINITY ||
    endMs === Number.NEGATIVE_INFINITY
  ) {
    return null
  }

  return {
    durationMs: Math.max(0, endMs - startMs),
    endMs,
    startMs,
  } satisfies DateRangeAggregate
}

function isDateRangeAggregate(value: unknown): value is DateRangeAggregate {
  return (
    value !== null &&
    typeof value === "object" &&
    "durationMs" in value &&
    "endMs" in value &&
    "startMs" in value
  )
}

function formatSummaryNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function resolveGroupedPadding(
  padding: React.CSSProperties["paddingLeft"],
  depth: number
) {
  const indent = depth * 16

  if (typeof padding === "number") {
    return padding + indent
  }

  if (typeof padding === "string") {
    return `calc(${padding} + ${indent}px)`
  }

  return indent
}

function resolveColumnId<TData extends DataTableRow>(
  column: DataTableColumnConfig<TData>,
  index: number
) {
  return (
    column.id ??
    column.accessorKey ??
    (column.header
      ? column.header.toLowerCase().replace(/\s+/g, "-")
      : `column-${index}`)
  )
}

type SelectionOverlayBox = {
  height: number
  key: string
  left: number
  top: number
  width: number
}

function isSelectableColumnId(columnId: string) {
  return columnId !== "__select" && columnId !== "__actions"
}

function isEditableColumnKind(kind: DataTableColumnKind | undefined) {
  return kind !== "json" && kind !== "selection"
}

function resolveEditable<TData extends DataTableRow>(
  column: DataTableColumnConfig<TData>,
  row: TData,
  value: unknown
) {
  if (!isEditableColumnKind(column.kind)) {
    return false
  }

  if (typeof column.editable === "function") {
    return column.editable({
      row,
      value,
    })
  }

  return column.editable ?? false
}

function stringifyEditableValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return JSON.stringify(value)
}

function mergeRowData<TData extends DataTableRow>(
  row: TData,
  patch: Partial<TData>
): TData {
  return {
    ...row,
    ...patch,
  }
}

function buildSelectionOverlayBoxes({
  columnLefts,
  columnWidths,
  normalizedRanges,
  rowStarts,
  rowStops,
  visibleRowIndices,
}: {
  columnLefts: number[]
  columnWidths: number[]
  normalizedRanges: NormalizedSelectionRange[]
  rowStarts: number[]
  rowStops: number[]
  visibleRowIndices: number[]
}) {
  const boxes: SelectionOverlayBox[] = []

  for (let rangeIndex = 0; rangeIndex < normalizedRanges.length; rangeIndex += 1) {
    const range = normalizedRanges[rangeIndex]!
    const left = columnLefts[range.startColumnIndex]
    const right =
      columnLefts[range.endColumnIndex] + columnWidths[range.endColumnIndex]

    if (left === undefined || right === undefined) {
      continue
    }

    let segmentStartRowIndex: number | null = null
    let previousRowIndex: number | null = null

    const pushSegment = (segmentEndRowIndex: number) => {
      if (segmentStartRowIndex === null) {
        return
      }

      const top = rowStarts[segmentStartRowIndex]
      const bottom = rowStops[segmentEndRowIndex]

      if (top === undefined || bottom === undefined) {
        return
      }

      boxes.push({
        height: Math.max(bottom - top, 0),
        key: `${rangeIndex}:${segmentStartRowIndex}:${segmentEndRowIndex}`,
        left,
        top,
        width: Math.max(right - left, 0),
      })
    }

    for (const rowIndex of visibleRowIndices) {
      const withinRange =
        rowIndex >= range.startRowIndex && rowIndex <= range.endRowIndex

      if (!withinRange) {
        if (segmentStartRowIndex !== null && previousRowIndex !== null) {
          pushSegment(previousRowIndex)
          segmentStartRowIndex = null
        }

        previousRowIndex = rowIndex
        continue
      }

      if (
        segmentStartRowIndex === null ||
        previousRowIndex === null ||
        rowIndex !== previousRowIndex + 1
      ) {
        if (segmentStartRowIndex !== null && previousRowIndex !== null) {
          pushSegment(previousRowIndex)
        }

        segmentStartRowIndex = rowIndex
      }

      previousRowIndex = rowIndex
    }

    if (segmentStartRowIndex !== null && previousRowIndex !== null) {
      pushSegment(previousRowIndex)
    }
  }

  return boxes
}

function escapeCsvValue(value: unknown): string {
  if (value == null) return ""
  const str = typeof value === "object" ? JSON.stringify(value) : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportTableData<TData extends DataTableRow>(
  table: ReturnType<typeof useReactTable<TData>>,
  tableId: string,
  format: "csv" | "md"
) {
  const visibleCols = table
    .getVisibleLeafColumns()
    .filter((c) => c.id !== "__selection" && c.id !== "__actions")
  const filteredRows = table.getFilteredRowModel().rows
  const headers = visibleCols.map((c) =>
    typeof c.columnDef.header === "string" ? c.columnDef.header : c.id
  )

  if (format === "csv") {
    const headerLine = headers.map(escapeCsvValue).join(",")
    const bodyLines = filteredRows.map((row) =>
      visibleCols.map((c) => escapeCsvValue(row.getValue(c.id))).join(",")
    )
    downloadFile(`${tableId}.csv`, [headerLine, ...bodyLines].join("\n"), "text/csv")
  } else {
    const headerLine = `| ${headers.join(" | ")} |`
    const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`
    const bodyLines = filteredRows.map(
      (row) =>
        `| ${visibleCols.map((c) => {
          const val = row.getValue(c.id)
          return val == null ? "" : String(val).replace(/\|/g, "\\|")
        }).join(" | ")} |`
    )
    downloadFile(
      `${tableId}.md`,
      [headerLine, separatorLine, ...bodyLines].join("\n"),
      "text/markdown"
    )
  }
}

function isColumnStickyLeft(meta: DataTableColumnMeta | undefined) {
  return meta?.sticky === "left"
}

function isColumnTrailing(id: string) {
  return id === "__actions"
}

function isColumnReorderable(
  id: string,
  meta: DataTableColumnMeta | undefined
) {
  return !isColumnStickyLeft(meta) && !isColumnTrailing(id)
}

function resolveColumnOrder(preferredOrder: string[], availableIds: string[]) {
  const availableIdSet = new Set(availableIds)
  const nextOrder = preferredOrder.filter((id) => availableIdSet.has(id))

  for (const id of availableIds) {
    if (!nextOrder.includes(id)) {
      nextOrder.push(id)
    }
  }

  return nextOrder
}

function buildColumns<TData extends DataTableRow>(
  data: TData[],
  columns?: DataTableColumnConfig<TData>[],
  dateFormat?: DatoolDateFormat,
  showRowSelectionColumn?: boolean,
  showRowActionButtonsColumn?: boolean,
  rowActionsColumnSize?: number,
  rowSelectionColumnState?: {
    getAllSelected: () => boolean
    getIsRowSelected: (rowId: string) => boolean
    getSomeSelected: () => boolean
    onToggleAll: (checked: boolean) => void
    onToggleRow: (rowId: string, checked: boolean) => void
  }
) {
  const inferredColumns: DataTableColumnConfig<TData>[] = (
    Object.keys(data[0] ?? {}) as Array<Extract<keyof TData, string>>
  ).map((accessorKey) => ({
    accessorKey,
    header: formatHeaderLabel(accessorKey),
  }))

  const sourceColumns =
    columns && columns.length > 0 ? columns : inferredColumns

  const builtColumns = sourceColumns.map<ColumnDef<TData>>((column, index) => {
    const id = resolveColumnId(column, index)
    const samples = data
      .slice(0, 25)
      .map((row) =>
        column.accessorFn
          ? column.accessorFn(row)
          : column.accessorKey
            ? row[column.accessorKey]
            : undefined
      )
    const kind = column.kind ?? inferDataTableColumnKind(samples)
    const meta: DataTableColumnMeta = {
      align: column.align ?? inferAlignment(kind),
      cellClassName: column.cellClassName,
      dateFormat: kind === "date" ? column.dateFormat : undefined,
      editable:
        typeof column.editable === "boolean" ? column.editable : undefined,
      enumColors: kind === "enum" ? column.enumColors : undefined,
      enumOptions: kind === "enum" ? column.enumOptions : undefined,
      enumVariant: kind === "enum" ? column.enumVariant : undefined,
      headerClassName: column.headerClassName,
      highlightMatches:
        column.highlightMatches ?? (kind === "text" ? true : false),
      kind,
      truncate: column.truncate ?? true,
    }
    const getDefaultCellContent = (value: unknown) =>
      renderDataCellValue({
        dateFormat: column.dateFormat ?? dateFormat,
        enumColors: kind === "enum" ? column.enumColors : undefined,
        enumOptions: kind === "enum" ? column.enumOptions : undefined,
        enumVariant: kind === "enum" ? column.enumVariant : undefined,
        type: kind,
        value,
      })

    return {
      accessorFn: column.accessorFn,
      accessorKey: column.accessorKey,
      aggregatedCell: column.aggregatedCell,
      aggregationFn:
        column.aggregationFn ??
        (kind === "date"
          ? buildDateRangeAggregate
          : kind === "number"
            ? "sum"
            : undefined),
      cell: ({ getValue, row }) => {
        const value = getValue()
        const children = getDefaultCellContent(value)

        return column.cell
          ? column.cell({
              children,
              row: row.original,
              value,
            })
          : children
      },
      enableGlobalFilter: column.enableFiltering ?? true,
      enableGrouping: column.enableGrouping ?? true,
      filterFn: column.filterFn,
      enableHiding: column.enableHiding ?? true,
      enableResizing: column.enableResizing ?? true,
      enableSorting: column.enableSorting ?? true,
      getGroupingValue: column.getGroupingValue,
      header: column.header ?? formatHeaderLabel(id),
      id,
      maxSize: column.maxWidth ?? 420,
      meta,
      minSize: column.minWidth ?? Math.min(inferWidth(kind), 120),
      size: column.width ?? inferWidth(kind),
    }
  })

  if (!showRowSelectionColumn) {
    if (!showRowActionButtonsColumn) {
      return builtColumns
    }

    return [
      ...builtColumns,
      {
        cell: () => null,
        enableGrouping: false,
        enableGlobalFilter: false,
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        header: "Actions",
        id: "__actions",
        maxSize: rowActionsColumnSize ?? 280,
        meta: {
          align: "right",
          truncate: false,
        } satisfies DataTableColumnMeta,
        minSize: Math.min(rowActionsColumnSize ?? 180, 180),
        size: rowActionsColumnSize ?? 220,
      },
    ] satisfies ColumnDef<TData>[]
  }

  const withSelectionColumn = [
    {
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          {!row.getIsGrouped() ? (
            <DataTableCheckbox
              ariaLabel={`Select row ${row.index + 1}`}
              checked={rowSelectionColumnState?.getIsRowSelected(row.id) ?? false}
              onCheckedChange={(checked) =>
                rowSelectionColumnState?.onToggleRow(row.id, checked)
              }
            />
          ) : null}
        </div>
      ),
      enableGrouping: false,
      enableGlobalFilter: false,
      enableHiding: false,
      enableResizing: false,
      enableSorting: false,
      header: () => (
        <div className="flex items-center justify-center">
          <DataTableCheckbox
            ariaLabel="Select all visible rows"
            checked={rowSelectionColumnState?.getAllSelected() ?? false}
            indeterminate={rowSelectionColumnState?.getSomeSelected() ?? false}
            onCheckedChange={(checked) => rowSelectionColumnState?.onToggleAll(checked)}
          />
        </div>
      ),
      id: "__select",
      maxSize: 56,
      meta: {
        align: "center",
        kind: "selection",
        sticky: "left",
        truncate: false,
      } satisfies DataTableColumnMeta,
      minSize: 56,
      size: 56,
    },
    ...builtColumns,
  ] satisfies ColumnDef<TData>[]

  if (!showRowActionButtonsColumn) {
    return withSelectionColumn
  }

  return [
    ...withSelectionColumn,
    {
      cell: () => null,
      enableGrouping: false,
      enableGlobalFilter: false,
      enableHiding: false,
      enableResizing: false,
      enableSorting: false,
      header: "Actions",
      id: "__actions",
      maxSize: rowActionsColumnSize ?? 280,
      meta: {
        align: "right",
        truncate: false,
      } satisfies DataTableColumnMeta,
      minSize: Math.min(rowActionsColumnSize ?? 180, 180),
      size: rowActionsColumnSize ?? 220,
    },
  ] satisfies ColumnDef<TData>[]
}

const globalFilterFn: FilterFn<RowData> = (row, columnId, filterValue) => {
  const query = String(filterValue ?? "")
    .trim()
    .toLowerCase()

  if (!query) {
    return true
  }

  return stringifyFilterValue(row.getValue(columnId))
    .toLowerCase()
    .includes(query)
}

function shouldIgnoreRowSelectionTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        [
          "a",
          "button",
          "input",
          "label",
          "select",
          "summary",
          "textarea",
          "[contenteditable=true]",
          "[data-no-row-select=true]",
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
        ].join(",")
      )
    )
  )
}

function shouldIgnoreSelectionShortcutTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        [
          "a",
          "button",
          "input",
          "select",
          "textarea",
          "[contenteditable=true]",
          '[role="button"]',
          '[role="combobox"]',
          '[role="dialog"]',
          '[role="menu"]',
          '[role="menuitem"]',
          '[role="searchbox"]',
          '[role="textbox"]',
        ].join(",")
      )
    )
  )
}

function resolveRowActionRows<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  row: Row<TData>,
  selectedRowIds: Set<string>,
  selectedRows: Row<TData>[]
) {
  if (action.scope === "selection" && selectedRowIds.has(row.id)) {
    return selectedRows.length > 0
      ? selectedRows.map((selectedRow) => selectedRow.original)
      : [row.original]
  }

  return [row.original]
}

function resolveRowActionRowIds<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  row: Row<TData>,
  selectedRowIds: Set<string>,
  selectedRows: Row<TData>[]
) {
  if (action.scope === "selection" && selectedRowIds.has(row.id)) {
    return selectedRows.length > 0
      ? selectedRows.map((selectedRow) => selectedRow.id)
      : [row.id]
  }

  return [row.id]
}

function buildRowActionContext<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  row: Row<TData>,
  selectedRowIds: Set<string>,
  selectedRows: Row<TData>[]
) {
  return {
    actionRowIds: resolveRowActionRowIds(
      action,
      row,
      selectedRowIds,
      selectedRows
    ),
    actionRows: resolveRowActionRows(action, row, selectedRowIds, selectedRows),
    anchorRow: row.original,
    anchorRowId: row.id,
    selectedRowIds: selectedRows.map((selectedRow) => selectedRow.id),
    selectedRows: selectedRows.map((selectedRow) => selectedRow.original),
  } satisfies DataTableRowActionContext<TData>
}

function resolveRowActionState<TData extends DataTableRow>(
  value:
    | boolean
    | ((context: DataTableRowActionContext<TData>) => boolean)
    | undefined,
  context: DataTableRowActionContext<TData>
) {
  if (typeof value === "function") {
    return value(context)
  }

  return Boolean(value)
}

function resolveRowActionLabel<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  context: DataTableRowActionContext<TData>
) {
  return typeof action.label === "function"
    ? action.label(context)
    : action.label
}

function resolveRowActionButton(
  action: DataTableRowAction<DataTableRow>
): Exclude<DataTableRowActionButtonConfig, false> | null {
  if (action.button === undefined || action.button === false) {
    return null
  }

  return action.button
}

function getRowActionStatusKey<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  context: DataTableRowActionContext<TData>
) {
  return `${action.id}:${context.actionRowIds.join(",")}`
}

function getRowActionResultMessage(result: unknown) {
  if (typeof result === "string") {
    return result
  }

  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    (typeof result.message === "string" || result.message === undefined)
  ) {
    return result.message
  }

  return undefined
}

function countStaticButtonActions<TData extends DataTableRow>(
  actions: DataTableRowAction<TData>[]
): number {
  return actions.reduce((count, action) => {
    const nextCount =
      resolveRowActionButton(action as DataTableRowAction<DataTableRow>) !==
      null
        ? count + 1
        : count

    const items = Array.isArray(action.items) ? action.items : undefined

    return items ? nextCount + countStaticButtonActions(items) : nextCount
  }, 0)
}

type ResolvedRowAction<TData extends DataTableRow> = {
  action: DataTableRowAction<TData>
  context: DataTableRowActionContext<TData>
  items: ResolvedRowAction<TData>[]
}

type RowActionState = "idle" | "loading" | "success" | "error"

type RowActionStatus = {
  message?: string
  state: RowActionState
}

type RowActionButtonGroupProps<TData extends DataTableRow> = {
  resolvedActions: ResolvedRowAction<TData>[]
  setStatus: (
    key: string,
    status: RowActionStatus,
    resetAfterMs?: number
  ) => void
  statuses: Record<string, RowActionStatus>
}

function resolveRowActionItems<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  context: DataTableRowActionContext<TData>,
  row: Row<TData>,
  selectedRowIds: Set<string>,
  selectedRows: Row<TData>[]
) {
  const items =
    typeof action.items === "function" ? action.items(context) : action.items

  return resolveVisibleRowActions(items ?? [], row, selectedRowIds, selectedRows)
}

function resolveVisibleRowActions<TData extends DataTableRow>(
  actions: DataTableRowAction<TData>[],
  row: Row<TData>,
  selectedRowIds: Set<string>,
  selectedRows: Row<TData>[]
): ResolvedRowAction<TData>[] {
  return actions.flatMap((action) => {
    const context = buildRowActionContext(action, row, selectedRowIds, selectedRows)

    if (resolveRowActionState(action.hidden, context)) {
      return []
    }

    const items = resolveRowActionItems(
      action,
      context,
      row,
      selectedRowIds,
      selectedRows
    )

    if (action.items && items.length === 0) {
      return []
    }

    return [
      {
        action,
        context,
        items,
      },
    ]
  })
}

function resolveRenderableButtonActions<TData extends DataTableRow>(
  resolvedActions: ResolvedRowAction<TData>[]
) {
  return resolvedActions.filter(
    (resolvedAction) =>
      resolvedAction.items.length === 0 &&
      resolveRowActionButton(
        resolvedAction.action as DataTableRowAction<DataTableRow>
      ) !== null
  )
}

function arePrimitiveArraysEqual<T extends string | number | boolean>(
  left: T[],
  right: T[]
) {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function areReferenceArraysEqual<T>(left: T[], right: T[]) {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function areRowActionContextsEqual<TData extends DataTableRow>(
  left: DataTableRowActionContext<TData>,
  right: DataTableRowActionContext<TData>
) {
  return (
    left.anchorRowId === right.anchorRowId &&
    left.anchorRow === right.anchorRow &&
    arePrimitiveArraysEqual(left.actionRowIds, right.actionRowIds) &&
    areReferenceArraysEqual(left.actionRows, right.actionRows) &&
    arePrimitiveArraysEqual(left.selectedRowIds, right.selectedRowIds) &&
    areReferenceArraysEqual(left.selectedRows, right.selectedRows)
  )
}

function areResolvedRowActionsEqual<TData extends DataTableRow>(
  left: ResolvedRowAction<TData>[],
  right: ResolvedRowAction<TData>[]
): boolean {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((resolvedAction, index) => {
    const nextResolvedAction = right[index]

    return (
      resolvedAction.action === nextResolvedAction.action &&
      areRowActionContextsEqual(
        resolvedAction.context,
        nextResolvedAction.context
      ) &&
      areResolvedRowActionsEqual(resolvedAction.items, nextResolvedAction.items)
    )
  })
}

function areRowActionStatusesEqual(
  left?: RowActionStatus,
  right?: RowActionStatus
) {
  return left?.state === right?.state && left?.message === right?.message
}

function RowActionMenuItem<TData extends DataTableRow>({
  resolvedAction,
  setStatus,
  statuses,
}: {
  resolvedAction: ResolvedRowAction<TData>
  setStatus: (
    key: string,
    status: RowActionStatus,
    resetAfterMs?: number
  ) => void
  statuses: Record<string, RowActionStatus>
}) {
  const { action, context, items } = resolvedAction
  const label = resolveRowActionLabel(action, context)
  const isDisabled = resolveRowActionState(action.disabled, context)
  const statusKey = getRowActionStatusKey(action, context)
  const status = statuses[statusKey]
  const button = resolveRowActionButton(
    action as DataTableRowAction<DataTableRow>
  )

  const handleRun = React.useCallback(async () => {
    if (!action.onSelect) {
      return
    }

    setStatus(statusKey, {
      state: "loading",
    })

    try {
      const result = await action.onSelect(context)

      setStatus(
        statusKey,
        {
          message: getRowActionResultMessage(result),
          state: "success",
        },
        2_500
      )
    } catch (error) {
      setStatus(
        statusKey,
        {
          message: error instanceof Error ? error.message : String(error),
          state: "error",
        },
        4_000
      )
    }
  }, [action, context, setStatus, statusKey])

  const Icon =
    status?.state === "loading"
      ? LoaderCircle
      : status?.state === "success"
        ? Check
        : status?.state === "error"
          ? CircleAlert
          : action.icon
  const isBusy = status?.state === "loading"

  if (items.length > 0) {
    return (
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={isDisabled || isBusy}>
          {Icon ? <Icon className="size-3.5" /> : null}
          <span className="truncate">{label}</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-72">
          {items.map((item) => (
            <RowActionMenuItem
              key={item.action.id}
              resolvedAction={item}
              setStatus={setStatus}
              statuses={statuses}
            />
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
    )
  }

  return (
    <ContextMenuItem
      disabled={isDisabled || isBusy}
      onSelect={() => {
        void handleRun()
      }}
      title={status?.message}
      variant={
        action.variant ??
        (button === "destructive" ||
        (typeof button === "object" && button?.variant === "destructive")
          ? "destructive"
          : "default")
      }
    >
      {Icon ? (
        <Icon className={cn("size-3.5", isBusy && "animate-spin")} />
      ) : null}
      <span className="truncate">{label}</span>
      {action.shortcut ? (
        <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
      ) : null}
    </ContextMenuItem>
  )
}

function RowActionButtonGroupInner<TData extends DataTableRow>({
  resolvedActions,
  setStatus,
  statuses,
}: RowActionButtonGroupProps<TData>) {
  const buttonActions = React.useMemo(
    () => resolveRenderableButtonActions(resolvedActions),
    [resolvedActions]
  )

  if (buttonActions.length === 0) {
    return null
  }

  return (
    <div className="gap-1.5 flex w-full justify-end" data-no-row-select="true">
      {buttonActions.map((resolvedAction) => {
        const { action, context } = resolvedAction
        const button = resolveRowActionButton(
          action as DataTableRowAction<DataTableRow>
        )
        const label = resolveRowActionLabel(action, context)
        const statusKey = getRowActionStatusKey(action, context)
        const status = statuses[statusKey]
        const isDisabled =
          resolveRowActionState(action.disabled, context) ||
          status?.state === "loading"
        const Icon =
          status?.state === "loading"
            ? LoaderCircle
            : status?.state === "success"
              ? Check
              : status?.state === "error"
                ? CircleAlert
                : action.icon
        const buttonLabel =
          button && typeof button === "object" && button.label
            ? button.label
            : label
        const buttonVariant =
          status?.state === "error"
            ? "destructive"
            : typeof button === "string"
              ? button
              : button && typeof button === "object"
                ? (button.variant ?? "outline")
                : "outline"
        const buttonSize =
          button && typeof button === "object" && button.size
            ? button.size
            : "sm"
        const buttonClassName =
          button && typeof button === "object" ? button.className : undefined

        return (
          <Button
            aria-busy={status?.state === "loading"}
            className={buttonClassName}
            disabled={isDisabled}
            key={statusKey}
            onClick={() => {
              const runAction = action.onSelect

              if (!runAction) {
                return
              }

              void (async () => {
                setStatus(statusKey, {
                  state: "loading",
                })

                try {
                  const result = await runAction(context)

                  setStatus(
                    statusKey,
                    {
                      message: getRowActionResultMessage(result),
                      state: "success",
                    },
                    2_500
                  )
                } catch (error) {
                  setStatus(
                    statusKey,
                    {
                      message:
                        error instanceof Error ? error.message : String(error),
                      state: "error",
                    },
                    4_000
                  )
                }
              })()
            }}
            size={buttonSize}
            title={status?.message}
            type="button"
            variant={buttonVariant}
          >
            {Icon ? (
              <Icon
                className={cn(
                  "size-3.5",
                  status?.state === "loading" && "animate-spin"
                )}
              />
            ) : null}
            {buttonLabel}
          </Button>
        )
      })}
    </div>
  )
}

const MemoizedRowActionButtonGroup = React.memo(
  RowActionButtonGroupInner,
  <TData extends DataTableRow>(
    previousProps: RowActionButtonGroupProps<TData>,
    nextProps: RowActionButtonGroupProps<TData>
  ) => {
    if (previousProps.setStatus !== nextProps.setStatus) {
      return false
    }

    const previousButtonActions = resolveRenderableButtonActions(
      previousProps.resolvedActions
    )
    const nextButtonActions = resolveRenderableButtonActions(
      nextProps.resolvedActions
    )

    if (!areResolvedRowActionsEqual(previousButtonActions, nextButtonActions)) {
      return false
    }

    return previousButtonActions.every((resolvedAction, index) => {
      const previousStatusKey = getRowActionStatusKey(
        resolvedAction.action,
        resolvedAction.context
      )
      const nextResolvedAction = nextButtonActions[index]
      const nextStatusKey = getRowActionStatusKey(
        nextResolvedAction.action,
        nextResolvedAction.context
      )

      return areRowActionStatusesEqual(
        previousProps.statuses[previousStatusKey],
        nextProps.statuses[nextStatusKey]
      )
    })
  }
)

const RowActionButtonGroup =
  MemoizedRowActionButtonGroup as typeof RowActionButtonGroupInner

function DataTableView<TData extends DataTableRow>({
  autoScrollToBottom = false,
  autoScrollToBottomThreshold = 96,
  cellEditors,
  columnFilters: controlledColumnFilters,
  columnSizing: controlledColumnSizing,
  columnVisibility: controlledColumnVisibility,
  columns,
  data,
  dateFormat,
  defaultSorting,
  edgeHorizontalPadding = "16px",
  enableRowSelection = false,
  globalFilter,
  grouping: controlledGrouping,
  getRowId,
  height = '100%',
  highlightQuery = "",
  id,
  onUpdate,
  onColumnFiltersChange,
  onColumnSizingChange,
  onColumnVisibilityChange,
  onGroupingChange,
  resolveColumnHighlightTerms,
  rowActions,
  rowClassName,
  rowStyle,
  rowHeight = 48,
  selection = enableRowSelection ? "row" : "cell",
  statePersistence = "localStorage",
}: DataTableProps<TData>) {
  const context = useOptionalDataTableContext<TData>()
  const [sorting, setSorting] = React.useState<SortingState>(
    defaultSorting ?? []
  )
  const [columnOrder, setColumnOrder] = React.useState<string[]>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [highlightedColumns, setHighlightedColumns] = React.useState<
    Record<string, boolean>
  >({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [grouping, setGrouping] = React.useState<GroupingState>([])
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [selectionState, setSelectionState] =
    React.useState<DataTableSelectionState | null>(null)
  const [editingCell, setEditingCell] = React.useState<{
    columnId: string
    draft: string
    rowId: string
  } | null>(null)
  const [pendingCellKeys, setPendingCellKeys] = React.useState<
    Record<string, boolean>
  >({})
  const [localRowPatches, setLocalRowPatches] = React.useState<
    Record<string, Partial<TData>>
  >({})
  const [rowActionStatuses, setRowActionStatuses] = React.useState<
    Record<string, RowActionStatus>
  >({})
  const rowActionStatusTimersRef = React.useRef<Record<string, number>>({})
  const editingCellRef = React.useRef<{
    columnId: string
    draft: string
    rowId: string
  } | null>(null)
  const selectionStateRef = React.useRef<DataTableSelectionState | null>(null)
  const pendingAdditiveToggleCellRef =
    React.useRef<DataTableSelectionCell | null>(null)
  const didDragSelectionRef = React.useRef(false)
  const dragSelectionRef = React.useRef<{
    activeRangeIndex: number
    additive: boolean
    anchor: DataTableSelectionCell
    baseSelection: DataTableSelectionState | null
    extend: boolean
  } | null>(null)
  const dragPointerRef = React.useRef<{
    clientX: number
    clientY: number
  } | null>(null)
  const [isDragSelecting, setIsDragSelecting] = React.useState(false)
  const [activeContextMenuRowId, setActiveContextMenuRowId] = React.useState<
    string | null
  >(null)
  const [activeContextMenuColumnId, setActiveContextMenuColumnId] =
    React.useState<string | null>(null)
  const [uncontrolledSearchDraft, setUncontrolledSearchDraft] =
    React.useState("")
  const isColumnFiltersControlled = controlledColumnFilters !== undefined
  const isColumnSizingControlled = controlledColumnSizing !== undefined
  const isColumnVisibilityControlled = controlledColumnVisibility !== undefined
  const isGlobalFilterControlled = globalFilter !== undefined
  const isGroupingControlled = controlledGrouping !== undefined
  const searchDraft = isGlobalFilterControlled
    ? (globalFilter ?? "")
    : uncontrolledSearchDraft
  const deferredSearch = useDeferredValue(searchDraft)
  const resolvedColumnFilters = controlledColumnFilters ?? columnFilters
  const resolvedColumnSizing = controlledColumnSizing ?? columnSizing
  const resolvedColumnVisibility =
    controlledColumnVisibility ?? columnVisibility
  const resolvedGrouping = controlledGrouping ?? grouping
  const groupingKey = React.useMemo(
    () => resolvedGrouping.join("\u001f"),
    [resolvedGrouping]
  )
  const rowActionButtonCount = rowActions
    ? countStaticButtonActions(rowActions)
    : 0
  const selectionMode: DataTableSelectionMode = selection
  const isRowSelectionMode = selectionMode === "row"
  const showRowSelectionColumn = enableRowSelection && isRowSelectionMode
  const showRowActionButtonsColumn = rowActionButtonCount > 0
  const rowActionsColumnSize = React.useMemo(
    () => Math.max(160, Math.min(320, rowActionButtonCount * 96)),
    [rowActionButtonCount]
  )
  const resolveRowId = React.useCallback(
    (row: TData, index: number) =>
      getRowId ? getRowId(row, index) : String(index),
    [getRowId]
  )
  const columnsWithEnumOptions = React.useMemo(() => {
    if (!columns || columns.length === 0) {
      return columns
    }

    const fieldOptionsById = new Map(
      (context?.searchFields ?? [])
        .filter((field) => field.kind === "enum")
        .map((field) => [field.id, field.options ?? []])
    )

    return columns.map((column, index) => {
      if (column.kind !== "enum" || column.enumOptions?.length) {
        return column
      }

      const enumOptions = fieldOptionsById.get(resolveColumnId(column, index))

      if (!enumOptions || enumOptions.length === 0) {
        return column
      }

      return {
        ...column,
        enumOptions,
      } satisfies DataTableColumnConfig<TData>
    })
  }, [columns, context?.searchFields])
  const displayData = React.useMemo(
    () =>
      data.map((row, index) => {
        const rowPatch = localRowPatches[resolveRowId(row, index)]

        return rowPatch ? mergeRowData(row, rowPatch) : row
      }),
    [data, localRowPatches, resolveRowId]
  )
  const tableRef = React.useRef<ReturnType<typeof useReactTable<TData>> | null>(
    null
  )
  const rowSelectionColumnState = React.useMemo(
    () =>
      showRowSelectionColumn
        ? {
            getAllSelected: () => {
              const visibleRows =
                tableRef.current?.getRowModel().rows.filter(
                  (row) => !row.getIsGrouped()
                ) ?? []

              return (
                visibleRows.length > 0 &&
                visibleRows.every((row) => rowSelection[row.id] === true)
              )
            },
            getIsRowSelected: (rowId: string) => rowSelection[rowId] === true,
            getSomeSelected: () => {
              const visibleRows =
                tableRef.current?.getRowModel().rows.filter(
                  (row) => !row.getIsGrouped()
                ) ?? []

              const selectedCount = visibleRows.filter(
                (row) => rowSelection[row.id] === true
              ).length

              return selectedCount > 0 && selectedCount < visibleRows.length
            },
            onToggleAll: (checked: boolean) => {
              const visibleRows =
                tableRef.current?.getRowModel().rows.filter(
                  (row) => !row.getIsGrouped()
                ) ?? []

              if (!checked || visibleRows.length === 0) {
                setSelectionState(null)
                return
              }

              setSelectionState({
                activeRangeIndex: Math.max(visibleRows.length - 1, 0),
                ranges: visibleRows.map((row) => ({
                  anchor: {
                    columnId: "__row__",
                    rowId: row.id,
                  },
                  focus: {
                    columnId: "__row__",
                    rowId: row.id,
                  },
                })),
              })
            },
            onToggleRow: (rowId: string, checked: boolean) => {
              setSelectionState((current) => {
                const visibleRows =
                  tableRef.current?.getRowModel().rows.filter(
                    (row) => !row.getIsGrouped()
                  ) ?? []
                const visibleRowIds = visibleRows.map((row) => row.id)
                const visibleRowIndexById = new Map<string, number>(
                  visibleRowIds.map((candidateRowId, index) => [
                    candidateRowId,
                    index,
                  ])
                )

                if (!checked) {
                  if (!current) {
                    return null
                  }

                  const nextRanges = current.ranges.filter(
                    (range) =>
                      range.anchor.rowId !== rowId && range.focus.rowId !== rowId
                  )

                  return nextRanges.length > 0
                    ? {
                        activeRangeIndex: Math.min(
                          current.activeRangeIndex,
                          nextRanges.length - 1
                        ),
                        ranges: nextRanges,
                      }
                    : null
                }

                const nextRange = {
                  anchor: {
                    columnId: "__row__",
                    rowId,
                  },
                  focus: {
                    columnId: "__row__",
                    rowId,
                  },
                } satisfies DataTableSelectionRange

                if (!current) {
                  return createSelectionState(nextRange)
                }

                return addRangeToSelectionState({
                  columnIds: [],
                  columnIndexById: new Map<string, number>(),
                  nextRange,
                  rowIds: visibleRowIds,
                  rowIndexById: visibleRowIndexById,
                  rowSelection: true,
                  selection: current,
                })
              })
            },
          }
        : undefined,
    [rowSelection, showRowSelectionColumn]
  )
  const columnBuildRows = useStableLeadingRows(
    displayData,
    25,
    columnsWithEnumOptions
  )
  const tableColumns = React.useMemo(
    () =>
      buildColumns(
        columnBuildRows,
        columnsWithEnumOptions,
        dateFormat,
        showRowSelectionColumn,
        showRowActionButtonsColumn,
        rowActionsColumnSize,
        rowSelectionColumnState
      ),
    [
      columnBuildRows,
      columnsWithEnumOptions,
      dateFormat,
      rowActionsColumnSize,
      rowSelectionColumnState,
      showRowActionButtonsColumn,
      showRowSelectionColumn,
    ]
  )
  const columnOrderBuckets = React.useMemo(() => {
    const leading: string[] = []
    const movable: string[] = []
    const trailing: string[] = []

    for (const column of tableColumns) {
      const id =
        typeof column.id === "string"
          ? column.id
          : "accessorKey" in column && typeof column.accessorKey === "string"
            ? column.accessorKey
            : null

      if (!id) {
        continue
      }

      const meta = (column.meta ?? {}) as DataTableColumnMeta

      if (isColumnStickyLeft(meta)) {
        leading.push(id)
        continue
      }

      if (isColumnTrailing(id)) {
        trailing.push(id)
        continue
      }

      movable.push(id)
    }

    return {
      leading,
      movable,
      trailing,
    }
  }, [tableColumns])
  const resolvedMovableColumnOrder = React.useMemo(
    () => resolveColumnOrder(columnOrder, columnOrderBuckets.movable),
    [columnOrder, columnOrderBuckets.movable]
  )
  const resolvedColumnOrder = React.useMemo(
    () => [
      ...columnOrderBuckets.leading,
      ...resolvedMovableColumnOrder,
      ...columnOrderBuckets.trailing,
    ],
    [
      columnOrderBuckets.leading,
      columnOrderBuckets.trailing,
      resolvedMovableColumnOrder,
    ]
  )
  const reorderSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const setRowActionStatus = React.useCallback(
    (key: string, status: RowActionStatus, resetAfterMs?: number) => {
      const existingTimer = rowActionStatusTimersRef.current[key]

      if (existingTimer) {
        window.clearTimeout(existingTimer)
        delete rowActionStatusTimersRef.current[key]
      }

      setRowActionStatuses((current) => ({
        ...current,
        [key]: status,
      }))

      if (!resetAfterMs) {
        return
      }

      rowActionStatusTimersRef.current[key] = window.setTimeout(() => {
        setRowActionStatuses((current) => {
          const next = { ...current }

          delete next[key]

          return next
        })
        delete rowActionStatusTimersRef.current[key]
      }, resetAfterMs)
    },
    []
  )
  const handleColumnSizingChange = React.useCallback<
    OnChangeFn<ColumnSizingState>
  >(
    (updater) => {
      const nextValue = functionalUpdate(updater, resolvedColumnSizing)

      if (!isColumnSizingControlled) {
        setColumnSizing(nextValue)
      }

      onColumnSizingChange?.(nextValue)
    },
    [isColumnSizingControlled, onColumnSizingChange, resolvedColumnSizing]
  )
  const handleColumnOrderChange = React.useCallback<
    OnChangeFn<ColumnOrderState>
  >(
    (updater) => {
      const nextValue = functionalUpdate(updater, resolvedColumnOrder)
      const nextMovableOrder = resolveColumnOrder(
        nextValue.filter((id) => columnOrderBuckets.movable.includes(id)),
        columnOrderBuckets.movable
      )

      setColumnOrder(nextMovableOrder)
    },
    [columnOrderBuckets.movable, resolvedColumnOrder]
  )
  const handleColumnFiltersChange = React.useCallback<
    OnChangeFn<ColumnFiltersState>
  >(
    (updater) => {
      const nextValue = functionalUpdate(updater, resolvedColumnFilters)

      if (!isColumnFiltersControlled) {
        setColumnFilters(nextValue)
      }

      onColumnFiltersChange?.(nextValue)
    },
    [isColumnFiltersControlled, onColumnFiltersChange, resolvedColumnFilters]
  )
  const handleColumnVisibilityChange = React.useCallback<
    OnChangeFn<VisibilityState>
  >(
    (updater) => {
      const nextValue = functionalUpdate(updater, resolvedColumnVisibility)

      if (!isColumnVisibilityControlled) {
        setColumnVisibility(nextValue)
      }

      onColumnVisibilityChange?.(nextValue)
    },
    [
      isColumnVisibilityControlled,
      onColumnVisibilityChange,
      resolvedColumnVisibility,
    ]
  )
  const handleGroupingChange = React.useCallback<OnChangeFn<GroupingState>>(
    (updater) => {
      const nextValue = functionalUpdate(updater, resolvedGrouping)

      if (!isGroupingControlled) {
        setGrouping(nextValue)
      }

      onGroupingChange?.(nextValue)
    },
    [isGroupingControlled, onGroupingChange, resolvedGrouping]
  )

  const table = useReactTable({
    autoResetExpanded: false,
    autoResetPageIndex: false,
    columnResizeMode: "onChange",
    columns: tableColumns,
    data: displayData,
    enableColumnResizing: true,
    enableGrouping: true,
    enableRowSelection: (row) => !row.getIsGrouped(),
    enableSubRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getRowId: resolveRowId,
    getSortedRowModel: getSortedRowModel(),
    groupedColumnMode: false,
    globalFilterFn: globalFilterFn as FilterFn<TData>,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onExpandedChange: setExpanded,
    onGroupingChange: handleGroupingChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters: resolvedColumnFilters,
      columnOrder: resolvedColumnOrder,
      columnSizing: resolvedColumnSizing,
      columnVisibility: resolvedColumnVisibility,
      expanded,
      globalFilter: deferredSearch.trim(),
      grouping: resolvedGrouping,
      rowSelection,
      sorting,
    },
  })
  tableRef.current = table

  const [containerEl, setContainerEl] = React.useState<HTMLDivElement | null>(
    null
  )
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const headerRef = React.useRef<HTMLTableSectionElement | null>(null)
  const [headerHeight, setHeaderHeight] = React.useState(0)
  const [editingOverlayRect, setEditingOverlayRect] = React.useState<{
    height: number
    left: number
    top: number
    width: number
  } | null>(null)
  const containerCallbackRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      setContainerEl(node)
    },
    []
  )
  const shouldAutoScrollRef = React.useRef(true)
  const hasAutoScrolledOnMountRef = React.useRef(false)
  const previousDataLengthRef = React.useRef(0)
  const rows = table.getRowModel().rows
  const rowsById = React.useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows]
  )
  const interactiveRows = React.useMemo(
    () => rows.filter((row) => !row.getIsGrouped()),
    [rows]
  )
  const selectableColumns = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((column) => isSelectableColumnId(column.id)),
    [table]
  )
  const columnIds = React.useMemo(
    () => selectableColumns.map((column) => column.id),
    [selectableColumns]
  )
  const rowIds = React.useMemo(
    () => interactiveRows.map((row) => row.id),
    [interactiveRows]
  )
  const columnIndexById = React.useMemo(
    () => new Map(columnIds.map((columnId, index) => [columnId, index])),
    [columnIds]
  )
  const rowIndexById = React.useMemo(
    () => new Map(rowIds.map((rowId, index) => [rowId, index])),
    [rowIds]
  )
  const normalizedSelectionRanges = React.useMemo(
    () =>
      normalizeSelectionState({
        columnCount: columnIds.length,
        columnIndexById,
        rowIndexById,
        rowSelection: isRowSelectionMode,
        selection: selectionState,
      }),
    [columnIds.length, columnIndexById, isRowSelectionMode, rowIndexById, selectionState]
  )
  const selectedRowIds = React.useMemo(
    () =>
      getSelectedRowIds({
        normalizedRanges: normalizedSelectionRanges,
        rowIds,
      }),
    [normalizedSelectionRanges, rowIds]
  )
  const selectedRowIdSet = React.useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds]
  )
  const selectedTableRows = React.useMemo(
    () =>
      selectedRowIds
        .map((rowId) => rowsById.get(rowId))
        .filter((row): row is Row<TData> => Boolean(row)),
    [rowsById, selectedRowIds]
  )
  const activeSelectionRange =
    selectionState && selectionState.ranges.length > 0
      ? selectionState.ranges[selectionState.activeRangeIndex] ?? null
      : null
  const activeCell = activeSelectionRange?.focus ?? null
  const selectableColumnConfigs = React.useMemo(() => {
    const configuredColumns = new Map<string, DataTableColumnConfig<TData>>()

    columnsWithEnumOptions?.forEach((column, index) => {
      configuredColumns.set(resolveColumnId(column, index), column)
    })

    return selectableColumns.map((column) => ({
      config: configuredColumns.get(column.id) ?? {},
      id: column.id,
    }))
  }, [columnsWithEnumOptions, selectableColumns])
  const selectableColumnConfigById = React.useMemo(
    () =>
      new Map(
        selectableColumnConfigs.map((column) => [column.id, column.config])
      ),
    [selectableColumnConfigs]
  )
  const activeContextMenuRow = activeContextMenuRowId
    ? rowsById.get(activeContextMenuRowId)
    : undefined
  const activeContextMenuActions = React.useMemo(
    () =>
      activeContextMenuRow && !activeContextMenuRow.getIsGrouped()
        ? resolveVisibleRowActions(
            rowActions ?? [],
            activeContextMenuRow,
            selectedRowIdSet,
            selectedTableRows
          )
        : [],
    [activeContextMenuRow, rowActions, selectedRowIdSet, selectedTableRows]
  )
  const activeContextMenuCell = React.useMemo(() => {
    if (!activeContextMenuRow || !activeContextMenuColumnId) {
      return null
    }

    const column = table.getColumn(activeContextMenuColumnId)

    if (!column) {
      return null
    }

    const headerName =
      typeof column.columnDef.header === "string"
        ? column.columnDef.header
        : column.id
    const value = activeContextMenuRow.getValue(activeContextMenuColumnId)

    return { headerName, value }
  }, [activeContextMenuRow, activeContextMenuColumnId, table])
  const resolvedHeight = typeof height === "number" ? height : 0
  const canComputeInitialOffset = autoScrollToBottom && resolvedHeight > 0
  const initialOffsetRef = React.useRef(
    canComputeInitialOffset
      ? Math.max(rows.length * rowHeight - resolvedHeight, 0)
      : 0
  )
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    enabled: containerEl !== null,
    estimateSize: () => rowHeight,
    getScrollElement: () => containerEl,
    initialOffset: initialOffsetRef.current,
    overscan: 12,
  })

  // When height is not a number (e.g. "100%"), we can't compute initialOffset
  // at render time. Scroll to bottom after mount once the container is available.
  React.useEffect(() => {
    if (!autoScrollToBottom || canComputeInitialOffset || !containerEl) return
    if (hasAutoScrolledOnMountRef.current) return
    hasAutoScrolledOnMountRef.current = true
    const totalSize = rows.length * rowHeight
    const visibleHeight = containerEl.clientHeight
    if (totalSize > visibleHeight) {
      containerEl.scrollTop = totalSize - visibleHeight
    }
  }, [
    autoScrollToBottom,
    canComputeInitialOffset,
    containerEl,
    rows.length,
    rowHeight,
  ])
  const virtualRows = rowVirtualizer.getVirtualItems()
  const visibleRowIndices = React.useMemo(
    () => virtualRows.map((virtualRow) => virtualRow.index),
    [virtualRows]
  )
  const rowStarts = React.useMemo(() => {
    const next: number[] = []

    for (const virtualRow of virtualRows) {
      next[virtualRow.index] = virtualRow.start
    }

    return next
  }, [virtualRows])
  const rowStops = React.useMemo(() => {
    const next: number[] = []

    for (const virtualRow of virtualRows) {
      next[virtualRow.index] = virtualRow.start + virtualRow.size
    }

    return next
  }, [virtualRows])
  const columnWidths = React.useMemo(
    () => selectableColumns.map((column) => column.getSize()),
    [selectableColumns]
  )
  const columnLefts = React.useMemo(() => {
    let left = 0

    return columnWidths.map((width) => {
      const start = left

      left += width

      return start
    })
  }, [columnWidths])
  const selectionOverlayBoxes = React.useMemo(
    () =>
      buildSelectionOverlayBoxes({
        columnLefts,
        columnWidths,
        normalizedRanges: normalizedSelectionRanges,
        rowStarts,
        rowStops,
        visibleRowIndices,
      }),
    [
      columnLefts,
      columnWidths,
      normalizedSelectionRanges,
      rowStarts,
      rowStops,
      visibleRowIndices,
    ]
  )
  React.useEffect(() => {
    selectionStateRef.current = selectionState
  }, [selectionState])

  React.useEffect(() => {
    editingCellRef.current = editingCell
  }, [editingCell])

  React.useEffect(() => {
    setRowSelection(Object.fromEntries(selectedRowIds.map((rowId) => [rowId, true])))
  }, [selectedRowIds])

  React.useLayoutEffect(() => {
    if (!headerRef.current) {
      return
    }

    const measure = () => {
      setHeaderHeight(headerRef.current?.getBoundingClientRect().height ?? 0)
    }

    measure()

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(headerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [resolvedColumnOrder, resolvedColumnSizing, resolvedGrouping.length])

  React.useEffect(() => {
    if (activeContextMenuRowId && !rowsById.has(activeContextMenuRowId)) {
      setActiveContextMenuRowId(null)
    }
  }, [activeContextMenuRowId, rowsById])

  React.useEffect(() => {
    return () => {
      for (const timerId of Object.values(rowActionStatusTimersRef.current)) {
        window.clearTimeout(timerId)
      }
    }
  }, [])

  React.useEffect(() => {
    const nextState = readPersistedState(id, statePersistence)

    setSorting(nextState.sorting ?? defaultSorting ?? [])
    setColumnOrder(nextState.columnOrder ?? [])
    if (!isColumnSizingControlled) {
      setColumnSizing(nextState.columnSizing ?? {})
    }
    if (!isColumnVisibilityControlled) {
      setColumnVisibility(nextState.columnVisibility ?? {})
    }
    setHighlightedColumns(nextState.highlightedColumns ?? {})
    if (!isColumnFiltersControlled) {
      setColumnFilters(nextState.columnFilters ?? [])
    }
    if (!isGroupingControlled) {
      setGrouping(nextState.grouping ?? [])
    }
    setExpanded(
      (isGroupingControlled ? controlledGrouping : (nextState.grouping ?? []))
        .length > 0
        ? true
        : {}
    )
    if (!isGlobalFilterControlled) {
      setUncontrolledSearchDraft(nextState.globalFilter ?? "")
    }
    setRowSelection({})
    setSelectionState(null)
    setEditingCell(null)
    dragSelectionRef.current = null
    dragPointerRef.current = null
    setIsDragSelecting(false)
    setPendingCellKeys({})
    setLocalRowPatches({})
    for (const timerId of Object.values(rowActionStatusTimersRef.current)) {
      window.clearTimeout(timerId)
    }
    rowActionStatusTimersRef.current = {}
    setRowActionStatuses({})
  }, [
    controlledGrouping,
    defaultSorting,
    id,
    isColumnFiltersControlled,
    isColumnSizingControlled,
    isColumnVisibilityControlled,
    isGlobalFilterControlled,
    isGroupingControlled,
    statePersistence,
  ])

  React.useEffect(() => {
    if (typeof window === "undefined" || statePersistence !== "url") {
      return
    }

    const syncFromUrl = () => {
      const nextState = readPersistedState(id, "url")

      setSorting(nextState.sorting ?? defaultSorting ?? [])
      setColumnOrder(nextState.columnOrder ?? [])
      if (!isColumnSizingControlled) {
        setColumnSizing(nextState.columnSizing ?? {})
      }
      if (!isColumnVisibilityControlled) {
        setColumnVisibility(nextState.columnVisibility ?? {})
      }
      setHighlightedColumns(nextState.highlightedColumns ?? {})
      if (!isColumnFiltersControlled) {
        setColumnFilters(nextState.columnFilters ?? [])
      }
      if (!isGroupingControlled) {
        setGrouping(nextState.grouping ?? [])
      }
      setExpanded(
        (isGroupingControlled ? controlledGrouping : (nextState.grouping ?? []))
          .length > 0
          ? true
          : {}
      )
      if (!isGlobalFilterControlled) {
        setUncontrolledSearchDraft(nextState.globalFilter ?? "")
      }
      setRowSelection({})
      setSelectionState(null)
      setEditingCell(null)
      dragSelectionRef.current = null
      dragPointerRef.current = null
      setIsDragSelecting(false)
      setPendingCellKeys({})
      setLocalRowPatches({})
    }

    window.addEventListener("popstate", syncFromUrl)

    return () => window.removeEventListener("popstate", syncFromUrl)
  }, [
    controlledGrouping,
    defaultSorting,
    id,
    isColumnFiltersControlled,
    isColumnSizingControlled,
    isColumnVisibilityControlled,
    isGlobalFilterControlled,
    isGroupingControlled,
    statePersistence,
  ])

  React.useEffect(() => {
    writePersistedState(id, statePersistence, {
      columnFilters: resolvedColumnFilters,
      columnOrder: resolvedMovableColumnOrder,
      columnSizing: resolvedColumnSizing,
      highlightedColumns,
      columnVisibility: resolvedColumnVisibility,
      globalFilter: deferredSearch.trim(),
      grouping: resolvedGrouping,
      sorting,
    })
  }, [
    deferredSearch,
    highlightedColumns,
    id,
    resolvedMovableColumnOrder,
    resolvedColumnFilters,
    resolvedColumnSizing,
    resolvedColumnVisibility,
    resolvedGrouping,
    sorting,
    statePersistence,
  ])

  React.useEffect(() => {
    setExpanded(resolvedGrouping.length > 0 ? true : {})
  }, [groupingKey, resolvedGrouping.length])

  React.useEffect(() => {
    const container = containerRef.current

    if (!autoScrollToBottom || !container) {
      return
    }

    const updateShouldAutoScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight

      shouldAutoScrollRef.current =
        distanceFromBottom <= autoScrollToBottomThreshold
    }

    updateShouldAutoScroll()
    container.addEventListener("scroll", updateShouldAutoScroll, {
      passive: true,
    })

    return () => {
      container.removeEventListener("scroll", updateShouldAutoScroll)
    }
  }, [autoScrollToBottom, autoScrollToBottomThreshold])

  React.useLayoutEffect(() => {
    const container = containerRef.current
    const previousDataLength = previousDataLengthRef.current

    previousDataLengthRef.current = data.length

    const scrollToBottom = () => {
      if (rows.length === 0) {
        return
      }

      rowVirtualizer.scrollToIndex(rows.length - 1, {
        align: "end",
      })
      container?.scrollTo({
        top: container.scrollHeight,
      })
    }

    const scheduleBottomScroll = () => {
      const frameIds: number[] = []

      const run = (remainingFrames: number) => {
        scrollToBottom()

        if (remainingFrames <= 0) {
          return
        }

        const frameId = window.requestAnimationFrame(() =>
          run(remainingFrames - 1)
        )

        frameIds.push(frameId)
      }

      run(4)

      return () => {
        for (const frameId of frameIds) {
          window.cancelAnimationFrame(frameId)
        }
      }
    }

    if (
      autoScrollToBottom &&
      container &&
      !hasAutoScrolledOnMountRef.current &&
      rows.length > 0
    ) {
      hasAutoScrolledOnMountRef.current = true
      shouldAutoScrollRef.current = true

      return scheduleBottomScroll()
    }

    if (
      !autoScrollToBottom ||
      !container ||
      data.length <= previousDataLength ||
      !shouldAutoScrollRef.current
    ) {
      return
    }

    return scheduleBottomScroll()
  }, [autoScrollToBottom, data.length, rowVirtualizer, rows.length])

  const clearSelection = React.useCallback(() => {
    setSelectionState(null)
    setEditingCell(null)
    pendingAdditiveToggleCellRef.current = null
    didDragSelectionRef.current = false
    dragSelectionRef.current = null
    dragPointerRef.current = null
    setIsDragSelecting(false)
  }, [])

  const isColumnHighlightEnabled = React.useCallback(
    (columnId: string, meta: DataTableColumnMeta) =>
      highlightedColumns[columnId] ?? Boolean(meta.highlightMatches),
    [highlightedColumns]
  )
  const highlightTermsByColumnId = React.useMemo(() => {
    const next = new Map<string, string[]>()

    for (const column of table.getAllLeafColumns()) {
      const meta = (column.columnDef.meta ?? {}) as DataTableColumnMeta

      if (
        meta.kind === "text" &&
        resolveColumnHighlightTerms &&
        isColumnHighlightEnabled(column.id, meta)
      ) {
        const terms = resolveColumnHighlightTerms(column.id, highlightQuery)

        next.set(column.id, terms.length > 0 ? terms : EMPTY_HIGHLIGHT_TERMS)
        continue
      }

      next.set(column.id, EMPTY_HIGHLIGHT_TERMS)
    }

    return next
  }, [
    highlightQuery,
    isColumnHighlightEnabled,
    resolveColumnHighlightTerms,
    table,
  ])
  const handleColumnDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) {
        return
      }

      const activeId = String(active.id)
      const overId = String(over.id)
      const activeIndex = resolvedMovableColumnOrder.indexOf(activeId)
      const overIndex = resolvedMovableColumnOrder.indexOf(overId)

      if (activeIndex === -1 || overIndex === -1) {
        return
      }

      handleColumnOrderChange(
        arrayMove(
          resolvedColumnOrder,
          activeIndex + columnOrderBuckets.leading.length,
          overIndex + columnOrderBuckets.leading.length
        )
      )
    },
    [
      columnOrderBuckets.leading.length,
      handleColumnOrderChange,
      resolvedColumnOrder,
      resolvedMovableColumnOrder,
    ]
  )
  const setSelectionFromInteraction = React.useCallback(
    ({
      additive = false,
      anchor,
      baseSelection = selectionStateRef.current,
      extend = false,
      focus,
    }: {
      additive?: boolean
      anchor: DataTableSelectionCell
      baseSelection?: DataTableSelectionState | null
      extend?: boolean
      focus: DataTableSelectionCell
    }) => {
      const nextRange = {
        anchor,
        focus,
      } satisfies DataTableSelectionRange

      if (extend && baseSelection && baseSelection.ranges.length > 0) {
        const activeRangeIndex = Math.min(
          baseSelection.activeRangeIndex,
          baseSelection.ranges.length - 1
        )
        const nextRanges = [...baseSelection.ranges]
        const baseRange = nextRanges[activeRangeIndex] ?? nextRange

        nextRanges[activeRangeIndex] = {
          anchor: baseRange.anchor,
          focus,
        }

        setSelectionState({
          activeRangeIndex,
          ranges: nextRanges,
        })
        return
      }

      if (additive && baseSelection) {
        setSelectionState(
          addRangeToSelectionState({
            columnIds,
            columnIndexById,
            nextRange,
            rowIds,
            rowIndexById,
            rowSelection: isRowSelectionMode,
            selection: baseSelection,
          })
        )
        return
      }

      setSelectionState(createSelectionState(nextRange))
    },
    [columnIds, columnIndexById, isRowSelectionMode, rowIds, rowIndexById]
  )
  const scrollCellIntoView = React.useCallback(
    (cell: DataTableSelectionCell | null) => {
      if (!cell || !containerRef.current) {
        return
      }

      const row = rowsById.get(cell.rowId)

      if (row) {
        rowVirtualizer.scrollToIndex(row.index, {
          align: "auto",
        })
      }

      const container = containerRef.current
      const cellElement = container.querySelector<HTMLElement>(
        `tr[data-row-id="${cell.rowId}"] td[data-column-id="${cell.columnId}"]`
      )

      if (!cellElement) {
        return
      }

      const containerBounds = container.getBoundingClientRect()
      const cellBounds = cellElement.getBoundingClientRect()

      if (cellBounds.left < containerBounds.left) {
        container.scrollLeft -= containerBounds.left - cellBounds.left + 8
      } else if (cellBounds.right > containerBounds.right) {
        container.scrollLeft += cellBounds.right - containerBounds.right + 8
      }
    },
    [rowVirtualizer, rowsById]
  )
  const getEditingCellElement = React.useCallback(() => {
    const currentEditingCell = editingCellRef.current

    if (!currentEditingCell || !containerRef.current) {
      return null
    }

    return containerRef.current.querySelector<HTMLTableCellElement>(
      `tr[data-row-id="${currentEditingCell.rowId}"] td[data-column-id="${currentEditingCell.columnId}"]`
    )
  }, [])
  const updateEditingOverlayRect = React.useCallback(() => {
    const cellElement = getEditingCellElement()

    if (!cellElement) {
      setEditingOverlayRect(null)
      return
    }

    const rect = cellElement.getBoundingClientRect()

    setEditingOverlayRect({
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    })
  }, [getEditingCellElement])
  const editingCellRowId = editingCell?.rowId ?? null
  const editingCellColumnId = editingCell?.columnId ?? null
  React.useLayoutEffect(() => {
    if (!editingCellRowId || !editingCellColumnId) {
      setEditingOverlayRect(null)
      return
    }

    setEditingOverlayRect(null)

    let frameId = 0
    let attempts = 0

    const measure = () => {
      attempts += 1
      updateEditingOverlayRect()

      if (!getEditingCellElement() && attempts < 4) {
        frameId = window.requestAnimationFrame(measure)
      }
    }

    frameId = window.requestAnimationFrame(measure)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    editingCellColumnId,
    editingCellRowId,
    getEditingCellElement,
    updateEditingOverlayRect,
  ])
  const getRelativeCell = React.useCallback(
    (
      cell: DataTableSelectionCell,
      {
        columnDelta,
        rowDelta,
      }: {
        columnDelta: number
        rowDelta: number
      }
    ) => {
      if (rowIds.length === 0 || columnIds.length === 0) {
        return null
      }

      const currentRowIndex = rowIndexById.get(cell.rowId) ?? 0
      const currentColumnIndex = columnIndexById.get(cell.columnId) ?? 0
      const nextRowIndex = Math.max(
        0,
        Math.min(rowIds.length - 1, currentRowIndex + rowDelta)
      )
      const nextColumnIndex = isRowSelectionMode
        ? currentColumnIndex
        : Math.max(
            0,
            Math.min(columnIds.length - 1, currentColumnIndex + columnDelta)
          )

      return {
        columnId: columnIds[nextColumnIndex] ?? columnIds[0]!,
        rowId: rowIds[nextRowIndex] ?? rowIds[0]!,
      } satisfies DataTableSelectionCell
    },
    [columnIds, columnIndexById, isRowSelectionMode, rowIds, rowIndexById]
  )
  const moveSelection = React.useCallback(
    ({
      columnDelta,
      extend = false,
      rowDelta,
    }: {
      columnDelta: number
      extend?: boolean
      rowDelta: number
    }) => {
      if (interactiveRows.length === 0 || columnIds.length === 0) {
        return
      }

      const currentRange =
        selectionStateRef.current &&
        selectionStateRef.current.ranges[selectionStateRef.current.activeRangeIndex]
          ? selectionStateRef.current.ranges[
              selectionStateRef.current.activeRangeIndex
            ]!
          : null
      const currentCell =
        currentRange?.focus ?? {
          columnId: columnIds[0]!,
          rowId: interactiveRows[0]!.id,
        }
      const currentRowIndex = rowIndexById.get(currentCell.rowId) ?? 0
      const currentColumnIndex = columnIndexById.get(currentCell.columnId) ?? 0
      const nextCell =
        getRelativeCell(currentCell, {
          columnDelta,
          rowDelta,
        }) ?? {
          columnId: columnIds[currentColumnIndex] ?? columnIds[0]!,
          rowId: rowIds[currentRowIndex] ?? rowIds[0]!,
        }
      const anchor = extend
        ? currentRange?.anchor ?? currentCell
        : nextCell

      setSelectionFromInteraction({
        anchor,
        extend,
        focus: nextCell,
      })
      scrollCellIntoView(nextCell)
    },
    [
      columnIds,
      getRelativeCell,
      interactiveRows,
      rowIds,
      scrollCellIntoView,
      setSelectionFromInteraction,
    ]
  )
  const beginEditingCell = React.useCallback(
    (cell: DataTableSelectionCell, initialDraft?: string) => {
      if (isRowSelectionMode || !onUpdate) {
        return false
      }

      const row = rowsById.get(cell.rowId)
      const columnConfig = selectableColumnConfigs.find(
        (column) => column.id === cell.columnId
      )?.config

      if (!row || !columnConfig) {
        return false
      }

      const value = row.getValue(cell.columnId)

      if (!resolveEditable(columnConfig, row.original, value)) {
        return false
      }

      scrollCellIntoView(cell)
      setSelectionFromInteraction({
        anchor: cell,
        focus: cell,
      })
      setEditingCell({
        columnId: cell.columnId,
        draft: initialDraft ?? stringifyEditableValue(value),
        rowId: cell.rowId,
      })

      return true
    },
    [
      isRowSelectionMode,
      onUpdate,
      rowsById,
      scrollCellIntoView,
      selectableColumnConfigs,
      setSelectionFromInteraction,
    ]
  )
  const commitEditingCell = React.useCallback(
    async ({
      nextCell,
    }: {
      nextCell?: DataTableSelectionCell | null
    } = {}) => {
      if (!editingCell) {
        if (nextCell) {
          setSelectionFromInteraction({
            anchor: nextCell,
            focus: nextCell,
          })
          scrollCellIntoView(nextCell)
        }

        return
      }

      const row = rowsById.get(editingCell.rowId)
      const key = `${editingCell.rowId}:${editingCell.columnId}`

      if (!row || !onUpdate) {
        setEditingCell(null)
        return
      }

      const currentValue = stringifyEditableValue(
        row.getValue(editingCell.columnId)
      )

      if (editingCell.draft === currentValue) {
        setEditingCell(null)

        if (nextCell) {
          setSelectionFromInteraction({
            anchor: nextCell,
            focus: nextCell,
          })
          scrollCellIntoView(nextCell)
        }

        return
      }

      setPendingCellKeys((current) => ({
        ...current,
        [key]: true,
      }))

      try {
        const results = await onUpdate([
          {
            data: {
              [editingCell.columnId]: editingCell.draft,
            },
            row: row.original,
            rowId: editingCell.rowId,
          },
        ])

        setLocalRowPatches((current) => {
          const next = { ...current }

          for (const result of results) {
            next[result.rowId] = {
              ...(next[result.rowId] ?? {}),
              ...result.data,
            }
          }

          return next
        })
      } finally {
        setPendingCellKeys((current) => {
          const next = { ...current }

          delete next[key]

          return next
        })
        setEditingCell(null)
      }

      if (nextCell) {
        setSelectionFromInteraction({
          anchor: nextCell,
          focus: nextCell,
        })
        scrollCellIntoView(nextCell)
      }
    },
    [editingCell, onUpdate, rowsById, scrollCellIntoView, setSelectionFromInteraction]
  )
  const cancelEditingCell = React.useCallback(() => {
    setEditingCell(null)
  }, [])
  const handleEditingOverlayChange = React.useCallback((value: string) => {
    setEditingCell((current) =>
      current
        ? {
            ...current,
            draft: value,
          }
        : current
    )
  }, [])
  const updateDragSelectionFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!dragSelectionRef.current || !containerRef.current) {
        return
      }

      const target = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-selection-row-id][data-selection-column-id]")
      const renderedCells = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          "[data-selection-row-id][data-selection-column-id]"
        )
      )
      const fallbackCell =
        clientY < containerRef.current.getBoundingClientRect().top
          ? renderedCells[0]
          : clientY > containerRef.current.getBoundingClientRect().bottom
            ? renderedCells.at(-1)
            : undefined
      const rowId = target?.dataset.selectionRowId ?? fallbackCell?.dataset.selectionRowId
      const columnId =
        target?.dataset.selectionColumnId ?? fallbackCell?.dataset.selectionColumnId

      if (!rowId || !columnId) {
        return
      }

      const { activeRangeIndex, additive, anchor, baseSelection, extend } =
        dragSelectionRef.current
      const focus = {
        columnId,
        rowId,
      } satisfies DataTableSelectionCell

      if (focus.rowId !== anchor.rowId || focus.columnId !== anchor.columnId) {
        didDragSelectionRef.current = true
        pendingAdditiveToggleCellRef.current = null
      }

      if (extend && baseSelection && baseSelection.ranges.length > 0) {
        const nextRanges = [...baseSelection.ranges]
        const baseRange = nextRanges[activeRangeIndex] ?? {
          anchor,
          focus,
        }

        nextRanges[activeRangeIndex] = {
          anchor: baseRange.anchor,
          focus,
        }

        setSelectionState({
          activeRangeIndex,
          ranges: nextRanges,
        })
        return
      }

      if (additive && baseSelection) {
        setSelectionState(
          addRangeToSelectionState({
            columnIds,
            columnIndexById,
            nextRange: {
              anchor,
              focus,
            },
            rowIds,
            rowIndexById,
            rowSelection: isRowSelectionMode,
            selection: baseSelection,
          })
        )
        return
      }

      setSelectionState(
        createSelectionState({
          anchor,
          focus,
        })
      )
    },
    [columnIds, columnIndexById, isRowSelectionMode, rowIds, rowIndexById]
  )
  const handleCellMouseDown = React.useCallback(
    (
      event: React.MouseEvent<HTMLTableCellElement>,
      cell: Cell<TData, unknown>
    ) => {
      if (event.button !== 0 || shouldIgnoreRowSelectionTarget(event.target)) {
        return
      }

      if (editingCell) {
        return
      }

      const nextCell = {
        columnId: cell.column.id,
        rowId: cell.row.id,
      } satisfies DataTableSelectionCell
      const currentSelection = selectionStateRef.current
      const currentEditingCell = editingCellRef.current
      const rowIndex = rowIndexById.get(nextCell.rowId)
      const columnIndex = columnIndexById.get(nextCell.columnId)
      const isAlreadySelected =
        rowIndex !== undefined &&
        columnIndex !== undefined &&
        isCellInSelectionRanges({
          columnIndex,
          normalizedRanges: normalizedSelectionRanges,
          rowIndex,
        })

      if (
        currentEditingCell &&
        currentEditingCell.rowId === nextCell.rowId &&
        currentEditingCell.columnId === nextCell.columnId
      ) {
        return
      }

      if (currentEditingCell) {
        event.preventDefault()
        void commitEditingCell({
          nextCell,
        })
        return
      }

      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[data-cell-content="true"]') &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        return
      }

      dragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      }
      event.preventDefault()

      if (event.shiftKey && currentSelection && currentSelection.ranges.length > 0) {
        const activeRangeIndex = Math.min(
          currentSelection.activeRangeIndex,
          currentSelection.ranges.length - 1
        )
        const activeRange = currentSelection.ranges[activeRangeIndex]!

        dragSelectionRef.current = {
          activeRangeIndex,
          additive: false,
          anchor: activeRange.anchor,
          baseSelection: currentSelection,
          extend: true,
        }
        setIsDragSelecting(true)
        setSelectionState({
          activeRangeIndex,
          ranges: currentSelection.ranges.map((range, index) =>
            index === activeRangeIndex
              ? {
                  anchor: range.anchor,
                  focus: nextCell,
                }
              : range
          ),
        })
        return
      }

      const additive = event.metaKey || event.ctrlKey
      const baseSelection = additive ? currentSelection : null
      const nextActiveRangeIndex = additive && currentSelection
        ? currentSelection.ranges.length
        : 0

      didDragSelectionRef.current = false
      pendingAdditiveToggleCellRef.current =
        additive && isAlreadySelected ? nextCell : null

      dragSelectionRef.current = {
        activeRangeIndex: nextActiveRangeIndex,
        additive,
        anchor: nextCell,
        baseSelection,
        extend: false,
      }
      setIsDragSelecting(true)

      if (additive && isAlreadySelected) {
        return
      }

      setSelectionFromInteraction({
        additive,
        anchor: nextCell,
        baseSelection,
        focus: nextCell,
      })
    },
    [
      columnIndexById,
      commitEditingCell,
      editingCell,
      normalizedSelectionRanges,
      rowIndexById,
      setSelectionFromInteraction,
    ]
  )
  const handleCellMouseEnter = React.useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (event.buttons !== 1 || !dragSelectionRef.current) {
        return
      }

      dragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      }
      updateDragSelectionFromPointer(event.clientX, event.clientY)
    },
    [updateDragSelectionFromPointer]
  )
  const handleCellClick = React.useCallback(
    (
      event: React.MouseEvent<HTMLTableCellElement>,
      cell: Cell<TData, unknown>
    ) => {
      const textSelection = window.getSelection()?.toString() ?? ""

      if (textSelection.length > 0) {
        return
      }

      const nextCell = {
        columnId: cell.column.id,
        rowId: cell.row.id,
      } satisfies DataTableSelectionCell
      const isAdditive = event.metaKey || event.ctrlKey
      const rowIndex = rowIndexById.get(nextCell.rowId)
      const columnIndex = columnIndexById.get(nextCell.columnId)
      const isAlreadySelected =
        rowIndex !== undefined &&
        columnIndex !== undefined &&
        isCellInSelectionRanges({
          columnIndex,
          normalizedRanges: normalizedSelectionRanges,
          rowIndex,
        })

      if (
        isAdditive &&
        pendingAdditiveToggleCellRef.current?.rowId === nextCell.rowId &&
        pendingAdditiveToggleCellRef.current?.columnId === nextCell.columnId &&
        !didDragSelectionRef.current
      ) {
        setSelectionState((current) =>
          removeRangeFromSelectionState({
            columnIds,
            columnIndexById,
            rangeToRemove: {
              anchor: nextCell,
              focus: nextCell,
            },
            rowIds,
            rowIndexById,
            rowSelection: isRowSelectionMode,
            selection: current,
          })
        )
        pendingAdditiveToggleCellRef.current = null
        didDragSelectionRef.current = false
        return
      }

      if (event.shiftKey || isAdditive) {
        pendingAdditiveToggleCellRef.current = null
        didDragSelectionRef.current = false
        return
      }

      pendingAdditiveToggleCellRef.current = null
      didDragSelectionRef.current = false
      setSelectionFromInteraction({
        anchor: nextCell,
        focus: nextCell,
      })
    },
    [
      columnIds,
      columnIndexById,
      isRowSelectionMode,
      normalizedSelectionRanges,
      rowIds,
      rowIndexById,
      setSelectionFromInteraction,
    ]
  )
  const handleCellDoubleClick = React.useCallback(
    (cell: Cell<TData, unknown>) => {
      void beginEditingCell({
        columnId: cell.column.id,
        rowId: cell.row.id,
      })
    },
    [beginEditingCell]
  )
  const editingOverlayContext = React.useMemo(() => {
    if (!editingCell || !editingOverlayRect) {
      return null
    }

    const row = rowsById.get(editingCell.rowId)
    const column = selectableColumnConfigById.get(editingCell.columnId)
    const tableColumn = table.getColumn(editingCell.columnId)
    const meta = (tableColumn?.columnDef.meta ?? {}) as DataTableColumnMeta

    if (!row || !column || !meta.kind) {
      return null
    }

    const Editor = resolveDataTableCellEditor<TData>({
      editors: cellEditors,
      kind: meta.kind,
    })
    const pendingKey = `${editingCell.rowId}:${editingCell.columnId}`
    const nextCell = getRelativeCell(
      {
        columnId: editingCell.columnId,
        rowId: editingCell.rowId,
      },
      {
        columnDelta: 1,
        rowDelta: 0,
      }
    )
    const previousCell = getRelativeCell(
      {
        columnId: editingCell.columnId,
        rowId: editingCell.rowId,
      },
      {
        columnDelta: -1,
        rowDelta: 0,
      }
    )
    const handleEditorKeyDown = (
      event:
        | React.KeyboardEvent<HTMLInputElement>
        | React.KeyboardEvent<HTMLSelectElement>
        | React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
      event.stopPropagation()

      if (event.key === "Enter") {
        event.preventDefault()
        void commitEditingCell()
      } else if (event.key === "Tab") {
        event.preventDefault()
        void commitEditingCell({
          nextCell: event.shiftKey ? previousCell : nextCell,
        })
      } else if (event.key === "Escape") {
        event.preventDefault()
        cancelEditingCell()
      }
    }

    return {
      Editor,
      column,
      handleEditorKeyDown,
      pending: pendingCellKeys[pendingKey] === true,
      rect: editingOverlayRect,
      row: row.original,
      value: editingCell.draft,
    }
  }, [
    cancelEditingCell,
    cellEditors,
    commitEditingCell,
    editingCell,
    editingOverlayRect,
    getRelativeCell,
    pendingCellKeys,
    rowsById,
    selectableColumnConfigById,
    table,
  ])
  const handleRowContextMenu = React.useCallback(
    (row: Row<TData>, columnId?: string | null) => {
      if (row.getIsGrouped()) {
        return
      }

      if (selectedRowIdSet.has(row.id)) {
        return
      }

      const fallbackColumnId = columnId ?? columnIds[0]

      if (!fallbackColumnId) {
        return
      }

      const nextCell = {
        columnId: fallbackColumnId,
        rowId: row.id,
      } satisfies DataTableSelectionCell

      setSelectionFromInteraction({
        anchor: nextCell,
        focus: nextCell,
      })
    },
    [columnIds, selectedRowIdSet, setSelectionFromInteraction]
  )
  const handleTableContextMenuCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!rowActions || rowActions.length === 0) {
        return
      }

      const target = event.target as HTMLElement | null
      const rowId =
        target?.closest<HTMLTableRowElement>("tr[data-row-id]")?.dataset.rowId
      const columnId =
        target?.closest<HTMLTableCellElement>("td[data-column-id]")?.dataset
          .columnId ?? null

      if (!rowId) {
        setActiveContextMenuRowId(null)
        setActiveContextMenuColumnId(null)
        event.preventDefault()
        return
      }

      const row = rowsById.get(rowId)

      if (!row || row.getIsGrouped()) {
        setActiveContextMenuRowId(null)
        setActiveContextMenuColumnId(null)
        event.preventDefault()
        return
      }

      handleRowContextMenu(row, columnId)

      if (
        resolveVisibleRowActions(
          rowActions,
          row,
          selectedRowIdSet,
          selectedTableRows
        ).length === 0
      ) {
        setActiveContextMenuRowId(null)
        setActiveContextMenuColumnId(null)
        event.preventDefault()
        return
      }

      setActiveContextMenuRowId(rowId)
      setActiveContextMenuColumnId(columnId)
    },
    [handleRowContextMenu, rowActions, rowsById, selectedRowIdSet, selectedTableRows]
  )
  React.useEffect(() => {
    if (!isDragSelecting) {
      return
    }

    const handleWindowMouseMove = (event: MouseEvent) => {
      dragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      }
      updateDragSelectionFromPointer(event.clientX, event.clientY)
    }

    const stopDragSelection = () => {
      dragSelectionRef.current = null
      dragPointerRef.current = null
      setIsDragSelecting(false)
    }

    window.addEventListener("mousemove", handleWindowMouseMove)
    window.addEventListener("mouseup", stopDragSelection)

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove)
      window.removeEventListener("mouseup", stopDragSelection)
    }
  }, [isDragSelecting, updateDragSelectionFromPointer])
  React.useEffect(() => {
    if (!isDragSelecting) {
      return
    }

    let frameId = 0

    const tick = () => {
      const container = containerRef.current
      const pointer = dragPointerRef.current

      if (container && pointer) {
        const { top, bottom } = container.getBoundingClientRect()
        const edgeThreshold = 48
        let delta = 0

        if (pointer.clientY < top + edgeThreshold) {
          delta = -Math.ceil((top + edgeThreshold - pointer.clientY) / 6)
        } else if (pointer.clientY > bottom - edgeThreshold) {
          delta = Math.ceil((pointer.clientY - (bottom - edgeThreshold)) / 6)
        }

        if (delta !== 0) {
          const maxDelta = 28
          const nextDelta = Math.max(-maxDelta, Math.min(maxDelta, delta))

          container.scrollTop += nextDelta
          updateDragSelectionFromPointer(pointer.clientX, pointer.clientY)
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isDragSelecting, updateDragSelectionFromPointer])
  React.useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreSelectionShortcutTarget(event.target)) {
        return
      }

      if (
        event.key === "Escape" &&
        (selectionStateRef.current?.ranges.length ?? 0) > 0
      ) {
        event.preventDefault()
        clearSelection()
        return
      }

      if (editingCell) {
        return
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          moveSelection({
            columnDelta: 0,
            extend: event.shiftKey,
            rowDelta: -1,
          })
          return
        case "ArrowDown":
          event.preventDefault()
          moveSelection({
            columnDelta: 0,
            extend: event.shiftKey,
            rowDelta: 1,
          })
          return
        case "ArrowLeft":
          if (isRowSelectionMode) {
            return
          }

          event.preventDefault()
          moveSelection({
            columnDelta: -1,
            extend: event.shiftKey,
            rowDelta: 0,
          })
          return
        case "ArrowRight":
          if (isRowSelectionMode) {
            return
          }

          event.preventDefault()
          moveSelection({
            columnDelta: 1,
            extend: event.shiftKey,
            rowDelta: 0,
          })
          return
        case "Enter":
          if (!activeCell) {
            return
          }

          event.preventDefault()
          void beginEditingCell(activeCell)
          return
        case "Tab":
          if (isRowSelectionMode) {
            return
          }

          event.preventDefault()
          moveSelection({
            columnDelta: event.shiftKey ? -1 : 1,
            rowDelta: 0,
          })
          return
        default:
          if (
            event.key.length === 1 &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            activeCell
          ) {
            event.preventDefault()
            void beginEditingCell(activeCell, event.key)
          }
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown)

    return () => window.removeEventListener("keydown", handleWindowKeyDown)
  }, [
    activeCell,
    beginEditingCell,
    clearSelection,
    editingCell,
    isRowSelectionMode,
    moveSelection,
  ])
  const registerViewerSettings = React.useContext(DataTableViewerSettingsContext)
  const settingsColumns = React.useMemo<DataTableViewerSettingsColumn[]>(() => {
    if (!columns || columns.length === 0) return []
    const result: DataTableViewerSettingsColumn[] = []
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!
      const colId = resolveColumnId(col, i)
      if (colId === "__selection" || colId === "__actions") continue
      result.push({
        id: colId,
        kind: col.kind,
        label: col.header ?? formatHeaderLabel(col.accessorKey ?? col.id ?? `column-${i}`),
        visible: resolvedColumnVisibility[colId] !== false,
      })
    }
    return result
  }, [columns, resolvedColumnVisibility])
  const resolvedGroupingRef = React.useRef(resolvedGrouping)
  resolvedGroupingRef.current = resolvedGrouping
  const resolvedColumnVisibilityRef = React.useRef(resolvedColumnVisibility)
  resolvedColumnVisibilityRef.current = resolvedColumnVisibility
  tableRef.current = table

  React.useEffect(() => {
    if (!registerViewerSettings) return

    const currentGrouping = resolvedGroupingRef.current

    registerViewerSettings({
      columns: settingsColumns,
      exportActions: [
        {
          id: "csv",
          label: "Export CSV",
          onSelect: () => {
            if (tableRef.current) {
              exportTableData(tableRef.current, id, "csv")
            }
          },
        },
        {
          id: "md",
          label: "Export Markdown",
          onSelect: () => {
            if (tableRef.current) {
              exportTableData(tableRef.current, id, "md")
            }
          },
        },
      ],
      groupedColumnIds: [...currentGrouping],
      onClearGrouping: () => {
        if (isGroupingControlled) {
          onGroupingChange?.([])
        } else {
          setGrouping([])
        }
      },
      onToggleGrouping: (columnId, grouped) => {
        const updater = (current: GroupingState) =>
          grouped
            ? current.includes(columnId) ? current : [...current, columnId]
            : current.filter((gId) => gId !== columnId)
        if (isGroupingControlled) {
          onGroupingChange?.(updater(resolvedGroupingRef.current))
        } else {
          setGrouping(updater)
        }
      },
      onToggleColumn: (columnId, visible) => {
        const updater = (current: VisibilityState) => ({ ...current, [columnId]: visible })
        if (isColumnVisibilityControlled) {
          onColumnVisibilityChange?.(updater(resolvedColumnVisibilityRef.current))
        } else {
          setColumnVisibility(updater)
        }
      },
    })

    return () => registerViewerSettings(null)
  }, [
    registerViewerSettings,
    settingsColumns,
    resolvedGrouping,
    isGroupingControlled,
    onGroupingChange,
    isColumnVisibilityControlled,
    onColumnVisibilityChange,
    id,
  ])

  const tableContent = (
    <div
      className={cn(
        "min-h-0 pb-4 flex-1 overflow-auto",
        isDragSelecting && "select-none"
      )}
      onContextMenuCapture={handleTableContextMenuCapture}
      ref={containerCallbackRef}
      style={{
        scrollbarGutter: "stable",
      }}
    >
      <DndContext
        id="datool-dnd-context"
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
        sensors={reorderSensors}
      >
        <div className="relative min-w-full" style={{ width: table.getTotalSize() }}>
          <table
            className="border-spacing-0 grid w-full border-separate"
            role="grid"
          >
          <thead className="top-0 sticky z-20 grid" ref={headerRef}>
            {table.getHeaderGroups().map((headerGroup) => (
              <SortableContext
                items={headerGroup.headers
                  .filter((header) =>
                    isColumnReorderable(
                      header.column.id,
                      (header.column.columnDef.meta ??
                        {}) as DataTableColumnMeta
                    )
                  )
                  .map((header) => header.column.id)}
                key={headerGroup.id}
                strategy={horizontalListSortingStrategy}
              >
                <tr
                  className="flex w-full"
                  style={{
                    width: table.getTotalSize(),
                  }}
                >
                  {headerGroup.headers.map((header, index) => (
                    <DataTableHeaderCol
                      header={header}
                      highlightEnabled={isColumnHighlightEnabled(
                        header.column.id,
                        (header.column.columnDef.meta ??
                          {}) as DataTableColumnMeta
                      )}
                      key={header.id}
                      onToggleHighlight={() =>
                        setHighlightedColumns((current) => ({
                          ...current,
                          [header.column.id]: !isColumnHighlightEnabled(
                            header.column.id,
                            (header.column.columnDef.meta ??
                              {}) as DataTableColumnMeta
                          ),
                        }))
                      }
                      paddingLeft={
                        index === 0 ? edgeHorizontalPadding : undefined
                      }
                      paddingRight={
                        index === headerGroup.headers.length - 1
                          ? edgeHorizontalPadding
                          : undefined
                      }
                      reorderable={isColumnReorderable(
                        header.column.id,
                        (header.column.columnDef.meta ??
                          {}) as DataTableColumnMeta
                      )}
                      scrollContainerRef={containerRef}
                    />
                  ))}
                </tr>
              </SortableContext>
            ))}
          </thead>

            <tbody
              className="relative grid"
              style={{
                height: rowVirtualizer.getTotalSize(),
              }}
            >
            {virtualRows.length === 0 ? (
              <tr className="inset-x-0 top-0 absolute flex h-full items-center justify-center">
                <td className="px-4 py-10 text-sm text-muted-foreground text-center">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]
                const isGroupRow = row.getIsGrouped()
                const visibleRowActions = isGroupRow
                  ? []
                  : resolveVisibleRowActions(
                      rowActions ?? [],
                      row,
                      selectedRowIdSet,
                      selectedTableRows
                    )
                const groupVisibleCells = row.getVisibleCells()
                const isSelected = isRowSelectionMode && selectedRowIdSet.has(row.id)
                const groupingColumn = row.groupingColumnId
                  ? table.getColumn(row.groupingColumnId)
                  : undefined
                const groupingMeta = groupingColumn?.columnDef.meta as
                  | DataTableColumnMeta
                  | undefined
                const groupingValue = groupingColumn
                  ? renderDataCellValue({
                      dateFormat: groupingMeta?.dateFormat ?? dateFormat,
                      enumColors: groupingMeta?.enumColors,
                      enumOptions: groupingMeta?.enumOptions,
                      enumVariant: groupingMeta?.enumVariant,
                      type: groupingMeta?.kind,
                      value: row.groupingValue,
                    })
                  : null
                const hasVisibleGroupedCell = groupVisibleCells.some((cell) =>
                  cell.getIsGrouped()
                )
                const primaryGroupCellId = groupVisibleCells.find(
                  (cell) =>
                    cell.column.id !== "__select" &&
                    cell.column.id !== "__actions"
                )?.id

                return (
                  <tr
                    aria-selected={isSelected}
                    className={cn(
                      "left-0 absolute flex w-full transition-colors",
                      isGroupRow ? "bg-transparent" : "bg-card",
                      // canSelectRows && row.getCanSelect() && "cursor-pointer",
                      !isGroupRow && rowClassName?.(row.original),
                      !isGroupRow &&
                        isSelected &&
                        "bg-primary/10 before:left-0 before:bg-primary after:bottom-0 after:left-0 after:bg-primary before:absolute before:-top-px before:h-px before:w-full before:content-[''] after:absolute after:h-px after:w-full after:content-['']"
                    )}
                    data-index={virtualRow.index}
                    data-row-id={row.id}
                    data-state={
                      !isGroupRow && isSelected ? "selected" : undefined
                    }
                    key={row.id}
                    ref={(node) => {
                      if (node) {
                        rowVirtualizer.measureElement(node)
                      }
                    }}
                    style={{
                      ...(!isGroupRow ? rowStyle?.(row.original) : undefined),
                      minHeight: isGroupRow
                        ? Math.max(rowHeight, 44)
                        : rowHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: table.getTotalSize(),
                    }}
                  >
                    {isGroupRow
                      ? groupVisibleCells.map((cell, index, visibleCells) => {
                          const meta = (cell.column.columnDef.meta ??
                            {}) as DataTableColumnMeta
                          const isActionsCell = cell.column.id === "__actions"
                          const isSelectionCell = meta.kind === "selection"
                          const shouldRenderGroupLabel =
                            cell.getIsGrouped() ||
                            (!hasVisibleGroupedCell &&
                              cell.id === primaryGroupCellId)
                          const value = cell.getValue()
                          let content: React.ReactNode = null

                          if (!isActionsCell && !isSelectionCell) {
                            if (shouldRenderGroupLabel) {
                              content = (
                                <div className="min-w-0 gap-0.5 flex items-center">
                                  {row.getCanExpand() ? (
                                    <button
                                      aria-label={
                                        row.getIsExpanded()
                                          ? "Collapse group"
                                          : "Expand group"
                                      }
                                      className="-ml-4"
                                      onClick={() => row.toggleExpanded()}
                                      type="button"
                                    >
                                      {row.getIsExpanded() ? (
                                        <ChevronDown className="size-3.5" />
                                      ) : (
                                        <ChevronRight className="size-3.5" />
                                      )}
                                    </button>
                                  ) : null}
                                  <div className="min-w-0 font-medium text-foreground truncate">
                                    {groupingColumn ? groupingValue : "Group"}
                                  </div>
                                </div>
                              )
                            } else if (
                              meta.kind === "date" &&
                              isDateRangeAggregate(value)
                            ) {
                              content = (
                                <div className="min-w-0 truncate">
                                  <span className="font-medium text-foreground">
                                    {formatDuration(value.durationMs)}
                                  </span>
                                  <span className="ml-2 text-muted-foreground text-[11px]">
                                    span
                                  </span>
                                </div>
                              )
                            } else if (
                              meta.kind === "number" &&
                              typeof value === "number"
                            ) {
                              content = (
                                <div className="min-w-0 font-medium text-foreground truncate">
                                  {formatSummaryNumber(value)}
                                </div>
                              )
                            }
                          }

                          return (
                            <td
                              className={cn(
                                "border-border/70 px-2 py-2 text-xs text-muted-foreground flex shrink-0 items-center border-y align-middle",
                                meta.align === "center" &&
                                  "justify-center text-center",
                                meta.align === "right" &&
                                  "justify-end text-right",
                                meta.sticky === "left" &&
                                  "left-0 border-r-border sticky z-10 border-r"
                              )}
                              key={cell.id}
                              style={{
                                background:
                                  "var(--color-table-gap, color-mix(in oklab, var(--color-muted) 84%, transparent))",
                                paddingLeft:
                                  index === 0
                                    ? resolveGroupedPadding(
                                        edgeHorizontalPadding,
                                        row.depth
                                      )
                                    : undefined,
                                paddingRight:
                                  index === visibleCells.length - 1
                                    ? edgeHorizontalPadding
                                    : undefined,
                                width: cell.column.getSize(),
                              }}
                            >
                              <div className="min-w-0 w-full">{content}</div>
                            </td>
                          )
                        })
                      : row
                          .getVisibleCells()
                          .map((cell, index, visibleCells) => {
                            const meta = (cell.column.columnDef.meta ??
                              {}) as DataTableColumnMeta
                            const isActionsCell = cell.column.id === "__actions"
                            const highlightTerms =
                              highlightTermsByColumnId.get(cell.column.id) ??
                              EMPTY_HIGHLIGHT_TERMS

                            if (isActionsCell) {
                              return (
                                <td
                                  className={cn(
                                    "border-border px-2 py-1.5 text-sm text-foreground flex shrink-0 justify-end border-b text-right align-middle",
                                    meta.cellClassName
                                  )}
                                  key={cell.id}
                                  style={{
                                    paddingLeft:
                                      index === 0
                                        ? edgeHorizontalPadding
                                        : undefined,
                                    paddingRight:
                                      index === visibleCells.length - 1
                                        ? edgeHorizontalPadding
                                        : undefined,
                                    width: cell.column.getSize(),
                                  }}
                                >
                                  <div className="min-w-0 w-full">
                                    <RowActionButtonGroup
                                      resolvedActions={visibleRowActions}
                                      setStatus={setRowActionStatus}
                                      statuses={rowActionStatuses}
                                    />
                                  </div>
                                </td>
                              )
                            }

                            return (
                              <DataTableBodyCell
                                cell={cell}
                                cellProps={{
                                  "data-selection-column-id": isSelectableColumnId(
                                    cell.column.id
                                  )
                                    ? cell.column.id
                                    : undefined,
                                  "data-selection-row-id": isSelectableColumnId(
                                    cell.column.id
                                  )
                                    ? row.id
                                    : undefined,
                                  onDoubleClick: isSelectableColumnId(cell.column.id)
                                    ? () => handleCellDoubleClick(cell)
                                    : undefined,
                                  onClick: isSelectableColumnId(cell.column.id)
                                    ? (event) => handleCellClick(event, cell)
                                    : undefined,
                                  onMouseDown: isSelectableColumnId(cell.column.id)
                                    ? (event) => handleCellMouseDown(event, cell)
                                    : undefined,
                                  onMouseEnter: isSelectableColumnId(cell.column.id)
                                    ? (event) => handleCellMouseEnter(event)
                                    : undefined,
                                }}
                                dateFormat={dateFormat}
                                highlightTerms={highlightTerms}
                                isActive={
                                  activeCell?.rowId === row.id &&
                                  activeCell?.columnId === cell.column.id
                                }
                                isEditing={
                                  editingCell?.rowId === row.id &&
                                  editingCell?.columnId === cell.column.id
                                }
                                isSelected={
                                  (() => {
                                    const rowIndex = rowIndexById.get(row.id)
                                    const columnIndex = columnIndexById.get(
                                      cell.column.id
                                    )

                                    return (
                                      rowIndex !== undefined &&
                                      columnIndex !== undefined &&
                                      isCellInSelectionRanges({
                                        columnIndex,
                                        normalizedRanges: normalizedSelectionRanges,
                                        rowIndex,
                                      })
                                    )
                                  })()
                                }
                                key={cell.id}
                                paddingLeft={
                                  index === 0
                                    ? edgeHorizontalPadding
                                    : undefined
                                }
                                paddingRight={
                                  index === visibleCells.length - 1
                                    ? edgeHorizontalPadding
                                    : undefined
                                }
                                width={cell.column.getSize()}
                              />
                            )
                          })}
                  </tr>
                )
              })
            )}
            </tbody>
          </table>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {selectionOverlayBoxes.map((box) => (
              <div
                className="absolute border border-primary/70 ring-1 ring-primary/70 bg-primary/6"
                key={box.key}
                style={{
                  height: box.height,
                  left: box.left,
                  top: headerHeight + box.top,
                  width: box.width,
                }}
              />
            ))}
          </div>
        </div>
      </DndContext>
      {editingOverlayContext
        ? createPortal(
            <div
              className="z-60 overflow-hidden border border-primary ring-1 ring-primary bg-background shadow-lg"
              style={{
                height: editingOverlayContext.rect.height,
                left: editingOverlayContext.rect.left,
                position: "fixed",
                top: editingOverlayContext.rect.top,
                width: editingOverlayContext.rect.width,
              }}
            >
              <editingOverlayContext.Editor
                column={editingOverlayContext.column}
                onBlur={() => {
                  void commitEditingCell()
                }}
                onChange={handleEditingOverlayChange}
                onKeyDown={editingOverlayContext.handleEditorKeyDown}
                pending={editingOverlayContext.pending}
                row={editingOverlayContext.row}
                value={editingOverlayContext.value}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  )

  return (
    <section
      className="min-h-0 border-border bg-card text-card-foreground flex flex-col overflow-hidden border-t"
      style={{ height }}
    >
      {rowActions && rowActions.length > 0 ? (
        <ContextMenu
          onOpenChange={(open: boolean) => {
            if (!open) {
              setActiveContextMenuRowId(null)
              setActiveContextMenuColumnId(null)
            }
          }}
        >
          <ContextMenuTrigger asChild>{tableContent}</ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            {activeContextMenuCell ? (
              <>
                <ContextMenuItem
                  onSelect={() => {
                    const cellValue = activeContextMenuCell.value
                    const text =
                      cellValue === null || cellValue === undefined
                        ? ""
                        : typeof cellValue === "object"
                          ? JSON.stringify(cellValue)
                          : String(cellValue)
                    void navigator.clipboard.writeText(text)
                  }}
                >
                  <Copy className="size-3.5" />
                  <span className="truncate">
                    Copy {activeContextMenuCell.headerName}
                  </span>
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            ) : null}
            {activeContextMenuActions.map((resolvedAction) => (
              <RowActionMenuItem
                key={resolvedAction.action.id}
                resolvedAction={resolvedAction}
                setStatus={setRowActionStatus}
                statuses={rowActionStatuses}
              />
            ))}
            {activeContextMenuActions.length > 0 ? (
              <ContextMenuSeparator />
            ) : null}
            {activeContextMenuRow &&
            selectedRowIdSet.has(activeContextMenuRow.id) &&
            selectedTableRows.length > 1 ? (
              <ContextMenuLabel>
                {selectedTableRows.length} selected rows
              </ContextMenuLabel>
            ) : activeContextMenuActions.length > 0 ? (
              <ContextMenuLabel>Row actions</ContextMenuLabel>
            ) : null}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        tableContent
      )}
    </section>
  )
}

export function DataTable<TData extends DataTableRow>(
  props: DataTableProps<TData>
): React.JSX.Element
export function DataTable<TData extends DataTableRow>(
  props?: Partial<DataTableProps<TData>>
): React.JSX.Element
export function DataTable<TData extends DataTableRow>(
  props: Partial<DataTableProps<TData>> = {}
) {
  const context = useOptionalDataTableContext<TData>()
  const resolvedProps = context
    ? ({ ...context.tableProps, ...props } as Partial<DataTableProps<TData>>)
    : props

  if (resolvedProps.data === undefined || resolvedProps.id === undefined) {
    throw new Error(
      "DataTable must be used inside DataTableProvider or receive data and id props."
    )
  }

  return <DataTableView {...(resolvedProps as DataTableProps<TData>)} />
}
