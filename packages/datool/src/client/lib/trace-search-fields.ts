import type { Trace } from "../components/trace-viewer/types"
import type { DataTableSearchFieldSpec } from "./data-table-search"

const TRACE_ENUM_OPTION_LIMIT = 12

function stringifyTraceAttributeValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

export function buildTraceSearchFieldSpecs(
  trace: Trace | null
): DataTableSearchFieldSpec[] {
  if (!trace) {
    return []
  }

  const fieldOptions = new Map<
    string,
    {
      options: Set<string>
      tooManyOptions: boolean
    }
  >()

  for (const span of trace.spans) {
    for (const [fieldId, rawValue] of Object.entries(span.attributes ?? {})) {
      if (!fieldId) {
        continue
      }

      const entry = fieldOptions.get(fieldId) ?? {
        options: new Set<string>(),
        tooManyOptions: false,
      }
      const value = stringifyTraceAttributeValue(rawValue).trim()

      if (value) {
        if (
          !entry.options.has(value) &&
          entry.options.size >= TRACE_ENUM_OPTION_LIMIT
        ) {
          entry.tooManyOptions = true
        } else {
          entry.options.add(value)
        }
      }

      fieldOptions.set(fieldId, entry)
    }
  }

  return Array.from(fieldOptions.entries()).map(([fieldId, entry]) => {
    const options = Array.from(entry.options)

    if (!entry.tooManyOptions && options.length > 0) {
      return {
        id: fieldId,
        kind: "enum",
        options,
      } satisfies DataTableSearchFieldSpec
    }

    return {
      id: fieldId,
      kind: "text",
    } satisfies DataTableSearchFieldSpec
  })
}
