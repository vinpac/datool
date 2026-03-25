const historyCount = Number.parseInt(process.argv[2] ?? "5", 10)

function emit(index: number) {
  const cycle = Math.floor(index / 11)
  const step = index % 11
  const cycleSpacingMs = 2600
  const workflowDurationMs = 2200
  const baseTime = Date.now() - historyCount * 250 + cycle * cycleSpacingMs
  const runId = `run-${cycle + 1}`
  const prepareId = `${runId}:prepare-context`
  const fetchUserId = `${runId}:fetch-user-profile`
  const buildPromptId = `${runId}:build-prompt`
  const runModelId = `${runId}:run-model`
  const parseResultId = `${runId}:parse-structured-response`
  const executeToolsId = `${runId}:execute-tools`
  const queryDbId = `${runId}:query-database`
  const writeAuditId = `${runId}:write-audit-log`
  const finalizeId = `${runId}:finalize`
  const failedRun = cycle % 4 === 3

  const common = {
    payload: {
      attempt: cycle + 1,
      host: "local",
      phase: "running",
    },
    service: "command-jsonl",
  }

  switch (step) {
    case 0:
      console.log(
        JSON.stringify({
          ...common,
          component: "workflow",
          level: "info",
          message: `Workflow Run #${cycle + 1} started`,
          name: "Workflow Run",
          spanId: runId,
          status: "running",
          ts: new Date(baseTime).toISOString(),
          type: "span",
        })
      )
      return
    case 1:
      console.log(
        JSON.stringify({
          ...common,
          component: "step",
          level: "info",
          message: "Preparing execution context",
          name: "Prepare Context",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: "prepare-context",
          },
          spanId: prepareId,
          status: "running",
          ts: new Date(baseTime + 100).toISOString(),
          type: "span",
        })
      )
      return
    case 2:
      console.log(
        JSON.stringify({
          ...common,
          component: "function",
          level: "info",
          message: "Fetched cached user profile",
          name: "fetchUserProfile",
          parentSpanId: prepareId,
          payload: {
            ...common.payload,
            phase: "fetch-user-profile",
          },
          spanId: fetchUserId,
          status: "ok",
          endTs: new Date(baseTime + 320).toISOString(),
          ts: new Date(baseTime + 160).toISOString(),
          type: "span",
        })
      )
      return
    case 3:
      console.log(
        JSON.stringify({
          ...common,
          component: "function",
          level: "info",
          message: "Cache hit for profile payload",
          name: "cache_hit",
          payload: {
            ...common.payload,
            phase: "fetch-user-profile-cache",
          },
          spanId: fetchUserId,
          ts: new Date(baseTime + 240).toISOString(),
          type: "event",
        })
      )
      return
    case 4:
      console.log(
        JSON.stringify({
          ...common,
          component: "step",
          level: "info",
          message: "Context assembled from profile and request state",
          name: "Prepare Context",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: "prepare-context-complete",
          },
          spanId: prepareId,
          status: "ok",
          endTs: new Date(baseTime + 500).toISOString(),
          ts: new Date(baseTime + 100).toISOString(),
          type: "span",
        })
      )
      console.log(
        JSON.stringify({
          ...common,
          component: "step",
          level: "info",
          message: "Prompt composed from workflow state",
          name: "Build Prompt",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: "build-prompt",
          },
          spanId: buildPromptId,
          status: "ok",
          endTs: new Date(baseTime + 860).toISOString(),
          ts: new Date(baseTime + 560).toISOString(),
          type: "span",
        })
      )
      return
    case 5:
      console.log(
        JSON.stringify({
          ...common,
          component: "model",
          level: "info",
          message: "Invoking model for tool selection",
          name: "Tool Planner",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: "run-model",
          },
          spanId: runModelId,
          status: "running",
          ts: new Date(baseTime + 930).toISOString(),
          type: "span",
        })
      )
      return
    case 6:
      console.log(
        JSON.stringify({
          ...common,
          component: "function",
          level: "info",
          message: "Parsed structured model response",
          name: "parseStructuredResponse",
          parentSpanId: runModelId,
          payload: {
            ...common.payload,
            phase: "parse-structured-response",
          },
          spanId: parseResultId,
          status: "ok",
          endTs: new Date(baseTime + 1320).toISOString(),
          ts: new Date(baseTime + 1120).toISOString(),
          type: "span",
        })
      )
      return
    case 7:
      console.log(
        JSON.stringify({
          ...common,
          component: "model",
          level: "info",
          message: "Model finished choosing tool plan",
          name: "Tool Planner",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: "run-model-complete",
          },
          spanId: runModelId,
          status: "ok",
          endTs: new Date(baseTime + 1450).toISOString(),
          ts: new Date(baseTime + 930).toISOString(),
          type: "span",
        })
      )
      console.log(
        JSON.stringify({
          ...common,
          component: "step",
          level: failedRun ? "warn" : "info",
          message: "Executing selected tools",
          name: "Execute Tools",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: "execute-tools",
          },
          spanId: executeToolsId,
          status: "running",
          ts: new Date(baseTime + 1520).toISOString(),
          type: "span",
        })
      )
      return
    case 8:
      console.log(
        JSON.stringify({
          ...common,
          component: "database",
          level: failedRun ? "warn" : "info",
          message: failedRun ? "Database query slowed down by retry" : "Loaded candidate rows from Postgres",
          name: "queryDatabase",
          parentSpanId: executeToolsId,
          payload: {
            ...common.payload,
            phase: "query-database",
          },
          spanId: queryDbId,
          status: "ok",
          endTs: new Date(baseTime + 1840).toISOString(),
          ts: new Date(baseTime + 1600).toISOString(),
          type: "span",
        })
      )
      return
    case 9:
      console.log(
        JSON.stringify({
          ...common,
          component: "function",
          level: failedRun ? "error" : "info",
          message: failedRun ? "Audit writer threw during serialization" : "Persisted audit log entry",
          name: "writeAuditLog",
          parentSpanId: executeToolsId,
          payload: {
            ...common.payload,
            phase: failedRun ? "write-audit-log-error" : "write-audit-log",
          },
          spanId: writeAuditId,
          status: failedRun ? "error" : "ok",
          endTs: new Date(baseTime + 1980).toISOString(),
          ts: new Date(baseTime + 1860).toISOString(),
          type: "span",
        })
      )
      return
    default:
      console.log(
        JSON.stringify({
          ...common,
          component: "step",
          level: failedRun ? "error" : "info",
          message: failedRun ? "Tool execution aborted after audit logging failure" : "All selected tools completed",
          name: "Execute Tools",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: failedRun ? "execute-tools-error" : "execute-tools-complete",
          },
          spanId: executeToolsId,
          status: failedRun ? "error" : "ok",
          endTs: new Date(baseTime + 2050).toISOString(),
          ts: new Date(baseTime + 1520).toISOString(),
          type: "span",
        })
      )
      console.log(
        JSON.stringify({
          ...common,
          component: "step",
          level: failedRun ? "error" : "info",
          message: failedRun ? `Workflow Run #${cycle + 1} failed during audit logging` : `Workflow Run #${cycle + 1} completed successfully`,
          name: "Finalize",
          parentSpanId: runId,
          payload: {
            ...common.payload,
            phase: failedRun ? "finalize-error" : "finalize",
          },
          spanId: finalizeId,
          status: failedRun ? "error" : "ok",
          endTs: new Date(baseTime + 2180).toISOString(),
          ts: new Date(baseTime + 2060).toISOString(),
          type: "span",
        })
      )
      console.log(
        JSON.stringify({
          ...common,
          component: "workflow",
          level: failedRun ? "error" : "info",
          message: failedRun ? `Workflow Run #${cycle + 1} failed` : `Workflow Run #${cycle + 1} completed`,
          name: "Workflow Run",
          payload: {
            ...common.payload,
            phase: failedRun ? "failed" : "completed",
          },
          spanId: runId,
          status: failedRun ? "error" : "ok",
          endTs: new Date(baseTime + workflowDurationMs).toISOString(),
          ts: new Date(baseTime).toISOString(),
          type: "span",
        })
      )
  }
}

for (let index = 0; index < historyCount; index += 1) {
  emit(index)
}

let nextIndex = historyCount

const interval = setInterval(() => {
  emit(nextIndex)
  nextIndex += 1
}, 250)

process.on("SIGTERM", () => {
  clearInterval(interval)
  process.exit(0)
})
