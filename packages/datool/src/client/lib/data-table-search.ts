export type DataTableSearchFieldKind =
  | "date"
  | "enum"
  | "json"
  | "number"
  | "text"

export type DataTableSearchField<Row> = {
  getValue: (row: Row) => unknown
  id: string
  kind: DataTableSearchFieldKind
  options?: string[]
  sample?: string
}

export type DataTableSearchSuggestion = {
  group: "filters" | "input" | "values"
  id: string
  insertText: string
  keepOpen?: boolean
  label: string
  mode: "append" | "replace-token" | "replace-whole"
}

export type DataTableSearchFilterClause = {
  operator: ":" | "<" | ">"
  value: string
}

export type DataTableSearchTokenOperator = ":" | "." | "<" | ">"

export type DataTableSearchSelectorRange = {
  end: number
  fieldId: string
  operator: DataTableSearchTokenOperator
  start: number
  token: string
}

type DataTableSearchTokenRange = {
  end: number
  start: number
  token: string
}

function withSuggestionMode(
  suggestion: DataTableSearchSuggestion,
  mode: DataTableSearchSuggestion["mode"]
): DataTableSearchSuggestion {
  return {
    ...suggestion,
    mode,
  }
}

type TokenContext<Row> = {
  end: number
  field?: DataTableSearchField<Row>
  fragment: string
  operator?: DataTableSearchTokenOperator
  start: number
  token: string
}

type MatchedSearchToken<Row> = {
  field?: DataTableSearchField<Row>
  fieldId: string
  fragment: string
  operator: DataTableSearchTokenOperator
}

function matchSearchToken<Row>(
  token: string,
  fields: DataTableSearchField<Row>[]
): MatchedSearchToken<Row> | null {
  const match = token.match(/^([a-zA-Z0-9_.-]+)(:|>|<|\.)(.*)$/)

  if (!match) {
    return null
  }

  const [, fieldId, operator, fragment] = match

  return {
    field: fields.find((item) => item.id === fieldId),
    fieldId,
    fragment,
    operator: operator as DataTableSearchTokenOperator,
  }
}

function isSupportedOperator<Row>(
  field: DataTableSearchField<Row>,
  operator: DataTableSearchTokenOperator
) {
  switch (field.kind) {
    case "date":
    case "number":
      return operator === ":" || operator === ">" || operator === "<"
    case "json":
      return operator === ":" || operator === "."
    default:
      return operator === ":"
  }
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

function getSearchTokenRanges(value: string) {
  const ranges: DataTableSearchTokenRange[] = []
  let tokenStart = -1
  let isQuoted = false
  let isEscaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (tokenStart === -1) {
      if (/\s/.test(character)) {
        continue
      }

      tokenStart = index
    }

    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (character === "\\") {
      isEscaped = true
      continue
    }

    if (character === '"') {
      isQuoted = !isQuoted
      continue
    }

    if (!isQuoted && /\s/.test(character)) {
      ranges.push({
        end: index,
        start: tokenStart,
        token: value.slice(tokenStart, index),
      })
      tokenStart = -1
    }
  }

  if (tokenStart !== -1) {
    ranges.push({
      end: value.length,
      start: tokenStart,
      token: value.slice(tokenStart),
    })
  }

  return ranges
}

export function splitSearchQuery(value: string) {
  return getSearchTokenRanges(value).map((range) => range.token)
}

