import { describe, expect, test } from "bun:test"

import {
  formatDateValue,
  formatUtcDateValue,
  normalizeDateFormatPattern,
} from "../registry/data-table/components/data-table/lib/date-format"

describe("date formatting", () => {
  test("supports common uppercase date tokens in string patterns", () => {
    const value = new Date(2024, 1, 3, 4, 5, 6)

    expect(normalizeDateFormatPattern("HH:MM:SS DD/MM/YYYY")).toBe(
      "HH:mm:ss dd/MM/yyyy"
    )
    expect(formatDateValue(value, "HH:MM:SS DD/MM/YYYY")).toBe(
      "04:05:06 03/02/2024"
    )
  })

  test("formats tooltip values as full UTC timestamps", () => {
    expect(formatUtcDateValue("2024-02-03T04:05:06.789Z")).toBe(
      "2024-02-03T04:05:06.789Z"
    )
  })
})
