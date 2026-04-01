import { ReactNode } from "react"

interface InfoTableRow {
  label: string
  value: ReactNode
}

interface InfoTableProps {
  rows: InfoTableRow[]
}

export function InfoTable({ rows }: InfoTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex border-b border-border last:border-b-0 px-4 py-5"
        >
          <div className="w-32 shrink-0 text-muted-foreground">{row.label}</div>
          <div className="flex-1 text-card-foreground">{row.value}</div>
        </div>
      ))}
    </div>
  )
}

interface InfoLinkProps {
  children: ReactNode
  href?: string
}

export function InfoLink({ children, href = "#" }: InfoLinkProps) {
  return (
    <a
      href={href}
      className="text-card-foreground decoration-dotted underline underline-offset-4 hover:text-muted-foreground transition-colors"
    >
      {children}
    </a>
  )
}
