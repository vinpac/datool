"use client"

import * as React from "react"

import { Button } from "./ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "./ui/combobox"
import { useDatoolTraceGroupPicker } from "../providers/datool-source-context"

/**
 * Connected trace group picker.
 * Reads group state from the source context (registered by DatoolTraceViewer).
 * Renders nothing if no trace groups are configured.
 */
export function DatoolTraceGroupPicker() {
  const groupPicker = useDatoolTraceGroupPicker()

  if (!groupPicker || groupPicker.groups.length === 0) {
    return null
  }

  return (
    <TraceGroupPickerInner
      groups={groupPicker.groups}
      onValueChange={groupPicker.onValueChange}
      selectedGroupId={groupPicker.selectedGroupId}
    />
  )
}

function TraceGroupPickerInner({
  groups,
  onValueChange,
  selectedGroupId,
}: {
  groups: Array<{ displayName: string; id: string }>
  onValueChange: (value: string | undefined) => void
  selectedGroupId: string | undefined
}) {
  const items = React.useMemo(
    () => groups.map((g) => ({ label: g.displayName, value: g.id })),
    [groups]
  )
  const selectedItem = items.find((i) => i.value === selectedGroupId) ?? null

  return (
    <Combobox
      items={items}
      value={selectedItem}
      itemToStringLabel={(i) => i.label}
      itemToStringValue={(i) => i.value}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(i) => onValueChange(i?.value)}
    >
      <Button asChild variant="ghost" size="xl" className="flex items-center cursor-pointer text-lg!">
        <ComboboxTrigger>
          <ComboboxValue>{selectedItem?.label}</ComboboxValue>
        </ComboboxTrigger>
      </Button>
      <ComboboxContent className="md:min-w-[500px]">
        <ComboboxInput />
        <ComboboxEmpty>No groups found.</ComboboxEmpty>
        <ComboboxList>
          {(item: { label: string; value: string }) => (
            <ComboboxItem key={item.value} value={item} className="text-sm py-2 px-3">
              <span className="truncate">{item.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
