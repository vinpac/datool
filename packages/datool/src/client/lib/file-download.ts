export function sanitizeFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "datool-view"
  )
}

export function downloadTextFile(
  content: string,
  fileName: string,
  contentType: string
) {
  const blob = new Blob([content], {
    type: `${contentType};charset=utf-8`,
  })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl)
  }, 0)
}
