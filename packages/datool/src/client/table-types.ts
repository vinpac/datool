import type { DataTableColumnConfig } from "@/components/data-table"

type DatoolRow = Record<string, unknown>

export type DatoolColumns<TData extends DatoolRow = DatoolRow> = Omit<
  DataTableColumnConfig<TData>,
  "accessorFn" | "accessorKey"
> & {
  accessorKey: string
}

export type DatoolTableProps<TData extends DatoolRow = DatoolRow> = {
  columns: DatoolColumns<TData>[]
  stream: string
}
