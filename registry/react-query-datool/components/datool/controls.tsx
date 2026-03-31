"use client"

import { RefreshCwIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slot } from "radix-ui"
import { useDatoolQuery } from "./provider"

export function RefreshButton({
  className,
  label = "Refresh data",
  query,
}: {
  className?: string
  label?: string
  query?: string
}) {
  const datoolQuery = useDatoolQuery(query)

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={() => void datoolQuery.result.refetch()}
      size="lg"
      type="button"
      variant="outline"
    >
      <RefreshCwIcon className="size-4" />
    </Button>
  )
}

export function ClearButton({
  className,
  label = "Reset view",
  query,
}: {
  className?: string
  label?: string
  query?: string
}) {
  const datoolQuery = useDatoolQuery(query)
  const searchKey =
    datoolQuery.definition.kind === "collection"
      ? datoolQuery.definition.searchKey
      : undefined
  const canResetSearch = searchKey
    ? !Object.is(
        datoolQuery.filters[searchKey],
        datoolQuery.state.getInitial()[searchKey]
      )
    : false
  const canReset =
    canResetSearch || datoolQuery.viewRevision > 0

  return (
    <Button
      aria-label={label}
      className={className}
      disabled={!canReset}
      onClick={() => {
        if (searchKey) {
          datoolQuery.state.set({
            [searchKey]: datoolQuery.state.getInitial()[searchKey],
          } as Partial<typeof datoolQuery.filters>)
        }
        datoolQuery.resetView()
      }}
      size="lg"
      type="button"
      variant="outline"
    >
      <Trash2Icon className="size-4" />
    </Button>
  )
}

export function ErrorMessage({
  className = "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  query,
  asChild = false,
}: {
  className?: string
  query?: string
  asChild?: boolean
}) {
  const datoolQuery = useDatoolQuery(query)
  const error = datoolQuery.result.error

  if (!error) {
    return null
  }

  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp className={className}>
      {error instanceof Error ? error.message : String(error)}
    </Comp>
  )
}
