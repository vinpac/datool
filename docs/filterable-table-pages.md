# Creating Filtered Table Pages

The easiest way to build a new page now is:

1. Define your row type.
2. Define your columns.
3. Wrap the page in `DataTableProvider`.
4. Render `DataTableSearchInput` and `DataTable`.

## Recommended API

```tsx
import * as React from "react"

import {
  DataTable,
  DataTableProvider,
  type DataTableColumnConfig,
  type DataTableRowAction,
} from "@/components/data-table"
import { DataTableSearchInput } from "@/components/data-table-search-input"
import { Copy } from "lucide-react"

type UserRow = {
  createdAt: string
  email: string
  id: string
  metadata: Record<string, unknown>
  status: "active" | "disabled"
}

const columns: DataTableColumnConfig<UserRow>[] = [
  { accessorKey: "email", header: "Email" },
  { accessorKey: "status", header: "Status", kind: "enum" },
  { accessorKey: "createdAt", header: "Created", kind: "date" },
  { accessorKey: "metadata", header: "Metadata", kind: "json" },
]

const rowActions: DataTableRowAction<UserRow>[] = [
  {
    icon: Copy,
    id: "copy-email",
    label: "Copy email",
    onSelect: async ({ anchorRow }) => {
      await navigator.clipboard.writeText(anchorRow.email)
    },
    scope: "row",
  },
  {
    icon: Copy,
    id: "copy-markdown",
    label: ({ actionRows }) =>
      actionRows.length > 1
        ? `Copy ${actionRows.length} rows as Markdown`
        : "Copy row as Markdown",
    onSelect: async ({ actionRows }) => {
      await navigator.clipboard.writeText(toMarkdownTable(actionRows, columns))
    },
    scope: "selection",
  },
  {
    id: "filter-matching",
    items: ({ anchorRow }) => [
      {
        id: "filter-status",
        label: `Status: ${anchorRow.status}`,
        onSelect: () => {
          // update the provider search state however your page stores it
        },
      },
    ],
    label: "Filter matching",
    scope: "row",
  },
]

export function UsersPage() {
  const [rows] = React.useState<UserRow[]>([])

  return (
    <DataTableProvider
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      id="users"
      persistSearch
      rowActions={rowActions}
    >
      <DataTableSearchInput />
      <DataTable />
    </DataTableProvider>
  )
}
```

`toMarkdownTable` is not built in. It is just a small helper that converts your selected rows into the markdown shape you want to copy.

## Column kinds

- No `kind`: plain text search.
- `kind: "enum"`: exact-match filter with options auto-detected from the current data.
- `kind: "date"`: date-aware filter with operators like `>`, `<`, `today`, and `-7d`. It also supports `dateFormat` as either `Intl.DateTimeFormatOptions` or a `date-fns` pattern string. Hover shows the full UTC timestamp, and clicking the rendered date copies the displayed value.
- `kind: "json"`: text search against the serialized value.
- `kind: "number"`: numeric filter with `:`, `>`, and `<`.

## What `DataTableProvider` does

`DataTableProvider` now owns the wiring that used to be manual:

- builds searchable fields from your columns
- parses the search query
- attaches TanStack column filter functions
- passes highlight terms into the table
- persists search in `localStorage` when `persistSearch` is enabled

That means new pages usually only care about:

- `columns`
- `data`
- `rowActions` when you want per-row or multi-row context-menu actions
- `id`
- `getRowId`
- any normal `DataTable` display props like `rowHeight`, `height`, or `rowClassName`

## Row actions

Use `rowActions` to attach [src/components/ui/context-menu.tsx](/Users/vinpac/lab/vite-app/src/components/ui/context-menu.tsx) actions to every row.

- `scope: "row"` runs against the row you right-clicked.
- `scope: "selection"` runs against the current selection when you right-click inside it, otherwise it falls back to the clicked row.
- `items` turns an action into a submenu. You can provide a static array or derive submenu items from the action context.
- `enableRowSelection` shows the checkbox column explicitly. Selection-aware actions also enable selection automatically.

Selection behavior:

- Click a row to select it.
- Click and drag across rows to sweep-select them.
- `Cmd`/`Ctrl`-click toggles a row in the selection.
- `Shift`-click selects a range.
- Right-clicking a selected row keeps the current selection, so multi-row actions like "Copy as Markdown" work naturally.

## Useful provider props

```tsx
<DataTableProvider
  columns={columns}
  data={rows}
  fieldOptions={{
    status: ["ACTIVE", "DISABLED", "INVITED"],
  }}
  getRowId={(row) => row.id}
  height="100%"
  id="users"
  persistSearch
  rowActions={rowActions}
  rowHeight={32}
>
  <DataTableSearchInput />
  <DataTable />
</DataTableProvider>
```

Use `fieldOptions` when an enum column should keep a stable set of values even if the current dataset does not include every option.

## When to use the low-level utilities

Most pages should not need them anymore.

The lower-level search helpers still exist, but they are now mainly for advanced cases where you need custom wiring outside `DataTableProvider`.

For the normal case, [src/App.tsx](/Users/vinpac/lab/vite-app/src/App.tsx) is the reference implementation.
