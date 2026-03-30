"use client"

import { SidebarTrigger } from "./ui/sidebar"
import { SettingsButton } from "./viewer-settings"
import { ClearButton } from "./clear-button"
import { ErrorMessage } from "./error-message"
import { LivePlayPause } from "./live-play-pause"
import { DatoolTraceViewer } from "./datool-trace-viewer"
import { DatoolTraceGroupPicker } from "./trace-group-picker"
import { DatoolSourceProvider } from "../providers/datool-source-provider"
import { SearchFilter } from "./search-filter"
import type {
  DatoolTraceSchema,
  DatoolTraceGroupsConfig,
} from "../trace-types"

function TracePageHeader() {
  return (
    <header className="flex w-full flex-wrap items-start justify-between gap-3 px-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
        <SidebarTrigger className="shrink-0" />
        <SearchFilter placeholder="Search spans..." />
        <DatoolTraceGroupPicker />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ClearButton label="Clear trace rows" />
        <LivePlayPause />
        <SettingsButton />
      </div>
    </header>
  )
}

export function TracePageView<
  Row extends Record<string, unknown>,
  GroupRow extends Record<string, unknown> = never,
>({
  groups,
  schema,
  source,
}: {
  groups?: DatoolTraceGroupsConfig<GroupRow, Row>
  schema: DatoolTraceSchema<Row>
  source: string
}) {
  return (
    <DatoolSourceProvider source={source}>
      <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden bg-background pt-3">
        <TracePageHeader />
        <ErrorMessage />
        <DatoolTraceViewer
          groups={groups}
          schema={schema as DatoolTraceSchema<Record<string, unknown>>}
        />
      </main>
    </DatoolSourceProvider>
  )
}
