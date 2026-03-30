"use client"

import * as React from "react"
import { QueryClient } from "@tanstack/react-query"
import { Eye, RotateCcw, Sparkles } from "lucide-react"
import { TooltipProvider } from "@/components/data-table/ui/tooltip"

import {
  ClearButton,
  DatoolDataTable,
  DatoolProvider,
  ErrorMessage,
  RefreshButton,
  SearchFilter,
  useDatoolQuery,
  type DatoolCollectionQueryDefinition,
  type DatoolEntityQueryDefinition,
  type DatoolQueryActionContext,
} from "@/components/datool"

type PromptStatus = "active" | "draft" | "review"

type Prompt = {
  content: string
  id: string
  owner: string
  status: PromptStatus
  title: string
  updatedAt: string
}

type PromptFilters = {
  search: string
  status: "all" | PromptStatus
}

type PromptDetailFilters = {
  id: string | null
}

const queryClient = new QueryClient()

const INITIAL_PROMPTS: Prompt[] = [
  {
    content: "Welcome users with a warm and concise onboarding note.",
    id: "prompt_1",
    owner: "Ava",
    status: "active",
    title: "Onboarding welcome",
    updatedAt: "2026-03-30T10:15:00.000Z",
  },
  {
    content: "Summarize support tickets and recommend next actions.",
    id: "prompt_2",
    owner: "Milo",
    status: "review",
    title: "Support triage",
    updatedAt: "2026-03-30T09:40:00.000Z",
  },
  {
    content: "Draft a weekly product update for internal stakeholders.",
    id: "prompt_3",
    owner: "Nia",
    status: "draft",
    title: "Weekly product memo",
    updatedAt: "2026-03-29T18:05:00.000Z",
  },
  {
    content: "Generate follow-up suggestions after discovery calls.",
    id: "prompt_4",
    owner: "Leo",
    status: "active",
    title: "Sales follow-up",
    updatedAt: "2026-03-29T13:20:00.000Z",
  },
]

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function DetailPanel() {
  const promptQuery = useDatoolQuery<Prompt | null, PromptDetailFilters>(
    "prompt"
  )
  const prompt = promptQuery.result.data

  return (
    <aside className="detail-panel">
      <div className="detail-label">Selected prompt</div>
      {prompt ? (
        <>
          <h2>{prompt.title}</h2>
          <dl className="detail-grid">
            <div>
              <dt>Status</dt>
              <dd>{prompt.status}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{prompt.owner}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{new Date(prompt.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
          <p>{prompt.content}</p>
        </>
      ) : (
        <p className="detail-empty">
          Pick a row action to inspect a single prompt here.
        </p>
      )}
    </aside>
  )
}

export default function App() {
  const [prompts, setPrompts] = React.useState<Prompt[]>(INITIAL_PROMPTS)
  const [revision, setRevision] = React.useState(0)
  const [promptFilters, setPromptFilters] = React.useState<PromptFilters>({
    search: "",
    status: "all",
  })
  const [promptDetailFilters, setPromptDetailFilters] =
    React.useState<PromptDetailFilters>({
      id: INITIAL_PROMPTS[0]?.id ?? null,
    })

  const bumpRevision = React.useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  const promptsQuery = React.useMemo<
    DatoolCollectionQueryDefinition<Prompt[], PromptFilters, Prompt>
  >(
    () => ({
      actions: [
        {
          button: {
            label: "Inspect",
            size: "sm",
            variant: "outline",
          },
          icon: Eye,
          label: "Inspect prompt",
          onSelect: ({
            anchorRow,
          }: DatoolQueryActionContext<Prompt[], PromptFilters, Prompt>) => {
            if (!anchorRow) return
            setPromptDetailFilters({ id: anchorRow.id })
          },
          scope: "row",
        },
        {
          button: {
            label: "Send to Review",
            size: "sm",
          },
          icon: Sparkles,
          label: ({
            actionRows,
          }: DatoolQueryActionContext<Prompt[], PromptFilters, Prompt>) =>
            actionRows.length > 1
              ? `Move ${actionRows.length} prompts to review`
              : "Move prompt to review",
          onSelect: ({
            actionRows,
          }: DatoolQueryActionContext<Prompt[], PromptFilters, Prompt>) => {
            const ids = new Set(actionRows.map((row) => row.id))
            setPrompts((current) =>
              current.map((prompt) =>
                ids.has(prompt.id)
                  ? {
                      ...prompt,
                      status: "review",
                      updatedAt: new Date().toISOString(),
                    }
                  : prompt
              )
            )
            bumpRevision()
          },
          scope: "selection",
        },
      ],
      filters: promptFilters,
      getQueryOptions: (filters) => ({
        queryFn: async () => {
          await delay(180)

          return prompts.filter((prompt) => {
            const matchesSearch =
              filters.search.trim().length === 0 ||
              `${prompt.title} ${prompt.owner} ${prompt.content}`
                .toLowerCase()
                .includes(filters.search.toLowerCase())
            const matchesStatus =
              filters.status === "all" || prompt.status === filters.status

            return matchesSearch && matchesStatus
          })
        },
        queryKey: ["prompts", filters, revision],
      }),
      getRowId: (row) => row.id,
      getRows: (data) => data ?? [],
      kind: "collection",
      pollingIntervalMs: 5000,
      search: {
        onChange: (search) => {
          setPromptFilters((current) => ({ ...current, search }))
        },
        reset: () => {
          setPromptFilters((current) => ({ ...current, search: "" }))
        },
        value: promptFilters.search,
      },
      setFilters: setPromptFilters,
    }),
    [bumpRevision, promptFilters, prompts, revision]
  )

  const promptQuery = React.useMemo<
    DatoolEntityQueryDefinition<Prompt | null, PromptDetailFilters>
  >(
    () => ({
      filters: promptDetailFilters,
      getQueryOptions: (filters) => ({
        enabled: Boolean(filters.id),
        queryFn: async () => {
          await delay(100)
          return prompts.find((prompt) => prompt.id === filters.id) ?? null
        },
        queryKey: ["prompt", filters, revision],
      }),
      kind: "entity",
      pollingIntervalMs: false,
      setFilters: setPromptDetailFilters,
    }),
    [promptDetailFilters, prompts, revision]
  )

  return (
    <TooltipProvider>
      <DatoolProvider
        defaultQuery="prompts"
        queries={{
          prompt: promptQuery,
          prompts: promptsQuery,
        }}
        queryClient={queryClient}
      >
        <main className="demo-shell">
          <section className="demo-hero">
            <div>
              <p className="eyebrow">Datool example</p>
              <h1>React Query-powered prompts workspace</h1>
              <p className="hero-copy">
                This example uses the new single-provider API with one
                collection query, one entity query, built-in
                search/refresh/reset controls, and client-side row actions.
              </p>
            </div>

            <div className="hero-actions">
              <label className="status-filter">
                <span>Status</span>
                <select
                  onChange={(event) => {
                    const nextStatus = event.target
                      .value as PromptFilters["status"]
                    setPromptFilters((current) => ({
                      ...current,
                      status: nextStatus,
                    }))
                  }}
                  value={promptFilters.status}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="review">Review</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <button
                className="ghost-button"
                onClick={() => {
                  setPrompts(INITIAL_PROMPTS)
                  setPromptDetailFilters({ id: INITIAL_PROMPTS[0]?.id ?? null })
                  setPromptFilters({ search: "", status: "all" })
                  bumpRevision()
                }}
                type="button"
              >
                <RotateCcw size={16} />
                Reset data
              </button>
            </div>
          </section>

          <section className="demo-layout">
            <div className="table-card">
              <header className="toolbar">
                <SearchFilter />
                <RefreshButton />
                <ClearButton />
              </header>

              <ErrorMessage />

              <DatoolDataTable
                columns={[
                  { accessorKey: "title", header: "Title" },
                  { accessorKey: "status", header: "Status", kind: "enum" },
                  { accessorKey: "owner", header: "Owner" },
                  { accessorKey: "updatedAt", header: "Updated", kind: "date" },
                ]}
              />
            </div>

            <DetailPanel />
          </section>
        </main>
      </DatoolProvider>
    </TooltipProvider>
  )
}
