import type { ComponentType, Dispatch, SetStateAction } from "react"
import type {
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query"

export type DatoolActionButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

export type DatoolActionButtonSize =
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

export type DatoolActionButtonConfig =
  | false
  | DatoolActionButtonVariant
  | {
      className?: string
      label?: string
      size?: DatoolActionButtonSize
      variant?: DatoolActionButtonVariant
    }

export type DatoolQueryScope = "row" | "selection"

export type DatoolQuerySearch = {
  value: string
  onChange: (next: string) => void
  reset: () => void
}

export type DatoolQueryActionContext<
  TData,
  TFilters,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  actionRowIds: string[]
  actionRows: TRow[]
  anchorRow: TRow | null
  anchorRowId: string | null
  filters: TFilters
  queryId: string
  refetch: UseQueryResult<TData>["refetch"]
  result: UseQueryResult<TData>
  rows: TRow[]
  selectedRowIds: string[]
  selectedRows: TRow[]
  setFilters: Dispatch<SetStateAction<TFilters>>
}

export type DatoolQueryAction<
  TData,
  TFilters,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  button?: DatoolActionButtonConfig
  disabled?:
    | boolean
    | ((context: DatoolQueryActionContext<TData, TFilters, TRow>) => boolean)
  hidden?:
    | boolean
    | ((context: DatoolQueryActionContext<TData, TFilters, TRow>) => boolean)
  icon?: ComponentType<{ className?: string }>
  label:
    | string
    | ((context: DatoolQueryActionContext<TData, TFilters, TRow>) => string)
  onSelect: (
    context: DatoolQueryActionContext<TData, TFilters, TRow>
  ) => Promise<unknown> | unknown
  scope?: DatoolQueryScope
  variant?: "default" | "destructive"
}

export type DatoolBaseQueryDefinition<TData, TFilters> = {
  filters: TFilters
  getQueryOptions: (
    filters: TFilters
  ) => UseQueryOptions<TData, Error, TData, QueryKey>
  pollingIntervalMs?: false | number
  setFilters: Dispatch<SetStateAction<TFilters>>
}

export type DatoolCollectionQueryDefinition<
  TData,
  TFilters,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = DatoolBaseQueryDefinition<TData, TFilters> & {
  actions?: DatoolQueryAction<TData, TFilters, TRow>[]
  getRowId: (row: TRow, index: number) => string
  getRows: (data: TData | undefined) => TRow[]
  kind: "collection"
  search?: DatoolQuerySearch
}

export type DatoolEntityQueryDefinition<TData, TFilters> =
  DatoolBaseQueryDefinition<TData, TFilters> & {
    kind: "entity"
  }

export type DatoolQueryDefinition<
  TData = unknown,
  TFilters = unknown,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> =
  | DatoolCollectionQueryDefinition<TData, TFilters, TRow>
  | DatoolEntityQueryDefinition<TData, TFilters>
