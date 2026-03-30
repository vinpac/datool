"use client"

import * as React from "react"
import type { ColumnSizingState, VisibilityState } from "@tanstack/react-table"
import { Copy, Filter } from "lucide-react"

import {
  DataTable,
  DataTableProvider,
  type DataTableColumnConfig,
  type DataTableRowAction,
  type DataTableRowActionContext,
  useDataTableContext,
} from "./data-table"
import {
  DataTableColIcon,
  type DataTableColumnKind,
} from "./data-table-col-icon"
import type { DatoolTableState } from "../providers/datool-context"
import { useDatoolCollectionQuery } from "../providers/datool-context"
import {
  getValueAtPath,
  isNestedAccessorKey,
  resolveDatoolColumnId,
} from "../../shared/columns"
import type {
  DatoolDateFormat,
  DatoolQueryAction,
  DatoolQueryActionContext,
} from "../../shared/types"
import {
  quoteSearchTokenValue,
  splitSearchQuery,
  type DataTableSearchFieldSpec,
} from "../lib/data-table-search"
import { downloadTextFile, sanitizeFilePart } from "../lib/file-download"
import type { DatoolColumn, DatoolSortingState } from "../table-types"
import { buildTableSearchFields } from "../lib/filterable-table"
import {
  stripViewerRowId,
  type StreamViewerRow,
} from "../stream-state"

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
  query?: string
  rowClassName?: (row: ViewerRow) => string | undefined
  rowHeight?: number
  rowStyle?: (row: ViewerRow) => React.CSSProperties | undefined
}

function formatColumnLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function stringifyGroupingValue(value: unknown) {
  if (value === undefined) return "undefined:"
  if (value === null) return "null:"
  if (value instanceof Date) return `date:${value.toISOString()}`
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
  if (columns.length === 0 || rows.length === 0) return rows
  const groupOrder: string[] = []
  const rowsByGroup = new Map<string, ViewerRow[]>()

  for (const row of rows) {
    const groupKey = columns
      .map((column) => stringifyGroupingValue(getValueAtPath(row, column.accessorKey)))
      .join("\u001f")
    const existing = rowsByGroup.get(groupKey)

    if (existing) {
      existing.push(row)
    } else {
      groupOrder.push(groupKey)
      rowsByGroup.set(groupKey, [row])
    }
  }

  return groupOrder.flatMap((groupKey) => rowsByGroup.get(groupKey) ?? [])
}

function stringifyExportValue(value: unknown, kind?: DataTableColumnKind) {
  if (value === null || value === undefined || value === "") return ""
  if (kind === "date") {
    const date = value instanceof Date ? value : new Date(value as string | number)

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
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
  const header = columns.map((column) => escapeCsvValue(column.label)).join(",")
  const data = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsvValue(
          stringifyExportValue(getValueAtPath(row, column.accessorKey), column.kind)
        )
      )
      .join(",")
  )

  return [header, ...data].join("\n")
}

function buildMarkdownContent(rows: ViewerRow[], columns: ViewerExportColumn[]) {
  const header = `| ${columns.map((column) => escapeMarkdownValue(column.label)).join(" | ")} |`
  const divider = `| ${columns.map(() => "---").join(" | ")} |`
  const data = rows.map((row) =>
    `| ${columns
      .map((column) =>
        escapeMarkdownValue(
          stringifyExportValue(getValueAtPath(row, column.accessorKey), column.kind)
        )
      )
      .join(" | ")} |`
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
      accessorKey: nested
        ? undefined
        : (column.accessorKey as Extract<keyof ViewerRow, string>),
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

function toMarkdownTable(
  rows: ViewerRow[],
  columns: DataTableColumnConfig<ViewerRow>[]
) {
  const headers = columns.map((column, index) =>
    escapeMarkdownCell(getColumnLabel(column, index))
  )

  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => {
      const values = columns.map((column) =>
        escapeMarkdownCell(stringifyRowActionValue(getColumnValue(row, column)))
      )

      return `| ${values.join(" | ")} |`
    }),
  ].join("\n")
}

