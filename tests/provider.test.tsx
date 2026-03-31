import { describe, expect, test } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import type { UseQueryResult } from "@tanstack/react-query"

import {
  DatoolProvider,
  useDatool,
  useDatoolCollectionQuery,
  useDatoolQuery,
  useDatoolSearch,
} from "../registry/react-query-datool/components/datool/provider"
import type {
  DatoolInstance,
  DatoolQueryActionContext,
} from "../registry/react-query-datool/components/datool/types"

type PromptRow = {
  id: string
  title: string
}

type PromptFilters = {
  search: string
}

type PromptEntity = {
  id: string
  title: string
}

type PromptEntityFilters = {
  id: string
}

type TestState = {
  prompt: PromptEntityFilters
  prompts: PromptFilters
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

describe("datool provider", () => {
  test("infers the default query when only one query is registered", () => {
    let capturedQueryId = ""
    let capturedRowCount = 0

    function CaptureQuery() {
      const query = useDatoolCollectionQuery<PromptRow[], PromptFilters>()

      capturedQueryId = query.id
      capturedRowCount = query.rows.length

      return <div>{`${query.id}:${query.rows.length}`}</div>
    }

    function App() {
      const datool = useDatool({
        initialState: {
          prompts: {
            search: "",
          },
        },
      })

      datool.useCollection({
        getRowId: (row: PromptRow) => row.id,
        key: "prompts",
        result: createQueryResult([
          {
            id: "prompt_1",
            title: "Welcome",
          },
        ] satisfies PromptRow[]),
        searchKey: "search",
      })

      return (
        <DatoolProvider datool={datool}>
          <CaptureQuery />
        </DatoolProvider>
      )
    }

    const markup = renderToString(<App />)

    expect(markup).toContain("prompts:1")
    expect(capturedQueryId).toBe("prompts")
    expect(capturedRowCount).toBe(1)
  })

  test("requires a default query when multiple queries are registered", () => {
    function CaptureQuery() {
      useDatoolQuery()
      return null
    }

    function App() {
      const datool = useDatool<TestState>({
        initialState: {
          prompt: {
            id: "prompt_1",
          },
          prompts: {
            search: "",
          },
        },
      })

      datool.useCollection({
        getRowId: (row: PromptRow) => row.id,
        key: "prompts",
        result: createQueryResult([] as PromptRow[]),
        searchKey: "search",
      })
      datool.useEntity({
        key: "prompt",
        result: createQueryResult<PromptEntity | null>(null),
      })

      return (
        <DatoolProvider datool={datool}>
          <CaptureQuery />
        </DatoolProvider>
      )
    }

    expect(() => renderToString(<App />)).toThrow(
      "Datool requires a defaultQuery when more than one query is registered."
    )
  })

  test("search bindings read and reset slice state", () => {
    let capturedDatool: DatoolInstance<{ prompts: PromptFilters }> | null = null
    let capturedSearch:
      | ReturnType<typeof useDatoolSearch<PromptRow[], PromptFilters>>["search"]
      | undefined

    function CaptureSearch() {
      const query = useDatoolSearch<PromptRow[], PromptFilters>("prompts")
      capturedSearch = query.search
      return <div>{query.search?.value ?? ""}</div>
    }

    function App() {
      const datool = useDatool({
        initialState: {
          prompts: {
            search: "initial value",
          },
        },
      })

      capturedDatool = datool

      datool.useCollection({
        getRowId: (row: PromptRow) => row.id,
        key: "prompts",
        result: createQueryResult([] as PromptRow[]),
        searchKey: "search",
      })

      return (
        <DatoolProvider datool={datool}>
          <CaptureSearch />
        </DatoolProvider>
      )
    }

    const markup = renderToString(<App />)
    const datool = capturedDatool!
    const search = capturedSearch!

    expect(markup).toContain("initial value")
    expect(search.value).toBe("initial value")

    search.onChange("updated")
    expect(datool.slice("prompts").get().search).toBe("updated")

    search.reset()
    expect(datool.slice("prompts").get().search).toBe("initial value")
  })

  test("actions receive datool access for cross-slice updates", async () => {
    let capturedDatool: DatoolInstance<TestState> | null = null
    let capturedAction:
      | ((
          context: DatoolQueryActionContext<
            PromptRow[],
            PromptFilters,
            TestState,
            PromptRow
          >
        ) => Promise<unknown> | unknown)
      | undefined

    function CaptureQuery() {
      const query = useDatoolCollectionQuery<
        PromptRow[],
        PromptFilters,
        TestState,
        PromptRow
      >("prompts")
      capturedAction = query.definition.actions?.[0]?.onSelect
      return <div>{query.id}</div>
    }

    function App() {
      const datool = useDatool<TestState>({
        defaultQuery: "prompts",
        initialState: {
          prompt: {
            id: "prompt_1",
          },
          prompts: {
            search: "",
          },
        },
      })

      capturedDatool = datool

      datool.useCollection({
        actions: [
          {
            label: "Inspect",
            onSelect: ({ anchorRow, datool: actionDatool }) => {
              if (!anchorRow) return
              actionDatool.slice("prompt").set({ id: anchorRow.id })
            },
          },
        ],
        getRowId: (row: PromptRow) => row.id,
        key: "prompts",
        result: createQueryResult([
          {
            id: "prompt_1",
            title: "Welcome",
          },
        ] satisfies PromptRow[]),
        searchKey: "search",
      })
      datool.useEntity({
        key: "prompt",
        result: createQueryResult<PromptEntity | null>({
          id: "prompt_1",
          title: "Welcome",
        }),
      })

      return (
        <DatoolProvider datool={datool}>
          <CaptureQuery />
        </DatoolProvider>
      )
    }

    renderToString(<App />)
    const datool = capturedDatool!
    const action = capturedAction!

    await action({
      actionRowIds: ["prompt_2"],
      actionRows: [
        {
          id: "prompt_2",
          title: "Updated",
        },
      ],
      anchorRow: {
        id: "prompt_2",
        title: "Updated",
      },
      anchorRowId: "prompt_2",
      datool,
      filters: datool.slice("prompts").get(),
      queryId: "prompts",
      refetch: createQueryResult([] as PromptRow[]).refetch,
      result: createQueryResult([] as PromptRow[]),
      rows: [
        {
          id: "prompt_2",
          title: "Updated",
        },
      ],
      selectedRowIds: ["prompt_2"],
      selectedRows: [
        {
          id: "prompt_2",
          title: "Updated",
        },
      ],
      state: datool.slice("prompts"),
    })

    expect(datool.slice("prompt").get().id).toBe("prompt_2")
  })
})
