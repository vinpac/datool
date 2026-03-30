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
import { useDatoolTraceGroupPicker } from "../providers/datool-context"

export function DatoolTraceGroupPicker({ query }: { query?: string }) {
  const groupPicker = useDatoolTraceGroupPicker(query)

  if (!groupPicker || groupPicker.groups.length === 0) {
    return null
  }

  const items = groupPicker.groups.map((group) => ({
    label: group.displayName,
    value: group.id,
  }))
  const selectedItem =
    items.find((item) => item.value === groupPicker.selectedGroupId) ?? null

  return (
    <Combobox
      items={items}
      value={selectedItem}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      onValueChange={(item) => groupPicker.onValueChange(item?.value)}
    >
      <Button
        asChild
        className="flex cursor-pointer items-center text-lg!"
        size="xl"
        variant="ghost"
      >
        <ComboboxTrigger>
          <ComboboxValue>{selectedItem?.label}</ComboboxValue>
        </ComboboxTrigger>
      </Button>
      <ComboboxContent className="md:min-w-[500px]">
        <ComboboxInput />
        <ComboboxEmpty>No groups found.</ComboboxEmpty>
        <ComboboxList>
          {(item: { label: string; value: string }) => (
            <ComboboxItem
              key={item.value}
              className="px-3 py-2 text-sm"
              value={item}
            >
              <span className="truncate">{item.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