function buildFieldFilterToken(fieldId: string, value: unknown) {
  const stringValue = stringifyRowActionValue(value)
  return stringValue.trim() ? `${fieldId}:${quoteSearchTokenValue(stringValue)}` : null
}

function replaceFieldFilter(query: string, fieldId: string, nextToken: string) {
  const escaped = fieldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const tokens = splitSearchQuery(query).filter(
    (token) => !token.match(new RegExp(`^${escaped}(:|>|<)`))
  )
  tokens.push(nextToken)
  return tokens.join(" ")
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

function toDatoolActionContext<TData, TFilters, TRow extends Record<string, unknown>>({
  collection,
  context,
}: {
  collection: {
    definition: Extract<
      ReturnType<typeof useDatoolCollectionQuery<TData, TFilters, TRow>>["definition"],
      { kind: "collection" }
    >
    id: string
    result: ReturnType<typeof useDatoolCollectionQuery<TData, TFilters, TRow>>["result"]
    rows: TRow[]
  }
  context: DataTableRowActionContext<ViewerRow>
}) {
  return {
    actionRowIds: context.actionRowIds,
    actionRows: context.actionRows.map((row) => stripViewerRowId(row as StreamViewerRow<TRow>)),
    anchorRow: stripViewerRowId(context.anchorRow as StreamViewerRow<TRow>),
    anchorRowId: context.anchorRowId,
    filters: collection.definition.filters,
    queryId: collection.id,
    refetch: collection.result.refetch,
    result: collection.result,
    rows: collection.rows,
    selectedRowIds: context.selectedRowIds,
    selectedRows: context.selectedRows.map((row) =>
      stripViewerRowId(row as StreamViewerRow<TRow>)
    ),
    setFilters: collection.definition.setFilters,
  } satisfies DatoolQueryActionContext<TData, TFilters, TRow>
}

function DatoolDataTableInner({
  columns,
  collection,
}: {
  collection: ReturnType<
    typeof useDatoolCollectionQuery<
      Record<string, unknown>[],
      unknown,
      Record<string, unknown>
    >
  >
  columns: DataTableColumnConfig<ViewerRow>[]
}) {
  const { search, setSearch } = useDataTableContext<ViewerRow>()
  const searchRef = React.useRef(search)

  React.useEffect(() => {
    searchRef.current = search
  }, [search])

  const rowActions = React.useMemo<DataTableRowAction<ViewerRow>[]>(() => {
    const datoolActions =
      (collection.definition.actions as DatoolQueryAction<
        unknown,
        unknown,
        Record<string, unknown>
      >[] | undefined)?.map((action, index) => {
        const disabled = action.disabled
        const hidden = action.hidden
        const label = action.label

        return {
          button: action.button,
          disabled:
            typeof disabled === "function"
              ? (context: DataTableRowActionContext<ViewerRow>) =>
                  disabled(
                    toDatoolActionContext({
                      collection,
                      context,
                    })
                  )
              : disabled,
          hidden:
            typeof hidden === "function"
              ? (context: DataTableRowActionContext<ViewerRow>) =>
                  hidden(
                    toDatoolActionContext({
                      collection,
                      context,
                    })
                  )
              : hidden,
          icon: action.icon,
          id: `query-action-${index}`,
          label:
            typeof label === "function"
              ? (context: DataTableRowActionContext<ViewerRow>) =>
                  label(
                    toDatoolActionContext({
                      collection,
                      context,
                    })
                  )
              : label,
          onSelect: async (context: DataTableRowActionContext<ViewerRow>) => {
            await action.onSelect(
              toDatoolActionContext({
                collection,
                context,
              })
            )
          },
          scope: action.scope,
          variant: action.variant,
        }
      }) ?? []

    return [
      ...datoolActions,
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
              icon: (props) => (
                <DataTableColIcon kind={column.kind ?? "text"} {...props} />
              ),
              id: `filter-${column.id ?? index}`,
              label: `${getColumnLabel(column, index)}: ${
                stringifyRowActionValue(value) || "(empty)"
              }`,
              onSelect: () => {
                if (!token) return
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
  }, [collection, columns, setSearch])

  return (
    <div className="min-h-0 flex-1">
      <DataTable rowActions={rowActions} />
    </div>
  )
}

export function DatoolDataTable({
  columns: declaredColumns,
  dateFormat,
  defaultSorting,
  query,
  rowClassName,
  rowHeight = 20,
  rowStyle,
}: DatoolDataTableProps) {
  const collection = useDatoolCollectionQuery<Record<string, unknown>[], unknown, Record<string, unknown>>(
    query
  )
  const viewerRows = React.useMemo(
    () => toViewerRows(collection.rows, collection.definition.getRowId),
    [collection.definition, collection.rows]
  )
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
  const searchFieldSpecs = React.useMemo<DataTableSearchFieldSpec[]>(
    () =>
      buildTableSearchFields(columns, viewerRows.slice(0, 200)).map(
        ({ getValue: _getValue, ...field }) => field
      ),
    [columns, viewerRows]
  )
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [groupedColumnIds, setGroupedColumnIds] = React.useState<string[]>([])
  const tableId = `datool-${collection.id}`

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
    () => exportColumns.filter((column) => columnVisibility[column.id] !== false),
    [columnVisibility, exportColumns]
  )

  const exportColumnsById = React.useMemo(
    () => new Map(exportColumns.map((column) => [column.id, column])),
    [exportColumns]
  )

  const groupedExportColumns = React.useMemo(
    () =>
      groupedColumnIds.flatMap((id) => {
        const column = exportColumnsById.get(id)
        return column ? [column] : []
      }),
    [exportColumnsById, groupedColumnIds]
  )

  const groupedRows = React.useMemo(
    () => groupViewerRows(viewerRows, groupedExportColumns),
    [groupedExportColumns, viewerRows]
  )

  const handleExport = React.useCallback(
    (format: "csv" | "md") => {
      if (visibleExportColumns.length === 0) return
      const fileBaseName = `${sanitizeFilePart(collection.id)}-${new Date()
        .toISOString()
        .replaceAll(":", "-")}`
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
    [collection.id, groupedRows, visibleExportColumns]
  )

  const reset = React.useCallback(() => {
    setColumnSizing({})
    setColumnVisibility({})
    setGroupedColumnIds([])
  }, [])

  const tableState = React.useMemo<DatoolTableState>(
    () => ({
      columnIds: exportColumns.map((column) => column.id),
      columnVisibility,
      groupedColumnIds,
      handleExport,
      reset,
      setColumnVisibility,
      setGroupedColumnIds,
      settingsColumns,
    }),
    [columnVisibility, exportColumns, groupedColumnIds, handleExport, reset, settingsColumns]
  )

  React.useEffect(() => {
    collection.registerTable(tableState)
    return () => collection.registerTable(null)
  }, [collection.registerTable, tableState])

  React.useEffect(() => {
    collection.registerSearchFieldSpecs(searchFieldSpecs)
    return () => collection.registerSearchFieldSpecs([])
  }, [collection.registerSearchFieldSpecs, searchFieldSpecs])

  return (
    <DataTableProvider
      autoScrollToBottom={groupedColumnIds.length === 0}
      columnSizing={columnSizing}
      columnVisibility={columnVisibility}
      columns={columns}
      data={viewerRows}
      dateFormat={dateFormat}
      defaultSorting={defaultSorting}
      getRowId={(row) => row.__datoolRowId}
      grouping={groupedColumnIds}
      height="100%"
      id={tableId}
      onColumnSizingChange={setColumnSizing}
      onColumnVisibilityChange={setColumnVisibility}
      onGroupingChange={setGroupedColumnIds}
      onSearchChange={collection.definition.search?.onChange}
      rowClassName={rowClassName}
      rowHeight={rowHeight}
      rowStyle={rowStyle}
      search={collection.definition.search?.value}
      statePersistence="none"
    >
      <DatoolDataTableInner collection={collection} columns={columns} />
    </DataTableProvider>
  )
}
