import type {
  AggregationFnOption,
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  FilterFn,
  GroupingState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table"
import type * as React from "react"
import type { Button } from "@/components/ui/button"
import type { SearchStatePersistence } from "./lib/table-search-persistence"

export type DatoolColumnKind =
  | "text"
  | "enum"
  | "number"
  | "boolean"
  | "date"
  | "json"

export const DATOOL_ENUM_BADGE_COLORS = [
  "emerald",
  "purple",
  "sky",
  "pink",
  "red",
  "zinc",
  "lime",
  "violet",
  "fuchsia",
  "teal",
  "amber",
  "rose",
  "orange",
  "cyan",
  "indigo",
  "yellow",
  "green",
  "coral",
  "blue",
  "stone",
] as const

type ButtonProps = React.ComponentProps<typeof Button>

export type DatoolEnumBadgeColor = (typeof DATOOL_ENUM_BADGE_COLORS)[number]
export type DatoolEnumColorMap = Partial<Record<string, DatoolEnumBadgeColor>>

export type DatoolActionButtonConfig =
  | false
  | ButtonProps["variant"]
  | {
      className?: string
      label?: string
      size?: ButtonProps["size"]
      variant?: ButtonProps["variant"]
    }

export type DatoolRelativeDateFormat = {
  addSuffix?: boolean
  relative: true
}

export type DatoolDateFormat =
  | DatoolRelativeDateFormat
  | Intl.DateTimeFormatOptions
  | string

export type DatoolOpenContext = {
  emit: (line: string) => void
  query: URLSearchParams
  signal: AbortSignal
}

export type DatoolGetContext = {
  limit?: number
  offset?: number
  page?: number
  query: URLSearchParams
  signal: AbortSignal
  sourceId: string
  streamId?: string
}

export type DatoolGetResultMetadata = {
  nextOffset?: number
  nextPage?: number
  prevOffset?: number
  prevPage?: number
  total?: number
}

export type DatoolParseLineContext = {
  line: string
  query: URLSearchParams
  sourceId: string
  streamId?: string
}

export type DatoolGetRowIdContext<Row extends Record<string, unknown>> = {
  index: number
  line?: string
  query: URLSearchParams
  row: Row
  sourceId: string
  streamId?: string
}

export type DatoolActionResolveContext<Row extends Record<string, unknown>> = {
  actionId: string
  query: URLSearchParams
  rows: Row[]
  sourceId: string
  streamId?: string
}

export type DatoolActionRowChange<Row extends Record<string, unknown>> =
  | Row
  | boolean
  | null
  | void

export type DatoolActionResolveResult<Row extends Record<string, unknown>> =
  | DatoolActionRowChange<Row>[]
  | boolean
  | null
  | void

export type DatoolAction<Row extends Record<string, unknown>> = {
  button?: DatoolActionButtonConfig
  icon?: React.ReactNode
  label: string
  resolve: (
    context: DatoolActionResolveContext<Row>
  ) => DatoolActionResolveResult<Row> | Promise<DatoolActionResolveResult<Row>>
}

export type DatoolOpenHandler = (
  context: DatoolOpenContext
) => void | Promise<void> | (() => void | Promise<void>)

export type DatoolGetResult<Row extends Record<string, unknown>> =
  | Row[]
  | ({
      rows: Row[]
    } & DatoolGetResultMetadata)

export type DatoolGetHandler<Row extends Record<string, unknown>> = (
  context: DatoolGetContext
) => DatoolGetResult<Row> | Promise<DatoolGetResult<Row>>

export type DatoolParseLineHandler<Row extends Record<string, unknown>> = (
  context: DatoolParseLineContext
) => Row | null | Promise<Row | null>

export type DatoolGetRowIdHandler<Row extends Record<string, unknown>> = (
  context: DatoolGetRowIdContext<Row>
) => string | Promise<string>

export type DatoolSource = {
  open: DatoolOpenHandler
}

type RequireAtLeastOne<TValue, TKey extends keyof TValue = keyof TValue> = Omit<
  TValue,
  TKey
> &
  {
    [Key in TKey]-?: Required<Pick<TValue, Key>> &
      Partial<Pick<TValue, Exclude<TKey, Key>>>
  }[TKey]

export type DatoolResolvedSource<Row extends Record<string, unknown>> = {
  actions?: Record<string, DatoolAction<Row>>
  get?: DatoolGetHandler<Row>
  getRowId?: DatoolGetRowIdHandler<Row>
  label?: string
  open?: DatoolOpenHandler
  parseLine: DatoolParseLineHandler<Row>
  pollIntervalMs?: number
}

type DatoolSourceDefinitionBase<Row extends Record<string, unknown>> = {
  actions?: Record<string, DatoolAction<Row>>
  get?: DatoolGetHandler<Row>
  getRowId?: DatoolGetRowIdHandler<Row>
  label?: string
  open?: DatoolOpenHandler
  parseLine?: DatoolParseLineHandler<Row>
  pollIntervalMs?: number
  source?: DatoolSource
  stream?: DatoolSource
}

export type DatoolSourceDefinition<Row extends Record<string, unknown>> =
  RequireAtLeastOne<
    DatoolSourceDefinitionBase<Row>,
    "get" | "open" | "source" | "stream"
  >

export type DatoolSourceExport<Row extends Record<string, unknown>> =
  | DatoolSource
  | DatoolResolvedSource<Row>
  | DatoolSourceDefinition<Row>

export type DatoolResolvedStream<Row extends Record<string, unknown>> =
  DatoolResolvedSource<Row>

export type DatoolStreamDefinition<Row extends Record<string, unknown>> =
  DatoolSourceDefinition<Row>

export type DatoolStreamExport<Row extends Record<string, unknown>> =
  DatoolSourceExport<Row>

export type DatoolClientAction = {
  button?: DatoolActionButtonConfig
  icon?: React.ReactNode
  id: string
  label: string
}

export type DatoolClientSource = {
  actions: DatoolClientAction[]
  id: string
  label: string
  pollIntervalMs?: number
  supportsGet: boolean
  supportsLive: boolean
  supportsStream: boolean
}

export type DatoolClientStream = DatoolClientSource

export type DatoolClientPage = {
  filePath: string
  id: string
  path: string
  title: string
}

export type DatoolClientConfig = {
  dateFormat?: DatoolDateFormat
  pages: DatoolClientPage[]
  sources: DatoolClientSource[]
  streams: DatoolClientSource[]
}

export type DatoolApp = {
  dateFormat?: DatoolDateFormat
  pages: DatoolClientPage[]
  server?: {
    host?: string
    port?: number
  }
  sources: Record<string, DatoolResolvedSource<Record<string, unknown>>>
  streams: Record<string, DatoolResolvedSource<Record<string, unknown>>>
  streamsPath: string
}

export type DatoolRowEvent = {
  id: string
  row: Record<string, unknown>
}

export type DatoolSseErrorEvent = {
  message: string
}

export type DatoolSseEndEvent = {
  reason: "completed" | "error"
}

export type DatoolActionRequest = {
  rows: Record<string, unknown>[]
}

export type DatoolActionResponse = {
  rowChanges?: Array<Record<string, unknown> | boolean>
}

export type DataTableColumnKind = DatoolColumnKind | "selection"

export type DataTableAlign = "left" | "center" | "right"

export type DataTableSelectionMode = "cell" | "row"

export type DataTableColumnMeta = {
  align?: DataTableAlign
  cellClassName?: string
  dateFormat?: DatoolDateFormat
  editable?: boolean
  enumColors?: DatoolEnumColorMap
  enumOptions?: string[]
  enumVariant?: "default" | "outline"
  headerClassName?: string
  highlightMatches?: boolean
  kind?: DataTableColumnKind
  sticky?: "left"
  truncate?: boolean
}

export type DataTableRow = Record<string, unknown>

export type DataTableCellEditorProps<TData extends DataTableRow> = {
  column: DataTableColumnConfig<TData>
  onBlur: () => void
  onChange: (value: string) => void
  onKeyDown: (
    event:
      | React.KeyboardEvent<HTMLInputElement>
      | React.KeyboardEvent<HTMLSelectElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
  ) => void
  pending: boolean
  row: TData
  value: string
}

export type DataTableCellEditorComponent<TData extends DataTableRow> =
  React.ComponentType<DataTableCellEditorProps<TData>>

export type DataTableRowActionScope = "row" | "selection"

export type DataTableRowActionButtonConfig = DatoolActionButtonConfig

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
  cell?: (args: {
    children: React.ReactNode
    row: TData
    value: unknown
  }) => React.ReactNode
  cellClassName?: string
  dateFormat?: DatoolDateFormat
  editable?:
    | boolean
    | ((args: {
        row: TData
        value: unknown
      }) => boolean)
  enableFiltering?: boolean
  enableGrouping?: boolean
  enableHiding?: boolean
  enableResizing?: boolean
  enableSorting?: boolean
  enumColors?: DatoolEnumColorMap
  enumOptions?: string[]
  enumVariant?: "default" | "outline"
  filterFn?: FilterFn<TData>
  getGroupingValue?: (row: TData) => unknown
  header?: string
  headerClassName?: string
  highlightMatches?: boolean
  id?: string
  kind?: DataTableColumnKind
  maxWidth?: number
  minWidth?: number
  truncate?: boolean
  width?: number
}

