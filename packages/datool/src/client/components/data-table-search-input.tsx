import * as React from "react"
import { Extension } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Placeholder from "@tiptap/extension-placeholder"
import Text from "@tiptap/extension-text"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { LoaderCircle, Search, XIcon } from "lucide-react"

import { useOptionalDataTableContext } from "./data-table"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import {
  applySuggestionToValue,
  getSearchSuggestions,
  getSelectorHighlightRanges,
  type DataTableSearchField,
  type DataTableSearchSuggestion,
} from "@/lib/data-table-search"

export type DataTableSearchInputHandle = {
  focus: () => void
  selectAll: () => void
}

type ControlledDataTableSearchInputProps<Row> = {
  fields: DataTableSearchField<Row>[]
  onSearchChange: (value: string) => void
  value: string
}

type UncontrolledDataTableSearchInputProps = {
  fields?: never
  onSearchChange?: never
  value?: never
}

export type DataTableSearchInputProps<Row> = {
  inputRef?: React.Ref<DataTableSearchInputHandle>
  isLoading?: boolean
  placeholder?: string
} & (
  | ControlledDataTableSearchInputProps<Row>
  | UncontrolledDataTableSearchInputProps
)

const selectorPluginKey = new PluginKey(
  "data-table-search-selector-highlighter"
)
const selectorRefreshKey = "refresh-data-table-search-selector-highlighter"
const selectorHighlighterState = {
  fields: [] as DataTableSearchField<unknown>[],
}

function createSelectorDecorations(doc: Editor["state"]["doc"]) {
  const ranges = getSelectorHighlightRanges(
    getPlainText(doc),
    selectorHighlighterState.fields
  )

  return DecorationSet.create(
    doc,
    ranges
      .map((range) => {
        const from = textOffsetToDocPosition(doc, range.start)
        const to = textOffsetToDocPosition(doc, range.end)

        if (from >= to) {
          return null
        }

        return Decoration.inline(
          from,
          to,
          {
            class: "data-table-search-input-selector-token",
            "data-table-search-selector": "",
          },
          {
            inclusiveEnd: false,
            inclusiveStart: false,
          }
        )
      })
      .filter((decoration): decoration is Decoration => decoration !== null)
  )
}

const DataTableSelectorHighlighter = Extension.create({
  name: "dataTableSelectorHighlighter",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: selectorPluginKey,
        state: {
          init: (_, state) => createSelectorDecorations(state.doc),
          apply: (transaction, decorationSet, _oldState, newState) => {
            if (
              transaction.docChanged ||
              transaction.getMeta(selectorRefreshKey)
            ) {
              return createSelectorDecorations(newState.doc)
            }

            return decorationSet.map(transaction.mapping, transaction.doc)
          },
        },
        props: {
          decorations(state) {
            return selectorPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})

function assignRefValue<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value)
    return
  }

  if (ref) {
    ref.current = value
  }
}

function createEditorDocument(value: string) {
  return {
    content: value
      ? [
          {
            content: [
              {
                text: value,
                type: "text",
              },
            ],
            type: "paragraph",
          },
        ]
      : [
          {
            type: "paragraph",
          },
        ],
    type: "doc",
  } as const
}

function getPlainText(doc: Editor["state"]["doc"]) {
  return doc.textBetween(0, doc.content.size, "", "")
}

function getCursorOffset(editor: Editor) {
  return editor.state.doc.textBetween(0, editor.state.selection.from, "", "")
    .length
}

function textOffsetToDocPosition(doc: Editor["state"]["doc"], offset: number) {
  const totalLength = getPlainText(doc).length
  const clampedOffset = Math.max(0, Math.min(offset, totalLength))
  let remaining = clampedOffset
  let position = TextSelection.atStart(doc).from

  doc.descendants((node, pos) => {
    if (!node.isText) {
      return true
    }

    const text = node.text ?? ""

    if (remaining <= text.length) {
      position = pos + remaining
      return false
    }

    remaining -= text.length
    position = pos + text.length

    return true
  })

  return position
}

function normalizeSingleLineText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/\n/g, " ")
}

