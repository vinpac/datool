"use client"

import { Trash2Icon } from "lucide-react"

import { Button } from "./ui/button"
import { useDatoolSourceContext } from "../providers/datool-source-context"

export function ClearButton({
  className,
  label = "Clear rows",
}: {
  className?: string
  label?: string
}) {
  const { clearRows } = useDatoolSourceContext()

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={clearRows}
      size="icon-xl"
      type="button"
      variant="outline"
    >
      <Trash2Icon className="size-4" />
    </Button>
  )
}
