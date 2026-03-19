import * as React from "react"
import {
  ChevronDownIcon,
  LoaderCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConnectionStatus } from "@/components/connection-status"
import { cn } from "@/lib/utils"
import type { DatoolClientStream } from "../../shared/types"

type StreamControlsProps = {
  streams: DatoolClientStream[]
  selectedStreamId: string | null
  isConnected: boolean
  isConnecting: boolean
  isDisabled?: boolean
  canClear?: boolean
  onClear: () => void
  onPause: () => void
  onPlay: () => void
  onSelectStream: (streamId: string) => void
  className?: string
}

export function StreamControls({
  streams,
  selectedStreamId,
  isConnected,
  isConnecting,
  isDisabled = false,
  canClear = true,
  onClear,
  onPause,
  onPlay,
  onSelectStream,
  className,
}: StreamControlsProps) {
  const selectedStreamLabel = React.useMemo(() => {
    if (!selectedStreamId) {
      return streams[0]?.label ?? "Select a stream"
    }

    return (
      streams.find((stream) => stream.id === selectedStreamId)?.label ??
      "Select a stream"
    )
  }, [selectedStreamId, streams])

  const canOpenMenu = !isDisabled && streams.length > 0
  const canPlay = !isDisabled && Boolean(selectedStreamId) && !isConnecting
  const playButtonLabel = isConnected ? "Pause stream" : "Play stream"

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
              <span className="truncate text-sm">{selectedStreamLabel}</span>
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
            <DropdownMenuLabel>Streams</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={selectedStreamId ?? ""}
              onValueChange={onSelectStream}
            >
              {streams.map((stream) => (
                <DropdownMenuRadioItem
                  key={stream.id}
                  value={stream.id}
                  className="min-h-9 text-sm"
                >
                  {stream.label}
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
