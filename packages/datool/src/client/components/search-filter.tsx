"use client"

import * as React from "react"

import {
  DataTableSearchInput,
  type DataTableSearchInputHandle,
} from "./data-table-search-input"
import { useOptionalDataTableContext } from "./data-table"
import { useDatoolCollectionQuery } from "../providers/datool-context"

export function SearchFilter({
  className,
  inputRef,
  placeholder,
  query,
}: {
  className?: string
  inputRef?: React.RefObject<DataTableSearchInputHandle | null>
  placeholder?: string
  query?: string
}) {
  const tableContext = useOptionalDataTableContext()
  const datoolQuery = useDatoolCollectionQuery(query)

  if (!query && tableContext) {
    return (
      <div className={className ?? "min-w-0 flex-1"}>
        <DataTableSearchInput
          inputRef={inputRef}
          placeholder={placeholder}
        />
      </div>
    )
  }

  if (
    datoolQuery &&
    datoolQuery.definition.kind === "collection" &&
    datoolQuery.definition.search
  ) {
    const fields = datoolQuery.searchFieldSpecs.map((field) => ({
      ...field,
      getValue: () => undefined,
    }))

    return (
      <div className={className ?? "min-w-0 flex-1"}>
        <DataTableSearchInput
          fields={fields}
          inputRef={inputRef}
          onSearchChange={datoolQuery.definition.search.onChange}
          placeholder={placeholder}
          value={datoolQuery.definition.search.value}
        />
      </div>
    )
  }

  return null
}
