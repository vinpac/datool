import type { Trace } from "@/components/ui/datool/trace-viewer"

type TraceStatus = "healthy" | "degraded" | "critical"

export type TraceScenario = {
  durationMs: number
  environment: string
  id: string
  release: string
  route: string
  service: string
  startedAt: string
  status: TraceStatus
  summary: string
  title: string
  trace: Trace
}

type EventInput = {
  attributes?: Record<string, unknown>
  atMs: number
  color?: string
  name: string
  showVerticalLine?: boolean
}

type SpanInput = {
  activeStartMs?: number
  attributes?: Record<string, unknown>
  endMs: number
  events?: EventInput[]
  id: string
  isRunning?: boolean
  kind: number
  name: string
  parentId?: string
  resource: string
  startMs: number
  statusCode?: number
}

const toHighRes = (epochMs: number): [number, number] => [
  Math.floor(epochMs / 1000),
  (epochMs % 1000) * 1_000_000,
]

const createEvent = (traceStartMs: number, event: EventInput) => ({
  attributes: event.attributes ?? {},
  ...(event.color ? { color: event.color } : {}),
  name: event.name,
  ...(event.showVerticalLine === false
    ? { showVerticalLine: false }
    : {}),
  timestamp: toHighRes(traceStartMs + event.atMs),
})

const createSpan = (traceStartMs: number, span: SpanInput) => {
  const startTime = traceStartMs + span.startMs
  const endTime = traceStartMs + span.endMs

  return {
    ...(span.activeStartMs !== undefined
      ? { activeStartTime: toHighRes(traceStartMs + span.activeStartMs) }
      : {}),
    attributes: span.attributes ?? {},
    duration: toHighRes(endTime - startTime),
    endTime: toHighRes(endTime),
    events: (span.events ?? []).map((event) => createEvent(traceStartMs, event)),
    isRunning: span.isRunning,
    kind: span.kind,
    library: {
      name: "observability-demo",
      version: "0.1.0",
    },
    links: [],
    name: span.name,
    parentSpanId: span.parentId,
    resource: span.resource,
    spanId: span.id,
    startTime: toHighRes(startTime),
    status: {
      code: span.statusCode ?? 1,
    },
    traceFlags: 1,
  }
}

const createResources = (
  environment: string,
  release: string,
  services: string[]
) =>
  services.map((serviceName) => ({
    attributes: {
      "deployment.environment": environment,
      "service.name": serviceName,
      "service.version": release,
      "telemetry.sdk.language": "typescript",
    },
    name: serviceName,
  }))

const createScenario = ({
  durationMs,
  environment,
  id,
  release,
  route,
  service,
  spans,
  startedAt,
  status,
  summary,
  title,
}: Omit<TraceScenario, "trace"> & {
  spans: SpanInput[]
}) => {
  const traceStartMs = Date.parse(startedAt)
  const resources = Array.from(new Set(spans.map((span) => span.resource)))

  return {
    durationMs,
    environment,
    id,
    release,
    route,
    service,
    startedAt,
    status,
    summary,
    title,
    trace: {
      resources: createResources(environment, release, resources),
      rootSpanId: spans[0]?.id,
      spans: spans.map((span) => createSpan(traceStartMs, span)),
      traceId: `trace_${id}`,
    },
  } satisfies TraceScenario
}

