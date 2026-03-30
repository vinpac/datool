"use client"

import { RefreshCwIcon } from "lucide-react"

import { Button } from "./ui/button"
import { useDatoolQuery } from "../providers/datool-context"

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
      size="icon-xl"
      type="button"
      variant="outline"
    >
      <RefreshCwIcon className="size-4" />
    </Button>
  )
}
