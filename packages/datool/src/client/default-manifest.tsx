function EmptyDatoolPage() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
      No datool pages were generated.
    </div>
  )
}

export const manifestPages = [
  {
    component: EmptyDatoolPage,
    id: "empty",
    path: "/",
    title: "Datool",
  },
]
