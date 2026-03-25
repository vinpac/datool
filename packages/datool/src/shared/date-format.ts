import { format as formatDateFns, formatDistanceToNow } from "date-fns"

import type { DatoolDateFormat, DatoolRelativeDateFormat } from "./types"

const DEFAULT_INTL_DATE_FORMAT = {
  dateStyle: "medium",
} satisfies Intl.DateTimeFormatOptions

export function isRelativeDateFormat(
  value: DatoolDateFormat | unknown
): value is DatoolRelativeDateFormat {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "relative" in value &&
    (value as DatoolRelativeDateFormat).relative === true
  )
}

export function isIntlDateFormat(
  value: DatoolDateFormat | unknown
): value is Intl.DateTimeFormatOptions {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !isRelativeDateFormat(value)
}

export function normalizeDateFormatPattern(pattern: string) {
  return pattern
    .replace(/YYYY/g, "yyyy")
    .replace(/YY/g, "yy")
    .replace(/DD/g, "dd")
    .replace(/\bA\b/g, "a")
    .replace(/(H{1,2}|h{1,2}):MM(?=(:SS\b|:ss\b|:S\b|:s\b|\b))/g, "$1:mm")
    .replace(/:SS\b/g, ":ss")
    .replace(/:S\b/g, ":s")
}

export function parseDateValue(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

export function assertDateFormatShape(value: unknown) {
  if (value === undefined) {
    return
  }

  if (typeof value === "string") {
    try {
      formatDateFns(new Date(0), normalizeDateFormatPattern(value))
    } catch {
      throw new Error("The datool source config defines an invalid dateFormat.")
    }

    return
  }

  if (isRelativeDateFormat(value)) {
    return
  }

  if (!isIntlDateFormat(value)) {
    throw new Error("The datool source config dateFormat must be a string, an object, or { relative: true }.")
  }

  try {
    new Intl.DateTimeFormat(undefined, value)
  } catch {
    throw new Error("The datool source config defines an invalid dateFormat.")
  }
}

export function formatDateValue(
  value: string | number | Date,
  dateFormat?: DatoolDateFormat
) {
  const date = parseDateValue(value)

  if (!date) {
    return String(value)
  }

  if (isRelativeDateFormat(dateFormat)) {
    return formatDistanceToNow(date, {
      addSuffix: dateFormat.addSuffix ?? false,
    })
  }

  if (typeof dateFormat === "string") {
    try {
      return formatDateFns(date, normalizeDateFormatPattern(dateFormat))
    } catch {
      return new Intl.DateTimeFormat(
        undefined,
        DEFAULT_INTL_DATE_FORMAT
      ).format(date)
    }
  }

  return new Intl.DateTimeFormat(
    undefined,
    dateFormat ?? DEFAULT_INTL_DATE_FORMAT
  ).format(date)
}

export function formatUtcDateValue(value: string | number | Date) {
  const date = parseDateValue(value)

  if (!date) {
    return String(value)
  }

  return date.toISOString()
}