function moveActiveIndex(
  currentIndex: number,
  totalItems: number,
  direction: 1 | -1
) {
  if (totalItems <= 0) {
    return -1
  }

  if (currentIndex < 0) {
    return direction === 1 ? 0 : totalItems - 1
  }

  return (currentIndex + direction + totalItems) % totalItems
}

export function DataTableSearchInput<Row extends Record<string, unknown>>({
  inputRef,
  isLoading = false,
  placeholder = "Search table...",
  ...props
}: DataTableSearchInputProps<Row>) {
  const context = useOptionalDataTableContext<Row>()
  const fields =
    "fields" in props ? props.fields : (context?.searchFields ?? undefined)
  const value = "value" in props ? props.value : (context?.search ?? undefined)
  const onSearchChange =
    "onSearchChange" in props
      ? props.onSearchChange
      : (context?.setSearch ?? undefined)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const valueRef = React.useRef(value ?? "")
  const openRef = React.useRef(false)
  const activeIndexRef = React.useRef(-1)
  const suppressNextFocusOpenRef = React.useRef(false)
  const latestSuggestionsRef = React.useRef<DataTableSearchSuggestion[]>([])
  const applySuggestionRef = React.useRef<
    (
      editorInstance: Editor | null,
      suggestion: DataTableSearchSuggestion
    ) => void
  >(() => {})
  const pendingSelectionRef = React.useRef<{
    end: number
    start: number
  } | null>(null)
  const [cursor, setCursor] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)

  if (!fields || value === undefined || !onSearchChange) {
    throw new Error(
      "DataTableSearchInput must be used inside DataTableProvider or receive fields, value, and onSearchChange props."
    )
  }

  const setActiveSuggestionIndex = React.useCallback((nextIndex: number) => {
    activeIndexRef.current = nextIndex
    setActiveIndex(nextIndex)
  }, [])

  const suggestions = React.useMemo(
    () => getSearchSuggestions(value, cursor, fields),
    [cursor, fields, value]
  )
  const inputSuggestions = React.useMemo(
    () => suggestions.filter((suggestion) => suggestion.group === "input"),
    [suggestions]
  )
  const valueSuggestions = React.useMemo(
    () => suggestions.filter((suggestion) => suggestion.group === "values"),
    [suggestions]
  )
  const filterSuggestions = React.useMemo(
    () => suggestions.filter((suggestion) => suggestion.group === "filters"),
    [suggestions]
  )

  const syncEditorValue = React.useCallback(
    (
      editorInstance: Editor,
      nextValue: string,
      selection?: {
        end: number
        start: number
      }
    ) => {
      editorInstance.commands.setContent(createEditorDocument(nextValue), {
        emitUpdate: false,
        parseOptions: { preserveWhitespace: "full" },
      })

      if (selection) {
        editorInstance.commands.setTextSelection({
          from: textOffsetToDocPosition(
            editorInstance.state.doc,
            selection.start
          ),
          to: textOffsetToDocPosition(editorInstance.state.doc, selection.end),
        })
      }
    },
    []
  )

  const applySuggestion = React.useCallback(
    (editorInstance: Editor | null, suggestion: DataTableSearchSuggestion) => {
      const nextState = applySuggestionToValue(
        value,
        cursor,
        fields,
        suggestion
      )

      pendingSelectionRef.current = {
        end: nextState.selectionStart,
        start: nextState.selectionStart,
      }
      setCursor(nextState.selectionStart)
      setOpen(nextState.keepOpen)

      if (!nextState.keepOpen) {
        suppressNextFocusOpenRef.current = true
      }

      if (editorInstance) {
        syncEditorValue(
          editorInstance,
          nextState.value,
          pendingSelectionRef.current
        )
        editorInstance.commands.focus()
      }

      onSearchChange(nextState.value)
    },
    [cursor, fields, onSearchChange, syncEditorValue, value]
  )

  const editor = useEditor(
    {
      content: createEditorDocument(value),
      editorProps: {
        attributes: {
          autocapitalize: "off",
          autocomplete: "off",
          autocorrect: "off",
          class:
            "data-table-search-input-editor min-w-0 flex-1 overflow-x-auto px-2 py-0 text-sm outline-none whitespace-pre",
          spellcheck: "false",
        },
        handleKeyDown: (_view, event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            suppressNextFocusOpenRef.current = true
            setOpen(false)
            return true
          }

          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActiveSuggestionIndex(
              moveActiveIndex(
                activeIndexRef.current,
                latestSuggestionsRef.current.length,
                1
              )
            )
            return true
          }

          if (event.key === "ArrowUp") {
            event.preventDefault()
            setOpen(true)
            setActiveSuggestionIndex(
              moveActiveIndex(
                activeIndexRef.current,
                latestSuggestionsRef.current.length,
                -1
              )
            )
            return true
          }

          if (event.key === "Tab") {
            const activeSuggestion =
              latestSuggestionsRef.current[activeIndexRef.current]

            if (!openRef.current || !activeSuggestion) {
              return false
            }

            event.preventDefault()
            applySuggestionRef.current(editor, activeSuggestion)
            return true
          }

          if (event.key === "Enter") {
            event.preventDefault()
            event.stopPropagation()

            const activeSuggestion =
              latestSuggestionsRef.current[activeIndexRef.current]

            if (openRef.current && activeSuggestion) {
              applySuggestionRef.current(editor, activeSuggestion)
            } else {
              setCursor(getCursorOffset(editor))
            }

            return true
          }

          return false
        },
        handlePaste: (view, event) => {
          const pastedText = event.clipboardData?.getData("text/plain")

          if (typeof pastedText !== "string") {
            return false
          }

          event.preventDefault()
          view.dispatch(
            view.state.tr.insertText(
              normalizeSingleLineText(pastedText),
              view.state.selection.from,
              view.state.selection.to
            )
          )
          return true
        },
      },
      extensions: [
        Document,
        Paragraph,
        Text,
        Placeholder.configure({
          placeholder,
        }),
        DataTableSelectorHighlighter,
        Extension.create({
          name: "singleLineSearchBehavior",
          addKeyboardShortcuts() {
            return {
              Enter: () => true,
            }
          },
        }),
      ],
      immediatelyRender: true,
      onSelectionUpdate: ({ editor: nextEditor }) => {
        setCursor(getCursorOffset(nextEditor))
      },
      onUpdate: ({ editor: nextEditor }) => {
        const nextValue = getPlainText(nextEditor.state.doc)

        setCursor(getCursorOffset(nextEditor))

        if (nextValue !== valueRef.current) {
          onSearchChange(nextValue)
        }

        setOpen(true)
      },
    },
    []
  )

  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  React.useEffect(() => {
    openRef.current = open
  }, [open])

  React.useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  React.useEffect(() => {
    latestSuggestionsRef.current = suggestions
  }, [suggestions])

  React.useEffect(() => {
    applySuggestionRef.current = applySuggestion
  }, [applySuggestion])

  React.useEffect(() => {
    itemRefs.current.length = suggestions.length
  }, [suggestions.length])

  React.useEffect(() => {
    selectorHighlighterState.fields = fields as DataTableSearchField<unknown>[]
  }, [fields])

  React.useEffect(() => {
    if (!editor) {
      return
    }

    editor.view.dispatch(editor.state.tr.setMeta(selectorRefreshKey, true))
  }, [editor, fields])

  React.useEffect(() => {
    if (!editor) {
      return
    }

    const nextSelection = pendingSelectionRef.current
    const editorValue = getPlainText(editor.state.doc)

    if (editorValue !== value) {
      syncEditorValue(editor, value, nextSelection ?? undefined)
    } else if (nextSelection) {
      editor.commands.setTextSelection({
        from: textOffsetToDocPosition(editor.state.doc, nextSelection.start),
        to: textOffsetToDocPosition(editor.state.doc, nextSelection.end),
      })
    }

    pendingSelectionRef.current = null
    setCursor(getCursorOffset(editor))
  }, [editor, syncEditorValue, value])

  React.useEffect(() => {
    const nextCursor = Math.min(cursor, value.length)

    if (nextCursor !== cursor) {
      setCursor(nextCursor)
    }
  }, [cursor, value.length])

  React.useEffect(() => {
    const nextIndex =
      suggestions.length > 0
        ? Math.min(activeIndex, suggestions.length - 1)
        : -1

    setActiveSuggestionIndex(open ? nextIndex : -1)
  }, [activeIndex, open, setActiveSuggestionIndex, suggestions.length])

  React.useEffect(() => {
    if (!open || activeIndex < 0) {
      return
    }

    itemRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
    })
  }, [activeIndex, open])

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)

    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  React.useEffect(() => {
    if (!inputRef) {
      return
    }

    assignRefValue(inputRef, {
      focus: () => {
        editor?.commands.focus()
      },
      selectAll: () => {
        editor?.chain().focus().selectAll().run()
      },
    })

    return () => assignRefValue(inputRef, null)
  }, [editor, inputRef])

  const showLoading = isLoading
  const groupedSuggestions = [
    { items: inputSuggestions, label: undefined },
    { items: valueSuggestions, label: "Values" },
    { items: filterSuggestions, label: "Filters" },
  ] satisfies Array<{
    items: DataTableSearchSuggestion[]
    label?: string
  }>

  let flatIndex = 0

  return (
    <div ref={containerRef} className="relative min-w-64 flex-1">
      <InputGroup className="h-10 w-full text-lg focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        <InputGroupAddon align="inline-start">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center"
          >
            {showLoading ? (
              <LoaderCircle className="size-4.5 animate-spin" />
            ) : (
              <Search className="size-4.5" />
            )}
          </span>
        </InputGroupAddon>
        <div className="min-w-0 flex-1">
          <EditorContent
            editor={editor}
            onBlur={() => {
              requestAnimationFrame(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setOpen(false)
                }
                suppressNextFocusOpenRef.current = false
              })
            }}
            onClick={() => {
              setCursor(editor ? getCursorOffset(editor) : 0)
              suppressNextFocusOpenRef.current = false
              setOpen(true)
            }}
            onFocus={() => {
              setCursor(editor ? getCursorOffset(editor) : 0)

              if (suppressNextFocusOpenRef.current) {
                suppressNextFocusOpenRef.current = false
                return
              }

              setOpen(true)
            }}
          />
        </div>
        <InputGroupAddon align="inline-end">
          {value ? (
            <InputGroupButton
              aria-label="Clear search"
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                if (!editor) {
                  onSearchChange("")
                  setCursor(0)
                  setOpen(false)
                  return
                }

                pendingSelectionRef.current = { end: 0, start: 0 }
                setCursor(0)
                setOpen(false)
                syncEditorValue(editor, "", pendingSelectionRef.current)
                editor.commands.focus()
                onSearchChange("")
              }}
            >
              <XIcon className="pointer-events-none" />
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>

      {open ? (
        <div className="absolute top-full left-0 z-50 mt-1 w-full">
          <div className="max-h-[min(calc(var(--spacing(72)---spacing(9)),calc(100svh---spacing(20)))] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {suggestions.length === 0 ? (
              <div className="flex w-full justify-center py-2 text-center text-xs/relaxed text-muted-foreground">
                No items found.
              </div>
            ) : (
              <div className="max-h-[min(calc(var(--spacing(72)---spacing(9)),calc(100svh---spacing(20)))] overflow-y-auto p-1">
                {groupedSuggestions.map((group) => {
                  if (group.items.length === 0) {
                    return null
                  }

                  return (
                    <div key={group.label ?? "Input"}>
                      {group.label ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          {group.label}
                        </div>
                      ) : null}
                      {group.items.map((item) => {
                        const itemIndex = flatIndex

                        flatIndex += 1

                        return (
                          <button
                            key={item.id}
                            ref={(node) => {
                              itemRefs.current[itemIndex] = node
                            }}
                            type="button"
                            className={`relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-hidden select-none hover:bg-accent hover:text-accent-foreground ${
                              itemIndex === activeIndex
                                ? "bg-accent text-accent-foreground"
                                : ""
                            }`}
                            data-highlighted={
                              itemIndex === activeIndex ? "" : undefined
                            }
                            onClick={() => applySuggestion(editor, item)}
                            onMouseDown={(event) => {
                              event.preventDefault()
                            }}
                            onMouseEnter={() =>
                              setActiveSuggestionIndex(itemIndex)
                            }
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const DataTableSearch = DataTableSearchInput
