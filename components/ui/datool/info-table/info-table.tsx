import type { ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { inferDataTableColumnKind } from "@/components/ui/datool/data-table/data-table-col-icon"
import { renderDataCellValue } from "@/components/ui/datool/data-table/data-cell"
import type { DataTableColumnConfig } from "@/components/ui/datool/data-table"
import { cn } from "@/lib/utils"

const infoTableContainerVariants = cva("rounded-lg overflow-hidden", {
  variants: {
    variant: {
      default: "border border-border bg-card",
      muted:
        "bg-gray-50",
      outline: "border-2 border-foreground/15 bg-background",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

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

const infoTableHeaderVariants = cva(
  "",
  {
    variants: {
      variant: {
        muted: 'bg-gray-100'
      }
    },
  },
)
const infoTableLabelVariants = cva(
  "align-top font-medium whitespace-nowrap border-b border-r",
  {
    variants: {
      size: {
        default: "px-3 py-3 pr-5",
        lg: "px-4 py-5 pr-6",
        sm: "px-2.5 py-3 pr-4",
        xs: "px-2 py-2.5 pr-3",
      },
      isHeader: {
        false: '',
        true: 'uppercase text-xs font-medium text-muted-foreground',
      },
      variant: {
        default:
          "border-border bg-muted/40 text-muted-foreground",
        muted: "border-background border-b-[.25rem] border-r-0",
        outline:
          "border-foreground/10 bg-muted/30 text-muted-foreground dark:bg-muted/20",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

const infoTableValueVariants = cva("align-top border-b w-full", {
  variants: {
    size: {
      default: "px-3 py-3",
      lg: "px-4 py-5",
      sm: "px-2.5 py-3",
      xs: "px-2 py-2.5",
    },
    isHeader: {
      false: '',
      true: 'uppercase text-xs font-medium text-muted-foreground',
    },
    variant: {
      default: "border-border bg-card text-card-foreground",
      muted:
        "border-background border-b-[.25rem]",
      outline: "border-foreground/10 bg-background text-foreground",
    },
  },
  defaultVariants: {
    size: "default",
    variant: "default",
  },
})


export type InfoTableProps<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = VariantProps<typeof infoTableVariants> &
  VariantProps<typeof infoTableContainerVariants> & {
    className?: string
    columns: DataTableColumnConfig<TData>[]
    data: TData | null | undefined
    /** Optional column header row: `[labelCell, valueCell]` — same two-column shape as each body row, styled via header CVAs. */
    headers?: [ReactNode, ReactNode]
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
>({
  className,
  columns,
  data,
  headers,
  size,
  variant = "muted",
}: InfoTableProps<TData>) {
  if (!data) {
    return null
  }

  return (
    <div
      className={cn(infoTableContainerVariants({ variant }), className)}
    >
      <table className={cn(infoTableVariants({ size }))}>
        {headers ? (
          <thead>
            <tr className={cn(infoTableHeaderVariants({ size, variant } as any))}>
              <th
                className={cn(infoTableLabelVariants({ size, variant, isHeader: true } as any))}
                scope="col"
              >
                {headers[0]}
              </th>
              <th
                className={cn(infoTableValueVariants({ size, variant, isHeader: true } as any))}
                scope="col"
              >
                {headers[1]}
              </th>
            </tr>
          </thead>
        ) : null}
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
                    infoTableLabelVariants({ size, variant }),
                    index === columns.length - 1 && "border-b-0"
                  )}
                  scope="row"
                >
                  {column.header ?? formatHeaderLabel(id)}
                </th>
                <td
                  className={cn(
                    infoTableValueVariants({ size, variant }),
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
