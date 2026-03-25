import fs from "fs"
import fsPromises from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"

import { assertDateFormatShape } from "../shared/date-format"
import type {
  DatoolApp,
  DatoolClientConfig,
  DatoolClientPage,
  DatoolDateFormat,
  DatoolResolvedSource,
  DatoolSourceDefinition,
  DatoolSourceExport,
} from "../shared/types"
import {
  LOG_VIEWER_ACTION_BUTTON_SIZES,
  LOG_VIEWER_ACTION_BUTTON_VARIANTS,
  LOG_VIEWER_ICON_NAMES,
} from "../shared/types"

const PRIMARY_APP_DIRECTORY_NAME = ".datool"
const LEGACY_APP_DIRECTORY_NAME = "datool"
const APP_DIRECTORY_NAMES = [
  PRIMARY_APP_DIRECTORY_NAME,
  LEGACY_APP_DIRECTORY_NAME,
] as const
const SOURCE_CONFIG_BASENAMES = [
  "sources.ts",
  "sources.mts",
  "sources.js",
  "sources.mjs",
  "streams.ts",
  "streams.mts",
  "streams.js",
  "streams.mjs",
]

const PAGE_EXTENSIONS = new Set([".tsx", ".jsx"])
const IGNORED_APP_SUBDIRECTORIES = new Set(["client-dist", "generated"])
const RESERVED_EXPORT_NAMES = new Set(["dateFormat", "default", "server"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isSource(value: unknown): value is { open: NonNullable<DatoolResolvedSource<Record<string, unknown>>["open"]> } {
  return isRecord(value) && typeof value.open === "function"
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
        `Action "${actionId}" on source "${streamId}" defines an invalid button variant.`
      )
    }

    return
  }

  if (!isRecord(value)) {
    throw new Error(
      `Action "${actionId}" on source "${streamId}" must define button as false, a variant string, or an object.`
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
      `Action "${actionId}" on source "${streamId}" defines an invalid button variant.`
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
      `Action "${actionId}" on source "${streamId}" defines an invalid button size.`
    )
  }

  if (value.className !== undefined && typeof value.className !== "string") {
    throw new Error(
      `Action "${actionId}" on source "${streamId}" defines an invalid button className.`
    )
  }

  if (value.label !== undefined && typeof value.label !== "string") {
    throw new Error(
      `Action "${actionId}" on source "${streamId}" defines an invalid button label.`
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
      `Action "${actionId}" on source "${streamId}" must be an object.`
    )
  }

  if (typeof value.label !== "string" || !value.label) {
    throw new Error(
      `Action "${actionId}" on source "${streamId}" must define a label.`
    )
  }

  if (typeof value.resolve !== "function") {
    throw new Error(
      `Action "${actionId}" on source "${streamId}" must define a resolve() function.`
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
      `Action "${actionId}" on source "${streamId}" defines an invalid icon.`
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
  sourceId,
}: Parameters<NonNullable<DatoolResolvedSource<Record<string, unknown>>["parseLine"]>>[0]) {
  try {
    return JSON.parse(line) as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    throw new Error(
      `Source "${sourceId}" emitted invalid JSONL. ${message}`
    )
  }
}

