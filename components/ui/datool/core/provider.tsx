"use client"

import * as React from "react"
import type { UseQueryResult } from "@tanstack/react-query"

import type { SearchField } from "@/components/ui/datool/search-bar"
import type {
  DatoolCollectionQueryDefinition,
  DatoolEntityQueryDefinition,
  DatoolInstance,
  DatoolQueryDefinition,
  DatoolQuerySearch,
  DatoolSliceApi,
  DatoolStateShape,
} from "./types"

type DatoolSearchSourceValue = {
  fields: SearchField<any>[]
  signature: string
}

type DatoolStore<TState extends DatoolStateShape> = {
  getInitialState: () => TState
  getState: () => TState
  setSlice: (
    key: Extract<keyof TState, string>,
    update:
      | Partial<TState[Extract<keyof TState, string>]>
      | ((
          current: TState[Extract<keyof TState, string>]
        ) =>
          | Partial<TState[Extract<keyof TState, string>]>
          | TState[Extract<keyof TState, string>])
  ) => void
  subscribe: (listener: () => void) => () => void
}

type InternalDatoolInstance<TState extends DatoolStateShape> =
  DatoolInstance<TState> & {
    __getDefinitions: () => Record<string, DatoolQueryDefinition<any, any, any, any>>
  }

export type DatoolViewerSettingsColumn = {
  id: string
  kind?: string
  label: string
  visible: boolean
}

export type DatoolViewerSettingsExportAction = {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
}

export type DatoolViewerSettings = {
  columns: DatoolViewerSettingsColumn[]
  exportActions: DatoolViewerSettingsExportAction[]
  groupedColumnIds: string[]
  onClearGrouping: () => void
  onToggleGrouping: (columnId: string, grouped: boolean) => void
  onToggleColumn: (columnId: string, visible: boolean) => void
}

type DatoolViewerSettingsStore = {
  ref: React.RefObject<DatoolViewerSettings | null>
  listeners: Set<() => void>
}

type DatoolContextValue = {
  datool: InternalDatoolInstance<any>
  resetView: (queryId: string) => void
  searchSourceByQueryId: Record<string, DatoolSearchSourceValue | undefined>
  clearSearchSource: (queryId: string) => void
  setSearchSource: (
    queryId: string,
    source: DatoolSearchSourceValue
  ) => void
  viewRevisionByQueryId: Record<string, number>
  viewerSettingsStore: DatoolViewerSettingsStore
  setViewerSettings: (settings: DatoolViewerSettings | null) => void
}

export type DatoolQueryValue<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = {
  datool: DatoolInstance<TState>
  definition: DatoolQueryDefinition<TData, TFilters, TState, TRow>
  filters: TFilters
  id: string
  resetView: () => void
  result: UseQueryResult<TData>
  rows: TRow[]
  state: DatoolSliceApi<TFilters>
  viewRevision: number
}

export type DatoolProviderProps = {
  children: React.ReactNode
  datool: DatoolInstance<any>
}

function cloneState<TState extends DatoolStateShape>(state: TState) {
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, { ...value }])
  ) as TState
}

function shallowEqualObjects(
  left: Record<string, unknown>,
  right: Record<string, unknown>
) {
  if (left === right) {
    return true
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => Object.is(left[key], right[key]))
}

