import { flexRender, type Header } from "@tanstack/react-table"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, Search } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

import {
  DataTableColIcon,
  type DataTableColumnKind,
} from "./data-table-col-icon"
import type {
  DatoolDateFormat,
  DatoolEnumColorMap,
} from "./shared/types"
import { cn } from "./lib/utils"

export type DataTableAlign = "left" | "center" | "right"

export type DataTableColumnMeta = {
  align?: DataTableAlign
  cellClassName?: string
  dateFormat?: DatoolDateFormat
  enumColors?: DatoolEnumColorMap
  enumOptions?: string[]
  enumVariant?: "default" | "outline"
  headerClassName?: string
  highlightMatches?: boolean
  kind?: DataTableColumnKind
  sticky?: "left"
  truncate?: boolean
}

function getAlignmentClassName(align: DataTableAlign = "left") {
  switch (align) {
    case "center":
      return "justify-center text-center"
    case "right":
      return "justify-end text-right"
    default:
      return "justify-start text-left"
  }
}

function HeaderSortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUp className="size-3.5 text-foreground" />
  }

  if (sorted === "desc") {
    return <ArrowDown className="size-3.5 text-foreground" />
  }

  return null
}

export function DataTableHeaderCol<TData>({
  header,
  highlightEnabled = false,
  onToggleHighlight,
  paddingLeft,
  paddingRight,
  reorderable = false,
  scrollContainerRef,
}: {
  header: Header<TData, unknown>
  highlightEnabled?: boolean
  onToggleHighlight?: () => void
  paddingLeft?: React.CSSProperties["paddingLeft"]
  paddingRight?: React.CSSProperties["paddingRight"]
  reorderable?: boolean
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const meta = (header.column.columnDef.meta ?? {}) as DataTableColumnMeta
  const sorted = header.column.getIsSorted()
  const canSort = header.column.getCanSort()
  const alignmentClassName = getAlignmentClassName(meta.align)
  const isSticky = meta.sticky === "left"
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !reorderable,
    id: header.column.id,
  })
  const style = React.useMemo(
    () => ({
      maxWidth: header.getSize(),
      minWidth: header.getSize(),
      transform: transform
        ? CSS.Transform.toString({
            ...transform,
            scaleX: 1,
            scaleY: 1,
          })
        : undefined,
      transition,
      width: header.getSize(),
    }),
    [header, transform, transition]
  )

  return (
    <th
      className={cn(
        "relative flex shrink-0 border-b border-gray-300 bg-background py-2 align-middle text-xs font-medium tracking-wide text-muted-foreground uppercase dark:border-border",
        isSticky && "sticky left-0 z-20 border-r border-r-border bg-background",
        isDragging && "z-30 opacity-70 shadow-sm",
        meta.headerClassName
      )}
      ref={setNodeRef}
      style={style}
    >
      {header.isPlaceholder ? null : canSort ? (
        <div className="flex w-full min-w-0 items-center gap-1">
          <button
            {...(reorderable ? attributes : {})}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              reorderable && "cursor-grab active:cursor-grabbing",
              alignmentClassName
            )}
            {...(reorderable ? listeners : {})}
            onClick={header.column.getToggleSortingHandler()}
            style={{
              paddingLeft,
              paddingRight,
            }}
            type="button"
          >
            {meta.kind && meta.kind !== "selection" ? (
              <DataTableColIcon
                className="size-3.5 shrink-0 text-muted-foreground"
                kind={meta.kind}
              />
            ) : null}
            <span className="truncate font-medium text-foreground normal-case">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
            <HeaderSortIcon sorted={sorted} />
          </button>
        </div>
      ) : (
        <div
          {...(reorderable ? attributes : {})}
          className={cn(
            "flex w-full min-w-0 items-center gap-1 px-0.5 py-1",
            reorderable && "cursor-grab active:cursor-grabbing",
            alignmentClassName
          )}
          {...(reorderable ? listeners : {})}
          style={{
            paddingLeft,
            paddingRight,
          }}
        >
          {meta.kind && meta.kind !== "selection" ? (
            <DataTableColIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              kind={meta.kind}
            />
          ) : null}
          <span className="truncate font-medium text-foreground normal-case">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {meta.kind === "text" && onToggleHighlight ? (
            <button
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-sm border",
                highlightEnabled
                  ? "border-border bg-accent text-accent-foreground"
                  : "border-transparent text-muted-foreground"
              )}
              onClick={onToggleHighlight}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              <Search className="size-3" />
            </button>
          ) : null}
        </div>
      )}
      {header.column.getCanResize() ? (
        <ResizeHandler
          header={header}
          scrollContainerRef={scrollContainerRef}
        />
      ) : null}
    </th>
  )
}

function ResizeHandler<TData>({
  header,
  scrollContainerRef,
}: {
  header: Header<TData, unknown>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const isResizing = header.column.getIsResizing()
  const handleRef = React.useRef<HTMLDivElement>(null)
  const [overlayBounds, setOverlayBounds] = React.useState<{
    bottom: number
    left: number
    top: number
  } | null>(null)
  const transform = isResizing
    ? `translateX(${
        header.getContext().table.getState().columnSizingInfo.deltaOffset ?? 0
      }px)`
    : ""

  React.useLayoutEffect(() => {
    if (!isResizing || !handleRef.current || !scrollContainerRef.current) {
      setOverlayBounds(null)
      return
    }

    const updateBounds = () => {
      if (!handleRef.current || !scrollContainerRef.current) {
        return
      }

      const handleBounds = handleRef.current.getBoundingClientRect()
      const containerBounds = scrollContainerRef.current.getBoundingClientRect()

      setOverlayBounds({
        bottom: Math.max(window.innerHeight - containerBounds.bottom, 0),
        left: handleBounds.left,
        top: containerBounds.top,
      })
    }

    updateBounds()
    window.addEventListener("resize", updateBounds)

    return () => window.removeEventListener("resize", updateBounds)
  }, [isResizing, scrollContainerRef])

  return (
    <>
      {isResizing && overlayBounds
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] w-1 animate-in cursor-col-resize bg-border transition-colors duration-75 zoom-in-50"
              style={{
                bottom: overlayBounds.bottom,
                left: overlayBounds.left,
                top: overlayBounds.top,
                transform,
              }}
            />,
            document.body
          )
        : null}
      <div
        ref={handleRef}
        className={cn(
          "absolute top-0 right-[-2px] z-[100] h-full w-1 cursor-col-resize touch-none rounded-full bg-border opacity-0 transition-opacity select-none hover:opacity-100",
          isResizing && "opacity-100"
        )}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
      />
    </>
  )
}
