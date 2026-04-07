export type DataTableSelectionCell = {
  columnId: string
  rowId: string
}

export type DataTableSelectionRange = {
  anchor: DataTableSelectionCell
  focus: DataTableSelectionCell
}

export type DataTableSelectionState = {
  activeRangeIndex: number
  ranges: DataTableSelectionRange[]
}

export type NormalizedSelectionRange = {
  endColumnIndex: number
  endRowIndex: number
  range: DataTableSelectionRange
  startColumnIndex: number
  startRowIndex: number
}

type Rect = Pick<
  NormalizedSelectionRange,
  "endColumnIndex" | "endRowIndex" | "startColumnIndex" | "startRowIndex"
>

export function createSelectionState(
  range: DataTableSelectionRange
): DataTableSelectionState {
  return {
    activeRangeIndex: 0,
    ranges: [range],
  }
}

function getRectArea(rect: Rect) {
  return (
    (rect.endRowIndex - rect.startRowIndex + 1) *
    (rect.endColumnIndex - rect.startColumnIndex + 1)
  )
}

function getRectUnion(left: Rect, right: Rect): Rect {
  return {
    endColumnIndex: Math.max(left.endColumnIndex, right.endColumnIndex),
    endRowIndex: Math.max(left.endRowIndex, right.endRowIndex),
    startColumnIndex: Math.min(left.startColumnIndex, right.startColumnIndex),
    startRowIndex: Math.min(left.startRowIndex, right.startRowIndex),
  }
}

function getRectIntersection(left: Rect, right: Rect): Rect | null {
  const startRowIndex = Math.max(left.startRowIndex, right.startRowIndex)
  const endRowIndex = Math.min(left.endRowIndex, right.endRowIndex)
  const startColumnIndex = Math.max(
    left.startColumnIndex,
    right.startColumnIndex
  )
  const endColumnIndex = Math.min(left.endColumnIndex, right.endColumnIndex)

  if (startRowIndex > endRowIndex || startColumnIndex > endColumnIndex) {
    return null
  }

  return {
    endColumnIndex,
    endRowIndex,
    startColumnIndex,
    startRowIndex,
  }
}

function subtractRect(source: Rect, subtractor: Rect) {
  const intersection = getRectIntersection(source, subtractor)

  if (!intersection) {
    return [source]
  }

  const pieces: Rect[] = []

  if (source.startRowIndex < intersection.startRowIndex) {
    pieces.push({
      endColumnIndex: source.endColumnIndex,
      endRowIndex: intersection.startRowIndex - 1,
      startColumnIndex: source.startColumnIndex,
      startRowIndex: source.startRowIndex,
    })
  }

  if (intersection.endRowIndex < source.endRowIndex) {
    pieces.push({
      endColumnIndex: source.endColumnIndex,
      endRowIndex: source.endRowIndex,
      startColumnIndex: source.startColumnIndex,
      startRowIndex: intersection.endRowIndex + 1,
    })
  }

  if (source.startColumnIndex < intersection.startColumnIndex) {
    pieces.push({
      endColumnIndex: intersection.startColumnIndex - 1,
      endRowIndex: intersection.endRowIndex,
      startColumnIndex: source.startColumnIndex,
      startRowIndex: intersection.startRowIndex,
    })
  }

  if (intersection.endColumnIndex < source.endColumnIndex) {
    pieces.push({
      endColumnIndex: source.endColumnIndex,
      endRowIndex: intersection.endRowIndex,
      startColumnIndex: intersection.endColumnIndex + 1,
      startRowIndex: intersection.startRowIndex,
    })
  }

  return pieces
}

function canUnionAsExactRectangle(left: Rect, right: Rect) {
  const union = getRectUnion(left, right)

  return getRectArea(union) === getRectArea(left) + getRectArea(right)
}

function denormalizeSelectionRange({
  columnIds,
  range,
  rowIds,
  rowSelection,
}: {
  columnIds: string[]
  range: Rect
  rowIds: string[]
  rowSelection: boolean
}) {
  const startRowId = rowIds[range.startRowIndex]
  const endRowId = rowIds[range.endRowIndex]
  const startColumnId = rowSelection
    ? "__row__"
    : columnIds[range.startColumnIndex]
  const endColumnId = rowSelection ? "__row__" : columnIds[range.endColumnIndex]

  if (!startRowId || !endRowId || !startColumnId || !endColumnId) {
    return null
  }

  return {
    anchor: {
      columnId: startColumnId,
      rowId: startRowId,
    },
    focus: {
      columnId: endColumnId,
      rowId: endRowId,
    },
  } satisfies DataTableSelectionRange
}

