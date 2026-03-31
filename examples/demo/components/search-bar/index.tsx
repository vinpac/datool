import type { Ref } from "react"

import {
  DataTableSearchInput,
  type DataTableSearchInputHandle,
} from "./search-input"
import type { SearchField } from "./search-core"

export type { SearchField, SearchFieldKind, SearchFieldSpec } from "./search-core"

export type SearchBarHandle = DataTableSearchInputHandle

export type SearchBarProps<Row extends Record<string, unknown>> = {
  className?: string
  fields: SearchField<Row>[]
  inputRef?: Ref<SearchBarHandle>
  isLoading?: boolean
  onSearchChange: (value: string) => void
  placeholder?: string
  value: string
}

/**
 * Controlled token-aware search bar.
 */
export function SearchBar<Row extends Record<string, unknown>>({
  className,
  fields,
  inputRef,
  isLoading,
  onSearchChange,
  placeholder,
  value,
}: SearchBarProps<Row>) {
  return (
    <div className={className ?? "min-w-0 flex-1"}>
      <DataTableSearchInput
        fields={fields}
        inputRef={inputRef}
        isLoading={isLoading}
        onSearchChange={onSearchChange}
        placeholder={placeholder}
        value={value}
      />
    </div>
  )
}
