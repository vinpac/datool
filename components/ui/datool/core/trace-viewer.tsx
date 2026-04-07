"use client"

import * as React from "react"

import { downloadFile } from "@/components/ui/datool/data-table/lib/utils"
import type { SearchField } from "@/components/ui/datool/search-bar"
import { TraceViewer, type Trace, type TraceViewerProps } from "@/components/ui/datool/trace-viewer"
import type { Span } from "@/components/ui/datool/trace-viewer/types"

import {
  useClearDatoolSearchSource,
  useDatoolContext,
  useDatoolSearch,
  useRegisterDatoolSearchSource,
} from "./provider"

export type DatoolTraceViewerProps<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
> = Omit<TraceViewerProps, "filter" | "trace"> & {
  getTrace: (data: TData | undefined) => Trace | undefined
  query?: string
}

function getSearchFieldSignature<TRow extends Record<string, unknown>>(
  fields: SearchField<TRow>[]
) {
  return JSON.stringify(
    fields.map((field) => ({
      id: field.id,
      kind: field.kind,
      options: field.options ?? null,
      sample: field.sample ?? null,
    }))
  )
}

function spanTimeToMs(time: [number, number]): number {
  return time[0] * 1000 + time[1] / 1_000_000
}

function escapeCsvField(value: unknown): string {
  if (value == null) return ""
  const str = typeof value === "object" ? JSON.stringify(value) : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportTraceJson(trace: Trace) {
  const content = JSON.stringify(trace, null, 2)
  downloadFile(`trace-${trace.traceId}.json`, content, "application/json")
}

function exportTraceCsv(trace: Trace) {
  const headers = [
    "spanId", "parentSpanId", "name", "resource", "library",
    "status", "kind", "startTime", "endTime", "durationMs", "attributes",
  ]
  const headerLine = headers.join(",")
  const rows = trace.spans.map((span) => [
    escapeCsvField(span.spanId),
    escapeCsvField(span.parentSpanId ?? ""),
    escapeCsvField(span.name),
    escapeCsvField(span.resource),
    escapeCsvField(span.library.name),
    escapeCsvField(span.status.code),
    escapeCsvField(span.kind),
    escapeCsvField(new Date(spanTimeToMs(span.startTime)).toISOString()),
    escapeCsvField(new Date(spanTimeToMs(span.endTime)).toISOString()),
    escapeCsvField(spanTimeToMs(span.duration)),
    escapeCsvField(span.attributes),
  ].join(","))

  downloadFile(
    `trace-${trace.traceId}.csv`,
    [headerLine, ...rows].join("\n"),
    "text/csv"
  )
}

function buildSpanSearchFields(spans: Span[]) {
  const resources = Array.from(new Set(spans.map((span) => span.resource))).sort()
  const libraries = Array.from(
    new Set(spans.map((span) => span.library.name).filter(Boolean))
  ).sort()
  const statuses = Array.from(
    new Set(spans.map((span) => String(span.status.code)))
  ).sort()

  return [
    {
      getValue: (span: Span) => span.name,
      id: "name",
      kind: "text",
      sample: spans[0]?.name,
    },
    {
      getValue: (span: Span) => span.resource,
      id: "resource",
      kind: "enum",
      options: resources,
      sample: resources[0],
    },
    {
      getValue: (span: Span) => span.library.name,
      id: "library",
      kind: "enum",
      options: libraries,
      sample: libraries[0],
    },
    {
      getValue: (span: Span) => String(span.status.code),
      id: "status",
      kind: "enum",
      options: statuses,
      sample: statuses[0],
    },
    {
      getValue: (span: Span) => span.attributes,
      id: "attributes",
      kind: "json",
    },
  ] satisfies SearchField<Span>[]
}

export function DatoolTraceViewer<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends Record<string, Record<string, unknown>> = Record<
    string,
    Record<string, unknown>
  >,
>({ getTrace, query, ...props }: DatoolTraceViewerProps<TData, TFilters, TState>) {
  const datoolQuery = useDatoolSearch<TData, TFilters, TState, Span>(query)
  const { setViewerSettings } = useDatoolContext()
  const registerSearchSource = useRegisterDatoolSearchSource<Span>()
  const clearSearchSource = useClearDatoolSearchSource()
  const trace = getTrace(datoolQuery.result.data)
  const searchFields = React.useMemo(
    () => buildSpanSearchFields(trace?.spans ?? []),
    [trace]
  )
  const searchFieldSignature = React.useMemo(
    () => getSearchFieldSignature(searchFields),
    [searchFields]
  )

  React.useEffect(() => {
    registerSearchSource(datoolQuery.id, searchFields)
  }, [datoolQuery.id, registerSearchSource, searchFieldSignature])

  React.useEffect(() => {
    return () => {
      clearSearchSource(datoolQuery.id)
    }
  }, [clearSearchSource, datoolQuery.id])

  const traceRef = React.useRef(trace)
  traceRef.current = trace

  React.useEffect(() => {
    setViewerSettings({
      columns: [],
      exportActions: [
        {
          id: "json",
          label: "Export JSON",
          disabled: !traceRef.current,
          onSelect: () => {
            if (traceRef.current) exportTraceJson(traceRef.current)
          },
        },
        {
          id: "csv",
          label: "Export CSV",
          disabled: !traceRef.current,
          onSelect: () => {
            if (traceRef.current) exportTraceCsv(traceRef.current)
          },
        },
      ],
      groupedColumnIds: [],
      onClearGrouping: () => {},
      onToggleGrouping: () => {},
      onToggleColumn: () => {},
    })

    return () => setViewerSettings(null)
  }, [setViewerSettings, trace])

  if (!trace) {
    return null
  }

  return (
    <TraceViewer
      {...props}
      filter={datoolQuery.search?.value}
      key={`${datoolQuery.id}:${datoolQuery.viewRevision}:${trace.traceId}`}
      trace={trace}
    />
  )
}
