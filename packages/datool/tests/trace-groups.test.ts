import { describe, expect, test } from "bun:test"

import {
  buildGroupedTraceRows,
  buildTraceGroupsFromRows,
  resolveInitialTraceGroupId,
} from "../src/client/lib/trace-groups"

type TraceRow = {
  type: "span" | "event"
  spanId: string
}

type GroupRow = {
  id?: string
  displayName?: string
  traces?: TraceRow[]
}

function viewerRow(id: string, row: GroupRow) {
  return {
    __datoolRowId: id,
    ...row,
  }
}

describe("trace groups", () => {
  test("builds groups from outer rows and synthesizes inner viewer row ids", () => {
    const result = buildTraceGroupsFromRows(
      [
        viewerRow("group-row-1", {
          displayName: "Workflow 1",
          id: "workflow-1",
          traces: [
            {
              spanId: "run-1",
              type: "span",
            },
            {
              spanId: "run-1",
              type: "event",
            },
          ],
        }),
      ],
      {
        displayName: "displayName",
        id: "id",
        traces: "traces",
      }
    )

    expect(result.issues).toEqual([])
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]).toEqual(
      expect.objectContaining({
        displayName: "Workflow 1",
        id: "workflow-1",
      })
    )

    expect(buildGroupedTraceRows(result.groups[0])).toEqual([
      {
        __datoolRowId: "workflow-1:trace:0",
        spanId: "run-1",
        type: "span",
      },
      {
        __datoolRowId: "workflow-1:trace:1",
        spanId: "run-1",
        type: "event",
      },
    ])
  })

  test("reports invalid group rows and resolves default selection", () => {
    const result = buildTraceGroupsFromRows(
      [
        viewerRow("bad-group", {
          displayName: "Broken",
          traces: [],
        }),
        viewerRow("good-group", {
          displayName: "Workflow 2",
          id: "workflow-2",
          traces: [],
        }),
      ],
      {
        displayName: "displayName",
        id: "id",
        traces: "traces",
      }
    )

    expect(result.issues.map((issue) => issue.message)).toEqual([
      'Trace group row is missing a valid string "id".',
    ])
    expect(resolveInitialTraceGroupId({ id: "id", traces: "traces" }, result.groups)).toBe(
      "workflow-2"
    )
  })
})
