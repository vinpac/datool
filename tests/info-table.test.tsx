import { describe, expect, test } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import type { UseQueryResult } from "@tanstack/react-query"

import { DatoolInfoTable, DatoolProvider, useDatool } from "@/components/ui/datool/core"
import type { DataTableColumnConfig } from "@/components/ui/datool/data-table"
import { InfoTable } from "@/components/ui/datool/info-table/info-table"

type Prompt = {
  id: string
  owner: string
  status: "active" | "draft"
  title: string
  updatedAt: string
}

type TestState = {
  promptDetail: {
    id: string | null
  }
}

function createQueryResult<TData>(data: TData): UseQueryResult<TData> {
  return {
    data,
    dataUpdatedAt: 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isLoading: false,
    isLoadingError: false,
    isPaused: false,
    isPending: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    refetch: async () =>
      ({
        data,
        error: null,
        isError: false,
        isSuccess: true,
        status: "success",
      }) as never,
    promise: Promise.resolve(data),
    status: "success",
  } as unknown as UseQueryResult<TData>
}

const prompt: Prompt = {
  id: "prompt_1",
  owner: "Ava",
  status: "active",
  title: "Onboarding welcome",
  updatedAt: "2026-03-30T10:15:00.000Z",
}

const columns: DataTableColumnConfig<Prompt>[] = [
  { accessorKey: "title", header: "Title" },
  { accessorKey: "status", header: "Status", kind: "enum" },
  { accessorKey: "owner", header: "Owner" },
  {
    accessorKey: "updatedAt",
    dateFormat: "yyyy-MM-dd",
    header: "Updated",
    kind: "date",
  },
]

describe("info table", () => {
  test("renders shared cell content from columns and data", () => {
    const markup = renderToString(<InfoTable columns={columns} data={prompt} />)

    expect(markup).toContain("<table")
    expect(markup).toContain("Onboarding welcome")
    expect(markup).toContain("active")
    expect(markup).toContain("2026-03-30")
  })

  test("supports size variants", () => {
    const markup = renderToString(
      <InfoTable columns={columns} data={prompt} size="sm" />
    )

    expect(markup).toContain("text-xs")
    expect(markup).toContain("px-2.5")
    expect(markup).not.toContain("w-32")
  })

  test("supports xs size", () => {
    const markup = renderToString(
      <InfoTable columns={columns} data={prompt} size="xs" />
    )

    expect(markup).toContain("text-[11px]")
    expect(markup).toContain("px-2")
  })

  test("reads entity data from a datool query", () => {
    function App() {
      const datool = useDatool<TestState>({
        defaultQuery: "promptDetail",
        initialState: {
          promptDetail: {
            id: "prompt_1",
          },
        },
      })

      datool.useEntity({
        key: "promptDetail",
        result: createQueryResult<Prompt | null>(prompt),
      })

      return (
        <DatoolProvider datool={datool}>
          <DatoolInfoTable columns={columns} query="promptDetail" />
        </DatoolProvider>
      )
    }

    const markup = renderToString(<App />)

    expect(markup).toContain("Owner")
    expect(markup).toContain("Ava")
    expect(markup).toContain("2026-03-30")
  })
})
