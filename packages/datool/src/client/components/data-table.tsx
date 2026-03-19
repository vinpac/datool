/* eslint-disable react-hooks/incompatible-library, react-refresh/only-export-components */
import {
  getExpandedRowModel,
  getGroupedRowModel,
  functionalUpdate,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type AggregationFnOption,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
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
  EyeOff,
  LayoutGrid,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react"
import * as React from "react"
import { useDeferredValue } from "react"

import {
  DataTableBodyCell,
  DataTableCheckbox,
  fallbackCellValue,
} from "./data-table-cell"
import {
  DataTableHeaderCol,
  type DataTableAlign,
  type DataTableColumnMeta,
} from "./data-table-header-col"
import {
  DataTableColIcon,
  inferDataTableColumnKind,
  type DataTableColumnKind,
} from "./data-table-col-icon"
import type {
  DatoolDateFormat,
  DatoolEnumColorMap,
} from "../../shared/types"
import { Button } from "@/components/ui/button"
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
} from "@/lib/data-table-search"
import {
  buildTableSearchFields,
  withColumnSearchFilters,
} from "@/lib/filterable-table"
import {
  readPersistedSearch,
  type SearchStatePersistence,
  writePersistedSearch,
} from "@/lib/table-search-persistence"
import { cn } from "@/lib/utils"

type DataTableRow = Record<string, unknown>

export type DataTableRowActionScope = "row" | "selection"

export type DataTableRowActionButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

export type DataTableRowActionButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "xl"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"
  | "icon-xl"

export type DataTableRowActionButtonConfig =
  | false
  | DataTableRowActionButtonVariant
  | {
      className?: string
      label?: string
      size?: DataTableRowActionButtonSize
      variant?: DataTableRowActionButtonVariant
    }

export type DataTableRowActionContext<TData extends DataTableRow> = {
  actionRowIds: string[]
  actionRows: TData[]
  anchorRow: TData
  anchorRowId: string
  selectedRowIds: string[]
  selectedRows: TData[]
}

type DataTableRowActionChildren<TData extends DataTableRow> =
  | DataTableRowAction<TData>[]
  | ((context: DataTableRowActionContext<TData>) => DataTableRowAction<TData>[])

export type DataTableRowAction<TData extends DataTableRow> = {
  button?: DataTableRowActionButtonConfig
  disabled?: boolean | ((context: DataTableRowActionContext<TData>) => boolean)
  hidden?: boolean | ((context: DataTableRowActionContext<TData>) => boolean)
  icon?: React.ComponentType<{ className?: string }>
  id: string
  items?: DataTableRowActionChildren<TData>
  label: string | ((context: DataTableRowActionContext<TData>) => string)
  onSelect?: (
    context: DataTableRowActionContext<TData>
  ) => Promise<unknown> | unknown
  scope?: DataTableRowActionScope
  shortcut?: string
  variant?: "default" | "destructive"
}

export type DataTableColumnConfig<TData extends DataTableRow> = {
  accessorFn?: (row: TData) => unknown
  accessorKey?: Extract<keyof TData, string>
  aggregatedCell?: ColumnDef<TData>["aggregatedCell"]
  aggregationFn?: AggregationFnOption<TData>
  align?: DataTableAlign
  cell?: (args: { row: TData; value: unknown }) => React.ReactNode
  cellClassName?: string
  enableFiltering?: boolean
  enableGrouping?: boolean
  enableHiding?: boolean
  enableResizing?: boolean
  enableSorting?: boolean
  enumColors?: DatoolEnumColorMap
  enumOptions?: string[]
  filterFn?: FilterFn<TData>
  header?: string
  headerClassName?: string
  highlightMatches?: boolean
  id?: string
  kind?: DataTableColumnKind
  maxWidth?: number
  minWidth?: number
  truncate?: boolean
  width?: number
  getGroupingValue?: (row: TData) => unknown
}

