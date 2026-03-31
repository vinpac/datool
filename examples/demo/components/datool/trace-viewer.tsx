"use client"

import * as React from "react"

import type { SearchField } from "@/components/search-bar"
import { TraceViewer, type Trace, type TraceViewerProps } from "@/components/trace-viewer"
import type { Span } from "@/components/trace-viewer/types"

import {
  useClearDatoolSearchSource,
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