function createDatoolStore<TState extends DatoolStateShape>(
  initialState: TState
): DatoolStore<TState> {
  const initialSnapshot = cloneState(initialState)
  const listeners = new Set<() => void>()
  let state = cloneState(initialState)

  return {
    getInitialState: () => initialSnapshot,
    getState: () => state,
    setSlice: (key, update) => {
      const currentSlice = state[key]
      const nextPatch =
        typeof update === "function" ? update(currentSlice) : update
      const nextSlice = {
        ...currentSlice,
        ...nextPatch,
      }

      if (shallowEqualObjects(currentSlice, nextSlice)) {
        return
      }

      state = {
        ...state,
        [key]: nextSlice,
      }

      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function mergeSearchFields<Row extends Record<string, unknown>>(
  currentFields: SearchField<Row>[],
  nextFields: SearchField<Row>[]
) {
  const currentFieldById = new Map(
    currentFields.map((field) => [field.id, field] as const)
  )

  return nextFields.map<SearchField<Row>>((field) => {
    const currentField = currentFieldById.get(field.id)

    if (!currentField) {
      return field
    }

    return {
      ...field,
      options:
        field.options || currentField.options
          ? Array.from(
              new Set([...(currentField.options ?? []), ...(field.options ?? [])])
            )
          : undefined,
      sample: field.sample ?? currentField.sample,
    }
  })
}

function getSearchSourceSignature(
  fields: SearchField<Record<string, unknown>>[]
) {
  return JSON.stringify(
    fields.map((field) => ({
      id: field.id,
      kind: field.kind,
      options: field.options ?? null,
      sample: field.sample ?? null,
    }))
  )
}

function getCollectionRows<
  TData,
  TFilters extends Record<string, unknown>,
  TState extends DatoolStateShape,
  TRow extends Record<string, unknown>,
>(
  definition: Extract<
    DatoolQueryDefinition<TData, TFilters, TState, TRow>,
    { kind: "collection" }
  >
) {
  if (definition.getRows) {
    return definition.getRows(definition.result.data)
  }

  return Array.isArray(definition.result.data)
    ? (definition.result.data as TRow[])
    : []
}

function resolveDefaultQueryId(
  datool: InternalDatoolInstance<any>,
  definitions: Record<string, DatoolQueryDefinition<any, any, any, any>>
) {
  const queryEntries = Object.entries(definitions)

  if (queryEntries.length === 0) {
    throw new Error("DatoolProvider requires at least one registered query.")
  }

  if (datool.defaultQuery) {
    if (!definitions[datool.defaultQuery]) {
      throw new Error(`Unknown default datool query "${datool.defaultQuery}".`)
    }

    return datool.defaultQuery
  }

  if (queryEntries.length === 1) {
    return queryEntries[0]![0]
  }

  throw new Error(
    "Datool requires a defaultQuery when more than one query is registered."
  )
}

const DatoolContext = React.createContext<DatoolContextValue | null>(null)

export function useDatool<TState extends DatoolStateShape>({
  defaultQuery,
  initialState,
}: {
  defaultQuery?: Extract<keyof TState, string>
  initialState: TState
}): DatoolInstance<TState> {
  const storeRef = React.useRef<DatoolStore<TState> | null>(null)
  const definitionsRef = React.useRef<
    Record<string, DatoolQueryDefinition<any, any, any, any>>
  >({})
  const sliceCacheRef = React.useRef<
    Partial<Record<Extract<keyof TState, string>, DatoolSliceApi<any>>>
  >({})
  const datoolRef = React.useRef<InternalDatoolInstance<TState> | null>(null)

  if (!storeRef.current) {
    storeRef.current = createDatoolStore(initialState)
  }

  definitionsRef.current = {}

  if (!datoolRef.current) {
    const getStore = () => storeRef.current!
    const ensureSliceKey = (key: string) => {
      if (!Object.prototype.hasOwnProperty.call(getStore().getState(), key)) {
        throw new Error(`Unknown datool state slice "${key}".`)
      }
    }
    const registerDefinition = (
      key: string,
      definition: DatoolQueryDefinition<any, any, any, any>
    ) => {
      ensureSliceKey(key)

      const existing = definitionsRef.current[key]

      if (existing && existing.kind !== definition.kind) {
        throw new Error(
          `Datool query "${key}" is registered with conflicting kinds.`
        )
      }

      definitionsRef.current[key] = definition
    }

    datoolRef.current = {
      __getDefinitions: () => definitionsRef.current,
      defaultQuery,
      slice: (key) => {
        ensureSliceKey(key)

        const cached = sliceCacheRef.current[key]

        if (cached) {
          return cached as DatoolSliceApi<TState[typeof key]>
        }

        const sliceApi = {
          get: () => getStore().getState()[key],
          getInitial: () => getStore().getInitialState()[key],
          set: (update) => {
            getStore().setSlice(key, update as never)
          },
          use: <TSelected,>(selector: (state: TState[typeof key]) => TSelected) =>
            React.useSyncExternalStore(
              getStore().subscribe,
              () => selector(getStore().getState()[key]),
              () => selector(getStore().getInitialState()[key])
            ),
        } satisfies DatoolSliceApi<TState[typeof key]>

        sliceCacheRef.current[key] = sliceApi

        return sliceApi
      },
      useCollection: ({ key, ...definition }) => {
        registerDefinition(key, {
          ...definition,
          kind: "collection",
        } satisfies DatoolCollectionQueryDefinition<any, any, any, any>)
      },
      useEntity: ({ key, ...definition }) => {
        registerDefinition(key, {
          ...definition,
          kind: "entity",
        } satisfies DatoolEntityQueryDefinition<any, any>)
      },
    }
  }

  datoolRef.current.defaultQuery = defaultQuery

  return datoolRef.current
}

export function DatoolProvider({ children, datool }: DatoolProviderProps) {
  const internalDatool = datool as InternalDatoolInstance<any>
  const [viewRevisionByQueryId, setViewRevisionByQueryId] = React.useState<
    Record<string, number>
  >({})
  const [searchSourceByQueryId, setSearchSourceByQueryId] = React.useState<
    Record<string, DatoolSearchSourceValue | undefined>
  >({})
  const viewerSettingsStoreRef = React.useRef<DatoolViewerSettingsStore | null>(null)
  if (!viewerSettingsStoreRef.current) {
    viewerSettingsStoreRef.current = {
      ref: { current: null },
      listeners: new Set(),
    }
  }
  const viewerSettingsStore = viewerSettingsStoreRef.current

  const resetView = React.useCallback((queryId: string) => {
    setViewRevisionByQueryId((current) => ({
      ...current,
      [queryId]: (current[queryId] ?? 0) + 1,
    }))
  }, [])
  const clearSearchSource = React.useCallback((queryId: string) => {
    setSearchSourceByQueryId((current) => {
      if (!current[queryId]) {
        return current
      }

      const next = { ...current }
      delete next[queryId]
      return next
    })
  }, [])
  const setSearchSource = React.useCallback(
    (queryId: string, source: DatoolSearchSourceValue) => {
      setSearchSourceByQueryId((current) => {
        const existing = current[queryId]
        const mergedFields = mergeSearchFields(
          (existing?.fields ?? []) as SearchField<Record<string, unknown>>[],
          source.fields as SearchField<Record<string, unknown>>[]
        )
        const mergedSignature = getSearchSourceSignature(
          mergedFields as SearchField<Record<string, unknown>>[]
        )

        if (existing?.signature === mergedSignature) {
          return current
        }

        return {
          ...current,
          [queryId]: {
            fields: mergedFields,
            signature: mergedSignature,
          },
        }
      })
    },
    []
  )
  const setViewerSettings = React.useCallback(
    (settings: DatoolViewerSettings | null) => {
      viewerSettingsStore.ref.current = settings
      viewerSettingsStore.listeners.forEach((listener) => listener())
    },
    [viewerSettingsStore]
  )

  const value = React.useMemo(
    () => ({
      clearSearchSource,
      datool: internalDatool,
      resetView,
      searchSourceByQueryId,
      setSearchSource,
      setViewerSettings,
      viewRevisionByQueryId,
      viewerSettingsStore,
    }),
    [
      clearSearchSource,
      internalDatool,
      resetView,
      searchSourceByQueryId,
      setSearchSource,
      setViewerSettings,
      viewRevisionByQueryId,
      viewerSettingsStore,
    ]
  )

  return <DatoolContext.Provider value={value}>{children}</DatoolContext.Provider>
}

export function useOptionalDatoolContext() {
  return React.useContext(DatoolContext)
}

export function useDatoolContext() {
  const context = useOptionalDatoolContext()

  if (!context) {
    throw new Error("Datool hooks must be used inside DatoolProvider.")
  }

  return context
}

export function useDatoolViewerSettings(): DatoolViewerSettings | null {
  const context = useOptionalDatoolContext()
  const store = context?.viewerSettingsStore ?? null

  return React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        if (!store) return () => {}
        store.listeners.add(onStoreChange)
        return () => { store.listeners.delete(onStoreChange) }
      },
      [store]
    ),
    () => store?.ref.current ?? null,
    () => null
  )
}

