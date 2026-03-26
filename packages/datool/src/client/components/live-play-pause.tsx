"use client"

import * as React from "react"
import {
  LoaderCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
} from "lucide-react"

import { Button } from "./ui/button"
import { useDatoolSourceContext } from "../providers/datool-source-context"

export function LivePlayPause({
  className,
}: {
  className?: string
}) {
  const {
    canLiveUpdate,
    isConnected,
    isConnecting,
    setShouldConnect,
  } = useDatoolSourceContext()

  return (
    <Button
      aria-label={isConnected ? "Pause live updates" : "Resume live updates"}
      className={className ?? "gap-2"}
      disabled={!canLiveUpdate}
      onClick={() => setShouldConnect((current) => !current)}
      size="xl"
      type="button"
      variant="outline"
    >
      {isConnecting ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : isConnected ? (
        <StopCircleIcon className="size-4" />
      ) : (
        <PlayCircleIcon className="size-4" />
      )}
      Live
    </Button>
  )
}