export type DataTableProps<TData extends DataTableRow> = {
  autoScrollToBottom?: boolean
  autoScrollToBottomThreshold?: number
  cellEditors?: Partial<
    Record<DataTableColumnKind, DataTableCellEditorComponent<TData>>
  >
  columnFilters?: ColumnFiltersState
  columnSizing?: ColumnSizingState
  columnVisibility?: VisibilityState
  columns?: DataTableColumnConfig<TData>[]
  data: TData[]
  dateFormat?: DatoolDateFormat
  defaultSorting?: SortingState
  edgeHorizontalPadding?: React.CSSProperties["paddingLeft"]
  enableRowSelection?: boolean
  filterPlaceholder?: string
  getRowId?: (row: TData, index: number) => string
  globalFilter?: string
  grouping?: GroupingState
  height?: React.CSSProperties["height"]
  highlightQuery?: string
  id: string
  onUpdate?: (
    changes: Array<{
      data: Record<string, string>
      row: TData
      rowId: string
    }>
  ) => Promise<
    Array<{
      data: Partial<TData>
      error?: string
      rowId: string
    }>
  >
  onColumnFiltersChange?: (value: ColumnFiltersState) => void
  onColumnSizingChange?: (value: ColumnSizingState) => void
  onColumnVisibilityChange?: (value: VisibilityState) => void
  onGlobalFilterChange?: (value: string) => void
  onGroupingChange?: (value: GroupingState) => void
  resolveColumnHighlightTerms?: (columnId: string, query: string) => string[]
  rowActions?: DataTableRowAction<TData>[]
  rowClassName?: (row: TData) => string | undefined
  rowHeight?: number
  rowStyle?: (row: TData) => React.CSSProperties | undefined
  selection?: DataTableSelectionMode
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

export type DatoolRowsResponse<
  Row extends Record<string, unknown> = Record<string, unknown>,
> = DatoolGetResultMetadata & {
  rows: Array<{
    id: string
    row: Row
  }>
}