export type DataTableProps<TData extends DataTableRow> = {
  autoScrollToBottom?: boolean
  autoScrollToBottomThreshold?: number
  columnFilters?: ColumnFiltersState
  columnVisibility?: VisibilityState
  columns?: DataTableColumnConfig<TData>[]
  data: TData[]
  dateFormat?: DatoolDateFormat
  edgeHorizontalPadding?: React.CSSProperties["paddingLeft"]
  enableRowSelection?: boolean
  filterPlaceholder?: string
  globalFilter?: string
  grouping?: GroupingState
  getRowId?: (row: TData, index: number) => string
  height?: React.CSSProperties["height"]
  highlightQuery?: string
  id: string
  onColumnFiltersChange?: (value: ColumnFiltersState) => void
  onColumnVisibilityChange?: (value: VisibilityState) => void
  onGlobalFilterChange?: (value: string) => void
  onGroupingChange?: (value: GroupingState) => void
  resolveColumnHighlightTerms?: (columnId: string, query: string) => string[]
  rowActions?: DataTableRowAction<TData>[]
  rowClassName?: (row: TData) => string | undefined
  rowStyle?: (row: TData) => React.CSSProperties | undefined
  rowHeight?: number
  statePersistence?: "localStorage" | "none" | "url"
}

export type DataTableProviderProps<TData extends DataTableRow> = Omit<
  DataTableProps<TData>,
  | "columnFilters"
  | "columns"
  | "data"
  | "globalFilter"
  | "highlightQuery"
  | "id"
  | "onColumnFiltersChange"
  | "onGlobalFilterChange"
  | "resolveColumnHighlightTerms"
  | "statePersistence"
> & {
  children: React.ReactNode
  columns: DataTableColumnConfig<TData>[]
  data: TData[]
  fieldOptions?: Partial<Record<string, string[]>>
  id: string
  onSearchChange?: (value: string) => void
  persistSearch?: boolean
  search?: string
  searchPersistence?: SearchStatePersistence | "none"
  statePersistence?: DataTableProps<TData>["statePersistence"]
}

type DataTableContextValue<TData extends DataTableRow> = {
  search: string
  searchFields: DataTableSearchField<TData>[]
  setSearch: (value: string) => void
  tableProps: DataTableProps<TData>
}

type PersistedTableState = {
  columnFilters?: ColumnFiltersState
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
  const [search, setSearch] = React.useState(() =>
    resolvedSearchPersistence === "none"
      ? ""
      : readPersistedSearch(id, resolvedSearchPersistence)
  )

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

  const searchFields = React.useMemo(
    () =>
      buildTableSearchFields(columns, data, {
        fieldOptions,
      }),
    [columns, data, fieldOptions]
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

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    seconds > 0 || totalSeconds === 0 ? `${seconds}s` : null,
  ].filter(Boolean)

  return parts.join(" ")
}

function getColumnHeaderLabel<TData extends DataTableRow>(
  column: Column<TData, unknown>
) {
  return typeof column.columnDef.header === "string"
    ? column.columnDef.header
    : formatHeaderLabel(column.id)
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

function buildColumns<TData extends DataTableRow>(
  data: TData[],
  columns?: DataTableColumnConfig<TData>[],
  dateFormat?: DatoolDateFormat,
  showRowSelectionColumn?: boolean,
  showRowActionButtonsColumn?: boolean,
  rowActionsColumnSize?: number
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
      enumColors: kind === "enum" ? column.enumColors : undefined,
      enumOptions: kind === "enum" ? column.enumOptions : undefined,
      headerClassName: column.headerClassName,
      highlightMatches:
        column.highlightMatches ?? (kind === "text" ? true : false),
      kind,
      truncate: column.truncate ?? true,
    }

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
      cell: ({ getValue, row }) =>
        column.cell
          ? column.cell({ row: row.original, value: getValue() })
          : fallbackCellValue(getValue(), kind, {
              dateFormat,
              enumColors: kind === "enum" ? column.enumColors : undefined,
              enumOptions: kind === "enum" ? column.enumOptions : undefined,
            }),
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
          {row.getCanSelect() ? (
            <DataTableCheckbox
              ariaLabel={`Select row ${row.index + 1}`}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked)}
            />
          ) : null}
        </div>
      ),
      enableGrouping: false,
      enableGlobalFilter: false,
      enableHiding: false,
      enableResizing: false,
      enableSorting: false,
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <DataTableCheckbox
            ariaLabel="Select all visible rows"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(checked)
            }
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
  selectedRows: Row<TData>[]
) {
  if (action.scope === "selection" && row.getIsSelected()) {
    return selectedRows.length > 0
      ? selectedRows.map((selectedRow) => selectedRow.original)
      : [row.original]
  }

  return [row.original]
}

