"use client"

import { SearchBar as ConnectedSearchBar } from "@/components/ui/datool/search-bar"
import { useDatoolSearch } from "./provider"

export function SearchBar({
  className,
  placeholder = "Search data...",
  query,
  showLoadingOnRefetch = true,
}: {
  className?: string
  placeholder?: string
  query?: string
  showLoadingOnRefetch?: boolean
}) {
  const datoolQuery = useDatoolSearch(query)
  const search = datoolQuery.search

  if (!search) {
    return null
  }

  const isLoading = showLoadingOnRefetch
    ? datoolQuery.result.isFetching
    : datoolQuery.result.isLoading

  return (
    <ConnectedSearchBar
      className={className}
      fields={datoolQuery.searchFields}
      isLoading={isLoading}
      onSearchChange={search.onChange}
      placeholder={placeholder}
      value={search.value}
    />
  )
}
