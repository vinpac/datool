"use client"

import * as React from "react"

import {
  DataTable,
  DataTableProvider,
  type DataTableColumnConfig,
  type DataTableRowAction,
  type DataTableRowActionContext,
} from "@/components/data-table"
import { buildTableSearchFields } from "@/components/data-table/lib/data-table-filters"
import type { SearchField } from "@/components/search-bar"

import {
  useClearDatoolSearchSource,
  useRegisterDatoolSearchSource,
  useDatoolSearch,
} from "./provider"
import type { DatoolQueryActionContext } from "./types"

export type DatoolDataTableProps<
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  columns: DataTableColumnConfig<TRow>[]
  query?: string
  rowClassName?: (row: TRow) => string | undefined
  rowHeight?: number
  rowStyle?: (row: TRow) => React.CSSProperties | undefined
}

function toActionContext<
  TData,
  TFilters extends Record<string, unknown>,
  TState extends Record<string, Record<string, unknown>>,
  TRow extends Record<string, unknown>,
>({
  collection,
  context,
}: {
  collection: ReturnType<typeof useDatoolSearch<TData, TFilters, TState, TRow>>
  context: DataTableRowActionContext<TRow>
}) {
  return {
    actionRowIds: context.actionRowIds,
    actionRows: context.actionRows,
    anchorRow: context.anchorRow ?? null,
    anchorRowId: context.anchorRowId ?? null,
    datool: collection.datool,
    filters: collection.filters,
    queryId: collection.id,
    refetch: collection.result.refetch,
    result: collection.result,
    rows: collection.rows,
    selectedRowIds: context.selectedRowIds,
    selectedRows: context.selectedRows,
    state: collection.state,
  } as DatoolQueryActionContext<TData, TFilters, TState, TRow>
}

function getSearchFieldSignature<TRow extends Record<string, unknown>>(
  fields: SearchField<TRow>[]
) {
  return JSON.stringify(
    fields.map((field) => ({
      id: field.id,
      kind: field.kind,
      options: field.options ?? null,
      sample: field.sample ?? null,
    }))
  )
}

export function DatoolDataTable<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>({
  columns,
  query,
  rowClassName,
  rowHeight = 48,
  rowStyle,
  ...props
}: DatoolDataTableProps<TRow>) {
  const collection = useDatoolSearch<TData, TFilters, TState, TRow>(query)
  const clearSearchSource = useClearDatoolSearchSource()
  const registerSearchSource = useRegisterDatoolSearchSource<TRow>()
  const rowActions = React.useMemo<DataTableRowAction<TRow>[]>(() => {
    const actions = collection.definition.actions ?? []

    return actions.map((action, index) => {
      const disabled = action.disabled
      const hidden = action.hidden
      const label = action.label

      return {
        button: action.button,
        disabled:
          typeof disabled === "function"
            ? (context: DataTableRowActionContext<TRow>) =>
                disabled(
                  toActionContext({
                    collection,
                    context,
                  })
                )
            : disabled,
        hidden:
          typeof hidden === "function"
            ? (context: DataTableRowActionContext<TRow>) =>
                hidden(
                  toActionContext({
                    collection,
                    context,
                  })
                )
            : hidden,
        icon: action.icon,
        id: `query-action-${index}`,
        label:
          typeof label === "function"
            ? (context: DataTableRowActionContext<TRow>) =>
                label(
                  toActionContext({
                    collection,
                    context,
                  })
                )
            : label,
        onSelect: async (context: DataTableRowActionContext<TRow>) => {
          await action.onSelect(
            toActionContext({
              collection,
              context,
            })
          )
        },
        scope: action.scope,
        variant: action.variant,
      }
    })
  }, [collection])
  const enableRowSelection = React.useMemo(
    () => rowActions.some((action) => action.scope === "selection"),
    [rowActions]
  )
  const searchFields = React.useMemo(
    () =>
      buildTableSearchFields(
        columns,
        collection.rows.slice(0, 200)
      ) as SearchField<TRow>[],
    [collection.rows, columns]
  )
  const searchFieldSignature = React.useMemo(
    () => getSearchFieldSignature(searchFields),
    [searchFields]
  )

  React.useEffect(() => {
    registerSearchSource(collection.id, searchFields)
  }, [collection.id, registerSearchSource, searchFieldSignature])

  React.useEffect(() => {
    return () => {
      clearSearchSource(collection.id)
    }
  }, [clearSearchSource, collection.id])

  return (
    <DataTableProvider
      {...props}
      columns={columns}
      data={collection.rows}
      enableRowSelection={enableRowSelection}
      getRowId={collection.definition.getRowId}
      id={`datool-demo-${collection.id}`}
      key={`${collection.id}:${collection.viewRevision}`}
      onSearchChange={collection.search?.onChange}
      rowActions={rowActions}
      rowClassName={rowClassName}
      rowHeight={rowHeight}
      rowStyle={rowStyle}
      search={collection.search?.value}
    >
      <DataTable />
    </DataTableProvider>
  )
}