function resolveRowActionRowIds<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  row: Row<TData>,
  selectedRows: Row<TData>[]
) {
  if (action.scope === "selection" && row.getIsSelected()) {
    return selectedRows.length > 0
      ? selectedRows.map((selectedRow) => selectedRow.id)
      : [row.id]
  }

  return [row.id]
}

function buildRowActionContext<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  row: Row<TData>,
  selectedRows: Row<TData>[]
) {
  return {
    actionRowIds: resolveRowActionRowIds(action, row, selectedRows),
    actionRows: resolveRowActionRows(action, row, selectedRows),
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

function hasSelectionScopedAction<TData extends DataTableRow>(
  actions: DataTableRowAction<TData>[]
): boolean {
  return actions.some((action) => {
    if (action.scope === "selection") {
      return true
    }

    const items = Array.isArray(action.items) ? action.items : undefined

    return items ? hasSelectionScopedAction(items) : false
  })
}

function countStaticButtonActions<TData extends DataTableRow>(
  actions: DataTableRowAction<TData>[]
): number {
  return actions.reduce((count, action) => {
    const nextCount =
      resolveRowActionButton(action as DataTableRowAction<DataTableRow>) !== null
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

function resolveRowActionItems<TData extends DataTableRow>(
  action: DataTableRowAction<TData>,
  context: DataTableRowActionContext<TData>,
  row: Row<TData>,
  selectedRows: Row<TData>[]
) {
  const items =
    typeof action.items === "function" ? action.items(context) : action.items

  return resolveVisibleRowActions(items ?? [], row, selectedRows)
}

function resolveVisibleRowActions<TData extends DataTableRow>(
  actions: DataTableRowAction<TData>[],
  row: Row<TData>,
  selectedRows: Row<TData>[]
): ResolvedRowAction<TData>[] {
  return actions.flatMap((action) => {
    const context = buildRowActionContext(action, row, selectedRows)

    if (resolveRowActionState(action.hidden, context)) {
      return []
    }

    const items = resolveRowActionItems(action, context, row, selectedRows)

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

function RowActionMenuItem<TData extends DataTableRow>({
  resolvedAction,
  setStatus,
  statuses,
}: {
  resolvedAction: ResolvedRowAction<TData>
  setStatus: (key: string, status: RowActionStatus, resetAfterMs?: number) => void
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
        ((button === "destructive" ||
          (typeof button === "object" && button?.variant === "destructive"))
          ? "destructive"
          : "default")
      }
    >
      {Icon ? (
        <Icon
          className={cn("size-3.5", isBusy && "animate-spin")}
        />
      ) : null}
      <span className="truncate">{label}</span>
      {action.shortcut ? (
        <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
      ) : null}
    </ContextMenuItem>
  )
}

function RowActionButtonGroup<TData extends DataTableRow>({
  resolvedActions,
  setStatus,
  statuses,
}: {
  resolvedActions: ResolvedRowAction<TData>[]
  setStatus: (key: string, status: RowActionStatus, resetAfterMs?: number) => void
  statuses: Record<string, RowActionStatus>
}) {
  const buttonActions = resolvedActions.filter(
    (resolvedAction) =>
      resolvedAction.items.length === 0 &&
      resolveRowActionButton(
        resolvedAction.action as DataTableRowAction<DataTableRow>
      ) !== null
  )

  if (buttonActions.length === 0) {
    return null
  }

  return (
    <div
      className="flex w-full justify-end gap-1.5"
      data-no-row-select="true"
    >
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
                ? button.variant ?? "outline"
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
                className={cn("size-3.5", status?.state === "loading" && "animate-spin")}
              />
            ) : null}
            {buttonLabel}
          </Button>
        )
      })}
    </div>
  )
}

function GroupSummaryBadge({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  )
}

function DataTableView<TData extends DataTableRow>({
  autoScrollToBottom = false,
  autoScrollToBottomThreshold = 96,
  columnFilters: controlledColumnFilters,
  columnVisibility: controlledColumnVisibility,
  columns,
  data,
  dateFormat,
  edgeHorizontalPadding = "16px",
  enableRowSelection = false,
  filterPlaceholder = "Search across visible columns",
  globalFilter,
  grouping: controlledGrouping,
  getRowId,
  height = 620,
  highlightQuery = "",
  id,
  onColumnFiltersChange,
  onColumnVisibilityChange,
  onGlobalFilterChange,
  onGroupingChange,
  resolveColumnHighlightTerms,
  rowActions,
  rowClassName,
  rowStyle,
  rowHeight = 48,
  statePersistence = "localStorage",
}: DataTableProps<TData>) {
  const context = useOptionalDataTableContext<TData>()
  const persistedState = React.useMemo(
    () => readPersistedState(id, statePersistence),
    [id, statePersistence]
  )
  const [sorting, setSorting] = React.useState<SortingState>(
    () => persistedState.sorting ?? []
  )
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    () => persistedState.columnSizing ?? {}
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => persistedState.columnVisibility ?? {})
  const [highlightedColumns, setHighlightedColumns] = React.useState<
    Record<string, boolean>
  >(() => persistedState.highlightedColumns ?? {})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () => persistedState.columnFilters ?? []
  )
  const [grouping, setGrouping] = React.useState<GroupingState>(
    () => persistedState.grouping ?? []
  )
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [rowActionStatuses, setRowActionStatuses] = React.useState<
    Record<string, RowActionStatus>
  >({})
  const rowActionStatusTimersRef = React.useRef<Record<string, number>>({})
  const selectionAnchorIdRef = React.useRef<string | null>(null)
  const dragSelectionRef = React.useRef<{
    anchorId: string
    baseSelection: RowSelectionState
  } | null>(null)
  const dragPointerRef = React.useRef<{
    clientX: number
    clientY: number
  } | null>(null)
  const [isDragSelecting, setIsDragSelecting] = React.useState(false)
  const [searchDraft, setSearchDraft] = React.useState(
    () => persistedState.globalFilter ?? ""
  )
  const deferredSearch = useDeferredValue(searchDraft)
  const isColumnFiltersControlled = controlledColumnFilters !== undefined
  const isColumnVisibilityControlled = controlledColumnVisibility !== undefined
  const isGlobalFilterControlled = globalFilter !== undefined
  const isGroupingControlled = controlledGrouping !== undefined
  const resolvedColumnFilters = controlledColumnFilters ?? columnFilters
  const resolvedColumnVisibility =
    controlledColumnVisibility ?? columnVisibility
  const resolvedGrouping = controlledGrouping ?? grouping
  const hasSelectionActions = rowActions
    ? hasSelectionScopedAction(rowActions)
    : false
  const rowActionButtonCount = rowActions
    ? countStaticButtonActions(rowActions)
    : 0
  const canSelectRows = enableRowSelection || hasSelectionActions
  const showRowSelectionColumn = enableRowSelection
  const showRowActionButtonsColumn = rowActionButtonCount > 0
  const rowActionsColumnSize = React.useMemo(
    () => Math.max(160, Math.min(320, rowActionButtonCount * 96)),
    [rowActionButtonCount]
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
  const tableColumns = React.useMemo(
    () =>
      buildColumns(
        data,
        columnsWithEnumOptions,
        dateFormat,
        showRowSelectionColumn,
        showRowActionButtonsColumn,
        rowActionsColumnSize
      ),
    [
      columnsWithEnumOptions,
      data,
      dateFormat,
      rowActionsColumnSize,
      showRowActionButtonsColumn,
      showRowSelectionColumn,
    ]
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
  >((updater) => {
    setColumnSizing((current) => functionalUpdate(updater, current))
  }, [])
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
  const expandedState = React.useMemo<ExpandedState>(
    () => (resolvedGrouping.length > 0 ? true : {}),
    [resolvedGrouping.length]
  )

  const table = useReactTable({
    columnResizeMode: "onChange",
    columns: tableColumns,
    data,
    enableColumnResizing: true,
    enableGrouping: true,
    enableRowSelection: canSelectRows ? (row) => !row.getIsGrouped() : false,
    enableSubRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getRowId,
    getSortedRowModel: getSortedRowModel(),
    groupedColumnMode: false,
    globalFilterFn: globalFilterFn as FilterFn<TData>,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onGroupingChange: handleGroupingChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters: resolvedColumnFilters,
      columnSizing,
      columnVisibility: resolvedColumnVisibility,
      expanded: expandedState,
      globalFilter: deferredSearch.trim(),
      grouping: resolvedGrouping,
      rowSelection,
      sorting,
    },
  })

  const containerRef = React.useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = React.useRef(true)
  const hasAutoScrolledOnMountRef = React.useRef(false)
  const previousDataLengthRef = React.useRef(0)
  const rows = table.getRowModel().rows
  const selectableRows = React.useMemo(
    () => rows.filter((row) => row.getCanSelect()),
    [rows]
  )
  const selectedTableRows = table.getSelectedRowModel().rows
  const resolvedHeight = typeof height === "number" ? height : 0
  const initialOffsetRef = React.useRef(
    autoScrollToBottom
      ? Math.max(rows.length * rowHeight - resolvedHeight, 0)
      : 0
  )
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    getScrollElement: () => containerRef.current,
    initialOffset: initialOffsetRef.current,
    overscan: 12,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalRows = data.length
  const filteredRows = rows.length
  const selectedRows = selectedTableRows.length

  React.useEffect(() => {
    return () => {
      for (const timerId of Object.values(rowActionStatusTimersRef.current)) {
        window.clearTimeout(timerId)
      }
    }
  }, [])

  React.useEffect(() => {
    if (isColumnFiltersControlled) {
      return
    }

    const nextState = readPersistedState(id, statePersistence)

    setSorting(nextState.sorting ?? [])
    setColumnSizing(nextState.columnSizing ?? {})
    if (!isColumnVisibilityControlled) {
      setColumnVisibility(nextState.columnVisibility ?? {})
    }
    setHighlightedColumns(nextState.highlightedColumns ?? {})
    setColumnFilters(nextState.columnFilters ?? [])
    if (!isGroupingControlled) {
      setGrouping(nextState.grouping ?? [])
    }
    setSearchDraft(nextState.globalFilter ?? "")
    setRowSelection({})
    dragSelectionRef.current = null
    dragPointerRef.current = null
    setIsDragSelecting(false)
    selectionAnchorIdRef.current = null
    for (const timerId of Object.values(rowActionStatusTimersRef.current)) {
      window.clearTimeout(timerId)
    }
    rowActionStatusTimersRef.current = {}
    setRowActionStatuses({})
  }, [
    id,
    isColumnFiltersControlled,
    isColumnVisibilityControlled,
    isGroupingControlled,
    statePersistence,
  ])

  React.useEffect(() => {
    if (!isColumnFiltersControlled) {
      return
    }

    setColumnFilters(controlledColumnFilters)
  }, [controlledColumnFilters, isColumnFiltersControlled])

  React.useEffect(() => {
    if (!isColumnVisibilityControlled) {
      return
    }

    setColumnVisibility(controlledColumnVisibility)
  }, [controlledColumnVisibility, isColumnVisibilityControlled])

  React.useEffect(() => {
    if (!isGroupingControlled) {
      return
    }

    setGrouping(controlledGrouping)
  }, [controlledGrouping, isGroupingControlled])

  React.useEffect(() => {
    if (!isGlobalFilterControlled) {
      return
    }

    setSearchDraft(globalFilter)
  }, [globalFilter, isGlobalFilterControlled])

  React.useEffect(() => {
    if (typeof window === "undefined" || statePersistence !== "url") {
      return
    }

    const syncFromUrl = () => {
      const nextState = readPersistedState(id, "url")

      setSorting(nextState.sorting ?? [])
      setColumnSizing(nextState.columnSizing ?? {})
      if (!isColumnVisibilityControlled) {
        setColumnVisibility(nextState.columnVisibility ?? {})
      }
      setHighlightedColumns(nextState.highlightedColumns ?? {})
      setColumnFilters(nextState.columnFilters ?? [])
      if (!isGroupingControlled) {
        setGrouping(nextState.grouping ?? [])
      }
      setSearchDraft(nextState.globalFilter ?? "")
      setRowSelection({})
      dragSelectionRef.current = null
      dragPointerRef.current = null
      setIsDragSelecting(false)
      selectionAnchorIdRef.current = null
    }

    window.addEventListener("popstate", syncFromUrl)

    return () => window.removeEventListener("popstate", syncFromUrl)
  }, [id, isColumnVisibilityControlled, isGroupingControlled, statePersistence])

  React.useEffect(() => {
    if (isGlobalFilterControlled || isColumnFiltersControlled) {
      return
    }

    writePersistedState(id, statePersistence, {
      columnFilters,
      columnSizing,
      highlightedColumns,
      columnVisibility: resolvedColumnVisibility,
      globalFilter: deferredSearch.trim(),
      grouping: resolvedGrouping,
      sorting,
    })
  }, [
    columnFilters,
    columnSizing,
    deferredSearch,
    highlightedColumns,
    id,
    isColumnFiltersControlled,
    isGlobalFilterControlled,
    isGroupingControlled,
    resolvedColumnVisibility,
    resolvedGrouping,
    sorting,
    statePersistence,
  ])

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

  const handleSearchDraftChange = (value: string) => {
    if (!isGlobalFilterControlled) {
      setSearchDraft(value)
    }

    onGlobalFilterChange?.(value)
  }
  const clearRowSelection = React.useCallback(() => {
    setRowSelection({})
    dragSelectionRef.current = null
    dragPointerRef.current = null
    setIsDragSelecting(false)
    selectionAnchorIdRef.current = null
  }, [])

  const isColumnHighlightEnabled = React.useCallback(
    (columnId: string, meta: DataTableColumnMeta) =>
      highlightedColumns[columnId] ?? Boolean(meta.highlightMatches),
    [highlightedColumns]
  )
  const selectRange = React.useCallback(
    (
      anchorId: string,
      rowId: string,
      baseSelection: RowSelectionState = {}
    ) => {
      const anchorIndex = selectableRows.findIndex(
        (candidateRow) => candidateRow.id === anchorId
      )
      const rowIndex = selectableRows.findIndex(
        (candidateRow) => candidateRow.id === rowId
      )

      if (anchorIndex === -1 || rowIndex === -1) {
        return
      }

      const [start, end] =
        anchorIndex <= rowIndex
          ? [anchorIndex, rowIndex]
          : [rowIndex, anchorIndex]

      setRowSelection({
        ...baseSelection,
        ...Object.fromEntries(
          selectableRows
            .slice(start, end + 1)
            .map((candidateRow) => [candidateRow.id, true])
        ),
      })
    },
    [selectableRows]
  )
  const selectSingleRow = React.useCallback((rowId: string) => {
    selectionAnchorIdRef.current = rowId
    setRowSelection({ [rowId]: true })
  }, [])
  const updateDragSelectionFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!dragSelectionRef.current) {
        return
      }

      const container = containerRef.current

      if (!container) {
        return
      }

      const rowElement = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLTableRowElement>("tr[data-row-id]")
      const renderedRows = Array.from(
        container.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")
      )
      const targetRowId =
        rowElement?.dataset.rowId ??
        (clientY < container.getBoundingClientRect().top
          ? renderedRows[0]?.dataset.rowId
          : clientY > container.getBoundingClientRect().bottom
            ? renderedRows.at(-1)?.dataset.rowId
            : undefined)

      if (!targetRowId) {
        return
      }

      const { anchorId, baseSelection } = dragSelectionRef.current

      selectRange(anchorId, targetRowId, baseSelection)
    },
    [selectRange]
  )
  const handleRowMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (
        event.button !== 0 ||
        !canSelectRows ||
        !row.getCanSelect() ||
        shouldIgnoreRowSelectionTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      dragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      }

      const rowId = row.id
      const isAdditiveSelection = event.metaKey || event.ctrlKey
      const currentSelection = table.getState().rowSelection

      if (event.shiftKey) {
        const anchorId = selectionAnchorIdRef.current ?? rowId

        selectionAnchorIdRef.current = anchorId
        dragSelectionRef.current = {
          anchorId,
          baseSelection: {},
        }
        setIsDragSelecting(true)
        selectRange(anchorId, rowId)
        return
      }

      if (isAdditiveSelection) {
        const baseSelection = { ...currentSelection }

        if (baseSelection[rowId]) {
          delete baseSelection[rowId]
        } else {
          baseSelection[rowId] = true
        }

        selectionAnchorIdRef.current = rowId
        dragSelectionRef.current = {
          anchorId: rowId,
          baseSelection,
        }
        setIsDragSelecting(true)
        setRowSelection(baseSelection)
        return
      }

      selectionAnchorIdRef.current = rowId
      dragSelectionRef.current = {
        anchorId: rowId,
        baseSelection: {},
      }
      setIsDragSelecting(true)
      setRowSelection({ [rowId]: true })
    },
    [canSelectRows, selectRange, table]
  )
  const handleRowMouseEnter = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (
        !canSelectRows ||
        !row.getCanSelect() ||
        event.buttons !== 1 ||
        shouldIgnoreRowSelectionTarget(event.target) ||
        !dragSelectionRef.current
      ) {
        return
      }

      const { anchorId, baseSelection } = dragSelectionRef.current

      selectRange(anchorId, row.id, baseSelection)
    },
    [canSelectRows, selectRange]
  )
  const handleRowContextMenu = React.useCallback(
    (row: Row<TData>) => {
      if (!canSelectRows || !row.getCanSelect()) {
        return
      }

      if (row.getIsSelected()) {
        selectionAnchorIdRef.current = row.id
        return
      }

      selectSingleRow(row.id)
    },
    [canSelectRows, selectSingleRow]
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
    if (!canSelectRows) {
      return
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        Object.keys(rowSelection).length === 0 ||
        shouldIgnoreSelectionShortcutTarget(event.target)
      ) {
        return
      }

      clearRowSelection()
    }

    window.addEventListener("keydown", handleWindowKeyDown)

    return () => window.removeEventListener("keydown", handleWindowKeyDown)
  }, [canSelectRows, clearRowSelection, rowSelection])

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden border-t border-border bg-card text-card-foreground shadow-sm"
      style={{ height }}
    >

      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto pb-4",
          isDragSelecting && "select-none"
        )}
        ref={containerRef}
        style={{
          scrollbarGutter: "stable",
        }}
      >
        <table
          className="grid w-full border-separate border-spacing-0"
          role="grid"
        >
          <thead className="sticky top-0 z-20 grid">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                className="flex w-full"
                key={headerGroup.id}
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
                    paddingLeft={index === 0 ? edgeHorizontalPadding : undefined}
                    paddingRight={
                      index === headerGroup.headers.length - 1
                        ? edgeHorizontalPadding
                        : undefined
                    }
                    scrollContainerRef={containerRef}
                  />
                ))}
              </tr>
            ))}
          </thead>

          <tbody
            className="relative grid"
            style={{
              height: rowVirtualizer.getTotalSize(),
            }}
          >
            {virtualRows.length === 0 ? (
              <tr className="absolute inset-x-0 top-0 flex h-full items-center justify-center">
                <td className="px-4 py-10 text-center text-sm text-muted-foreground">
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
                      selectedTableRows
                    )
                const isSelected = row.getIsSelected()
                const groupVisibleCells = row.getVisibleCells()
                const groupingColumn = row.groupingColumnId
                  ? table.getColumn(row.groupingColumnId)
                  : undefined
                const groupingMeta = groupingColumn?.columnDef.meta as
                  | DataTableColumnMeta
                  | undefined
                const groupingValue = groupingColumn
                  ? fallbackCellValue(row.groupingValue, groupingMeta?.kind, {
                      dateFormat,
                      enumColors: groupingMeta?.enumColors,
                      enumOptions: groupingMeta?.enumOptions,
                    })
                  : null
                const groupSummaries = isGroupRow
                  ? groupVisibleCells.flatMap((cell) => {
                      const meta = (cell.column.columnDef.meta ??
                        {}) as DataTableColumnMeta
                      const value = cell.getValue()
                      const label = getColumnHeaderLabel(cell.column)

                      if (meta.kind === "date" && isDateRangeAggregate(value)) {
                        return [
                          {
                            label: `${label} span`,
                            value: formatDuration(value.durationMs),
                          },
                        ]
                      }

                      if (meta.kind === "number" && typeof value === "number") {
                        return [
                          {
                            label: `${label} sum`,
                            value: formatSummaryNumber(value),
                          },
                        ]
                      }

                      return []
                    })
                  : []
                const rowContent = (
                  <tr
                    aria-selected={isSelected}
                    className={cn(
                      "absolute left-0 flex w-full transition-colors",
                      isGroupRow
                        ? "bg-transparent"
                        : "bg-card",
                      canSelectRows &&
                        row.getCanSelect() &&
                        "cursor-pointer",
                      !isGroupRow && rowClassName?.(row.original),
                      !isGroupRow &&
                        isSelected &&
                        "bg-primary/10 before:absolute before:-top-px before:left-0 before:h-px before:w-full before:bg-primary before:content-[''] after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-primary after:content-['']"
                    )}
                    data-index={virtualRow.index}
                    data-row-id={row.id}
                    data-state={!isGroupRow && isSelected ? "selected" : undefined}
                    key={row.id}
                    onContextMenu={
                      isGroupRow ? undefined : () => handleRowContextMenu(row)
                    }
                    onMouseDown={
                      isGroupRow
                        ? undefined
                        : (event) => handleRowMouseDown(event, row)
                    }
                    onMouseEnter={
                      isGroupRow
                        ? undefined
                        : (event) => handleRowMouseEnter(event, row)
                    }
                    ref={(node) => {
                      if (node) {
                        rowVirtualizer.measureElement(node)
                      }
                    }}
                    style={{
                      ...(!isGroupRow ? rowStyle?.(row.original) : undefined),
                      minHeight: isGroupRow ? Math.max(rowHeight, 44) : rowHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: table.getTotalSize(),
                    }}
                  >
                    {isGroupRow ? (
                      <td
                        className="flex shrink-0 items-center border-y border-border/70 px-2 py-2 align-middle text-xs text-muted-foreground"
                        style={{
                          background:
                            "var(--color-table-gap, color-mix(in oklab, var(--color-muted) 84%, transparent))",
                          paddingLeft: resolveGroupedPadding(
                            edgeHorizontalPadding,
                            row.depth
                          ),
                          paddingRight: edgeHorizontalPadding,
                          width: table.getTotalSize(),
                        }}
                      >
                        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                          {row.getCanExpand() ? (
                            <button
                              aria-label={
                                row.getIsExpanded()
                                  ? "Collapse group"
                                  : "Expand group"
                              }
                              className="inline-flex size-6 items-center justify-center rounded-md border border-border/70 bg-background/80 text-foreground transition-colors hover:bg-background"
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
                          {groupingColumn ? (
                            <span className="inline-flex items-center gap-2 text-xs">
                              <span className="font-medium text-foreground">
                                {getColumnHeaderLabel(groupingColumn)}
                              </span>
                              <span className="min-w-0 truncate text-foreground">
                                {groupingValue}
                              </span>
                            </span>
                          ) : (
                            <span className="font-medium text-foreground">
                              Group
                            </span>
                          )}
                          <GroupSummaryBadge
                            label="rows"
                            value={formatSummaryNumber(row.getLeafRows().length)}
                          />
                          {groupSummaries.map((summary) => (
                            <GroupSummaryBadge
                              key={`${row.id}-${summary.label}`}
                              label={summary.label}
                              value={summary.value}
                            />
                          ))}
                        </div>
                      </td>
                    ) : (
                      row.getVisibleCells().map((cell, index, visibleCells) => {
                        const meta = (cell.column.columnDef.meta ??
                          {}) as DataTableColumnMeta
                        const isActionsCell = cell.column.id === "__actions"
                        const highlightTerms =
                          meta.kind === "text" &&
                          resolveColumnHighlightTerms &&
                          isColumnHighlightEnabled(cell.column.id, meta)
                            ? resolveColumnHighlightTerms(
                                cell.column.id,
                                highlightQuery
                              )
                            : []

                        if (isActionsCell) {
                          return (
                            <td
                              className={cn(
                                "flex shrink-0 border-b border-border px-2 py-1.5 align-middle text-sm text-foreground justify-end text-right",
                                meta.cellClassName
                              )}
                              key={cell.id}
                              style={{
                                paddingLeft:
                                  index === 0 ? edgeHorizontalPadding : undefined,
                                paddingRight:
                                  index === visibleCells.length - 1
                                    ? edgeHorizontalPadding
                                    : undefined,
                                width: cell.column.getSize(),
                              }}
                            >
                              <div className="w-full min-w-0">
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
                            dateFormat={dateFormat}
                            highlightTerms={highlightTerms}
                            key={cell.id}
                            paddingLeft={
                              index === 0 ? edgeHorizontalPadding : undefined
                            }
                            paddingRight={
                              index === visibleCells.length - 1
                                ? edgeHorizontalPadding
                                : undefined
                            }
                          />
                        )
                      })
                    )}
                  </tr>
                )

                if (visibleRowActions.length === 0) {
                  return rowContent
                }

                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      {rowContent}
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64">
                      {visibleRowActions.map((resolvedAction) => (
                        <RowActionMenuItem
                          key={resolvedAction.action.id}
                          resolvedAction={resolvedAction}
                          setStatus={setRowActionStatus}
                          statuses={rowActionStatuses}
                        />
                      ))}
                      <ContextMenuSeparator />

                      <ContextMenuLabel>
                        {isSelected && selectedTableRows.length > 1
                          ? `${selectedTableRows.length} selected rows`
                          : "Row actions"}
                      </ContextMenuLabel>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })
            )}
          </tbody>
        </table>
      </div>
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
