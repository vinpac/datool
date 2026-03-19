/* eslint-disable react-refresh/only-export-components */
import { flexRender, type Cell } from "@tanstack/react-table"
import { Check, Minus } from "lucide-react"
import * as React from "react"

import type { DataTableColumnKind } from "./data-table-col-icon"
import type { DataTableColumnMeta } from "./data-table-header-col"
import { EnumBadge } from "./enum-badge"
import { cn } from "@/lib/utils"
import type {
  DatoolDateFormat,
  DatoolEnumColorMap,
} from "../../shared/types"

function getAlignmentClassName(align: DataTableColumnMeta["align"] = "left") {
  switch (align) {
    case "center":
      return "justify-center text-center"
    case "right":
      return "justify-end text-right"
    default:
      return "justify-start text-left"
  }
}

function formatDate(
  value: string | number | Date,
  dateFormat?: DatoolDateFormat
) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat(
    undefined,
    dateFormat ?? {
      dateStyle: "medium",
    }
  ).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function fallbackCellValue(
  value: unknown,
  kind?: DataTableColumnKind,
  options?: {
    dateFormat?: DatoolDateFormat
    enumColors?: DatoolEnumColorMap
    enumOptions?: string[]
  }
) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>
  }

  if (kind === "enum") {
    return (
      <EnumBadge
        colors={options?.enumColors}
        options={options?.enumOptions}
        value={String(value)}
      />
    )
  }

  if (kind === "boolean" || typeof value === "boolean") {
    return (
      <span
        className={cn(
          "inline-flex min-w-16 items-center justify-center rounded-full border px-2 py-1 text-[11px] font-medium",
          value
            ? "border-border bg-accent text-accent-foreground"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        {value ? "True" : "False"}
      </span>
    )
  }

  if (kind === "number" || typeof value === "number") {
    return formatNumber(Number(value))
  }

  if (kind === "date" || value instanceof Date) {
    return formatDate(value as string | number | Date, options?.dateFormat)
  }

  if (Array.isArray(value) || typeof value === "object") {
    return (
      <code className="rounded bg-muted px-1.5 py-1 font-mono text-[11px] text-muted-foreground">
        {JSON.stringify(value)}
      </code>
    )
  }

  return String(value)
}

function renderHighlightedTextParts(value: string, terms: string[]) {
  const normalizedTerms = Array.from(
    new Set(terms.map((term) => term.trim()).filter(Boolean))
  ).sort((left, right) => right.length - left.length)

  if (normalizedTerms.length === 0) {
    return [value]
  }

  const pattern = new RegExp(
    `(${normalizedTerms
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "gi"
  )
  const parts = value.split(pattern)

  return parts.map((part, index) => {
    const matched = normalizedTerms.some(
      (term) => part.toLowerCase() === term.toLowerCase()
    )

    if (!matched) {
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    }

    return (
      <mark
        className="rounded-sm bg-primary/20 ring-2 ring-primary/20 dark:bg-primary/50 dark:text-white dark:ring-primary/80"
        key={`${part}-${index}`}
      >
        {part}
      </mark>
    )
  })
}

function renderHighlightedText(
  value: string,
  terms: string[],
  rendered: React.ReactNode
) {
  const highlightedParts = renderHighlightedTextParts(value, terms)

  if (React.isValidElement(rendered)) {
    const element = rendered as React.ReactElement<{
      children?: React.ReactNode
    }>

    if (typeof element.props.children === "string") {
      return React.cloneElement(element, undefined, highlightedParts)
    }
  }

  return <span className="whitespace-pre-wrap">{highlightedParts}</span>
}

export function DataTableCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onCheckedChange: (checked: boolean) => void
  ariaLabel: string
}) {
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!ref.current) {
      return
    }

    ref.current.indeterminate = Boolean(indeterminate) && !checked
  }, [checked, indeterminate])

  return (
    <label className="inline-flex cursor-pointer items-center justify-center">
      <input
        ref={ref}
        aria-label={ariaLabel}
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
      />
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-[6px] border border-border bg-background text-primary-foreground shadow-xs transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50",
          (checked || indeterminate) && "border-primary bg-primary"
        )}
      >
        {indeterminate && !checked ? <Minus className="size-3.5" /> : null}
        {checked ? <Check className="size-3.5" /> : null}
      </span>
    </label>
  )
}

export function DataTableBodyCell<TData>({
  cell,
  dateFormat,
  highlightTerms = [],
  paddingLeft,
  paddingRight,
}: {
  cell: Cell<TData, unknown>
  dateFormat?: DatoolDateFormat
  highlightTerms?: string[]
  paddingLeft?: React.CSSProperties["paddingLeft"]
  paddingRight?: React.CSSProperties["paddingRight"]
}) {
  const meta = (cell.column.columnDef.meta ?? {}) as DataTableColumnMeta
  const rawValue = cell.getValue()
  const rendered = flexRender(cell.column.columnDef.cell, cell.getContext())
  const isSticky = meta.sticky === "left"
  const isSelectionCell = meta.kind === "selection"
  const shouldTruncate = meta.truncate ?? true
  const shouldHighlight =
    meta.kind === "text" &&
    meta.highlightMatches !== false &&
    typeof rawValue === "string" &&
    highlightTerms.length > 0
  const content = shouldHighlight
    ? renderHighlightedText(rawValue, highlightTerms, rendered)
    : (rendered ??
        fallbackCellValue(rawValue, meta.kind, {
          dateFormat,
          enumColors: meta.enumColors,
          enumOptions: meta.enumOptions,
        }))

  return (
    <td
      data-sticky-cell={isSticky ? "true" : "false"}
      className={cn(
        "flex shrink-0 border-b border-border px-2 py-1.5 align-middle text-sm text-foreground",
        getAlignmentClassName(meta.align),
        isSticky && "sticky left-0 z-10 border-r border-r-border bg-card",
        meta.cellClassName
      )}
      style={{
        paddingLeft,
        paddingRight,
        width: cell.column.getSize(),
      }}
    >
      <div
        className={cn(
          isSelectionCell
            ? "flex w-full items-center justify-center"
            : shouldTruncate
              ? "min-w-0 truncate"
              : "w-full min-w-0 break-words whitespace-normal"
        )}
      >
        {content}
      </div>
    </td>
  )
}

export { fallbackCellValue }
