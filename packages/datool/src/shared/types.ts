export type DatoolColumnKind =
  | "text"
  | "enum"
  | "number"
  | "boolean"
  | "date"
  | "json"

export const DATOOL_ENUM_BADGE_COLORS = [
  "emerald",
  "purple",
  "sky",
  "pink",
  "red",
  "zinc",
  "lime",
  "violet",
  "fuchsia",
  "teal",
  "amber",
  "rose",
  "orange",
  "cyan",
  "indigo",
  "yellow",
  "green",
  "coral",
  "blue",
  "stone",
] as const

export const LOG_VIEWER_ACTION_BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

export const LOG_VIEWER_ACTION_BUTTON_SIZES = [
  "default",
  "xs",
  "sm",
  "lg",
  "xl",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
  "icon-xl",
] as const

export const LOG_VIEWER_ICON_NAMES = [
  "Ban",
  "Check",
  "CircleAlert",
  "Copy",
  "Download",
  "ExternalLink",
  "Filter",
  "Info",
  "Play",
  "RefreshCcw",
  "Search",
  "Trash",
  "X",
] as const

export type DatoolActionButtonVariant =
  (typeof LOG_VIEWER_ACTION_BUTTON_VARIANTS)[number]

export type DatoolActionButtonSize =
  (typeof LOG_VIEWER_ACTION_BUTTON_SIZES)[number]

export type DatoolIconName = (typeof LOG_VIEWER_ICON_NAMES)[number]
export type DatoolEnumBadgeColor = (typeof DATOOL_ENUM_BADGE_COLORS)[number]
export type DatoolEnumColorMap = Partial<
  Record<string, DatoolEnumBadgeColor>
>

export type DatoolActionButtonConfig =
  | false
  | DatoolActionButtonVariant
  | {
      className?: string
      label?: string
      size?: DatoolActionButtonSize
      variant?: DatoolActionButtonVariant
    }

export type DatoolDateFormat = Intl.DateTimeFormatOptions

export type DatoolColumn = {
  accessorKey: string
  align?: "left" | "center" | "right"
  enumColors?: DatoolEnumColorMap
  header?: string
  id?: string
  kind?: DatoolColumnKind
  maxWidth?: number
  minWidth?: number
  truncate?: boolean
  width?: number
}

export type DatoolOpenContext = {
  emit: (line: string) => void
  query: URLSearchParams
  signal: AbortSignal
}

export type DatoolParseLineContext = {
  line: string
  query: URLSearchParams
  streamId: string
}

export type DatoolGetRowIdContext<Row extends Record<string, unknown>> = {
  index: number
  line: string
  query: URLSearchParams
  row: Row
  streamId: string
}

export type DatoolActionResolveContext<Row extends Record<string, unknown>> = {
  actionId: string
  query: URLSearchParams
  rows: Row[]
  streamId: string
}

export type DatoolActionRowChange<Row extends Record<string, unknown>> =
  | Row
  | boolean
  | null
  | void

export type DatoolActionResolveResult<Row extends Record<string, unknown>> =
  | DatoolActionRowChange<Row>[]
  | boolean
  | null
  | void

export type DatoolAction<Row extends Record<string, unknown>> = {
  button?: DatoolActionButtonConfig
  icon?: DatoolIconName
  label: string
  resolve: (
    context: DatoolActionResolveContext<Row>
  ) =>
    | DatoolActionResolveResult<Row>
    | Promise<DatoolActionResolveResult<Row>>
}

export type DatoolStream<Row extends Record<string, unknown>> = {
  actions?: Record<string, DatoolAction<Row>>
  columns: DatoolColumn[]
  getRowId?: (
    context: DatoolGetRowIdContext<Row>
  ) => string | Promise<string>
  label: string
  open: (
    context: DatoolOpenContext
  ) => void | Promise<void> | (() => void | Promise<void>)
  parseLine: (
    context: DatoolParseLineContext
  ) => Row | null | Promise<Row | null>
}

export type DatoolConfig = {
  dateFormat?: DatoolDateFormat
  server?: {
    host?: string
    port?: number
  }
  streams: Record<string, DatoolStream<Record<string, unknown>>>
}

export type DatoolSource = Pick<
  DatoolStream<Record<string, unknown>>,
  "open"
>

export type DatoolClientStream = {
  actions: DatoolClientAction[]
  columns: DatoolColumn[]
  id: string
  label: string
}

export type DatoolClientAction = {
  button?: DatoolActionButtonConfig
  icon?: DatoolIconName
  id: string
  label: string
}

export type DatoolClientConfig = {
  dateFormat?: DatoolDateFormat
  streams: DatoolClientStream[]
}

export type DatoolRowEvent = {
  id: string
  row: Record<string, unknown>
}

export type DatoolSseErrorEvent = {
  message: string
}

export type DatoolSseEndEvent = {
  reason: "completed" | "error"
}

export type DatoolActionRequest = {
  rows: Record<string, unknown>[]
}

export type DatoolActionResponse = {
  rowChanges?: Array<Record<string, unknown> | boolean>
}
