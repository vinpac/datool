"use client"

import { SidebarTrigger } from "./ui/sidebar"
import { SettingsButton } from "./viewer-settings"
import { ClearButton } from "./clear-button"
import { ErrorMessage } from "./error-message"
import { LivePlayPause } from "./live-play-pause"
import { SearchFilter } from "./search-filter"
import { DatoolDataTable } from "./datool-data-table"
import { DatoolSourceProvider } from "../providers/datool-source-provider"
import type { DatoolDateFormat } from "../../shared/types"
import type { DatoolColumn, DatoolSortingState } from "../table-types"

type ViewerRow = Record<string, unknown> & { __datoolRowId: string }

function TablePageHeader() {
  return (
    <header className="flex w-full flex-wrap items-start justify-between gap-3 px-4">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <SidebarTrigger className="shrink-0" />
        <SearchFilter />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ClearButton />
        <LivePlayPause />
        <SettingsButton />
      </div>
    </header>
  )
}

export function TablePageView({
  columns,
  dateFormat,
  defaultSorting,
  rowClassName,
  rowStyle,
  source,
}: {
  columns: DatoolColumn<ViewerRow>[]
  dateFormat?: DatoolDateFormat
  defaultSorting?: DatoolSortingState
  rowClassName?: (row: ViewerRow) => string | undefined
  rowStyle?: (row: ViewerRow) => React.CSSProperties | undefined
  source: string
}) {
  return (
    <DatoolSourceProvider source={source}>
      <main className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden bg-background pt-3">
        <TablePageHeader />
        <ErrorMessage />
        <DatoolDataTable
          columns={columns}
          dateFormat={dateFormat}
          defaultSorting={defaultSorting}
          rowClassName={rowClassName}
          rowStyle={rowStyle}
        />
      </main>
    </DatoolSourceProvider>
  )
}
