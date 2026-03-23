import fs from "fs/promises"
import path from "path"

import type { DatoolClientPage } from "../shared/types"

export function getDatoolAppDirectory(cwd: string) {
  return path.join(cwd, "datool")
}

export function getGeneratedDirectory(cwd: string) {
  return path.join(cwd, ".datool", "generated")
}

export function getGeneratedManifestPath(cwd: string) {
  return path.join(getGeneratedDirectory(cwd), "manifest.ts")
}

export function getClientDistDirectory(cwd: string) {
  return path.join(cwd, ".datool", "client-dist")
}

export async function writeDatoolManifest(options: {
  cwd: string
  pages: DatoolClientPage[]
}) {
  const generatedDirectory = getGeneratedDirectory(options.cwd)
  const manifestPath = getGeneratedManifestPath(options.cwd)

  await fs.mkdir(generatedDirectory, {
    recursive: true,
  })

  const pageImports = options.pages
    .map(
      (page, index) =>
        `import * as PageModule${index} from ${JSON.stringify(page.filePath)}`
    )
    .join("\n")
  const pageEntries = options.pages
    .map(
      (page, index) => `  {
    component: PageModule${index}.default,
    id: ${JSON.stringify(page.id)},
    path: ${JSON.stringify(page.path)},
    title: ${JSON.stringify(page.title)},
  },`
    )
    .join("\n")
  const contents = `${pageImports}

import type { ComponentType } from "react"

export type DatoolManifestPage = {
  component: ComponentType
  id: string
  path: string
  title: string
}

export const manifestPages: DatoolManifestPage[] = [
${pageEntries}
]
`

  await fs.writeFile(manifestPath, contents, "utf8")

  return manifestPath
}