export function normalizeSelectionRange({
  columnCount,
  columnIndexById,
  range,
  rowIndexById,
  rowSelection,
}: {
  columnCount: number
  columnIndexById: Map<string, number>
  range: DataTableSelectionRange
  rowIndexById: Map<string, number>
  rowSelection: boolean
}): NormalizedSelectionRange | null {
  const anchorRowIndex = rowIndexById.get(range.anchor.rowId)
  const focusRowIndex = rowIndexById.get(range.focus.rowId)

  if (anchorRowIndex === undefined || focusRowIndex === undefined) {
    return null
  }

  if (rowSelection) {
    return {
      endColumnIndex: Math.max(columnCount - 1, 0),
      endRowIndex: Math.max(anchorRowIndex, focusRowIndex),
      range,
      startColumnIndex: 0,
      startRowIndex: Math.min(anchorRowIndex, focusRowIndex),
    }
  }

  const anchorColumnIndex = columnIndexById.get(range.anchor.columnId)
  const focusColumnIndex = columnIndexById.get(range.focus.columnId)

  if (anchorColumnIndex === undefined || focusColumnIndex === undefined) {
    return null
  }

  return {
    endColumnIndex: Math.max(anchorColumnIndex, focusColumnIndex),
    endRowIndex: Math.max(anchorRowIndex, focusRowIndex),
    range,
    startColumnIndex: Math.min(anchorColumnIndex, focusColumnIndex),
    startRowIndex: Math.min(anchorRowIndex, focusRowIndex),
  }
}

export function normalizeSelectionState({
  columnCount,
  columnIndexById,
  rowIndexById,
  rowSelection,
  selection,
}: {
  columnCount: number
  columnIndexById: Map<string, number>
  rowIndexById: Map<string, number>
  rowSelection: boolean
  selection: DataTableSelectionState | null
}) {
  if (!selection) {
    return []
  }

  return selection.ranges
    .map((range) =>
      normalizeSelectionRange({
        columnCount,
        columnIndexById,
        range,
        rowIndexById,
        rowSelection,
      })
    )
    .filter((range) => range !== null)
}

function appendRangeToSelectionState({
  columnIds,
  columnIndexById,
  nextRange,
  rowIds,
  rowIndexById,
  rowSelection,
  selection,
}: {
  columnIds: string[]
  columnIndexById: Map<string, number>
  nextRange: DataTableSelectionRange
  rowIds: string[]
  rowIndexById: Map<string, number>
  rowSelection: boolean
  selection: DataTableSelectionState | null
}) {
  const normalizedExisting = normalizeSelectionState({
    columnCount: columnIds.length,
    columnIndexById,
    rowIndexById,
    rowSelection,
    selection,
  })
  const normalizedNext = normalizeSelectionRange({
    columnCount: columnIds.length,
    columnIndexById,
    range: nextRange,
    rowIndexById,
    rowSelection,
  })

  if (!normalizedNext) {
    return selection ?? createSelectionState(nextRange)
  }

  const existingRects = normalizedExisting.map((range) => ({
    endColumnIndex: range.endColumnIndex,
    endRowIndex: range.endRowIndex,
    startColumnIndex: range.startColumnIndex,
    startRowIndex: range.startRowIndex,
  }))
  let uncoveredRects: Rect[] = [
    {
      endColumnIndex: normalizedNext.endColumnIndex,
      endRowIndex: normalizedNext.endRowIndex,
      startColumnIndex: normalizedNext.startColumnIndex,
      startRowIndex: normalizedNext.startRowIndex,
    },
  ]

  for (const existingRect of existingRects) {
    uncoveredRects = uncoveredRects.flatMap((rect) =>
      subtractRect(rect, existingRect)
    )
  }

  if (uncoveredRects.length === 0) {
    return selection
  }

  const nextRects = [...existingRects]

  for (const uncoveredRect of uncoveredRects) {
    let candidate = uncoveredRect
    let merged = true

    while (merged) {
      merged = false

      for (let index = 0; index < nextRects.length; index += 1) {
        const currentRect = nextRects[index]

        if (!currentRect || !canUnionAsExactRectangle(currentRect, candidate)) {
          continue
        }

        candidate = getRectUnion(currentRect, candidate)
        nextRects.splice(index, 1)
        merged = true
        break
      }
    }

    nextRects.push(candidate)
  }

  const ranges = nextRects
    .map((range) =>
      denormalizeSelectionRange({
        columnIds,
        range,
        rowIds,
        rowSelection,
      })
    )
    .filter((range) => range !== null)

  if (ranges.length === 0) {
    return null
  }

  return {
    activeRangeIndex: ranges.length - 1,
    ranges,
  } satisfies DataTableSelectionState
}

