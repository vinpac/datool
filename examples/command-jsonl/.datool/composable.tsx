/**
 * Example page demonstrating the composable datool API.
 *
 * All data is generated on the client — no server source required.
 * This shows how to use DatoolProvider + individual connected components
 * to build a custom layout.
 */

import * as React from "react"
import {
  DatoolProvider,
  DatoolDataTable,
  SearchFilter,
  ClearButton,
  RefreshButton,
  ErrorMessage,
  type DatoolColumn,
  type DatoolClientConfig,
} from "datool"

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

type WorkflowRow = {
  id: string
  status: "running" | "completed" | "failed" | "queued"
  workflow: string
  duration: number
  startedAt: string
  triggeredBy: string
  branch: string
  commit: string
}

const WORKFLOWS = [
  "deploy-api",
  "run-tests",
  "build-image",
  "lint-check",
  "integration-tests",
  "release-notes",
]
const USERS = ["alice", "bob", "carol", "dave", "eve"]
const BRANCHES = ["main", "feat/auth", "fix/timeout", "refactor/db", "chore/deps"]
const STATUSES: WorkflowRow["status"][] = ["running", "completed", "failed", "queued"]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function generateRows(count: number) {
  const now = Date.now()

  return Array.from({ length: count }, (_, i) => {
    const startedAt = new Date(now - (count - i) * 60_000 - Math.random() * 300_000)
    const id = `run-${String(i + 1).padStart(4, "0")}`

    return {
      __datoolRowId: id,
      id,
      status: randomItem(STATUSES),
      workflow: randomItem(WORKFLOWS),
      duration: Math.round(Math.random() * 300),
      startedAt: startedAt.toISOString(),
      triggeredBy: randomItem(USERS),
      branch: randomItem(BRANCHES),
      commit: Math.random().toString(36).slice(2, 9),
    }
  })
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const config: DatoolClientConfig = {
  pages: [],
  sources: [
    {
      id: "workflows",
      label: "Workflows",
      actions: [],
      supportsGet: false,
      supportsLive: false,
      supportsStream: false,
    },
  ],
  streams: [],
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: DatoolColumn<WorkflowRow>[] = [
  { accessorKey: "id", header: "Run ID", kind: "text", width: 120 },
  {
    accessorKey: "status",
    header: "Status",
    kind: "enum",
    width: 120,
    enumColors: {
      completed: "green",
      failed: "red",
      queued: "zinc",
      running: "sky",
    },
    enumVariant: "outline",
  },
  { accessorKey: "workflow", header: "Workflow", kind: "enum", width: 180 },
  { accessorKey: "duration", header: "Duration (s)", kind: "number", width: 120 },
  { accessorKey: "startedAt", header: "Started At", kind: "date", width: 220 },
  { accessorKey: "triggeredBy", header: "Triggered By", kind: "text", width: 140 },
  { accessorKey: "branch", header: "Branch", kind: "enum", width: 160 },
  { accessorKey: "commit", header: "Commit", kind: "text", width: 100 },
]

// ---------------------------------------------------------------------------
// Generate rows once at module level
// ---------------------------------------------------------------------------

const workflowRows = generateRows(200)

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const title = "Composable API"

export default function ComposableExamplePage() {
  return (
    <DatoolProvider
      config={config}
      defaultSource="workflows"
      sources={{ workflows: { rows: workflowRows } }}
    >
      <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden bg-background pt-3">
        <header className="flex w-full flex-wrap items-start justify-between gap-3 px-4">
          <SearchFilter />
          <RefreshButton />
          <ClearButton />
        </header>

        <ErrorMessage />

        <DatoolDataTable columns={columns as DatoolColumn[]} />
      </main>
    </DatoolProvider>
  )
}
