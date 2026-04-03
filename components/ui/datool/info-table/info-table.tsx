import type { ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { inferDataTableColumnKind } from "@/components/ui/datool/data-table/data-table-col-icon"
import { renderDataCellValue } from "@/components/ui/datool/data-table/data-cell"
import type { DataTableColumnConfig } from "@/components/ui/datool/data-table"
import { cn } from "@/lib/utils"

const infoTableVariants = cva(
  "w-full border-separate border-spacing-0 text-left text-sm",
  {
    variants: {
      size: {
        default: "text-sm",
        lg: "text-base",
        sm: "text-xs",
        xs: "text-[11px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const infoTableLabelVariants = cva(
  "border-border text-muted-foreground align-top font-medium whitespace-nowrap border-b",
  {
    variants: {
      size: {
        default: "px-3 py-3 pr-5",
        lg: "px-4 py-5 pr-6",
        sm: "px-2.5 py-3 pr-4",
        xs: "px-2 py-2.5 pr-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const infoTableValueVariants = cva(
  "border-border text-card-foreground align-top border-b w-full",
  {
    variants: {
      size: {
        default: "px-3 py-3",
        lg: "px-4 py-5",
        sm: "px-2.5 py-3",
        xs: "px-2 py-2.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export type InfoTableProps<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = VariantProps<typeof infoTableVariants> & {
  className?: string
  columns: DataTableColumnConfig<TData>[]
  data: TData | null | undefined
}

function formatHeaderLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function resolveColumnId<TData extends Record<string, unknown>>(
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

function resolveColumnValue<TData extends Record<string, unknown>>(
  column: DataTableColumnConfig<TData>,
  data: TData
) {
  if (column.accessorFn) {
    return column.accessorFn(data)
  }

  if (column.accessorKey) {
    return data[column.accessorKey]
  }

  return undefined
}

export function InfoTable<
  TData extends Record<string, unknown> = Record<string, unknown>,
>({ className, columns, data, size }: InfoTableProps<TData>) {
  if (!data) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className
      )}
    >
      <table className={cn(infoTableVariants({ size }))}>
        <tbody>
          {columns.map((column, index) => {
            const id = resolveColumnId(column, index)
            const value = resolveColumnValue(column, data)
            const kind = column.kind ?? inferDataTableColumnKind([value])
            const children = renderDataCellValue({
              dateFormat: kind === "date" ? column.dateFormat : undefined,
              enumColors: kind === "enum" ? column.enumColors : undefined,
              enumOptions: kind === "enum" ? column.enumOptions : undefined,
              enumVariant: kind === "enum" ? column.enumVariant : undefined,
              type: kind,
              value,
            })
            const content = column.cell
              ? column.cell({
                  children,
                  row: data,
                  value,
                })
              : children

            return (
              <tr key={id}>
                <th
                  className={cn(
                    infoTableLabelVariants({ size }),
                    index === columns.length - 1 && "border-b-0"
                  )}
                  scope="row"
                >
                  {column.header ?? formatHeaderLabel(id)}
                </th>
                <td
                  className={cn(
                    infoTableValueVariants({ size }),
                    index === columns.length - 1 && "border-b-0"
                  )}
                >
                  {content}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface InfoLinkProps {
  children: ReactNode
  href?: string
}

export function InfoLink({ children, href = "#" }: InfoLinkProps) {
  return (
    <a
      href={href}
      className="text-card-foreground decoration-dotted underline underline-offset-4 hover:text-muted-foreground transition-colors"
    >
      {children}
    </a>
  )
}
