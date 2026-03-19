import { describe, expect, test } from "bun:test"

import { getValueAtPath, resolveDatoolColumnId } from "../src/shared/columns"

describe("columns", () => {
  test("reads nested accessor keys", () => {
    expect(
      getValueAtPath(
        {
          meta: {
            worker: "alpha",
          },
        },
        "meta.worker"
      )
    ).toBe("alpha")
  })

  test("resolves stable column ids", () => {
    expect(
      resolveDatoolColumnId(
        {
          accessorKey: "meta.worker",
          header: "Worker Name",
        },
        0
      )
    ).toBe("meta.worker")
  })
})
