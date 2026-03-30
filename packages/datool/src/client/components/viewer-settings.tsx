import * as React from "react"
import {
  DownloadIcon,
  EllipsisIcon,
  LayoutGridIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
} from "lucide-react"

import {
  DataTableColIcon,
  type DataTableColumnKind,
} from "./data-table-col-icon"
import { type Theme, useTheme } from "./theme-provider"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { cn } from "../lib/utils"
import { useOptionalDatoolSourceContext } from "../providers/datool-source-context"

type ViewerSettingsColumn = {
  id: string
  kind?: DataTableColumnKind
  label: string
  visible: boolean
}

type ViewerSettingsExportAction = {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
}

type ViewerSettingsMenuProps = {
  columns?: ViewerSettingsColumn[]
  groupedColumnIds?: string[]
  isDisabled?: boolean
  exportActions?: ViewerSettingsExportAction[]
  onClearGrouping?: () => void
  onToggleGrouping?: (columnId: string, grouped: boolean) => void
  onToggleColumn?: (columnId: string, visible: boolean) => void
  className?: string
}

export type SettingsButtonProps = {
  className?: string
}

const THEME_OPTIONS: Array<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: Theme
}> = [
  {
    icon: SunIcon,
    label: "Light",
    value: "light",
  },
  {
    icon: MoonIcon,
    label: "Dark",
    value: "dark",
  },
  {
    icon: Settings2Icon,
    label: "System",
    value: "system",
  },
]

function ViewerSettingsMenu({
  columns = [],
  groupedColumnIds = [],
  isDisabled = false,
  exportActions = [],
  onClearGrouping,
  onToggleGrouping,
  onToggleColumn,
  className,
}: ViewerSettingsMenuProps) {
  const { theme, setTheme } = useTheme()
  const canManageColumns = columns.length > 0 && typeof onToggleColumn === "function"
  const canManageGrouping =
    columns.length > 0 &&
    typeof onClearGrouping === "function" &&
    typeof onToggleGrouping === "function"
  const groupedLabels = React.useMemo(
    () =>
      groupedColumnIds.flatMap((columnId) => {
        const column = columns.find((candidate) => candidate.id === columnId)

        return column ? [column.label] : []
      }),
    [columns, groupedColumnIds]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-xl"
          disabled={isDisabled}
          className={cn("shrink-0", className)}
          aria-label="Open settings"
        >
          <EllipsisIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 max-w-[min(24rem,calc(100vw-2rem))]"
      >
        <DropdownMenuLabel>View</DropdownMenuLabel>
        {canManageColumns ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-9 text-sm">
              <Settings2Icon className="size-4 text-muted-foreground" />
              Columns
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.visible}
                  className="min-h-9 text-sm"
                  onSelect={(event) => {
                    event.preventDefault()
                  }}
                  onCheckedChange={(checked) =>
                    onToggleColumn?.(column.id, checked === true)
                  }
                >
                  <span className="flex min-w-0 items-center gap-2 pr-4">
                    {column.kind ? (
                      <DataTableColIcon
                        kind={column.kind}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                    <span className="truncate">{column.label}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {canManageGrouping ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="min-h-9 text-sm"
              disabled={isDisabled || columns.length === 0}
            >
              <LayoutGridIcon className="size-4 text-muted-foreground" />
              Group rows
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
              <DropdownMenuLabel>
                {groupedLabels.length > 0
                  ? `Grouped by ${groupedLabels.join(", ")}`
                  : "Group rows by field"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-9 text-sm"
                disabled={groupedColumnIds.length === 0}
                onSelect={(event) => {
                  event.preventDefault()
                  onClearGrouping?.()
                }}
              >
                Clear grouping
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={groupedColumnIds.includes(column.id)}
                  className="min-h-9 text-sm"
                  onSelect={(event) => {
                    event.preventDefault()
                  }}
                  onCheckedChange={(checked) =>
                    onToggleGrouping?.(column.id, checked === true)
                  }
                >
                  <span className="flex min-w-0 items-center gap-2 pr-4">
                    {column.kind ? (
                      <DataTableColIcon
                        kind={column.kind}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                    <span className="truncate">{column.label}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="min-h-9 text-sm">
            <SunIcon className="size-4 text-muted-foreground dark:hidden" />
            <MoonIcon className="hidden size-4 text-muted-foreground dark:block" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as Theme)}
            >
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon

                return (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className="min-h-9 text-sm"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {option.label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {exportActions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            {exportActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                className="min-h-9 text-sm"
                disabled={isDisabled || action.disabled}
                onSelect={action.onSelect}
              >
                <DownloadIcon className="size-4 text-muted-foreground" />
                {action.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SettingsButton({ className }: SettingsButtonProps) {
  const sourceContext = useOptionalDatoolSourceContext()
  const table = sourceContext?.table ?? null
  const trace = sourceContext?.trace ?? null
  const rows = sourceContext?.rows ?? []
  const activeSource = sourceContext?.sourceConfig ?? null

  const exportActions = React.useMemo<ViewerSettingsExportAction[]>(() => {
    if (table) {
      return [
        {
          id: "csv",
          label: "Export CSV",
          onSelect: () => table.handleExport("csv"),
        },
        {
          id: "markdown",
          label: "Export Markdown",
          onSelect: () => table.handleExport("md"),
        },
      ]
    }

    if (trace) {
      return [
        {
          id: "raw-data",
          label: "Export Raw Data",
          disabled: trace.rawRowCount === 0,
          onSelect: trace.handleExportRawData,
        },
        {
          id: "trace-data",
          label: "Export Trace Data",
          disabled: !trace.hasTrace,
          onSelect: trace.handleExportTraceData,
        },
      ]
    }

    return []
  }, [table, trace])

  return (
    <ViewerSettingsMenu
      className={className}
      columns={table?.settingsColumns}
      exportActions={exportActions}
      groupedColumnIds={table?.groupedColumnIds}
      isDisabled={
        table
          ? !activeSource
          : trace
            ? rows.length === 0 && !trace.hasTrace
            : false
      }
      onClearGrouping={
        table ? () => table.setGroupedColumnIds([]) : undefined
      }
      onToggleColumn={
        table
          ? (columnId, visible) =>
              table.setColumnVisibility((current) => ({
                ...current,
                [columnId]: visible,
              }))
          : undefined
      }
      onToggleGrouping={
        table
          ? (columnId, grouped) =>
              table.setGroupedColumnIds((current) =>
                grouped
                  ? current.includes(columnId)
                    ? current
                    : [...current, columnId]
                  : current.filter((id) => id !== columnId)
              )
          : undefined
      }
    />
  )
}

export const ViewerSettings = SettingsButton
