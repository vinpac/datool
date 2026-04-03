import type { ComponentType } from "react"
import type { UseQueryResult } from "@tanstack/react-query"

export type DatoolStateShape = Record<string, Record<string, unknown>>

type DatoolRowsFromData<TData> = TData extends readonly (infer TRow)[]
  ? Extract<TRow, Record<string, unknown>>
  : Record<string, unknown>

export type DatoolSliceUpdate<TSlice extends Record<string, unknown>> =
  | Partial<TSlice>
  | ((current: TSlice) => Partial<TSlice> | TSlice)

export type DatoolActionButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

export type DatoolActionButtonSize =
  | "default"
  | "sm"
  | "lg"
  | "xl"
  | "icon"
  | "icon-sm"
  | "icon-lg"

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

export type DatoolSliceApi<
  TSlice extends Record<string, unknown> = Record<string, unknown>,
> = {
  get: () => TSlice
  getInitial: () => TSlice
  set: (update: DatoolSliceUpdate<TSlice>) => void
  use: <TSelected>(selector: (state: TSlice) => TSelected) => TSelected
}

export type DatoolInstance<TState extends DatoolStateShape = DatoolStateShape> =
  {
    defaultQuery?: string
    slice: <TKey extends Extract<keyof TState, string>>(
      key: TKey
    ) => DatoolSliceApi<TState[TKey]>
    useCollection: <
      TKey extends Extract<keyof TState, string>,
      TData,
      TRow extends Record<string, unknown> = DatoolRowsFromData<TData>,
    >(
      definition: Omit<
        DatoolCollectionQueryDefinition<TData, TState[TKey], TState, TRow>,
        "kind"
      > & {
        key: TKey
      }
    ) => void
    useEntity: <TKey extends Extract<keyof TState, string>, TData>(
      definition: Omit<
        DatoolEntityQueryDefinition<TData, TState[TKey]>,
        "kind"
      > & {
        key: TKey
      }
    ) => void
  }

export type DatoolQueryActionContext<
  TData,
  TFilters extends Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  actionRowIds: string[]
  actionRows: TRow[]
  anchorRow: TRow | null
  anchorRowId: string | null
  datool: DatoolInstance<TState>
  filters: TFilters
  queryId: string
  refetch: UseQueryResult<TData>["refetch"]
  result: UseQueryResult<TData>
  rows: TRow[]
  selectedRowIds: string[]
  selectedRows: TRow[]
  state: DatoolSliceApi<TFilters>
}

export type DatoolQueryAction<
  TData,
  TFilters extends Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  button?: DatoolActionButtonConfig
  disabled?:
    | boolean
    | ((
        context: DatoolQueryActionContext<TData, TFilters, TState, TRow>
      ) => boolean)
  hidden?:
    | boolean
    | ((
        context: DatoolQueryActionContext<TData, TFilters, TState, TRow>
      ) => boolean)
  icon?: ComponentType<{ className?: string }>
  label:
    | string
    | ((
        context: DatoolQueryActionContext<TData, TFilters, TState, TRow>
      ) => string)
  onSelect: (
    context: DatoolQueryActionContext<TData, TFilters, TState, TRow>
  ) => Promise<unknown> | unknown
  scope?: DatoolQueryScope
  variant?: "default" | "destructive"
}

export type DatoolBaseQueryDefinition<
  TData,
  TFilters extends Record<string, unknown>,
> = {
  result: UseQueryResult<TData>
}

export type DatoolCollectionQueryDefinition<
  TData,
  TFilters extends Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = DatoolRowsFromData<TData>,
> = DatoolBaseQueryDefinition<TData, TFilters> & {
  actions?: DatoolQueryAction<TData, TFilters, TState, TRow>[]
  getRowId: (row: TRow, index: number) => string
  getRows?: (data: TData | undefined) => TRow[]
  kind: "collection"
  searchKey?: Extract<keyof TFilters, string>
}

export type DatoolEntityQueryDefinition<
  TData,
  TFilters extends Record<string, unknown>,
> = DatoolBaseQueryDefinition<TData, TFilters> & {
  kind: "entity"
}

export type DatoolQueryDefinition<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> =
  | DatoolCollectionQueryDefinition<TData, TFilters, TState, TRow>
  | DatoolEntityQueryDefinition<TData, TFilters>
