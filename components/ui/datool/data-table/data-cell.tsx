import { Check, Copy } from "lucide-react"
import * as React from "react"

import { EnumBadge } from "./enum-badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  formatDateValue,
  formatUtcDateValue,
  parseDateValue,
} from "./lib/date-format"
import type {
  DataTableColumnKind,
  DatoolDateFormat,
  DatoolEnumBadgeColor,
  DatoolEnumColorMap,
} from "./types"

export type DataCellProps = {
  addSuffix?: boolean
  color?: DatoolEnumBadgeColor
  dateFormat?: DatoolDateFormat
  enumColors?: DatoolEnumColorMap
  enumOptions?: string[]
  enumVariant?: "default" | "outline"
  relative?: boolean
  type?: DataTableColumnKind
  value: unknown
}

function DateCellValue({
  value,
  dateFormat,
}: {
  value: string | number | Date
  dateFormat?: DatoolDateFormat
}) {
  const [copied, setCopied] = React.useState(false)
  const resetCopiedTimeoutRef = React.useRef<number | null>(null)
  const date = parseDateValue(value)

  React.useEffect(() => {
    return () => {
      if (resetCopiedTimeoutRef.current !== null) {
        window.clearTimeout(resetCopiedTimeoutRef.current)
      }
    }
  }, [])

  if (!date) {
    return String(value)
  }

  const displayValue = formatDateValue(date, dateFormat)
  const tooltipValue = formatUtcDateValue(date)

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(displayValue)
      setCopied(true)

      if (resetCopiedTimeoutRef.current !== null) {
        window.clearTimeout(resetCopiedTimeoutRef.current)
      }

      resetCopiedTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        resetCopiedTimeoutRef.current = null
      }, 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={`Copy ${displayValue}`}
          className="group/date gap-1 rounded-sm hover:text-foreground focus-visible:ring-ring/50 inline-flex max-w-full items-center text-left text-inherit transition-colors focus-visible:ring-2 focus-visible:outline-none"
          onClick={handleCopy}
          type="button"
        >
          <span className="truncate">{displayValue}</span>
          <span
            aria-hidden="true"
            className="opacity-0 transition-opacity group-hover/date:opacity-100 group-focus-visible/date:opacity-100"
          >
            {copied ? (
              <Check className="size-3 text-primary" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="font-mono" sideOffset={6}>
        {tooltipValue}
      </TooltipContent>
    </Tooltip>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function resolveDateFormat({
  addSuffix,
  dateFormat,
  relative,
}: Pick<DataCellProps, "addSuffix" | "dateFormat" | "relative">) {
  if (relative) {
    return {
      addSuffix,
      relative: true,
    } satisfies DatoolDateFormat
  }

  return dateFormat
}

function resolveEnumColors({
  color,
  enumColors,
  value,
}: Pick<DataCellProps, "color" | "enumColors" | "value">) {
  if (enumColors) {
    return enumColors
  }

  if (!color) {
    return undefined
  }

  return {
    [String(value)]: color,
  } satisfies DatoolEnumColorMap
}

export function renderDataCellValue({
  addSuffix,
  color,
  dateFormat,
  enumColors,
  enumOptions,
  enumVariant,
  relative,
  type,
  value,
}: DataCellProps) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>
  }

  if (type === "enum") {
    return (
      <EnumBadge
        colors={resolveEnumColors({
          color,
          enumColors,
          value,
        })}
        options={enumOptions}
        value={String(value)}
        variant={enumVariant}
      />
    )
  }

  if (type === "boolean" || typeof value === "boolean") {
    return (
      <span
        className={cn(
          "min-w-16 px-2 py-1 font-medium inline-flex items-center justify-center rounded-full border text-[11px]",
          value
            ? "border-border bg-accent text-accent-foreground"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        {value ? "True" : "False"}
      </span>
    )
  }

  if (type === "number" || typeof value === "number") {
    return formatNumber(Number(value))
  }

  if (type === "date" || value instanceof Date) {
    return (
      <DateCellValue
        dateFormat={resolveDateFormat({
          addSuffix,
          dateFormat,
          relative,
        })}
        value={value as string | number | Date}
      />
    )
  }

  if (Array.isArray(value) || typeof value === "object") {
    return (
      <code className="rounded bg-muted px-1.5 py-1 font-mono text-muted-foreground text-[11px]">
        {JSON.stringify(value)}
      </code>
    )
  }

  return String(value)
}

export function DataCell(props: DataCellProps) {
  return <>{renderDataCellValue(props)}</>
}