export function useDatoolQuery<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(queryId?: string) {
  const context = useDatoolContext()
  const definitions = context.datool.__getDefinitions()
  const resolvedQueryId = queryId ?? resolveDefaultQueryId(context.datool, definitions)
  const definition = definitions[resolvedQueryId] as
    | DatoolQueryDefinition<TData, TFilters, TState, TRow>
    | undefined

  if (!definition) {
    throw new Error(`Unknown datool query "${resolvedQueryId}".`)
  }

  const state = context.datool.slice(resolvedQueryId as Extract<keyof TState, string>) as
    | DatoolSliceApi<TFilters>
  const filters = state.use((current) => current)
  const rows =
    definition.kind === "collection" ? getCollectionRows(definition) : ([] as TRow[])

  return React.useMemo(
    () =>
      ({
        datool: context.datool,
        definition,
        filters,
        id: resolvedQueryId,
        resetView: () => context.resetView(resolvedQueryId),
        result: definition.result as UseQueryResult<TData>,
        rows,
        state,
        viewRevision: context.viewRevisionByQueryId[resolvedQueryId] ?? 0,
      }) satisfies DatoolQueryValue<TData, TFilters, TState, TRow>,
    [context, definition, filters, resolvedQueryId, rows, state]
  )
}

export function useDatoolCollectionQuery<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(queryId?: string) {
  const query = useDatoolQuery<TData, TFilters, TState, TRow>(queryId)

  if (query.definition.kind !== "collection") {
    throw new Error(
      `Datool query "${query.id}" is not a collection query and cannot be used here.`
    )
  }

  return query as DatoolQueryValue<TData, TFilters, TState, TRow> & {
    definition: Extract<
      DatoolQueryDefinition<TData, TFilters, TState, TRow>,
      { kind: "collection" }
    >
  }
}

