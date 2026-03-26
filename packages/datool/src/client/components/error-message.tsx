"use client"

import { useDatoolSourceContext } from "../providers/datool-source-context"

export function ErrorMessage({
  className = "px-4 text-sm text-destructive",
}: {
  className?: string
}) {
  const { errorMessage } = useDatoolSourceContext()

  if (!errorMessage) {
    return null
  }

  return <div className={className}>{errorMessage}</div>
}
