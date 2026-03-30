import type { CSSProperties, ReactNode } from "react"

import type { Span } from "./components/trace-viewer/types"
import type { DatoolEnumBadgeColor } from "../shared/types"

export type DatoolTraceTime = string | number | Date | [number, number]

export type DatoolTraceDuration = number | [number, number]

export type DatoolTraceSpanStatus =
  | number
  | {
      code: number
    }

export type DatoolTraceSpanRecord = {
  type: "span"
  spanId: string
  parentSpanId?: string | null
  name?: string
  kind?: number
  resource?: string
  library?: {
    name: string
    version?: string
  }
  status?: DatoolTraceSpanStatus
  traceFlags?: number
  attributes?: Record<string, unknown>
  links?: Record<string, unknown>[]
  startTime?: DatoolTraceTime
  endTime?: DatoolTraceTime
  duration?: DatoolTraceDuration
  activeStartTime?: DatoolTraceTime
}

export type DatoolTraceEventRecord = {
  type: "event"
  spanId: string
  name: string
  timestamp: DatoolTraceTime
  attributes?: Record<string, unknown>
  color?: string
  showVerticalLine?: boolean
}

export type DatoolTraceRecord =
  | DatoolTraceSpanRecord
  | DatoolTraceEventRecord

export type DatoolTraceSchemaState<Row> = {
  rows: Row[]
  spans: Array<{
    spanId: string
    parentSpanId?: string
    name?: string
  }>
}

export type DatoolTraceSpanRenderContext<Row> = {
  span: Span
  sourceRows: Row[]
}

export type DatoolTraceResourceContext<Row> = DatoolTraceSpanRenderContext<Row> & {
  resource: string
}

export type DatoolTraceResourceConfig<Row> = {
  color?: DatoolEnumBadgeColor
  label?: (context: DatoolTraceResourceContext<Row>) => string | undefined
  className?: (context: DatoolTraceResourceContext<Row>) => string | undefined
  style?: (context: DatoolTraceResourceContext<Row>) => CSSProperties | undefined
}

export type DatoolTraceSliceColumn<Row> = {
  accessorKey: string
  label?: string
  render?: (value: unknown, row: Row) => ReactNode
}

export type DatoolTraceSliceContext<Row> = {
  matchedRows: Row[]
  selectedSpan: Span
}

export type DatoolTraceSchema<Row> = {
  mapRow?: (row: Row) => DatoolTraceRecord | DatoolTraceRecord[] | null
  mapRows?: (rows: Row[]) => Array<DatoolTraceRecord | DatoolTraceRecord[] | null>
  rootSpanId?: string | ((state: DatoolTraceSchemaState<Row>) => string | undefined)
  slice?: {
    title?: ReactNode | ((context: DatoolTraceSliceContext<Row>) => ReactNode)
    description?:
      | ReactNode
      | ((context: DatoolTraceSliceContext<Row>) => ReactNode)
    columns?: DatoolTraceSliceColumn<Row>[]
  }
  resources?: Record<string, DatoolTraceResourceConfig<Row>>
  spanLabel?: (context: DatoolTraceSpanRenderContext<Row>) => string | undefined
  spanClassName?: (
    context: DatoolTraceSpanRenderContext<Row>
  ) => string | undefined
  spanStyle?: (
    context: DatoolTraceSpanRenderContext<Row>
  ) => CSSProperties | undefined
}

export type DatoolTraceGroupAccessor<Row, TValue> =
  | string
  | ((row: Row) => TValue)

export type DatoolTraceGroup<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
> = {
  id: string
  displayName: string
  row: GroupRow
  traces: TraceRow[]
}

export type DatoolTraceGroupsConfig<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
> = {
  id: DatoolTraceGroupAccessor<GroupRow, string | null | undefined>
  displayName?: DatoolTraceGroupAccessor<GroupRow, string | null | undefined>
  traces: DatoolTraceGroupAccessor<GroupRow, TraceRow[] | null | undefined>
  label?: string
  placeholder?: string
  initialGroupId?:
    | string
    | ((groups: Array<DatoolTraceGroup<GroupRow, TraceRow>>) => string | undefined)
}

export type DatoolTraceViewerProps<
  Row extends Record<string, unknown> = Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
> = {
  query?: string
  schema: DatoolTraceSchema<Row>
  groups?: DatoolTraceGroupsConfig<GroupRow, Row>
}

export type DatoolTraceLifecycleAccessor<Row, TValue> =
  | string
  | ((row: Row) => TValue)

export type DatoolTraceLifecycleMatcher<Row> =
  | string
  | string[]
  | ((row: Row) => boolean)

export type DatoolTraceLifecycleParent<Row> =
  | "stack"
  | string
  | ((row: Row, context: DatoolTraceLifecycleContext<Row>) => string | null | undefined)

export type DatoolTraceLifecycleContext<Row> = {
  activeSpanIds: string[]
  rowIndex: number
  rootSpanId?: string
  rows: Row[]
}

export type DatoolTraceLifecycleLevel<Row> = {
  key: string
  id: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
  name: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
  start: DatoolTraceLifecycleMatcher<Row>
  end?: DatoolTraceLifecycleMatcher<Row>
  error?: DatoolTraceLifecycleMatcher<Row>
  resource?: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
  parent?: DatoolTraceLifecycleParent<Row>
  when?: (row: Row) => boolean
}

export type DatoolTraceLifecycleLogs<Row> =
  | false
  | {
      when?: (row: Row) => boolean
      span?:
        | "current"
        | "root"
        | DatoolTraceLifecycleAccessor<Row, string | null | undefined>
        | ((row: Row, context: DatoolTraceLifecycleContext<Row>) => string | null | undefined)
      name?: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
      color?: DatoolTraceLifecycleAccessor<Row, string | undefined>
      showVerticalLine?: boolean | ((row: Row) => boolean)
    }

export type DatoolTraceLifecycleSchemaConfig<Row> = {
  timestamp: DatoolTraceLifecycleAccessor<Row, DatoolTraceTime>
  event?: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
  message?: DatoolTraceLifecycleAccessor<Row, string | null | undefined>
  attributes?: (row: Row) => Record<string, unknown>
  levels: DatoolTraceLifecycleLevel<Row>[]
  logs?: DatoolTraceLifecycleLogs<Row>
  resources?: Record<string, DatoolTraceResourceConfig<Row>>
  slice?: DatoolTraceSchema<Row>["slice"]
}
