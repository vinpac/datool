import { describe, expect, test } from "bun:test"

import {
  matchesSearch,
  parseSearchQuery,
  quoteSearchTokenValue,
  splitSearchQuery,
  type DataTableSearchField,
} from "../registry/data-table/components/data-table/lib/data-table-text-search"

type SearchRow = {
  level: string
  message: string
}

const fields: DataTableSearchField<SearchRow>[] = [
  {
    getValue: (row) => row.level,
    id: "level",
    kind: "enum",
    options: ["ERROR", "INFO"],
  },
  {
    getValue: (row) => row.message,
    id: "message",
    kind: "text",
  },
]

describe("data table search", () => {
  test("keeps quoted filters as a single token", () => {
    expect(
      splitSearchQuery(
        `level:ERROR message:${quoteSearchTokenValue("worker failed")}`
      )
    ).toEqual(["level:ERROR", 'message:"worker failed"'])
  })

  test("parses quoted field filters", () => {
    expect(parseSearchQuery('message:"worker failed"', fields)).toEqual({
      columnFilters: [
        {
          id: "message",
          value: [
            {
              operator: ":",
              value: "worker failed",
            },
          ],
        },
      ],
      globalFilter: "",
    })
  })

  test("matches rows against quoted field filters", () => {
    expect(
      matchesSearch(
        {
          level: "ERROR",
          message: "worker failed to start",
        },
        'level:ERROR message:"worker failed"',
        fields
      )
    ).toBe(true)
  })
})
