import { describe, expect, test } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { QueryClient } from "@tanstack/react-query"

import {
  DatoolDataTable,
  DatoolProvider,
  DatoolTraceViewer,
  useDatoolCollectionQuery,
  useDatoolQuery,
  type DatoolCollectionQueryDefinition,
  type DatoolEntityQueryDefinition,
} from "../src/index"

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

function createPromptsDefinition(
  filters: PromptFilters,
  setFilters: React.Dispatch<React.SetStateAction<PromptFilters>>
): DatoolCollectionQueryDefinition<PromptRow[], PromptFilters, PromptRow> {
  return {
    filters,
    getQueryOptions: () => ({
      queryFn: async () => [],
      queryKey: ["prompts"],
    }),
    getRowId: (row) => row.id,
    getRows: (data) => data ?? [],
    kind: "collection",
    pollingIntervalMs: 1_500,
    search: {
      onChange: (search) => {
        setFilters((current) => ({ ...current, search }))
      },
      reset: () => {
        setFilters((current) => ({ ...current, search: "" }))
      },
      value: filters.search,
    },
    setFilters,
  }
}

function createPromptDefinition(
  filters: PromptEntityFilters,
  setFilters: React.Dispatch<React.SetStateAction<PromptEntityFilters>>
): DatoolEntityQueryDefinition<PromptEntity | null, PromptEntityFilters> {
  return {
    filters,
    getQueryOptions: (currentFilters) => ({
      queryFn: async () => ({
        id: currentFilters.id,
        title: "unused",
      }),
      queryKey: ["prompt", currentFilters.id],
    }),
    kind: "entity",
    setFilters,
  }
}

describe("datool provider", () => {
  test("infers the default query when only one query is registered", () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(["prompts"], [
      {
        id: "prompt_1",
        title: "Welcome",
      },
    ] satisfies PromptRow[])

    let capturedQueryId = ""
    let capturedRowCount = 0

    function CaptureQuery() {
      const query = useDatoolCollectionQuery<PromptRow[], PromptFilters, PromptRow>()

      capturedQueryId = query.id
      capturedRowCount = query.rows.length

      return <div>{`${query.id}:${query.rows.length}`}</div>
    }

    function App() {
      const [filters, setFilters] = React.useState<PromptFilters>({
        search: "",
      })

      return (
        <DatoolProvider
          queries={{
            prompts: createPromptsDefinition(filters, setFilters),
          }}
          queryClient={queryClient}
        >
          <CaptureQuery />
        </DatoolProvider>
      )
    }

    const markup = renderToString(<App />)

    expect(markup).toContain("prompts:1")
    expect(capturedQueryId).toBe("prompts")
    expect(capturedRowCount).toBe(1)
    expect(
      (
        queryClient.getQueryCache().find({ queryKey: ["prompts"] })?.options as {
          refetchInterval?: unknown
        }
      )?.refetchInterval
    ).toBe(1_500)
  })

  test("requires defaultQuery when multiple queries are registered", () => {
    const queryClient = new QueryClient()

    function App() {
      const [collectionFilters, setCollectionFilters] =
        React.useState<PromptFilters>({
          search: "",
        })
      const [entityFilters, setEntityFilters] = React.useState({
        id: "prompt_1",
      })

      return (
        <DatoolProvider
          queries={{
            prompt: createPromptDefinition(entityFilters, setEntityFilters),
            prompts: createPromptsDefinition(
              collectionFilters,
              setCollectionFilters
            ),
          }}
          queryClient={queryClient}
        >
          <div />
        </DatoolProvider>
      )
    }

    expect(() => renderToString(<App />)).toThrow(
      "DatoolProvider requires a defaultQuery when more than one query is registered."
    )
  })

  test("exposes entity queries through useDatoolQuery", () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(["prompt", "prompt_1"], {
      id: "prompt_1",
      title: "Welcome",
    })

    let capturedTitle = ""

    function CaptureEntity() {
      const query = useDatoolQuery<PromptEntity | null, PromptEntityFilters>("prompt")

      capturedTitle = query.result.data?.title ?? ""

      return <div>{capturedTitle}</div>
    }

    function App() {
      const [collectionFilters, setCollectionFilters] =
        React.useState<PromptFilters>({
          search: "",
        })
      const [entityFilters, setEntityFilters] = React.useState({
        id: "prompt_1",
      })

      return (
        <DatoolProvider
          defaultQuery="prompts"
          queries={{
            prompt: createPromptDefinition(entityFilters, setEntityFilters),
            prompts: createPromptsDefinition(
              collectionFilters,
              setCollectionFilters
            ),
          }}
          queryClient={queryClient}
        >
          <CaptureEntity />
        </DatoolProvider>
      )
    }

    expect(renderToString(<App />)).toContain("Welcome")
    expect(capturedTitle).toBe("Welcome")
  })

  test("rejects entity queries when rendering DatoolDataTable", () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(["prompt", "prompt_1"], {
      id: "prompt_1",
      title: "Welcome",
    })

    function App() {
      const [filters, setFilters] = React.useState({
        id: "prompt_1",
      })

      return (
        <DatoolProvider
          queries={{
            prompt: createPromptDefinition(filters, setFilters),
          }}
          queryClient={queryClient}
        >
          <DatoolDataTable
            columns={[
              {
                accessorKey: "title",
                header: "Title",
              },
            ]}
          />
        </DatoolProvider>
      )
    }

    expect(() => renderToString(<App />)).toThrow("is not a collection query")
  })

  test("renders DatoolTraceViewer from a collection query", () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(["trace-rows"], [
      {
        endTime: 1,
        id: "span_1",
        name: "Prompt fetch",
        startTime: 0,
        type: "span",
      },
    ])

    function App() {
      const [filters, setFilters] = React.useState({
        search: "",
      })

      return (
        <DatoolProvider
          queries={{
            traces: {
              filters,
              getQueryOptions: () => ({
                queryFn: async () => [],
                queryKey: ["trace-rows"],
              }),
              getRowId: (row: {
                endTime: number
                id: string
                name: string
                startTime: number
                type: "span"
              }) => row.id,
              getRows: (
                data:
                  | Array<{
                      endTime: number
                      id: string
                      name: string
                      startTime: number
                      type: "span"
                    }>
                  | undefined
              ) => data ?? [],
              kind: "collection",
              setFilters,
            },
          }}
          queryClient={queryClient}
        >
          <DatoolTraceViewer<{
            endTime: number
            id: string
            name: string
            startTime: number
            type: "span"
          }>
            query="traces"
            schema={{
              mapRow: (row) => ({
                endTime: row.endTime,
                name: row.name,
                spanId: row.id,
                startTime: row.startTime,
                type: "span",
              }),
            }}
          />
        </DatoolProvider>
      )
    }

    expect(() => renderToString(<App />)).not.toThrow()
  })
})
