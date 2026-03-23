import fs from "fs"
import fsPromises from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

import type {
  DatoolApp,
  DatoolClientConfig,
  DatoolClientPage,
  DatoolDateFormat,
  DatoolResolvedStream,
  DatoolStreamDefinition,
  DatoolStreamExport,
} from "../shared/types"
import {
  LOG_VIEWER_ACTION_BUTTON_SIZES,
  LOG_VIEWER_ACTION_BUTTON_VARIANTS,
  LOG_VIEWER_ICON_NAMES,
} from "../shared/types"

const STREAMS_FILENAMES = [
  path.join("datool", "streams.ts"),
  path.join("datool", "streams.mts"),
  path.join("datool", "streams.js"),
  path.join("datool", "streams.mjs"),
]

const PAGE_EXTENSIONS = new Set([".tsx", ".jsx"])
const RESERVED_EXPORT_NAMES = new Set(["dateFormat", "default", "server"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isSource(value: unknown): value is { open: DatoolResolvedStream<Record<string, unknown>>["open"] } {
  return isRecord(value) && typeof value.open === "function"
}

function assertDateFormatShape(value: unknown) {
  if (value === undefined) {
    return
  }

  if (!isRecord(value)) {
    throw new Error("datool/streams.ts dateFormat must be an object.")
  }

  try {
    new Intl.DateTimeFormat(undefined, value as Intl.DateTimeFormatOptions)
  } catch {
    throw new Error("datool/streams.ts defines an invalid dateFormat.")
  }
}

function assertActionButtonShape(
  streamId: string,
  actionId: string,
  value: unknown
) {
  if (value === undefined || value === false) {
    return
  }

  if (typeof value === "string") {
    if (
      !LOG_VIEWER_ACTION_BUTTON_VARIANTS.includes(
        value as (typeof LOG_VIEWER_ACTION_BUTTON_VARIANTS)[number]
      )
    ) {
      throw new Error(
        `Action "${actionId}" on stream "${streamId}" defines an invalid button variant.`
      )
    }

    return
  }

  if (!isRecord(value)) {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" must define button as false, a variant string, or an object.`
    )
  }

  if (
    value.variant !== undefined &&
    (typeof value.variant !== "string" ||
      !LOG_VIEWER_ACTION_BUTTON_VARIANTS.includes(
        value.variant as (typeof LOG_VIEWER_ACTION_BUTTON_VARIANTS)[number]
      ))
  ) {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" defines an invalid button variant.`
    )
  }

  if (
    value.size !== undefined &&
    (typeof value.size !== "string" ||
      !LOG_VIEWER_ACTION_BUTTON_SIZES.includes(
        value.size as (typeof LOG_VIEWER_ACTION_BUTTON_SIZES)[number]
      ))
  ) {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" defines an invalid button size.`
    )
  }

  if (value.className !== undefined && typeof value.className !== "string") {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" defines an invalid button className.`
    )
  }

  if (value.label !== undefined && typeof value.label !== "string") {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" defines an invalid button label.`
    )
  }
}

function assertActionShape(
  streamId: string,
  actionId: string,
  value: unknown
) {
  if (!isRecord(value)) {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" must be an object.`
    )
  }

  if (typeof value.label !== "string" || !value.label) {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" must define a label.`
    )
  }

  if (typeof value.resolve !== "function") {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" must define a resolve() function.`
    )
  }

  if (
    value.icon !== undefined &&
    (typeof value.icon !== "string" ||
      !LOG_VIEWER_ICON_NAMES.includes(
        value.icon as (typeof LOG_VIEWER_ICON_NAMES)[number]
      ))
  ) {
    throw new Error(
      `Action "${actionId}" on stream "${streamId}" defines an invalid icon.`
    )
  }

  assertActionButtonShape(streamId, actionId, value.button)
}

function toPageTitle(segment: string) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function toDefaultStreamLabel(streamId: string) {
  return toPageTitle(streamId)
}

function toDefaultPageTitle(relativePathWithoutExtension: string) {
  const parts = relativePathWithoutExtension.split(path.sep).filter(Boolean)
  const leaf = parts.at(-1)

  if (!leaf || leaf === "index") {
    return parts.at(-2) ? toPageTitle(parts.at(-2)!) : "Home"
  }

  return toPageTitle(leaf)
}

function toRoutePath(relativePathWithoutExtension: string) {
  const normalized = relativePathWithoutExtension.split(path.sep).join("/")
  const routePath =
    normalized === "index"
      ? "/"
      : `/${normalized.replace(/\/index$/, "").replace(/^\/+/, "")}`

  return routePath === "" ? "/" : routePath
}

function toPageId(relativePathWithoutExtension: string) {
  return relativePathWithoutExtension
    .split(path.sep)
    .join("-")
    .replace(/(^-|-$)/g, "") || "index"
}

function defaultJsonParseLine({
  line,
  streamId,
}: Parameters<NonNullable<DatoolResolvedStream<Record<string, unknown>>["parseLine"]>>[0]) {
  try {
    return JSON.parse(line) as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    throw new Error(
      `Stream "${streamId}" emitted invalid JSONL. ${message}`
    )
  }
}

