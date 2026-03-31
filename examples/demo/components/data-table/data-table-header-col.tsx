import { flexRender, type Header } from "@tanstack/react-table"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, Search } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

import { DataTableColIcon } from "./data-table-col-icon"
import type { DataTableAlign, DataTableColumnMeta } from "./types"
import { cn } from "@/lib/utils"

export type { DataTableAlign, DataTableColumnMeta } from "./types"

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
        "border-gray-300 bg-background py-2 text-xs font-medium tracking-wide text-muted-foreground dark:border-border relative flex shrink-0 border-b align-middle uppercase",
        isSticky && "left-0 border-r-border bg-background sticky z-20 border-r",
        isDragging && "shadow-sm z-30 opacity-70",
        meta.headerClassName
      )}
      ref={setNodeRef}
      style={style}
    >
      {header.isPlaceholder ? null : canSort ? (
        <div className="min-w-0 gap-1 flex w-full items-center">
          <button
            {...(reorderable ? attributes : {})}
            className={cn(
              "min-w-0 gap-1.5 rounded-md px-2 py-1 hover:bg-accent focus-visible:ring-ring/50 flex flex-1 items-center transition-colors focus-visible:ring-2 focus-visible:outline-none",
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
                className="size-3.5 text-muted-foreground shrink-0"
                kind={meta.kind}
              />
            ) : null}
            <span className="font-medium text-foreground truncate normal-case">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
            <HeaderSortIcon sorted={sorted} />
          </button>
        </div>
      ) : (
        <div
          {...(reorderable ? attributes : {})}
          className={cn(
            "min-w-0 gap-1 px-0.5 py-1 flex w-full items-center",
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
              className="size-3.5 text-muted-foreground shrink-0"
              kind={meta.kind}
            />
          ) : null}
          <span className="font-medium text-foreground truncate normal-case">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {meta.kind === "text" && onToggleHighlight ? (
            <button
              className={cn(
                "size-5 rounded-sm inline-flex items-center justify-center border",
                highlightEnabled
                  ? "border-border bg-accent text-accent-foreground"
                  : "text-muted-foreground border-transparent"
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
              className="w-1 animate-in bg-border zoom-in-50 pointer-events-none fixed z-[100] cursor-col-resize transition-colors duration-75"
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
          "top-0 w-1 bg-border absolute right-[-2px] z-[100] h-full cursor-col-resize touch-none rounded-full opacity-0 transition-opacity select-none hover:opacity-100",
          isResizing && "opacity-100"
        )}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
      />
    </>
  )
}
