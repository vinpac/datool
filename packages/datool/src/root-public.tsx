import type { CSSProperties } from "react"

import { TablePageView } from "./client/components/table-page-view"
import { TracePageView } from "./client/components/trace-page-view"
import { parseJSONL } from "./client/lib/jsonl"
import { traceLifecycleSchema } from "./client/lib/trace-lifecycle-schema"
import type { DatoolTableProps } from "./client/table-types"
import type { DatoolTraceViewerProps } from "./client/trace-types"

export type { DatoolColumn, DatoolSortingState, DatoolTableProps } from "./client/table-types"
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
} from "./client/trace-types"
export type { DatoolClientConfig, DatoolClientSource } from "./shared/types"

export { parseJSONL, traceLifecycleSchema }

export { DatoolProvider } from "./client/providers/datool-provider"
export type { DatoolProviderProps } from "./client/providers/datool-provider"
export type { DatoolClientSourceData } from "./client/providers/datool-context"
export { DatoolSourceProvider } from "./client/providers/datool-source-provider"
export type { DatoolSourceProviderProps } from "./client/providers/datool-source-provider"
export { useDatoolContext } from "./client/providers/datool-context"
export {
  useDatoolSourceContext,
  useDatoolTableContext,
  useDatoolTraceContext,
  useDatoolTraceGroupPicker,
} from "./client/providers/datool-source-context"
export type {
  DatoolSourceContextValue,
  DatoolTableState,
  DatoolTraceState,
  DatoolTraceGroupPickerState,
} from "./client/providers/datool-source-context"

export { DatoolDataTable } from "./client/components/datool-data-table"
export type { DatoolDataTableProps } from "./client/components/datool-data-table"

export { ClearButton } from "./client/components/clear-button"
export { ErrorMessage } from "./client/components/error-message"
export { LivePlayPause } from "./client/components/live-play-pause"
export { RefreshButton } from "./client/components/refresh-button"
export { SearchFilter } from "./client/components/search-filter"
export { SettingsButton } from "./client/components/viewer-settings"

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
