export type StreamViewerRow = Record<string, unknown> & {
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
