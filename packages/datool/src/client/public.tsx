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
export type { DatoolClientConfig, DatoolClientSource } from "../shared/types"
export type { DatoolLinkProps } from "./navigation"
export { DatoolLink, buildDatoolHref, prefillDatoolState, getDatoolStateKeys, pathnameToViewId } from "./navigation"

// State managers
export type { DatoolStateManager } from "./lib/state-manager"
export { createQueryParamsStateManager, createLocalStorageStateManager } from "./lib/state-manager"

// State hooks
export { useDatoolState } from "./hooks/use-datool-state"
export { parseJSONL, traceLifecycleSchema }

// Composable providers
export { DatoolProvider } from "./providers/datool-provider"
export type { DatoolProviderProps } from "./providers/datool-provider"
export type { DatoolClientSourceData } from "./providers/datool-context"
export { DatoolSourceProvider } from "./providers/datool-source-provider"
export type { DatoolSourceProviderProps } from "./providers/datool-source-provider"
export { useDatoolContext } from "./providers/datool-context"
export {
  useDatoolSourceContext,
  useDatoolTableContext,
  useDatoolTraceContext,
  useDatoolTraceGroupPicker,
} from "./providers/datool-source-context"
export type {
  DatoolSourceContextValue,
  DatoolTableState,
  DatoolTraceState,
  DatoolTraceGroupPickerState,
} from "./providers/datool-source-context"

// Connected components (level 2 — context-aware)
export { DatoolDataTable } from "./components/datool-data-table"
export type { DatoolDataTableProps } from "./components/datool-data-table"
export { DatoolTraceViewer } from "./components/datool-trace-viewer"
export type { DatoolTraceViewerProps as DatoolConnectedTraceViewerProps } from "./components/datool-trace-viewer"
export { DatoolTraceGroupPicker } from "./components/trace-group-picker"

// Composable UI components
export { ClearButton } from "./components/clear-button"
export { ErrorMessage } from "./components/error-message"
export { LivePlayPause } from "./components/live-play-pause"
export { RefreshButton } from "./components/refresh-button"
export { SearchFilter } from "./components/search-filter"

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
