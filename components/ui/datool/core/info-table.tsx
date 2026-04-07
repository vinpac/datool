"use client"

import {
  InfoTable,
  type InfoTableProps,
} from "@/components/ui/datool/info-table/info-table"
import type { DataTableColumnConfig } from "@/components/ui/datool/data-table"

import { useDatoolQuery } from "./provider"
import type { DatoolStateShape } from "./types"

export type DatoolInfoTableProps<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
> = Pick<
    InfoTableProps<TData>,
    "className" | "columns" | "headers" | "size" | "variant"
  > & {
  query?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function DatoolInfoTable<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
>({
  className,
  columns,
  headers,
  query,
  size,
  variant,
}: DatoolInfoTableProps<TData, TFilters, TState>) {
  const datoolQuery = useDatoolQuery<TData | null, TFilters, TState>(query)
  const data = datoolQuery.result.data

  if (!isRecord(data)) {
    return null
  }

  return (
    <InfoTable
      className={className}
      columns={columns}
      data={data as TData}
      headers={headers}
      size={size}
      variant={variant}
    />
  )
}
