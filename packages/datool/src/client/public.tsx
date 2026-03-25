import type { CSSProperties } from "react"

import { TablePageView } from "./components/table-page-view"
import { TracePageView } from "./components/trace-page-view"
import { parseJSONL } from "./lib/jsonl"
import { traceLifecycleSchema } from "./lib/trace-lifecycle-schema"
import type { DatoolTableProps } from "./table-types"
import type { DatoolTraceViewerProps } from "./trace-types"

export type { DatoolColumn, DatoolSortingState, DatoolTableProps } from "./table-types"
export type {
  DatoolTraceGroup,
  DatoolTraceGroupAccessor,
  DatoolTraceGroupsConfig,
  DatoolTraceDuration,
  DatoolTraceEventRecord,
  DatoolTraceLifecycleAccessor,
  DatoolTraceLifecycleContext,
  DatoolTraceLifecycleLevel,
  DatoolTraceLifecycleLogs,
  DatoolTraceLifecycleMatcher,
  DatoolTraceLifecycleParent,
  DatoolTraceLifecycleSchemaConfig,
  DatoolTraceRecord,
  DatoolTraceResourceConfig,
  DatoolTraceResourceContext,
  DatoolTraceSchema,
  DatoolTraceSchemaState,
  DatoolTraceSliceColumn,
  DatoolTraceSliceContext,
  DatoolTraceSpanRecord,
  DatoolTraceSpanRenderContext,
  DatoolTraceTime,
  DatoolTraceViewerProps,
} from "./trace-types"
export type { DatoolLinkProps } from "./navigation"
export { DatoolLink, buildDatoolHref } from "./navigation"
export { parseJSONL, traceLifecycleSchema }

export function Table<Row extends Record<string, unknown>>(
  props: DatoolTableProps<Row>
) {
  return (
    <TablePageView
      columns={props.columns as never}
      dateFormat={props.dateFormat}
      defaultSorting={props.defaultSorting}
      rowClassName={props.rowClassName as
        | ((row: Record<string, unknown>) => string | undefined)
        | undefined}
      rowStyle={props.rowStyle as
        | ((row: Record<string, unknown>) => CSSProperties | undefined)
        | undefined}
      source={props.source}
    />
  )
}

export function TraceViewer<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
>(
  props: DatoolTraceViewerProps<Row, GroupRow>
) {
  return (
    <TracePageView
      groups={props.groups as never}
      schema={props.schema as never}
      source={props.source}
    />
  )
}
