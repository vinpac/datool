import * as React from "react"

import {
  DATOOL_ENUM_BADGE_COLORS,
  type DatoolEnumBadgeColor,
  type DatoolEnumColorMap,
} from "../../shared/types"
import { cn } from "../lib/utils"

const ENUM_BADGE_STYLES: Record<DatoolEnumBadgeColor, string> = {
  amber:
    "bg-amber-50/90 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200",
  blue:
    "bg-blue-50/90 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200",
  coral:
    "bg-rose-50/90 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200",
  cyan:
    "bg-cyan-50/90 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200",
  emerald:
    "bg-emerald-50/90 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200",
  fuchsia:
    "bg-fuchsia-50/90 text-fuchsia-700 dark:bg-fuchsia-400/10 dark:text-fuchsia-200",
  green:
    "bg-green-50/90 text-green-700 dark:bg-green-400/10 dark:text-green-200",
  indigo:
    "bg-indigo-50/90 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200",
  lime:
    "bg-lime-50/90 text-lime-700 dark:bg-lime-400/10 dark:text-lime-200",
  orange:
    "bg-orange-50/90 text-orange-700 dark:bg-orange-400/10 dark:text-orange-200",
  pink:
    "bg-pink-50/90 text-pink-700 dark:bg-pink-400/10 dark:text-pink-200",
  purple:
    "bg-purple-50/90 text-purple-700 dark:bg-purple-400/10 dark:text-purple-200",
  red: "bg-red-50/90 text-red-700 dark:bg-red-400/10 dark:text-red-200",
  rose:
    "bg-rose-50/90 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200",
  sky: "bg-sky-50/90 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200",
  stone:
    "bg-stone-50/95 text-stone-700 dark:bg-white/5 dark:text-stone-100",
  teal:
    "bg-teal-50/90 text-teal-700 dark:bg-teal-400/10 dark:text-teal-200",
  violet:
    "bg-violet-50/90 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200",
  yellow:
    "bg-yellow-50/90 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-200",
  zinc: "bg-zinc-50/95 text-zinc-700 dark:bg-white/5 dark:text-zinc-100",
}

function normalizeEnumValue(value: string) {
  return value.trim().toUpperCase()
}

function getFallbackStyleIndex(value: string) {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash % DATOOL_ENUM_BADGE_COLORS.length
}

function resolveConfiguredColor(
  value: string,
  colors?: DatoolEnumColorMap
): DatoolEnumBadgeColor | null {
  if (!colors) {
    return null
  }

  const normalizedValue = normalizeEnumValue(value)

  for (const [candidateValue, color] of Object.entries(colors)) {
    if (color && normalizeEnumValue(candidateValue) === normalizedValue) {
      return color
    }
  }

  return null
}

function resolveEnumBadgeStyle(
  value: string,
  options?: string[],
  colors?: DatoolEnumColorMap
) {
  const normalizedValue = normalizeEnumValue(value)
  const configuredColor = resolveConfiguredColor(value, colors)

  if (configuredColor) {
    return ENUM_BADGE_STYLES[configuredColor]
  }

  const optionIndex =
    options?.findIndex((option) => normalizeEnumValue(option) === normalizedValue) ??
    -1

  if (optionIndex >= 0) {
    return ENUM_BADGE_STYLES[
      DATOOL_ENUM_BADGE_COLORS[optionIndex % DATOOL_ENUM_BADGE_COLORS.length]
    ]
  }

  return ENUM_BADGE_STYLES[
    DATOOL_ENUM_BADGE_COLORS[getFallbackStyleIndex(normalizedValue)]
  ]
}

export function EnumBadge({
  className,
  colors,
  options,
  value,
}: {
  className?: string
  colors?: DatoolEnumColorMap
  options?: string[]
  value: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md px-2 py-1 text-sm leading-none font-medium whitespace-nowrap shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
        resolveEnumBadgeStyle(value, options, colors),
        className
      )}
      title={value}
    >
      <span className="truncate">{value}</span>
    </span>
  )
}