export const TRACE_SCENARIOS: TraceScenario[] = [
  createScenario({
    durationMs: 2840,
    environment: "prod-us1",
    id: "checkout-retry-storm",
    release: "checkout-web@2026.03.30.2",
    route: "POST /api/payments",
    service: "checkout-web",
    startedAt: "2026-03-30T14:18:12.000Z",
    status: "critical",
    summary:
      "Fraud scoring stretches the request long enough for the payment write to time out, leaving the queue worker to retry the receipt flow.",
    title: "Checkout payment retry storm",
    spans: [
      {
        attributes: {
          "http.method": "POST",
          "http.route": "/api/payments",
          "user.id": "acct_1284",
        },
        endMs: 2840,
        events: [
          {
            atMs: 12,
            name: "request.received",
          },
          {
            atMs: 2826,
            name: "response.sent",
          },
        ],
        id: "checkout-root",
        kind: 2,
        name: "POST /api/payments",
        resource: "checkout-web",
        startMs: 0,
      },
      {
        attributes: {
          "cache.key": "session:acct_1284",
          "cache.layer": "edge",
        },
        endMs: 136,
        events: [
          {
            atMs: 54,
            color: "#f59e0b",
            name: "cache.miss",
          },
        ],
        id: "checkout-session",
        kind: 3,
        name: "session lookup",
        parentId: "checkout-root",
        resource: "edge-cache",
        startMs: 24,
      },
      {
        attributes: {
          "ai.model": "gpt-5.4-mini",
          "ai.provider": "openai",
          "risk.score": 0.82,
        },
        endMs: 1620,
        events: [
          {
            atMs: 210,
            name: "prompt.sent",
          },
          {
            atMs: 692,
            color: "#6366f1",
            name: "first_token",
          },
          {
            atMs: 1192,
            color: "#6366f1",
            name: "tool_call",
            showVerticalLine: false,
          },
        ],
        id: "checkout-fraud",
        kind: 3,
        name: "fraud score",
        parentId: "checkout-root",
        resource: "risk-orchestrator",
        startMs: 144,
      },
      {
        attributes: {
          "peer.service": "stripe",
          "retry.count": 2,
        },
        endMs: 2710,
        events: [
          {
            atMs: 1890,
            color: "#f59e0b",
            name: "retry.started",
          },
          {
            atMs: 2464,
            color: "#ef4444",
            name: "write.timeout",
          },
        ],
        id: "checkout-charge",
        kind: 3,
        name: "charge payment",
        parentId: "checkout-root",
        resource: "payments-api",
        startMs: 1680,
        statusCode: 2,
      },
      {
        attributes: {
          "db.statement": "insert into ledger_entries",
          "db.system": "postgresql",
        },
        endMs: 2640,
        events: [
          {
            atMs: 1982,
            color: "#f59e0b",
            name: "lock.wait",
          },
          {
            atMs: 2574,
            color: "#ef4444",
            name: "query.timeout",
          },
        ],
        id: "checkout-ledger",
        kind: 3,
        name: "write ledger entry",
        parentId: "checkout-charge",
        resource: "ledger-db",
        startMs: 1762,
        statusCode: 2,
      },
      {
        attributes: {
          "messaging.system": "sqs",
          "queue.name": "receipt-emails",
        },
        endMs: 2795,
        events: [
          {
            atMs: 2288,
            name: "message.enqueued",
          },
        ],
        id: "checkout-receipt",
        kind: 3,
        name: "queue receipt email",
        parentId: "checkout-root",
        resource: "queue-worker",
        startMs: 2210,
      },
    ],
  }),
  createScenario({
    durationMs: 4210,
    environment: "prod-eu1",
    id: "assistant-slow-tools",
    release: "assistant-api@2026.03.30.5",
    route: "POST /api/chat",
    service: "assistant-api",
    startedAt: "2026-03-30T14:24:41.000Z",
    status: "degraded",
    summary:
      "The chat request completes, but retrieval and downstream CRM lookup delay the first useful tool result long enough to push total latency over budget.",
    title: "Assistant response with slow downstream tools",
    spans: [
      {
        attributes: {
          "http.method": "POST",
          "http.route": "/api/chat",
          "session.id": "thread_52",
        },
        endMs: 4210,
        events: [
          {
            atMs: 20,
            name: "request.received",
          },
          {
            atMs: 4180,
            name: "response.stream.closed",
          },
        ],
        id: "assistant-root",
        kind: 2,
        name: "POST /api/chat",
        resource: "assistant-api",
        startMs: 0,
      },
      {
        attributes: {
          "vector.index": "customers",
          "vector.query": "renewal risk",
        },
        endMs: 860,
        events: [
          {
            atMs: 380,
            name: "hits.returned",
          },
        ],
        id: "assistant-rag",
        kind: 3,
        name: "retrieve context",
        parentId: "assistant-root",
        resource: "vector-store",
        startMs: 118,
      },
      {
        attributes: {
          "ai.model": "gpt-5.4",
          "stream.mode": "tokens",
        },
        endMs: 3810,
        events: [
          {
            atMs: 1660,
            color: "#6366f1",
            name: "first_token",
          },
          {
            atMs: 2144,
            color: "#6366f1",
            name: "tool_requested",
          },
          {
            atMs: 3650,
            color: "#10b981",
            name: "final_token",
            showVerticalLine: false,
          },
        ],
        id: "assistant-model",
        kind: 3,
        name: "generate response",
        parentId: "assistant-root",
        resource: "openai-gateway",
        startMs: 980,
      },
      {
        activeStartMs: 2320,
        attributes: {
          "crm.accountId": "acme-94",
          "tool.name": "fetch_account_health",
        },
        endMs: 3360,
        events: [
          {
            atMs: 2320,
            color: "#f59e0b",
            name: "tool.started",
          },
          {
            atMs: 3290,
            color: "#10b981",
            name: "tool.completed",
          },
        ],
        id: "assistant-crm",
        kind: 3,
        name: "crm lookup",
        parentId: "assistant-model",
        resource: "crm-proxy",
        startMs: 2140,
      },
      {
        attributes: {
          "cache.key": "customer:acme-94",
        },
        endMs: 3140,
        events: [
          {
            atMs: 2552,
            color: "#f59e0b",
            name: "cache.fill",
          },
        ],
        id: "assistant-crm-cache",
        kind: 3,
        name: "hydrate account cache",
        parentId: "assistant-crm",
        resource: "redis-cache",
        startMs: 2460,
      },
      {
        attributes: {
          "transport": "sse",
        },
        endMs: 4120,
        events: [
          {
            atMs: 3388,
            name: "stream.flush",
          },
        ],
        id: "assistant-sse",
        kind: 3,
        name: "flush stream",
        parentId: "assistant-root",
        resource: "edge-runtime",
        startMs: 3364,
      },
    ],
  }),
  createScenario({
    durationMs: 940,
    environment: "staging",
    id: "search-fast-path",
    release: "search-edge@2026.03.30.1",
    route: "GET /api/search/suggest",
    service: "search-edge",
    startedAt: "2026-03-30T14:31:03.000Z",
    status: "healthy",
    summary:
      "A clean fast-path search request with cache priming, vector suggestions, and a short ranking pass that stays well within budget.",
    title: "Search suggestions fast path",
    spans: [
      {
        attributes: {
          "http.method": "GET",
          "http.route": "/api/search/suggest",
          "query.length": 9,
        },
        endMs: 940,
        events: [
          {
            atMs: 16,
            name: "request.received",
          },
          {
            atMs: 922,
            name: "response.sent",
          },
        ],
        id: "search-root",
        kind: 2,
        name: "GET /api/search/suggest",
        resource: "search-edge",
        startMs: 0,
      },
      {
        attributes: {
          "cache.key": "suggest:vector",
        },
        endMs: 118,
        events: [
          {
            atMs: 70,
            color: "#10b981",
            name: "cache.hit",
          },
        ],
        id: "search-cache",
        kind: 3,
        name: "warm edge cache",
        parentId: "search-root",
        resource: "edge-cache",
        startMs: 18,
      },
      {
        attributes: {
          "vector.index": "suggestions-v3",
        },
        endMs: 484,
        events: [
          {
            atMs: 212,
            name: "neighbors.fetched",
          },
        ],
        id: "search-vector",
        kind: 3,
        name: "vector search",
        parentId: "search-root",
        resource: "vector-store",
        startMs: 124,
      },
      {
        attributes: {
          "ranking.model": "rank-lite",
        },
        endMs: 742,
        events: [
          {
            atMs: 610,
            color: "#10b981",
            name: "topk.ready",
            showVerticalLine: false,
          },
        ],
        id: "search-rank",
        kind: 3,
        name: "rank suggestions",
        parentId: "search-root",
        resource: "ranking-worker",
        startMs: 512,
      },
      {
        attributes: {
          "transport": "json",
        },
        endMs: 892,
        events: [
          {
            atMs: 840,
            name: "payload.serialized",
          },
        ],
        id: "search-respond",
        kind: 3,
        name: "serialize response",
        parentId: "search-root",
        resource: "edge-runtime",
        startMs: 760,
      },
    ],
  }),
]
