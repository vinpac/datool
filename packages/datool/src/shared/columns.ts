export function resolveDatoolColumnId(
  column: {
    accessorKey?: string
    header?: string
    id?: string
  },
  index: number
) {
  return (
    column.id ??
    column.accessorKey ??
    (column.header
      ? column.header.toLowerCase().replace(/\s+/g, "-")
      : `column-${index}`)
  )
}

export function getValueAtPath(
  value: Record<string, unknown>,
  accessorKey: string
): unknown {
  if (!accessorKey.includes(".")) {
    return value[accessorKey]
  }

  return accessorKey
    .split(".")
    .reduce<unknown>((currentValue, segment) => {
      if (
        currentValue === null ||
        currentValue === undefined ||
        typeof currentValue !== "object"
      ) {
        return undefined
      }

      return (currentValue as Record<string, unknown>)[segment]
    }, value)
}

export function isNestedAccessorKey(accessorKey: string) {
  return accessorKey.includes(".")
}
