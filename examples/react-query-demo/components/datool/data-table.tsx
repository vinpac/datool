"use client"

import * as React from "react"

import {
  DataTable,
  DataTableProvider,
  type DataTableColumnConfig,
  type DataTableRowAction,
  type DataTableRowActionContext,
} from "@/components/data-table"

import { useDatoolCollectionQuery } from "./provider"
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

function toActionContext<TData, TFilters, TRow extends Record<string, unknown>>({
  collection,
  context,
}: {
  collection: ReturnType<typeof useDatoolCollectionQuery<TData, TFilters, TRow>>
  context: DataTableRowActionContext<TRow>
}) {
  return {
    actionRowIds: context.actionRowIds,
    actionRows: context.actionRows,
    anchorRow: context.anchorRow ?? null,
    anchorRowId: context.anchorRowId ?? null,
    filters: collection.definition.filters,
    queryId: collection.id,
    refetch: collection.result.refetch,
    result: collection.result,
    rows: collection.rows,
    selectedRowIds: context.selectedRowIds,
    selectedRows: context.selectedRows,
    setFilters: collection.definition.setFilters,
  } satisfies DatoolQueryActionContext<TData, TFilters, TRow>
}

export function DatoolDataTable<
  TData = unknown,
  TFilters = unknown,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>({
  columns,
  query,
  rowClassName,
  rowHeight = 48,
  rowStyle,
}: DatoolDataTableProps<TRow>) {
  const collection = useDatoolCollectionQuery<TData, TFilters, TRow>(query)
  const rowActions = React.useMemo<DataTableRowAction<TRow>[]>(
    () => {
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
    },
    [collection]
  )
  const enableRowSelection = React.useMemo(
    () => rowActions.some((action) => action.scope === "selection"),
    [rowActions]
  )

  return (
    <div className="min-h-0 flex-1">
      <DataTableProvider
        autoScrollToBottom
        columns={columns}
        data={collection.rows}
        enableRowSelection={enableRowSelection}
        getRowId={collection.definition.getRowId}
        id={`datool-demo-${collection.id}`}
        key={`${collection.id}:${collection.viewRevision}`}
        onSearchChange={collection.definition.search?.onChange}
        rowActions={rowActions}
        rowClassName={rowClassName}
        rowHeight={rowHeight}
        rowStyle={rowStyle}
        search={collection.definition.search?.value}
        statePersistence="none"
      >
        <DataTable />
      </DataTableProvider>
    </div>
  )
}
