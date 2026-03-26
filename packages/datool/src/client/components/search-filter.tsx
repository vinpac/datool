"use client"

import * as React from "react"

import {
  DataTableSearchInput,
  type DataTableSearchInputHandle,
} from "./data-table-search-input"
import { useOptionalDataTableContext } from "./data-table"
import { useOptionalDatoolSourceContext } from "../providers/datool-source-context"

/**
 * Connected search filter.
 *
 * When used inside a DataTableProvider (e.g. inside DatoolDataTable), it
 * automatically reads/writes the table-level search state.
 *
 * When used outside a DataTableProvider but inside a DatoolSourceProvider,
 * it reads/writes the source-level search state — which the connected
 * DataTable will pick up via the shared DatoolSourceContext.
 */
export function SearchFilter({
  className,
  inputRef,
  placeholder,
}: {
  className?: string
  inputRef?: React.RefObject<DataTableSearchInputHandle | null>
  placeholder?: string
}) {
  const tableContext = useOptionalDataTableContext()
  const sourceContext = useOptionalDatoolSourceContext()

  // If we're inside a DataTableProvider, DataTableSearchInput will auto-connect
  // via useOptionalDataTableContext(). Just render it.
  if (tableContext) {
    return (
      <div className={className ?? "min-w-0 flex-1"}>
        <DataTableSearchInput
          inputRef={inputRef}
          placeholder={placeholder}
        />
      </div>
    )
  }

  // Outside DataTableProvider — use controlled mode with source context
  if (sourceContext) {
    return (
      <div className={className ?? "min-w-0 flex-1"}>
        <DataTableSearchInput
          inputRef={inputRef}
          onSearchChange={sourceContext.setSearch}
          placeholder={placeholder}
          value={sourceContext.search}
          fields={[]}
        />
      </div>
    )
  }

  // Fallback — uncontrolled (no context available)
  return (
    <div className={className ?? "min-w-0 flex-1"}>
      <DataTableSearchInput
        inputRef={inputRef}
        placeholder={placeholder}
      />
    </div>
  )
}
