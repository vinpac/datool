import {
  Braces,
  CalendarDays,
  CheckSquare2,
  Hash,
  ListFilter,
  Type,
} from "lucide-react"
import type { LucideProps } from "lucide-react"
import type { ComponentType } from "react"

export type DataTableColumnKind =
  | "text"
  | "enum"
  | "number"
  | "boolean"
  | "date"
  | "json"
  | "selection"

const iconMap: Record<DataTableColumnKind, ComponentType<LucideProps>> = {
  text: Type,
  enum: ListFilter,
  number: Hash,
  boolean: CheckSquare2,
  date: CalendarDays,
  json: Braces,
  selection: CheckSquare2,
}

export function DataTableColIcon({
  kind,
  ...props
}: { kind: DataTableColumnKind } & LucideProps) {
  const Icon = iconMap[kind]

  return <Icon {...props} />
}

function isDateString(value: string) {
  if (!/\d{4}-\d{2}-\d{2}/.test(value)) {
    return false
  }

  return !Number.isNaN(Date.parse(value))
}

export function inferDataTableColumnKind(values: unknown[]) {
  const sample = values.find((value) => value !== null && value !== undefined)

  if (sample instanceof Date) {
    return "date" as const
  }

  if (typeof sample === "boolean") {
    return "boolean" as const
  }

  if (typeof sample === "number") {
    return "number" as const
  }

  if (typeof sample === "string" && isDateString(sample)) {
    return "date" as const
  }

  if (sample && typeof sample === "object") {
    return "json" as const
  }

  return "text" as const
}
