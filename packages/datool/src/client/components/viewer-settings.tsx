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
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type ViewerSettingsColumn = {
  id: string
  kind?: DataTableColumnKind
  label: string
  visible: boolean
}

type ViewerSettingsProps = {
  columns: ViewerSettingsColumn[]
  groupedColumnIds: string[]
  isDisabled?: boolean
  onExportCsv: () => void
  onExportMarkdown: () => void
  onClearGrouping: () => void
  onToggleGrouping: (columnId: string, grouped: boolean) => void
  onToggleColumn: (columnId: string, visible: boolean) => void
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

export function ViewerSettings({
  columns,
  groupedColumnIds,
  isDisabled = false,
  onExportCsv,
  onExportMarkdown,
  onClearGrouping,
  onToggleGrouping,
  onToggleColumn,
  className,
}: ViewerSettingsProps) {
  const { theme, setTheme } = useTheme()
  const canExport = !isDisabled && columns.length > 0
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
                  onToggleColumn(column.id, checked === true)
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
                onClearGrouping()
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
                  onToggleGrouping(column.id, checked === true)
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        <DropdownMenuItem
          className="min-h-9 text-sm"
          disabled={!canExport}
          onSelect={onExportCsv}
        >
          <DownloadIcon className="size-4 text-muted-foreground" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-9 text-sm"
          disabled={!canExport}
          onSelect={onExportMarkdown}
        >
          <DownloadIcon className="size-4 text-muted-foreground" />
          Export Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
