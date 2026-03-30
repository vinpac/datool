"use client"

import { useDatoolQuery } from "../providers/datool-context"

export function ErrorMessage({
  className = "px-4 text-sm text-destructive",
  query,
}: {
  className?: string
  query?: string
}) {
  const datoolQuery = useDatoolQuery(query)
  const error = datoolQuery.result.error

  if (!error) {
    return null
  }

  return (
    <div className={className}>
      {error instanceof Error ? error.message : String(error)}
    </div>
  )
}
