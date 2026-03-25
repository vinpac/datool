import * as React from "react"
import {
  ChevronDownIcon,
  LoaderCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
  XIcon,
} from "lucide-react"

import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { ConnectionStatus } from "./connection-status"
import { cn } from "../lib/utils"
import type { DatoolClientSource } from "../../shared/types"

type StreamControlsProps = {
  sources: DatoolClientSource[]
  selectedSourceId: string | null
  isConnected: boolean
  isConnecting: boolean
  canLiveUpdate?: boolean
  isDisabled?: boolean
  canClear?: boolean
  onClear: () => void
  onPause: () => void
  onPlay: () => void
  onSelectSource: (sourceId: string) => void
  className?: string
}

export function StreamControls({
  sources,
  selectedSourceId,
  isConnected,
  isConnecting,
  canLiveUpdate = true,
  isDisabled = false,
  canClear = true,
  onClear,
  onPause,
  onPlay,
  onSelectSource,
  className,
}: StreamControlsProps) {
  const selectedSourceLabel = React.useMemo(() => {
    if (!selectedSourceId) {
      return sources[0]?.label ?? "Select a source"
    }

    return (
      sources.find((source) => source.id === selectedSourceId)?.label ??
      "Select a source"
    )
  }, [selectedSourceId, sources])

  const canOpenMenu = !isDisabled && sources.length > 0
  const canPlay =
    !isDisabled && canLiveUpdate && Boolean(selectedSourceId) && !isConnecting
  const playButtonLabel = isConnected
    ? "Pause live updates"
    : "Resume live updates"

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex min-w-0 h-10 overflow-hidden rounded-md border border-input bg-background",
          className
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-10 min-w-0 border-0 flex-1 justify-between"
              disabled={!canOpenMenu}
            >
              <span className="truncate text-sm">{selectedSourceLabel}</span>
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="max-h-80 max-w-[min(24rem,calc(100vw-2rem))]"
          >
            <div className="px-2 py-1.5">
              <ConnectionStatus
                isConnected={isConnected}
                isConnecting={isConnecting}
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Sources</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={selectedSourceId ?? ""}
              onValueChange={onSelectSource}
            >
              {sources.map((source) => (
                <DropdownMenuRadioItem
                  key={source.id}
                  value={source.id}
                  className="min-h-9 text-sm"
                >
                  {source.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon-xl"
          disabled={!canClear}
          aria-label="Clear rows"
          onClick={onClear}
          className="rounded-full"
        >
          <XIcon className="size-5" />
        </Button>
      </div>

      <Button
        type="button"
        size="xl"
        variant="outline"
        disabled={!canPlay}
        aria-label={playButtonLabel}
        onClick={isConnected ? onPause : onPlay}
        className={
          cn(isConnected ? "border-blue-500 ring-1 ring-blue-500 text-blue-500!" : "",
            "cursor-pointer gap-2"
          )
        }
      >
        <div className={cn("[&_svg]:shrink-0 [&_svg]:size-3",
          isConnecting ? "animate-spin" : ""
        )}>
          {isConnecting ? (
            <LoaderCircleIcon />
          ) : isConnected ? (
            <StopCircleIcon className="[&_rect]:fill-current" />
          ) : (
            <PlayCircleIcon className="[&_path]:fill-current"  />
          )}
        </div>
        Live
      </Button>
    </div>
  )
}
