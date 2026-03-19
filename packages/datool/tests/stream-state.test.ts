import { describe, expect, test } from "bun:test"

import { upsertViewerRow } from "../src/client/stream-state"

describe("stream state", () => {
  test("appends rows when the id is new", () => {
    expect(
      upsertViewerRow(
        [
          {
            __datoolRowId: "demo:0",
            message: "one",
          },
        ],
        {
          __datoolRowId: "demo:1",
          message: "two",
        }
      )
    ).toEqual([
      {
        __datoolRowId: "demo:0",
        message: "one",
      },
      {
        __datoolRowId: "demo:1",
        message: "two",
      },
    ])
  })

  test("replaces rows when the id already exists", () => {
    expect(
      upsertViewerRow(
        [
          {
            __datoolRowId: "demo:0",
            message: "old",
          },
          {
            __datoolRowId: "demo:1",
            message: "keep",
          },
        ],
        {
          __datoolRowId: "demo:0",
          message: "new",
        }
      )
    ).toEqual([
      {
        __datoolRowId: "demo:0",
        message: "new",
      },
      {
        __datoolRowId: "demo:1",
        message: "keep",
      },
    ])
  })
})
