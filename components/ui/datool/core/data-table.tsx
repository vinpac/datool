"use client"

import * as React from "react"

import {
  DataTable,
  DataTableProvider,
  DataTableViewerSettingsContext,
  type DataTableColumnConfig,
  type DataTableProps,
  type DataTableRowAction,
  type DataTableRowActionContext,
  type DataTableSelectionMode,
  type DataTableViewerSettings,
} from "@/components/ui/datool/data-table"
import { buildTableSearchFields } from "@/components/ui/datool/data-table/lib/data-table-filters"
import type { SearchField } from "@/components/ui/datool/search-bar"

import {
  useClearDatoolSearchSource,
  useDatoolContext,
  useRegisterDatoolSearchSource,
  useDatoolSearch,
} from "./provider"
import type { DatoolQueryActionContext } from "./types"

export type DatoolDataTableProps<
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  cellEditors?: DataTableProps<TRow>["cellEditors"]
  columns: DataTableColumnConfig<TRow>[]
  query?: string
  rowClassName?: (row: TRow) => string | undefined
  rowHeight?: number
  rowStyle?: (row: TRow) => React.CSSProperties | undefined
  selection?: DataTableSelectionMode
  showSelectionCheckbox?: boolean
  onUpdate?: DataTableProps<TRow>["onUpdate"]
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
  cellEditors,
  query,
  rowClassName,
  rowHeight = 48,
  rowStyle,
  selection,
  showSelectionCheckbox = true,
  onUpdate,
  ...props
}: DatoolDataTableProps<TRow>) {
  const collection = useDatoolSearch<TData, TFilters, TState, TRow>(query)
  const { setViewerSettings } = useDatoolContext()
  const clearSearchSource = useClearDatoolSearchSource()
  const registerSearchSource = useRegisterDatoolSearchSource<TRow>()
  const handleViewerSettings = React.useCallback(
    (settings: DataTableViewerSettings | null) => {
      setViewerSettings(settings)
    },
    [setViewerSettings]
  )
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
  const hasSelectionActions = React.useMemo(
    () => rowActions.some((action) => action.scope === "selection"),
    [rowActions]
  )
  const enableRowSelection = hasSelectionActions && showSelectionCheckbox
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
  }, [collection.id, registerSearchSource, searchFieldSignature, searchFields])

  React.useEffect(() => {
    return () => {
      clearSearchSource(collection.id)
    }
  }, [clearSearchSource, collection.id])

  return (
    <DataTableViewerSettingsContext.Provider value={handleViewerSettings}>
      <DataTableProvider
        {...props}
        cellEditors={cellEditors}
        columns={columns}
        data={collection.rows}
        enableRowSelection={enableRowSelection}
        getRowId={collection.definition.getRowId}
        id={`datool-demo-${collection.id}`}
        key={`${collection.id}:${collection.viewRevision}`}
        onUpdate={onUpdate}
        onSearchChange={collection.search?.onChange}
        rowActions={rowActions}
        rowClassName={rowClassName}
        rowHeight={rowHeight}
        rowStyle={rowStyle}
        search={collection.search?.value}
        selection={selection}
      >
        <DataTable />
      </DataTableProvider>
    </DataTableViewerSettingsContext.Provider>
  )
}
