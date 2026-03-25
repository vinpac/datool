import type { StreamViewerRow } from "../stream-state"
import type {
  DatoolTraceGroup,
  DatoolTraceGroupAccessor,
  DatoolTraceGroupsConfig,
} from "../trace-types"
import { getValueAtPath } from "../../shared/columns"

type TraceIssue = {
  message: string
  rowId?: string
}

export type ResolvedDatoolTraceGroup<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
> = DatoolTraceGroup<GroupRow, TraceRow> & {
  viewerRow: StreamViewerRow<GroupRow>
}

export type DatoolBuiltTraceGroups<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
> = {
  groups: Array<ResolvedDatoolTraceGroup<GroupRow, TraceRow>>
  issues: TraceIssue[]
}

function resolveAccessor<Row, TValue>(
  row: Row,
  accessor: DatoolTraceGroupAccessor<Row, TValue>
) {
  if (typeof accessor === "function") {
    return accessor(row)
  }

  return getValueAtPath(row as Record<string, unknown>, accessor) as TValue
}

export function buildTraceGroupsFromRows<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
>(
  rows: Array<StreamViewerRow<GroupRow>>,
  config: DatoolTraceGroupsConfig<GroupRow, TraceRow>
): DatoolBuiltTraceGroups<GroupRow, TraceRow> {
  const issues: TraceIssue[] = []
  const groups: Array<ResolvedDatoolTraceGroup<GroupRow, TraceRow>> = []

  for (const viewerRow of rows) {
    const id = resolveAccessor(viewerRow, config.id)

    if (typeof id !== "string" || id.trim() === "") {
      issues.push({
        message: 'Trace group row is missing a valid string "id".',
        rowId: viewerRow.__datoolRowId,
      })
      continue
    }

    const traces = resolveAccessor(viewerRow, config.traces)

    if (!Array.isArray(traces)) {
      issues.push({
        message: `Trace group "${id}" is missing a valid traces array.`,
        rowId: viewerRow.__datoolRowId,
      })
      continue
    }

    const displayName =
      config.displayName !== undefined
        ? resolveAccessor(viewerRow, config.displayName)
        : undefined

    groups.push({
      displayName:
        typeof displayName === "string" && displayName.trim().length > 0
          ? displayName
          : id,
      id,
      row: viewerRow,
      traces,
      viewerRow,
    })
  }

  return {
    groups,
    issues,
  }
}

export function resolveInitialTraceGroupId<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
>(
  config: DatoolTraceGroupsConfig<GroupRow, TraceRow>,
  groups: Array<ResolvedDatoolTraceGroup<GroupRow, TraceRow>>
) {
  if (typeof config.initialGroupId === "function") {
    return config.initialGroupId(groups)
  }

  if (typeof config.initialGroupId === "string") {
    return config.initialGroupId
  }

  return groups[0]?.id
}

export function buildGroupedTraceRows<
  GroupRow extends Record<string, unknown>,
  TraceRow extends Record<string, unknown>,
>(
  group: ResolvedDatoolTraceGroup<GroupRow, TraceRow> | undefined
): Array<StreamViewerRow<TraceRow>> {
  if (!group) {
    return []
  }

  return group.traces.map((traceRow, index) => {
    const existingRowId =
      "__datoolRowId" in traceRow && typeof traceRow.__datoolRowId === "string"
        ? traceRow.__datoolRowId
        : undefined

    return {
      ...traceRow,
      __datoolRowId: existingRowId ?? `${group.id}:trace:${index}`,
    } as StreamViewerRow<TraceRow>
  })
}
