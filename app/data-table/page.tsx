"use client"

import * as React from "react"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { Eye, RotateCcw, Sparkles } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ClearButton,
  DatoolDataTable,
  DatoolProvider,
  ErrorMessage,
  RefreshButton,
  SearchBar,
  useDatool,
  useDatoolQuery,
} from "@/components/ui/datool/core"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

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

type PromptDetailState = {
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

const INITIAL_STATE = {
  promptDetail: {
    id: INITIAL_PROMPTS[0]?.id ?? null,
  },
  prompts: {
    search: "",
    status: "all" as const,
  },
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function DetailPanel() {
  const promptQuery = useDatoolQuery<Prompt | null, PromptDetailState>(
    "promptDetail"
  )
  const prompt = promptQuery.result.data

  return (
    <aside className="p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-black/60 mb-1">
        Selected prompt
      </div>
      {prompt ? (
        <>
          <h2 className="font-serif font-semibold text-xl leading-tight mb-1">{prompt.title}</h2>
          <dl className="grid grid-cols-1 gap-y-2 md:gap-y-3 text-black/75 text-base mb-2">
            <div className="flex gap-4">
              <dt className="min-w-[60px] text-xs font-semibold text-black/60">Status</dt>
              <dd>{prompt.status}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="min-w-[60px] text-xs font-semibold text-black/60">Owner</dt>
              <dd>{prompt.owner}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="min-w-[60px] text-xs font-semibold text-black/60">Updated</dt>
              <dd>{new Date(prompt.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
          <p className="text-black/80">{prompt.content}</p>
        </>
      ) : (
        <p className="italic text-black/45">
          Pick a row action to inspect a single prompt here.
        </p>
      )}
    </aside>
  )
}

function DatoolDemo() {
  const [prompts, setPrompts] = React.useState<Prompt[]>(INITIAL_PROMPTS)
  const [revision, setRevision] = React.useState(0)
  const datool = useDatool({
    defaultQuery: "prompts",
    initialState: INITIAL_STATE,
  })
  const promptsState = datool.slice("prompts")
  const promptDetailState = datool.slice("promptDetail")
  const promptSearch = promptsState.use((state) => state.search)
  const promptStatus = promptsState.use((state) => state.status)
  const selectedPromptId = promptDetailState.use((state) => state.id)

  const bumpRevision = React.useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  const promptsQuery = useQuery({
    queryFn: async () => {
      await delay(180)

      return prompts.filter((prompt) => {
        const matchesSearch =
          promptSearch.trim().length === 0 ||
          `${prompt.title} ${prompt.owner} ${prompt.content}`
            .toLowerCase()
            .includes(promptSearch.toLowerCase())
        const matchesStatus =
          promptStatus === "all" || prompt.status === promptStatus

        return matchesSearch && matchesStatus
      })
    },
    queryKey: ["prompts", promptSearch, promptStatus, revision],
    refetchInterval: 5000,
  })

  const promptDetailQuery = useQuery({
    enabled: Boolean(selectedPromptId),
    queryFn: async () => {
      await delay(100)
      return prompts.find((prompt) => prompt.id === selectedPromptId) ?? null
    },
    queryKey: ["promptDetail", selectedPromptId, revision],
  })

  datool.useCollection({
    actions: [
      {
        button: {
          label: "Inspect",
          size: "sm",
          variant: "outline",
        },
        icon: Eye,
        label: "Inspect prompt",
        onSelect: ({ anchorRow, datool: actionDatool }) => {
          if (!anchorRow) return
          actionDatool.slice("promptDetail").set({ id: anchorRow.id })
        },
        scope: "row",
      },
      {
        button: {
          label: "Send to Review",
          size: "sm",
        },
        icon: Sparkles,
        label: ({ actionRows }) =>
          actionRows.length > 1
            ? `Move ${actionRows.length} prompts to review`
            : "Move prompt to review",
        onSelect: ({ actionRows }) => {
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
    getRowId: (row) => row.id,
    key: "prompts",
    result: promptsQuery,
    searchKey: "search",
  })

  datool.useEntity({
    key: "promptDetail",
    result: promptDetailQuery,
  })

  return (
    <DatoolProvider datool={datool}>
      <main className="w-full flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full flex flex-col items-center mb-6">
          <div className="flex flex-wrap gap-4 items-center mt-4">
            <label className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-black/10 shadow-sm text-black text-sm font-medium">
              <span className="uppercase tracking-widest text-xs text-black/60">Status</span>
              <select
                className="ml-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-black text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-200"
                onChange={(event) => {
                  promptsState.set({
                    status: event.target.value as PromptFilters["status"],
                  })
                }}
                value={promptStatus}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="review">Review</option>
                <option value="draft">Draft</option>
              </select>
            </label>

            <button
              className="flex items-center gap-2 px-4 py-2 rounded-full border bg-transparent border-black/10 text-black/65 hover:bg-white transition justify-center cursor-pointer ghost-button"
              onClick={() => {
                setPrompts(INITIAL_PROMPTS)
                promptDetailState.set({
                  id: INITIAL_STATE.promptDetail.id,
                })
                promptsState.set({
                  search: INITIAL_STATE.prompts.search,
                  status: INITIAL_STATE.prompts.status,
                })
                bumpRevision()
              }}
              type="button"
            >
              <RotateCcw size={16} />
              <span>Reset data</span>
            </button>
          </div>
        </section>

        {/* Data Table Section */}
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel>
            <header className="flex gap-3 items-center px-3 py-2">
              <SearchBar />
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
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            <DetailPanel />
          </ResizablePanel>
          </ResizablePanelGroup>
      </main>
    </DatoolProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DatoolDemo />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
