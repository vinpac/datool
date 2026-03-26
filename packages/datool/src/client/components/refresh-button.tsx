"use client"

import { RefreshCwIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "./ui/button"
import { useDatoolSourceContext } from "../providers/datool-source-context"

export function RefreshButton({
  className,
  label = "Refresh data",
}: {
  className?: string
  label?: string
}) {
  const { sourceId } = useDatoolSourceContext()
  const queryClient = useQueryClient()

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={() =>
        queryClient.invalidateQueries({
          queryKey: ["datool-rows", sourceId],
        })
      }
      size="icon-xl"
      type="button"
      variant="outline"
    >
      <RefreshCwIcon className="size-4" />
    </Button>
  )
}
