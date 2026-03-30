# datool

`datool` is a React Query-first toolkit for rendering collections and traces with a shared provider.

## Install

```tsx
import "datool/styles.css"
import {
  ClearButton,
  DatoolDataTable,
  DatoolProvider,
  ErrorMessage,
  RefreshButton,
  SearchFilter,
} from "datool"
```

## Core idea

You register named query definitions once in `DatoolProvider`.

- Collection queries power `DatoolDataTable`, `DatoolTraceViewer`, `SearchFilter`, and row actions.
- Entity queries are still available to custom components through `useDatoolQuery("queryId")`.
- `defaultQuery` decides which query built-in controls target when no `query` prop is passed.

## Example

```tsx
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ClearButton,
  DatoolDataTable,
  DatoolProvider,
  ErrorMessage,
  RefreshButton,
  SearchFilter,
  type DatoolCollectionQueryDefinition,
} from "datool"

type Prompt = {
  id: string
  title: string
  status: string
}

type PromptFilters = {
  search: string
}

export function PromptPage({
  trpc,
}: {
  trpc: {
    prompt: {
      findMany: {
        queryOptions: (filters: PromptFilters) => {
          queryKey: readonly unknown[]
          queryFn: () => Promise<Prompt[]>
        }
      }
    }
  }
}) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = React.useState<PromptFilters>({
    search: "",
  })

  const prompts: DatoolCollectionQueryDefinition<Prompt[], PromptFilters, Prompt> = {
    filters,
    getQueryOptions: (currentFilters) =>
      trpc.prompt.findMany.queryOptions(currentFilters),
    getRowId: (row) => row.id,
    getRows: (data) => data ?? [],
    kind: "collection",
    pollingIntervalMs: 5_000,
    search: {
      onChange: (search) => {
        setFilters((current) => ({ ...current, search }))
      },
      reset: () => {
        setFilters((current) => ({ ...current, search: "" }))
      },
      value: filters.search,
    },
    setFilters,
  }

  return (
    <DatoolProvider
      defaultQuery="prompts"
      queries={{ prompts }}
      queryClient={queryClient}
    >
      <header className="flex items-center gap-2">
        <SearchFilter />
        <RefreshButton />
        <ClearButton />
      </header>

      <ErrorMessage />

      <DatoolDataTable
        columns={[
          { accessorKey: "title", header: "Title" },
          { accessorKey: "status", header: "Status", kind: "enum" },
        ]}
      />
    </DatoolProvider>
  )
}
```

## API

### `DatoolProvider`

```ts
type DatoolProviderProps = {
  children: React.ReactNode
  defaultQuery?: string
  queries: Record<string, DatoolQueryDefinition<any, any, any>>
  queryClient?: QueryClient
}
```

### Collection query definition

```ts
type DatoolCollectionQueryDefinition<TData, TFilters, TRow> = {
  kind: "collection"
  filters: TFilters
  setFilters: React.Dispatch<React.SetStateAction<TFilters>>
  getQueryOptions: (
    filters: TFilters
  ) => UseQueryOptions<TData, Error, TData, QueryKey>
  getRows: (data: TData | undefined) => TRow[]
  getRowId: (row: TRow, index: number) => string
  pollingIntervalMs?: number | false
  search?: {
    value: string
    onChange: (next: string) => void
    reset: () => void
  }
  actions?: DatoolQueryAction<TData, TFilters, TRow>[]
}
```

### Hooks

- `useDatool()`
- `useDatoolQuery(queryId?)`
- `useDatoolCollectionQuery(queryId?)`
- `useDatoolTableContext(queryId?)`
- `useDatoolTraceContext(queryId?)`

## Notes

- `ClearButton` resets Datool-managed UI state and collection search; it does not clear React Query cache.
- `RefreshButton` calls the target query's `refetch()`.
- `DatoolDataTable` and `DatoolTraceViewer` require collection queries.
