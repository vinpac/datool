import path from "path"
import { pathToFileURL } from "url"
import fs from "fs"

import type {
  DatoolClientConfig,
  DatoolConfig,
  DatoolStream,
} from "../shared/types"
import {
  LOG_VIEWER_ACTION_BUTTON_SIZES,
  LOG_VIEWER_ACTION_BUTTON_VARIANTS,
  LOG_VIEWER_ICON_NAMES,
} from "../shared/types"

const CONFIG_FILENAMES = [
  "datool.config.ts",
  "datool.config.mts",
  "datool.config.js",
  "datool.config.mjs",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function assertActionButtonShape(streamId: string, actionId: string, value: unknown) {
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

function assertDateFormatShape(value: unknown) {
  if (value === undefined) {
    return
  }

  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error("datool.config.ts dateFormat must be an object.")
  }

  try {
    new Intl.DateTimeFormat(
      undefined,
      value as Intl.DateTimeFormatOptions
    )
  } catch {
    throw new Error("datool.config.ts defines an invalid dateFormat.")
  }
}

function assertStreamShape(streamId: string, value: unknown) {
  if (!isRecord(value)) {
    throw new Error(`Stream "${streamId}" must be an object.`)
  }

  if (typeof value.label !== "string" || !value.label) {
    throw new Error(`Stream "${streamId}" must define a label.`)
  }

  if (!Array.isArray(value.columns)) {
    throw new Error(`Stream "${streamId}" must define a columns array.`)
  }

  if (typeof value.open !== "function") {
    throw new Error(`Stream "${streamId}" must define an open() function.`)
  }

  if (typeof value.parseLine !== "function") {
    throw new Error(`Stream "${streamId}" must define a parseLine() function.`)
  }

  if (value.actions !== undefined) {
    if (!isRecord(value.actions)) {
      throw new Error(`Stream "${streamId}" actions must be an object.`)
    }

    for (const [actionId, action] of Object.entries(value.actions)) {
      assertActionShape(streamId, actionId, action)
    }
  }
}

export function findConfigPath(cwd: string) {
  for (const filename of CONFIG_FILENAMES) {
    const candidatePath = path.join(cwd, filename)

    if (fs.existsSync(candidatePath)) {
      return candidatePath
    }
  }

  return null
}

export async function loadDatoolConfig(options: {
  configPath?: string
  cwd: string
}) {
  const configPath = options.configPath ?? findConfigPath(options.cwd)

  if (!configPath) {
    throw new Error(
      `Could not find datool.config.ts in ${options.cwd}.`
    )
  }

  const importedModule = await import(pathToFileURL(configPath).href)
  const config = (importedModule.default ?? importedModule) as DatoolConfig

  validateDatoolConfig(config)

  return {
    config,
    configPath,
  }
}

export function validateDatoolConfig(
  config: unknown
): asserts config is DatoolConfig {
  if (!isRecord(config)) {
    throw new Error("datool.config.ts must export an object.")
  }

  assertDateFormatShape(config.dateFormat)

  if (!isRecord(config.streams) || Object.keys(config.streams).length === 0) {
    throw new Error("datool.config.ts must define at least one stream.")
  }

  for (const [streamId, stream] of Object.entries(config.streams)) {
    assertStreamShape(streamId, stream)
  }
}

export function toClientConfig(config: DatoolConfig): DatoolClientConfig {
  return {
    dateFormat: config.dateFormat,
    streams: Object.entries(config.streams).map(([id, stream]) => ({
      actions: Object.entries(stream.actions ?? {}).map(([actionId, action]) => ({
        button: action.button,
        icon: action.icon,
        id: actionId,
        label: action.label,
      })),
      columns: stream.columns,
      id,
      label: stream.label,
    })),
  }
}

export function getStreamFromConfig(
  config: DatoolConfig,
  streamId: string
): DatoolStream<Record<string, unknown>> | null {
  return config.streams[streamId] ?? null
}