function normalizeStreamExport(
  streamId: string,
  exportedValue: unknown
): DatoolResolvedSource<Record<string, unknown>> {
  if (!isRecord(exportedValue)) {
    throw new Error(`Source "${streamId}" must export an object.`)
  }

  const definition = exportedValue as DatoolSourceDefinition<Record<string, unknown>> &
    Partial<DatoolResolvedSource<Record<string, unknown>>>
  const get =
    typeof definition.get === "function"
      ? definition.get
      : undefined
  const source = isSource(definition.source) ? definition.source : undefined
  const stream = isSource(definition.stream) ? definition.stream : undefined
  const actions = isRecord(definition.actions) ? definition.actions : undefined
  const getRowId = definition.getRowId
  const label = definition.label
  const open =
    typeof definition.open === "function"
      ? definition.open
      : stream && typeof stream.open === "function"
        ? stream.open
      : source && typeof source.open === "function"
        ? source.open
        : undefined
  const parseLine =
    "parseLine" in definition && typeof definition.parseLine === "function"
      ? definition.parseLine
      : defaultJsonParseLine

  if (
    "get" in definition &&
    definition.get !== undefined &&
    typeof definition.get !== "function"
  ) {
    throw new Error(`Source "${streamId}" get must be a function.`)
  }

  if (
    "stream" in definition &&
    definition.stream !== undefined &&
    !isSource(definition.stream)
  ) {
    throw new Error(`Source "${streamId}" stream must define an open() function.`)
  }

  if (
    "source" in definition &&
    definition.source !== undefined &&
    !isSource(definition.source)
  ) {
    throw new Error(`Source "${streamId}" source must define an open() function.`)
  }

  if (!get && typeof open !== "function") {
    throw new Error(
      `Source "${streamId}" must define a get() function, a source.open() function, or both.`
    )
  }

  if (
    definition.actions !== undefined &&
    !isRecord(definition.actions)
  ) {
    throw new Error(`Source "${streamId}" actions must be an object.`)
  }

  for (const [actionId, action] of Object.entries(actions ?? {})) {
    assertActionShape(streamId, actionId, action)
  }

  if (getRowId !== undefined && typeof getRowId !== "function") {
    throw new Error(`Source "${streamId}" getRowId must be a function.`)
  }

  if (label !== undefined && typeof label !== "string") {
    throw new Error(`Source "${streamId}" label must be a string.`)
  }

  const pollIntervalMs =
    typeof definition.pollIntervalMs === "number" && definition.pollIntervalMs > 0
      ? definition.pollIntervalMs
      : undefined

  return {
    actions,
    get,
    getRowId,
    label: label ?? toDefaultStreamLabel(streamId),
    open,
    parseLine,
    pollIntervalMs,
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
      if (IGNORED_APP_SUBDIRECTORIES.has(entry.name)) {
        continue
      }

      pages.push(...(await discoverPagesInDirectory(absolutePath)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const extension = path.extname(entry.name)

    if (
      !PAGE_EXTENSIONS.has(extension) ||
      entry.name === "streams.tsx" ||
      entry.name === "sources.tsx"
    ) {
      continue
    }

    pages.push(absolutePath)
  }

  return pages
}

export function findSourcesPath(cwd: string) {
  for (const directoryName of APP_DIRECTORY_NAMES) {
    for (const basename of SOURCE_CONFIG_BASENAMES) {
      const absolutePath = path.join(cwd, directoryName, basename)

      if (fs.existsSync(absolutePath)) {
        return absolutePath
      }
    }
  }

  return null
}

export const findStreamsPath = findSourcesPath

export function resolveDatoolAppDirectory(cwd: string) {
  const sourcesPath = findSourcesPath(cwd)

  if (sourcesPath) {
    return path.dirname(sourcesPath)
  }

  return path.join(cwd, PRIMARY_APP_DIRECTORY_NAME)
}

export async function discoverDatoolPages(cwd: string, appDirectory = resolveDatoolAppDirectory(cwd)) {

  if (!fs.existsSync(appDirectory)) {
    throw new Error(
      `Could not find a datool pages directory (${PRIMARY_APP_DIRECTORY_NAME} or legacy ${LEGACY_APP_DIRECTORY_NAME}) in ${cwd}.`
    )
  }

  const files = await discoverPagesInDirectory(appDirectory)

  if (files.length === 0) {
    throw new Error(
      `The datool app must define at least one page in ${PRIMARY_APP_DIRECTORY_NAME}/*.tsx (or legacy ${LEGACY_APP_DIRECTORY_NAME}/*.tsx).`
    )
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
      `Could not find ${PRIMARY_APP_DIRECTORY_NAME}/sources.ts (or legacy datool/sources.ts / datool/streams.ts) in ${options.cwd}.`
    )
  }

  const pages = await discoverDatoolPages(options.cwd, path.dirname(streamsPath))
  const streamStats = await fsPromises.stat(streamsPath)
  const streamsUrl = pathToFileURL(streamsPath)

  streamsUrl.searchParams.set(
    "datool_mtime",
    String(streamStats.mtimeMs)
  )

  const importedModule = (await import(
    /* webpackIgnore: true */
    streamsUrl.href
  )) as Record<string, unknown>
  const dateFormat = importedModule.dateFormat as DatoolDateFormat | undefined
  const server = importedModule.server as DatoolApp["server"]

  assertDateFormatShape(dateFormat)

  if (server !== undefined && !isRecord(server)) {
    throw new Error("The datool source config server export must be an object.")
  }

  const entries = Object.entries(importedModule).filter(
    ([exportName]) => !RESERVED_EXPORT_NAMES.has(exportName)
  )

  if (entries.length === 0) {
    throw new Error("The datool source config must export at least one source.")
  }

  const sources = Object.fromEntries(
    entries.map(([streamId, exportedValue]) => [
      streamId,
      normalizeStreamExport(streamId, exportedValue),
    ])
  ) satisfies DatoolApp["sources"]

  return {
    app: {
      dateFormat,
      pages,
      server,
      sources,
      streams: sources,
      streamsPath,
    } satisfies DatoolApp,
    streamsPath,
  }
}

export function toClientConfig(app: DatoolApp): DatoolClientConfig {
  const sources = Object.entries(app.sources).map(([id, source]) => ({
    actions: Object.entries(source.actions ?? {}).map(([actionId, action]) => ({
      button: action.button,
      icon: action.icon,
      id: actionId,
      label: action.label,
    })),
    id,
    label: source.label ?? toDefaultStreamLabel(id),
    pollIntervalMs: source.pollIntervalMs,
    supportsGet: typeof source.get === "function",
    supportsLive: typeof source.open === "function",
    supportsStream: typeof source.open === "function",
  }))

  return {
    dateFormat: app.dateFormat,
    pages: app.pages,
    sources,
    streams: sources,
  }
}

export function getStreamFromApp(app: DatoolApp, streamId: string) {
  return app.sources[streamId] ?? null
}
