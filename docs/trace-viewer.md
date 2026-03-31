# Trace Viewer

The `trace-viewer` registry item installs a standalone timeline viewer for prebuilt trace payloads.

## Install

```bash
npx shadcn@latest add https://YOUR-DOMAIN/r/trace-viewer.json
```

## Usage

```tsx
import { TraceViewer } from "@/components/trace-viewer"
import type { Trace } from "@/components/trace-viewer/types"

const trace: Trace = {
  rootSpanId: "root",
  traceId: "trace-1",
  spans: [
    {
      attributes: {
        route: "/api/example",
      },
      duration: [2, 500_000_000],
      endTime: [12, 500_000_000],
      events: [],
      kind: 0,
      library: { name: "demo-app" },
      links: [],
      name: "request",
      resource: "http",
      spanId: "root",
      startTime: [10, 0],
      status: { code: 0 },
      traceFlags: 1,
    },
  ],
}

export function ExampleTrace() {
  return <TraceViewer height={640} trace={trace} />
}
```

## Notes

- The component expects a fully built `Trace` object.
- The installed files include the CSS module, worker, and helper utilities required by the viewer.
- See [examples/react-query-demo/app/trace-viewer/page.tsx](/Users/vinpac/lab/vite-app/examples/react-query-demo/app/trace-viewer/page.tsx) for a richer example with fake trace scenarios.
