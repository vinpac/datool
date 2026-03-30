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
export type DatoolEnumColorMap = Partial<Record<string, DatoolEnumBadgeColor>>

export type DatoolActionButtonConfig =
  | false
  | DatoolActionButtonVariant
  | {
      className?: string
      label?: string
      size?: DatoolActionButtonSize
      variant?: DatoolActionButtonVariant
    }

export type DatoolRelativeDateFormat = {
  addSuffix?: boolean
  relative: true
}

export type DatoolDateFormat =
  | DatoolRelativeDateFormat
  | Intl.DateTimeFormatOptions
  | string

export type DatoolOpenContext = {
  emit: (line: string) => void
  query: URLSearchParams
  signal: AbortSignal
}

export type DatoolGetContext = {
  limit?: number
  offset?: number
  page?: number
  query: URLSearchParams
  signal: AbortSignal
  sourceId: string
  streamId?: string
}

export type DatoolGetResultMetadata = {
  nextOffset?: number
  nextPage?: number
  prevOffset?: number
  prevPage?: number
  total?: number
}

export type DatoolParseLineContext = {
  line: string
  query: URLSearchParams
  sourceId: string
  streamId?: string
}

export type DatoolGetRowIdContext<Row extends Record<string, unknown>> = {
  index: number
  line?: string
  query: URLSearchParams
  row: Row
  sourceId: string
  streamId?: string
}

export type DatoolActionResolveContext<Row extends Record<string, unknown>> = {
  actionId: string
  query: URLSearchParams
  rows: Row[]
  sourceId: string
  streamId?: string
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

export type DatoolOpenHandler = (
  context: DatoolOpenContext
) => void | Promise<void> | (() => void | Promise<void>)

export type DatoolGetResult<Row extends Record<string, unknown>> =
  | Row[]
  | ({
      rows: Row[]
    } & DatoolGetResultMetadata)

export type DatoolGetHandler<Row extends Record<string, unknown>> = (
  context: DatoolGetContext
) => DatoolGetResult<Row> | Promise<DatoolGetResult<Row>>

export type DatoolParseLineHandler<Row extends Record<string, unknown>> = (
  context: DatoolParseLineContext
) => Row | null | Promise<Row | null>

export type DatoolGetRowIdHandler<Row extends Record<string, unknown>> = (
  context: DatoolGetRowIdContext<Row>
) => string | Promise<string>

export type DatoolSource = {
  open: DatoolOpenHandler
}

type RequireAtLeastOne<TValue, TKey extends keyof TValue = keyof TValue> =
  Omit<TValue, TKey> &
    {
      [Key in TKey]-?: Required<Pick<TValue, Key>> &
        Partial<Pick<TValue, Exclude<TKey, Key>>>
    }[TKey]

export type DatoolResolvedSource<Row extends Record<string, unknown>> = {
  actions?: Record<string, DatoolAction<Row>>
  get?: DatoolGetHandler<Row>
  getRowId?: DatoolGetRowIdHandler<Row>
  label?: string
  open?: DatoolOpenHandler
  parseLine: DatoolParseLineHandler<Row>
  pollIntervalMs?: number
}

type DatoolSourceDefinitionBase<Row extends Record<string, unknown>> = {
  actions?: Record<string, DatoolAction<Row>>
  get?: DatoolGetHandler<Row>
  getRowId?: DatoolGetRowIdHandler<Row>
  label?: string
  open?: DatoolOpenHandler
  parseLine?: DatoolParseLineHandler<Row>
  pollIntervalMs?: number
  source?: DatoolSource
  stream?: DatoolSource
}

export type DatoolSourceDefinition<Row extends Record<string, unknown>> =
  RequireAtLeastOne<
    DatoolSourceDefinitionBase<Row>,
    "get" | "open" | "source" | "stream"
  >

export type DatoolSourceExport<Row extends Record<string, unknown>> =
  | DatoolSource
  | DatoolResolvedSource<Row>
  | DatoolSourceDefinition<Row>

export type DatoolResolvedStream<Row extends Record<string, unknown>> =
  DatoolResolvedSource<Row>

export type DatoolStreamDefinition<Row extends Record<string, unknown>> =
  DatoolSourceDefinition<Row>

export type DatoolStreamExport<Row extends Record<string, unknown>> =
  DatoolSourceExport<Row>

export type DatoolClientAction = {
  button?: DatoolActionButtonConfig
  icon?: DatoolIconName
  id: string
  label: string
}

export type DatoolClientSource = {
  actions: DatoolClientAction[]
  id: string
  label: string
  pollIntervalMs?: number
  supportsGet: boolean
  supportsLive: boolean
  supportsStream: boolean
}

export type DatoolClientStream = DatoolClientSource

export type DatoolClientPage = {
  filePath: string
  id: string
  path: string
  title: string
}

export type DatoolClientConfig = {
  dateFormat?: DatoolDateFormat
  pages: DatoolClientPage[]
  sources: DatoolClientSource[]
  streams: DatoolClientSource[]
}

export type DatoolApp = {
  dateFormat?: DatoolDateFormat
  pages: DatoolClientPage[]
  server?: {
    host?: string
    port?: number
  }
  sources: Record<string, DatoolResolvedSource<Record<string, unknown>>>
  streams: Record<string, DatoolResolvedSource<Record<string, unknown>>>
  streamsPath: string
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

export type DatoolRowsResponse<Row extends Record<string, unknown> = Record<string, unknown>> =
  DatoolGetResultMetadata & {
    rows: Array<{
      id: string
      row: Row
    }>
  }