export function useRegisterDatoolSearchSource<
  TRow extends Record<string, unknown> = Record<string, unknown>,
>() {
  const { setSearchSource } = useDatoolContext()

  return React.useCallback(
    (queryId: string, fields: SearchField<TRow>[]) => {
      setSearchSource(queryId, {
        fields: fields as SearchField<any>[],
        signature: getSearchSourceSignature(
          fields as SearchField<Record<string, unknown>>[]
        ),
      })
    },
    [setSearchSource]
  )
}

export function useClearDatoolSearchSource() {
  const { clearSearchSource } = useDatoolContext()

  return React.useCallback(
    (queryId: string) => {
      clearSearchSource(queryId)
    },
    [clearSearchSource]
  )
}

export function useDatoolSearch<
  TData = unknown,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
  TState extends DatoolStateShape = DatoolStateShape,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(queryId?: string) {
  const collection = useDatoolCollectionQuery<TData, TFilters, TState, TRow>(queryId)
  const context = useDatoolContext()
  const searchSource = context.searchSourceByQueryId[collection.id]
  const searchKey = collection.definition.searchKey
  const searchValue = collection.state.use((filters) => {
    if (!searchKey) {
      return ""
    }

    const value = filters[searchKey]
    return typeof value === "string" ? value : ""
  })

  const search = React.useMemo<DatoolQuerySearch | undefined>(() => {
    if (!searchKey) {
      return undefined
    }

    return {
      onChange: (next) => {
        collection.state.set({
          [searchKey]: next,
        } as unknown as Partial<TFilters>)
      },
      reset: () => {
        collection.state.set({
          [searchKey]: collection.state.getInitial()[searchKey],
        } as unknown as Partial<TFilters>)
      },
      value: searchValue,
    }
  }, [collection.state, searchKey, searchValue])

  return React.useMemo(
    () => ({
      ...collection,
      search,
      searchFields: (searchSource?.fields ?? []) as SearchField<TRow>[],
    }),
    [collection, search, searchSource]
  )
}