export function addRangeToSelectionState({
  columnIds,
  columnIndexById,
  nextRange,
  rowIds,
  rowIndexById,
  rowSelection,
  selection,
}: {
  columnIds: string[]
  columnIndexById: Map<string, number>
  nextRange: DataTableSelectionRange
  rowIds: string[]
  rowIndexById: Map<string, number>
  rowSelection: boolean
  selection: DataTableSelectionState | null
}) {
  let nextSelection: DataTableSelectionState | null = null

  for (const range of selection?.ranges ?? []) {
    nextSelection = appendRangeToSelectionState({
      columnIds,
      columnIndexById,
      nextRange: range,
      rowIds,
      rowIndexById,
      rowSelection,
      selection: nextSelection,
    })
  }

  return appendRangeToSelectionState({
    columnIds,
    columnIndexById,
    nextRange,
    rowIds,
    rowIndexById,
    rowSelection,
    selection: nextSelection,
  })
}

export function removeRangeFromSelectionState({
  columnIds,
  columnIndexById,
  rangeToRemove,
  rowIds,
  rowIndexById,
  rowSelection,
  selection,
}: {
  columnIds: string[]
  columnIndexById: Map<string, number>
  rangeToRemove: DataTableSelectionRange
  rowIds: string[]
  rowIndexById: Map<string, number>
  rowSelection: boolean
  selection: DataTableSelectionState | null
}) {
  if (!selection) {
    return null
  }

  const normalizedExisting = normalizeSelectionState({
    columnCount: columnIds.length,
    columnIndexById,
    rowIndexById,
    rowSelection,
    selection,
  })
  const normalizedRemoval = normalizeSelectionRange({
    columnCount: columnIds.length,
    columnIndexById,
    range: rangeToRemove,
    rowIndexById,
    rowSelection,
  })

  if (!normalizedRemoval) {
    return selection
  }

  const pieces = normalizedExisting.flatMap((range) =>
    subtractRect(
      {
        endColumnIndex: range.endColumnIndex,
        endRowIndex: range.endRowIndex,
        startColumnIndex: range.startColumnIndex,
        startRowIndex: range.startRowIndex,
      },
      {
        endColumnIndex: normalizedRemoval.endColumnIndex,
        endRowIndex: normalizedRemoval.endRowIndex,
        startColumnIndex: normalizedRemoval.startColumnIndex,
        startRowIndex: normalizedRemoval.startRowIndex,
      }
    )
  )

  let nextSelection: DataTableSelectionState | null = null

  for (const piece of pieces) {
    const nextRange = denormalizeSelectionRange({
      columnIds,
      range: piece,
      rowIds,
      rowSelection,
    })

    if (!nextRange) {
      continue
    }

    nextSelection = appendRangeToSelectionState({
      columnIds,
      columnIndexById,
      nextRange,
      rowIds,
      rowIndexById,
      rowSelection,
      selection: nextSelection,
    })
  }

  return nextSelection
}

export function isCellInSelectionRanges({
  columnIndex,
  normalizedRanges,
  rowIndex,
}: {
  columnIndex: number
  normalizedRanges: NormalizedSelectionRange[]
  rowIndex: number
}) {
  return normalizedRanges.some(
    (range) =>
      rowIndex >= range.startRowIndex &&
      rowIndex <= range.endRowIndex &&
      columnIndex >= range.startColumnIndex &&
      columnIndex <= range.endColumnIndex
  )
}

export function getSelectedRowIds({
  normalizedRanges,
  rowIds,
}: {
  normalizedRanges: NormalizedSelectionRange[]
  rowIds: string[]
}) {
  const selectedRowIds = new Set<string>()

  for (const range of normalizedRanges) {
    for (
      let rowIndex = range.startRowIndex;
      rowIndex <= range.endRowIndex;
      rowIndex += 1
    ) {
      const rowId = rowIds[rowIndex]

      if (rowId) {
        selectedRowIds.add(rowId)
      }
    }
  }

  return rowIds.filter((rowId) => selectedRowIds.has(rowId))
}
