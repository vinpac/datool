"use client"

import { Trash2Icon } from "lucide-react"

import { Button } from "./ui/button"
import { useDatoolQuery } from "../providers/datool-context"

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
  const canReset =
    datoolQuery.definition.kind === "collection"
      ? Boolean(
          datoolQuery.definition.search ||
            datoolQuery.table ||
            datoolQuery.trace
        )
      : Boolean(datoolQuery.trace)

  return (
    <Button
      aria-label={label}
      className={className}
      disabled={!canReset}
      onClick={() => {
        if (datoolQuery.definition.kind === "collection") {
          datoolQuery.definition.search?.reset()
        }
        datoolQuery.table?.reset()
        datoolQuery.trace?.reset()
      }}
      size="icon-xl"
      type="button"
      variant="outline"
    >
      <Trash2Icon className="size-4" />
    </Button>
  )
}
