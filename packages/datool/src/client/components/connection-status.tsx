import { cn } from "@/lib/utils"

type ConnectionStatusProps = {
  isConnected: boolean
  isConnecting: boolean
  className?: string
}

export function ConnectionStatus({
  isConnected,
  isConnecting,
  className,
}: ConnectionStatusProps) {
  const status = isConnected
    ? {
        dotClassName: "bg-emerald-500",
        label: "Connected",
        textClassName: "text-emerald-600 dark:text-emerald-400",
      }
      : isConnecting
      ? {
          dotClassName: "bg-amber-500",
          label: "Connecting",
          textClassName: "text-amber-600 dark:text-amber-400",
        }
      : {
          dotClassName: "bg-muted-foreground/60",
          label: "Disconnected",
          textClassName: "text-muted-foreground",
        }

  return (
    <div
      className={cn("inline-flex items-center gap-2 text-xs font-medium", className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", status.dotClassName)}
      />
      <span className={status.textClassName}>{status.label}</span>
    </div>
  )
}
