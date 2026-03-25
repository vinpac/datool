import type { FilterFn } from "@tanstack/react-table"

import { type DataTableColumnConfig } from "../components/data-table"
import {
  buildEnumOptions,
  matchesFieldClauses,
  type DataTableSearchField,
  type DataTableSearchFieldKind,
  type DataTableSearchFilterClause,
} from "./data-table-search"

type TableRow = Record<string, unknown>

export type BuildTableSearchFieldsOptions = {
  fieldOptions?: Partial<Record<string, string[]>>
}

function stringifySampleValue(value: unknown) {
  if (value === null || value === undefined) {
    return new Date().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

function getColumnValueGetter<TData extends TableRow>(
  column: DataTableColumnConfig<TData>
) {
  return (row: TData) => {
    if (column.accessorFn) {
      return column.accessorFn(row)
    }

    if (column.accessorKey) {
      return row[column.accessorKey]
    }

    return undefined
  }
}

function getDefaultFieldKind<TData extends TableRow>(
  column: DataTableColumnConfig<TData>
): DataTableSearchFieldKind {
  switch (column.kind) {
    case "date":
      return "date"
    case "enum":
      return "enum"
    case "json":
      return "json"
    case "number":
      return "number"
    default:
      return "text"
  }
}

export function resolveTableColumnId<TData extends TableRow>(
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

export function buildTableSearchFields<TData extends TableRow>(
  columns: DataTableColumnConfig<TData>[],
  rows: TData[],
  options: BuildTableSearchFieldsOptions = {}
) {
  const latestRow = rows.at(-1)

  return columns.map<DataTableSearchField<TData>>((column, index) => {
    const columnId = resolveTableColumnId(column, index)
    const getValue = getColumnValueGetter(column)
    const kind = getDefaultFieldKind(column)

    if (kind === "enum") {
      return {
        getValue,
        id: columnId,
        kind,
        options:
          column.enumOptions ??
          options.fieldOptions?.[columnId] ??
          buildEnumOptions(rows, getValue),
      }
    }

    if (kind === "date") {
      return {
        getValue,
        id: columnId,
        kind,
        sample: stringifySampleValue(
          latestRow ? getValue(latestRow) : new Date().toISOString()
        ),
      }
    }

    return {
      getValue,
      id: columnId,
      kind,
    }
  })
}

export function withColumnSearchFilters<TData extends TableRow>(
  columns: DataTableColumnConfig<TData>[],
  fields: DataTableSearchField<TData>[]
) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]))

  return columns.map((column, index) => {
    const columnId = resolveTableColumnId(column, index)
    const field = fieldMap.get(columnId)

    if (!field || column.filterFn) {
      return column
    }

    return {
      ...column,
      filterFn: ((row, _columnId, filterValue) => {
        const clauses = Array.isArray(filterValue)
          ? (filterValue as DataTableSearchFilterClause[])
          : []

        return matchesFieldClauses(row.original, field, clauses)
      }) as FilterFn<TData>,
    } satisfies DataTableColumnConfig<TData>
  })
}