function normalizeStreamExport(
  streamId: string,
  exportedValue: unknown
): DatoolResolvedStream<Record<string, unknown>> {
  if (!isRecord(exportedValue)) {
    throw new Error(`Stream "${streamId}" must export an object.`)
  }

  const definition = exportedValue as DatoolStreamDefinition<Record<string, unknown>> &
    Partial<DatoolResolvedStream<Record<string, unknown>>>
  const source = isSource(definition.source) ? definition.source : undefined
  const actions = isRecord(definition.actions) ? definition.actions : undefined
  const getRowId = definition.getRowId
  const label = definition.label
  const open =
    typeof definition.open === "function"
      ? definition.open
      : source && typeof source.open === "function"
        ? source.open
        : undefined
  const parseLine =
    "parseLine" in definition && typeof definition.parseLine === "function"
      ? definition.parseLine
      : defaultJsonParseLine

  if (typeof open !== "function") {
    throw new Error(
      `Stream "${streamId}" must export a source, an open() function, or both.`
    )
  }

  if (
    definition.actions !== undefined &&
    !isRecord(definition.actions)
  ) {
    throw new Error(`Stream "${streamId}" actions must be an object.`)
  }

  for (const [actionId, action] of Object.entries(actions ?? {})) {
    assertActionShape(streamId, actionId, action)
  }

  if (getRowId !== undefined && typeof getRowId !== "function") {
    throw new Error(`Stream "${streamId}" getRowId must be a function.`)
  }

  if (label !== undefined && typeof label !== "string") {
    throw new Error(`Stream "${streamId}" label must be a string.`)
  }

  return {
    actions,
    getRowId,
    label: label ?? toDefaultStreamLabel(streamId),
    open,
    parseLine,
  }
}

async function discoverPagesInDirectory(directoryPath: string) {
  const entries = await fsPromises.readdir(directoryPath, {
    withFileTypes: true,
  })
  const pages: string[] = []

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const absolutePath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      pages.push(...(await discoverPagesInDirectory(absolutePath)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const extension = path.extname(entry.name)

    if (!PAGE_EXTENSIONS.has(extension) || entry.name === "streams.tsx") {
      continue
    }

    pages.push(absolutePath)
  }

  return pages
}

export function findStreamsPath(cwd: string) {
  for (const relativePath of STREAMS_FILENAMES) {
    const absolutePath = path.join(cwd, relativePath)

    if (fs.existsSync(absolutePath)) {
      return absolutePath
    }
  }

  return null
}

export async function discoverDatoolPages(cwd: string) {
  const appDirectory = path.join(cwd, "datool")

  if (!fs.existsSync(appDirectory)) {
    throw new Error(`Could not find datool pages directory in ${cwd}.`)
  }

  const files = await discoverPagesInDirectory(appDirectory)

  if (files.length === 0) {
    throw new Error("The datool app must define at least one page in datool/*.tsx.")
  }

  return files.map<DatoolClientPage>((filePath) => {
    const relativePath = path.relative(appDirectory, filePath)
    const relativePathWithoutExtension = relativePath.slice(
      0,
      -path.extname(relativePath).length
    )

    return {
      filePath,
      id: toPageId(relativePathWithoutExtension),
      path: toRoutePath(relativePathWithoutExtension),
      title: toDefaultPageTitle(relativePathWithoutExtension),
    }
  })
}

export async function loadDatoolApp(options: {
  cwd: string
  streamsPath?: string
}) {
  const streamsPath = options.streamsPath ?? findStreamsPath(options.cwd)

  if (!streamsPath) {
    throw new Error(
      `Could not find datool/streams.ts in ${options.cwd}.`
    )
  }

  const pages = await discoverDatoolPages(options.cwd)
  const streamStats = await fsPromises.stat(streamsPath)
  const streamsUrl = pathToFileURL(streamsPath)

  streamsUrl.searchParams.set(
    "datool_mtime",
    String(streamStats.mtimeMs)
  )

  const importedModule = (await import(
    streamsUrl.href
  )) as Record<string, unknown>
  const dateFormat = importedModule.dateFormat as DatoolDateFormat | undefined
  const server = importedModule.server as DatoolApp["server"]

  assertDateFormatShape(dateFormat)

  if (server !== undefined && !isRecord(server)) {
    throw new Error("datool/streams.ts server must be an object.")
  }

  const entries = Object.entries(importedModule).filter(
    ([exportName]) => !RESERVED_EXPORT_NAMES.has(exportName)
  )

  if (entries.length === 0) {
    throw new Error("datool/streams.ts must export at least one stream.")
  }

  const streams = Object.fromEntries(
    entries.map(([streamId, exportedValue]) => [
      streamId,
      normalizeStreamExport(streamId, exportedValue),
    ])
  ) satisfies DatoolApp["streams"]

  return {
    app: {
      dateFormat,
      pages,
      server,
      streams,
      streamsPath,
    } satisfies DatoolApp,
    streamsPath,
  }
}

export function toClientConfig(app: DatoolApp): DatoolClientConfig {
  return {
    dateFormat: app.dateFormat,
    pages: app.pages,
    streams: Object.entries(app.streams).map(([id, stream]) => ({
      actions: Object.entries(stream.actions ?? {}).map(([actionId, action]) => ({
        button: action.button,
        icon: action.icon,
        id: actionId,
        label: action.label,
      })),
      id,
      label: stream.label ?? toDefaultStreamLabel(id),
    })),
  }
}

export function getStreamFromApp(app: DatoolApp, streamId: string) {
  return app.streams[streamId] ?? null
}
