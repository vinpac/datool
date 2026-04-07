import { LoaderCircle } from "lucide-react"
import * as React from "react"

import type {
  DataTableCellEditorComponent,
  DataTableCellEditorProps,
  DataTableColumnKind,
  DataTableRow,
} from "./types"

function EditorShell({
  children,
  pending,
}: {
  children: React.ReactNode
  pending: boolean
}) {
  return (
    <div className="flex h-full w-full items-center gap-2 rounded-[inherit] bg-background px-2">
      <div className="min-w-0 flex-1">{children}</div>
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  )
}

function baseInputClassName() {
  return "h-full w-full border-0 bg-transparent px-0 text-sm outline-none"
}

export function TextCellEditor<TData extends DataTableRow>({
  onBlur,
  onChange,
  onKeyDown,
  pending,
  value,
}: DataTableCellEditorProps<TData>) {
  return (
    <EditorShell pending={pending}>
      <input
        autoFocus
        className={baseInputClassName()}
        disabled={pending}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        value={value}
      />
    </EditorShell>
  )
}

export function EnumCellEditor<TData extends DataTableRow>({
  column,
  onBlur,
  onChange,
  onKeyDown,
  pending,
  value,
}: DataTableCellEditorProps<TData>) {
  return (
    <EditorShell pending={pending}>
      <select
        autoFocus
        className={baseInputClassName()}
        disabled={pending}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        value={value}
      >
        {(column.enumOptions ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </EditorShell>
  )
}

export function BooleanCellEditor<TData extends DataTableRow>({
  onBlur,
  onChange,
  onKeyDown,
  pending,
  value,
}: DataTableCellEditorProps<TData>) {
  return (
    <EditorShell pending={pending}>
      <select
        autoFocus
        className={baseInputClassName()}
        disabled={pending}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        value={value}
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    </EditorShell>
  )
}

export const DEFAULT_DATA_TABLE_CELL_EDITORS = {
  boolean: BooleanCellEditor,
  date: TextCellEditor,
  enum: EnumCellEditor,
  json: TextCellEditor,
  number: TextCellEditor,
  selection: TextCellEditor,
  text: TextCellEditor,
} satisfies Record<
  DataTableColumnKind,
  DataTableCellEditorComponent<DataTableRow>
>

export function resolveDataTableCellEditor<TData extends DataTableRow>({
  editors,
  kind,
}: {
  editors?: Partial<Record<DataTableColumnKind, DataTableCellEditorComponent<TData>>>
  kind: DataTableColumnKind
}) {
  return (
    editors?.[kind] ??
    (DEFAULT_DATA_TABLE_CELL_EDITORS[kind] as DataTableCellEditorComponent<TData>)
  )
}
