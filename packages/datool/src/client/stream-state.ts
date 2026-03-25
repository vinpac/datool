export type StreamViewerRow<TData extends Record<string, unknown> = Record<string, unknown>> =
  TData & {
  __datoolRowId: string
  }

export function upsertViewerRow<T extends StreamViewerRow>(
  currentRows: T[],
  nextRow: T
) {
  const existingIndex = currentRows.findIndex(
    (row) => row.__datoolRowId === nextRow.__datoolRowId
  )

  if (existingIndex < 0) {
    return [...currentRows, nextRow]
  }

  return currentRows.map((row, index) =>
    index === existingIndex ? nextRow : row
  )
}

export function stripViewerRowId<TData extends Record<string, unknown>>(
  row: StreamViewerRow<TData>
) {
  const { __datoolRowId: _datoolRowId, ...data } = row

  return data as unknown as TData
}