function unescapeSearchTokenValue(value: string) {
  return value.replace(/\\(["\\])/g, "$1")
}

function unquoteSearchTokenValue(value: string) {
  const trimmedValue = value.trim()

  if (
    trimmedValue.length >= 2 &&
    trimmedValue.startsWith('"') &&
    trimmedValue.endsWith('"')
  ) {
    return unescapeSearchTokenValue(trimmedValue.slice(1, -1))
  }

  return unescapeSearchTokenValue(trimmedValue)
}

export function quoteSearchTokenValue(value: string) {
  if (!value || /[\s"]/u.test(value)) {
    return `"${value.replace(/["\\]/g, "\\$&")}"`
  }

  return value
}

function parseDateOperand(value: string) {
  const normalized = value.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized === "today") {
    const now = new Date()

    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }

  const relativeMatch = normalized.match(/^-(\d+)d$/)

  if (relativeMatch) {
    const days = Number(relativeMatch[1])

    return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  }

  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return null
  }

  return new Date(timestamp)
}

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function matchFieldToken<Row>(
  row: Row,
  field: DataTableSearchField<Row>,
  operator: ":" | "<" | ">",
  rawValue: string
) {
  const fieldValue = field.getValue(row)
  const stringValue = stringifyValue(fieldValue)

  if (!rawValue.trim()) {
    return true
  }

  if (field.kind === "enum") {
    return stringValue.toLowerCase() === rawValue.trim().toLowerCase()
  }

  if (field.kind === "number") {
    const left = Number(fieldValue)
    const right = Number(rawValue)

    if (Number.isNaN(left) || Number.isNaN(right)) {
      return stringValue.toLowerCase().includes(rawValue.trim().toLowerCase())
    }

    if (operator === ">") {
      return left > right
    }

    if (operator === "<") {
      return left < right
    }

    return left === right
  }

  if (field.kind === "date") {
    const nestedOperatorMatch =
      operator === ":" ? rawValue.match(/^([<>])(.*)$/) : null
    const effectiveOperator = nestedOperatorMatch
      ? (nestedOperatorMatch[1] as "<" | ">")
      : operator
    const effectiveValue = nestedOperatorMatch
      ? nestedOperatorMatch[2]
      : rawValue
    const left = parseDateOperand(stringValue)
    const right = parseDateOperand(effectiveValue)

    if (!left || !right) {
      return stringValue.toLowerCase().includes(rawValue.trim().toLowerCase())
    }

    if (effectiveOperator === ">") {
      return left > right
    }

    if (effectiveOperator === "<") {
      return left < right
    }

    return sameCalendarDay(left, right)
  }

  return stringValue.toLowerCase().includes(rawValue.trim().toLowerCase())
}

export function matchesFieldClauses<Row>(
  row: Row,
  field: DataTableSearchField<Row>,
  clauses: DataTableSearchFilterClause[]
) {
  return clauses.every((clause) =>
    matchFieldToken(row, field, clause.operator, clause.value)
  )
}

function buildBaseSuggestions<Row>(fields: DataTableSearchField<Row>[]) {
  return fields.flatMap<DataTableSearchSuggestion>((field) => {
    switch (field.kind) {
      case "date":
        return [
          {
            id: `${field.id}-eq`,
            group: "filters",
            insertText: `${field.id}:`,
            keepOpen: true,
            label: `${field.id}:`,
            mode: "append",
          },
          {
            id: `${field.id}-gt`,
            group: "filters",
            insertText: `${field.id}>`,
            keepOpen: true,
            label: `${field.id}>`,
            mode: "append",
          },
          {
            id: `${field.id}-lt`,
            group: "filters",
            insertText: `${field.id}<`,
            keepOpen: true,
            label: `${field.id}<`,
            mode: "append",
          },
        ]
      case "number":
        return [
          {
            id: `${field.id}-eq`,
            group: "filters",
            insertText: `${field.id}:`,
            keepOpen: true,
            label: `${field.id}:`,
            mode: "append",
          },
          {
            id: `${field.id}-gt`,
            group: "filters",
            insertText: `${field.id}>`,
            keepOpen: true,
            label: `${field.id}>`,
            mode: "append",
          },
          {
            id: `${field.id}-lt`,
            group: "filters",
            insertText: `${field.id}<`,
            keepOpen: true,
            label: `${field.id}<`,
            mode: "append",
          },
        ]
      case "json":
        return [
          {
            id: `${field.id}-dot`,
            group: "filters",
            insertText: `${field.id}.`,
            keepOpen: true,
            label: `${field.id}.`,
            mode: "append",
          },
          {
            id: `${field.id}-eq`,
            group: "filters",
            insertText: `${field.id}:`,
            keepOpen: true,
            label: `${field.id}:`,
            mode: "append",
          },
        ]
      default:
        return [
          {
            id: `${field.id}-eq`,
            group: "filters",
            insertText: `${field.id}:`,
            keepOpen: true,
            label: `${field.id}:`,
            mode: "append",
          },
        ]
    }
  })
}

export function getTokenContext<Row>(
  value: string,
  cursor: number,
  fields: DataTableSearchField<Row>[]
): TokenContext<Row> {
  const tokenRange = getSearchTokenRanges(value).find(
    (range) => cursor >= range.start && cursor <= range.end
  )
  const start = tokenRange?.start ?? cursor
  const end = tokenRange?.end ?? cursor
  const token = tokenRange?.token ?? ""
  const match = matchSearchToken(token, fields)

  if (!match) {
    return {
      end,
      fragment: token,
      start,
      token,
    }
  }

  return {
    end,
    field: match.field,
    fragment: match.fragment,
    operator: match.operator,
    start,
    token,
  }
}

export function getSelectorHighlightRanges<Row>(
  value: string,
  fields: DataTableSearchField<Row>[]
) {
  const ranges: DataTableSearchSelectorRange[] = []

  for (const { end, start, token } of getSearchTokenRanges(value)) {
    const parsedToken = matchSearchToken(token, fields)

    if (!parsedToken?.field) {
      continue
    }

    if (!isSupportedOperator(parsedToken.field, parsedToken.operator)) {
      continue
    }

    ranges.push({
      end,
      fieldId: parsedToken.field.id,
      operator: parsedToken.operator,
      start,
      token,
    })
  }

  return ranges
}

export function getSearchSuggestions<Row>(
  value: string,
  cursor: number,
  fields: DataTableSearchField<Row>[]
) {
  const token = getTokenContext(value, cursor, fields)
  const hasTokenFragment = token.fragment.trim().length > 0
  const inputSuggestion = value
    ? [
        {
          group: "input" as const,
          id: "input-value",
          insertText: value,
          label: value,
          mode: "replace-whole" as const,
        },
      ]
    : []

  if (!token.field || !token.operator) {
    const baseSuggestions = buildBaseSuggestions(fields)
    const filteredSuggestions = !token.fragment.trim()
      ? baseSuggestions
      : baseSuggestions.filter((suggestion) =>
          suggestion.label
            .toLowerCase()
            .includes(token.fragment.trim().toLowerCase())
        )

    if (hasTokenFragment) {
      return [
        ...inputSuggestion,
        ...filteredSuggestions.map((suggestion) =>
          withSuggestionMode(suggestion, "replace-token")
        ),
      ]
    }

    return [...inputSuggestion, ...filteredSuggestions]
  }

  if (token.field.kind === "enum" && token.operator === ":") {
    const selectedValue = unquoteSearchTokenValue(token.fragment).toLowerCase()

    if (
      selectedValue &&
      (token.field.options ?? []).some(
        (option) => option.toLowerCase() === selectedValue
      )
    ) {
      return inputSuggestion
    }

    const valueSuggestions = (token.field.options ?? [])
      .filter((option) => option.toLowerCase().includes(selectedValue))
      .map<DataTableSearchSuggestion>((option) => ({
        group: "values",
        id: `${token.field?.id}-${option}`,
        insertText: `${token.field?.id}:${quoteSearchTokenValue(option)}`,
        label: option,
        mode: "replace-token",
      }))

    return [...inputSuggestion, ...valueSuggestions]
  }

  if (token.field.kind === "date") {
    const sample = token.field.sample ?? new Date().toISOString()
    const suggestions = [
      {
        group: "values" as const,
        id: `${token.field.id}-today`,
        insertText: `${token.field.id}${token.operator}today`,
        label: "today",
        mode: "replace-token" as const,
      },
      {
        group: "values" as const,
        id: `${token.field.id}-7d`,
        insertText: `${token.field.id}${token.operator}-7d`,
        label: "-7d",
        mode: "replace-token" as const,
      },
      {
        group: "values" as const,
        id: `${token.field.id}-sample`,
        insertText: `${token.field.id}${token.operator}${sample}`,
        label: sample,
        mode: "replace-token" as const,
      },
    ]

    if (token.operator === ":") {
      suggestions[1] = {
        group: "values",
        id: `${token.field.id}-7d`,
        insertText: `${token.field.id}:>-7d`,
        label: ">-7d",
        mode: "replace-token",
      }
      suggestions[2] = {
        group: "values",
        id: `${token.field.id}-sample`,
        insertText: `${token.field.id}:>${sample}`,
        label: `>${sample}`,
        mode: "replace-token",
      }
    }

    const filteredSuggestions = !token.fragment.trim()
      ? suggestions
      : suggestions.filter((suggestion) =>
          suggestion.label
            .toLowerCase()
            .includes(token.fragment.trim().toLowerCase())
        )

    return [...inputSuggestion, ...filteredSuggestions]
  }

  const filteredSuggestions = buildBaseSuggestions([token.field]).filter(
    (suggestion) =>
      suggestion.label.toLowerCase().includes(token.token.trim().toLowerCase())
  )

  return [...inputSuggestion, ...filteredSuggestions]
}

export function applySuggestionToValue<Row>(
  value: string,
  cursor: number,
  fields: DataTableSearchField<Row>[],
  suggestion: DataTableSearchSuggestion
) {
  const token = getTokenContext(value, cursor, fields)
  const nextValue =
    suggestion.mode === "replace-whole"
      ? suggestion.insertText
      : suggestion.mode === "append"
        ? `${value.trimEnd()}${value.trim() ? " " : ""}${suggestion.insertText}`
        : `${value.slice(0, token.start)}${suggestion.insertText}${value.slice(token.end)}`
  const nextCursor =
    suggestion.mode === "append"
      ? nextValue.length
      : suggestion.mode === "replace-whole"
        ? suggestion.insertText.length
        : token.start + suggestion.insertText.length

  return {
    keepOpen: Boolean(suggestion.keepOpen),
    value: nextValue,
    selectionStart: nextCursor,
  }
}

export function parseSearchQuery<Row>(
  query: string,
  fields: DataTableSearchField<Row>[]
) {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return {
      columnFilters: [] as Array<{
        id: string
        value: DataTableSearchFilterClause[]
      }>,
      globalFilter: "",
    }
  }

  const tokens = splitSearchQuery(trimmedQuery)
  const columnFiltersMap = new Map<string, DataTableSearchFilterClause[]>()
  const globalTokens: string[] = []

  tokens.forEach((token) => {
    const match = token.match(/^([a-zA-Z0-9_.-]+)(:|>|<)(.*)$/)

    if (!match) {
      globalTokens.push(token)
      return
    }

    const [, fieldId, operator, rawValue] = match
    const field = fields.find((item) => item.id === fieldId)

    if (!field) {
      globalTokens.push(token)
      return
    }

    const existingClauses = columnFiltersMap.get(field.id) ?? []

    existingClauses.push({
      operator: operator as ":" | "<" | ">",
      value: unquoteSearchTokenValue(rawValue),
    })

    columnFiltersMap.set(field.id, existingClauses)
  })

  return {
    columnFilters: Array.from(columnFiltersMap.entries()).map(
      ([id, value]) => ({
        id,
        value,
      })
    ),
    globalFilter: globalTokens.join(" "),
  }
}

export function matchesSearch<Row>(
  row: Row,
  query: string,
  fields: DataTableSearchField<Row>[]
) {
  const parsedQuery = parseSearchQuery(query, fields)
  const fallbackValue = fields
    .map((field) => stringifyValue(field.getValue(row)).toLowerCase())
    .join("\n")

  const matchesGlobalFilter = parsedQuery.globalFilter
    ? parsedQuery.globalFilter
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => fallbackValue.includes(token.toLowerCase()))
    : true

  if (!matchesGlobalFilter) {
    return false
  }

  return parsedQuery.columnFilters.every((columnFilter) => {
    const field = fields.find((item) => item.id === columnFilter.id)

    if (!field) {
      return true
    }

    return matchesFieldClauses(row, field, columnFilter.value)
  })
}

export function getColumnHighlightTerms<Row>(
  query: string,
  columnId: string,
  fields: DataTableSearchField<Row>[]
) {
  const parsedQuery = parseSearchQuery(query, fields)
  const field = fields.find((item) => item.id === columnId)
  const globalTerms = parsedQuery.globalFilter.split(/\s+/).filter(Boolean)

  if (!field || field.kind !== "text") {
    return globalTerms
  }

  const columnTerms =
    parsedQuery.columnFilters
      .find((columnFilter) => columnFilter.id === columnId)
      ?.value.filter((clause) => clause.operator === ":" && clause.value.trim())
      .map((clause) => clause.value.trim()) ?? []

  return [...globalTerms, ...columnTerms]
}

export function buildEnumOptions<Row>(
  rows: Row[],
  getValue: (row: Row) => unknown
) {
  return Array.from(
    new Set(
      rows
        .map((row) => stringifyValue(getValue(row)).trim())
        .filter(Boolean)
    )
  )
}
