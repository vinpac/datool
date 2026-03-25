import type { CSSProperties } from "react"

import type { DataTableColumnConfig } from "./components/data-table"
import type { DatoolDateFormat } from "../shared/types"

type DatoolRow = Record<string, unknown>

export type DatoolColumn<TData extends DatoolRow = DatoolRow> = Omit<
  DataTableColumnConfig<TData>,
  "accessorFn" | "accessorKey"
> & {
  accessorKey: string
}

export type DatoolSortingState = Array<{ desc: boolean; id: string }>

export type DatoolTableProps<TData extends DatoolRow = DatoolRow> = {
  columns: DatoolColumn<TData>[]
  dateFormat?: DatoolDateFormat
  defaultSorting?: DatoolSortingState
  rowClassName?: (row: TData) => string | undefined
  rowStyle?: (row: TData) => CSSProperties | undefined
  source: string
}
