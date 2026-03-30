import type { ComponentType, Dispatch, SetStateAction } from "react"
import type {
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query"

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

export const DATOOL_ACTION_BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

export const DATOOL_ACTION_BUTTON_SIZES = [
  "default",
  "xs",
  "sm",
  "lg",
  "xl",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
  "icon-xl",
] as const

export type DatoolActionButtonVariant =
  (typeof DATOOL_ACTION_BUTTON_VARIANTS)[number]

export type DatoolActionButtonSize =
  (typeof DATOOL_ACTION_BUTTON_SIZES)[number]

export type DatoolEnumBadgeColor = (typeof DATOOL_ENUM_BADGE_COLORS)[number]
export type DatoolEnumColorMap = Partial<Record<string, DatoolEnumBadgeColor>>

export type DatoolActionButtonConfig =
  | false
  | DatoolActionButtonVariant
  | {
      className?: string
      label?: string
      size?: DatoolActionButtonSize
      variant?: DatoolActionButtonVariant
    }

export type DatoolRelativeDateFormat = {
  addSuffix?: boolean
  relative: true
}

export type DatoolDateFormat =
  | DatoolRelativeDateFormat
  | Intl.DateTimeFormatOptions
  | string

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
  actions?: DatoolQueryAction<TData, TFilters, Record<string, unknown>>[]
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
