"use client"

import { SearchBar as ConnectedSearchBar } from "@/components/ui/datool/search-bar"
import { useDatoolSearch } from "./provider"

export function SearchBar({
  className,
  placeholder = "Search data...",
  query,
}: {
  className?: string
  placeholder?: string
  query?: string
}) {
  const datoolQuery = useDatoolSearch(query)
  const search = datoolQuery.search

  if (!search) {
    return null
  }

  return (
    <ConnectedSearchBar
      className={className}
      fields={datoolQuery.searchFields}
      isLoading={datoolQuery.result.isFetching}
      onSearchChange={search.onChange}
      placeholder={placeholder}
      value={search.value}
    />
  )
}
