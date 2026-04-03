"use client"

import * as React from "react"
import Link from "next/link"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { ArrowRight, ExternalLink } from "lucide-react"

import {
  ClearButton,
  DatoolProvider,
  DatoolTraceViewer,
  ErrorMessage,
  RefreshButton,
  SearchBar,
  useDatool,
} from "@/components/ui/datool/core"
import type { GetQuickLinks, Span } from "@/components/ui/datool/trace-viewer/types"

import { TRACE_SCENARIOS, type TraceScenario } from "./fake-traces"
import styles from "./page.module.css"

type TraceFilters = {
  id: string
  search: string
}

const queryClient = new QueryClient()

const INITIAL_STATE = {
  trace: {
    id: TRACE_SCENARIOS[0]?.id ?? "",
    search: "",
  },
}

const formatDuration = (durationMs: number) =>
  durationMs >= 1000
    ? `${(durationMs / 1000).toFixed(durationMs >= 2000 ? 1 : 2)}s`
    : `${durationMs}ms`

const formatStartedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value))

function TraceViewerDemo() {
  const datool = useDatool({
    defaultQuery: "trace",
    initialState: INITIAL_STATE,
  })
  const traceState = datool.slice("trace")
  const activeTraceId = traceState.use((state) => state.id)

  const traceQuery = useQuery({
    queryFn: async () =>
      TRACE_SCENARIOS.find((scenario) => scenario.id === activeTraceId) ??
      TRACE_SCENARIOS[0],
    queryKey: ["trace", activeTraceId],
  })

  const activeTrace = traceQuery.data

  const getQuickLinks = React.useCallback(
    (span: Span) => {
      if (!activeTrace) {
        return []
      }

      return [
        {
          key: "Logs",
          value: Promise.resolve({
            href: `https://observability.example.com/logs/${activeTrace.id}?span=${span.spanId}`,
            label: "Open logs",
          }),
        },
        {
          key: "Deployment",
          value: Promise.resolve({
            href: `https://deployments.example.com/${activeTrace.release}`,
            label: activeTrace.release,
          }),
        },
        {
          key: "Trace JSON",
          value: Promise.resolve({
            href: `https://observability.example.com/traces/${activeTrace.trace.traceId}`,
            label: "Raw trace payload",
          }),
        },
      ]
    },
    [activeTrace]
  )

  datool.useCollection({
    getRowId: (row: Span) => row.spanId,
    getRows: (scenario) => scenario?.trace.spans ?? [],
    key: "trace",
    result: traceQuery,
    searchKey: "search",
  })

  if (!activeTrace) {
    return null
  }

  return (
    <DatoolProvider datool={datool}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <p className={styles.eyebrow}>Registry Demo</p>
              <h1 className={styles.title}>Trace viewer with fake data</h1>
              <p className={styles.copy}>
                This route uses the registry-installed trace viewer component
                through the shared datool toolbar. Pick a synthetic trace,
                search spans from the shared header, and open the built-in
                detail panel to inspect attributes and events.
              </p>
            </div>

            <div className={styles.heroLinks}>
              <Link className={styles.heroLink} href="/">
                Prompt workspace
                <ArrowRight size={16} />
              </Link>
              <a
                className={styles.heroLink}
                href="https://ui.shadcn.com"
                rel="noreferrer"
                target="_blank"
              >
                Registry pattern
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Trace Scenarios</p>
              <p className={styles.statValue}>{TRACE_SCENARIOS.length}</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Selected Trace</p>
              <p className={styles.statValue}>
                {formatDuration(activeTrace.durationMs)}
              </p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Span Count</p>
              <p className={styles.statValue}>{activeTrace.trace.spans.length}</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Environment</p>
              <p className={styles.statValue}>{activeTrace.environment}</p>
            </div>
          </div>
        </section>

        <section className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitle}>Sample traces</h2>
              <p className={styles.sidebarCopy}>
                Each card swaps the viewer over to a different trace shape and
                failure mode.
              </p>
            </div>

            <div className={styles.traceList}>
              {TRACE_SCENARIOS.map((scenario) => (
                <button
                  className={styles.traceButton}
                  data-active={scenario.id === activeTrace.id}
                  key={scenario.id}
                  onClick={() => {
                    traceState.set({ id: scenario.id })
                  }}
                  type="button"
                >
                  <div className={styles.traceButtonTop}>
                    <h3 className={styles.traceName}>{scenario.title}</h3>
                    <span className={styles.badge} data-tone={scenario.status}>
                      {scenario.status}
                    </span>
                  </div>

                  <p className={styles.traceSummary}>{scenario.summary}</p>

                  <div className={styles.traceMeta}>
                    <span className={styles.chip}>{scenario.service}</span>
                    <span className={styles.chip}>{scenario.route}</span>
                    <span className={styles.metaText}>
                      {formatStartedAt(scenario.startedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className={styles.viewerCard}>
            <header className={styles.viewerHeader}>
              <div className={styles.viewerTitleRow}>
                <div>
                  <p className={styles.eyebrow}>Selected Trace</p>
                  <h2 className={styles.viewerTitle}>{activeTrace.title}</h2>
                  <p className={styles.viewerCopy}>{activeTrace.summary}</p>
                </div>

                <div className={styles.viewerMeta}>
                  <span className={styles.badge} data-tone={activeTrace.status}>
                    {activeTrace.status}
                  </span>
                  <span className={styles.chip}>{activeTrace.service}</span>
                  <span className={styles.chip}>{activeTrace.route}</span>
                  <span className={styles.chip}>{activeTrace.release}</span>
                  <span className={styles.metaText}>
                    Started {formatStartedAt(activeTrace.startedAt)}
                  </span>
                </div>
              </div>
            </header>

            <header className="toolbar">
              <SearchBar placeholder="Search spans..." />
              <RefreshButton />
              <ClearButton />
            </header>

            <ErrorMessage />

            <DatoolTraceViewer
              className={styles.viewer}
              getTrace={(scenario: TraceScenario | undefined) => scenario?.trace}
              getQuickLinks={getQuickLinks}
              height="min(78vh, 820px)"
            />
          </div>
        </section>
      </main>
    </DatoolProvider>
  )
}

export default function TraceViewerPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <TraceViewerDemo />
    </QueryClientProvider>
  )
}
