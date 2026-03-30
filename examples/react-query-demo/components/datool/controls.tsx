import { RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/data-table/ui/button"

import { useDatoolCollectionQuery, useDatoolQuery } from "./provider"

export function SearchFilter({
  className,
  placeholder = "Search prompts...",
  query,
}: {
  className?: string
  placeholder?: string
  query?: string
}) {
  const datoolQuery = useDatoolCollectionQuery(query)
  const search = datoolQuery.definition.search

  if (!search) {
    return null
  }

  return (
    <label className={className ?? "search-shell"}>
      <SearchIcon className="size-4 text-muted-foreground" />
      <input
        className="search-input"
        onChange={(event) => {
          search.onChange(event.target.value)
        }}
        placeholder={placeholder}
        type="search"
        value={search.value}
      />
    </label>
  )
}

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
      ? Boolean(datoolQuery.definition.search) || datoolQuery.viewRevision > 0
      : datoolQuery.viewRevision > 0

  return (
    <Button
      aria-label={label}
      className={className}
      disabled={!canReset}
      onClick={() => {
        if (datoolQuery.definition.kind === "collection") {
          datoolQuery.definition.search?.reset()
        }
        datoolQuery.resetView()
      }}
      size="icon-xl"
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
