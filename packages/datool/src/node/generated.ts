import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import type { DatoolClientConfig, DatoolClientPage } from "../shared/types"

export function getDatoolAppDirectory(cwd: string) {
  return path.join(cwd, ".datool")
}

export function getGeneratedDirectory(cwd: string) {
  return path.join(cwd, ".datool", "generated")
}

export function getGeneratedManifestPath(cwd: string) {
  return path.join(getGeneratedDirectory(cwd), "manifest.ts")
}

export function getGeneratedNextAppDirectory(cwd: string) {
  return path.join(getGeneratedDirectory(cwd), "next-app")
}

export function getGeneratedNextManifestPath(cwd: string) {
  return path.join(getGeneratedNextAppDirectory(cwd), "datool-manifest.tsx")
}

export function getGeneratedNextClientConfigPath(cwd: string) {
  return path.join(getGeneratedNextAppDirectory(cwd), "datool-client-config.ts")
}

export function getClientDistDirectory(cwd: string) {
  return path.join(cwd, ".datool", "client-dist")
}

function toImportSpecifier(fromDirectory: string, absoluteFilePath: string) {
  const relativePath = path.relative(fromDirectory, absoluteFilePath)
  const normalizedPath = relativePath.split(path.sep).join("/")

  if (normalizedPath.startsWith(".")) {
    return normalizedPath
  }

  return `./${normalizedPath}`
}

function stripScriptExtension(filePath: string) {
  return filePath.replace(/\.(tsx|ts|jsx|js|mts|mjs)$/, "")
}

async function writeUtf8FileIfChanged(filePath: string, contents: string) {
  const existingContents = await fs.readFile(filePath, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  })

  if (existingContents === contents) {
    return
  }

  await fs.writeFile(filePath, contents, "utf8")
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

  await writeUtf8FileIfChanged(manifestPath, contents)

  return manifestPath
}

export async function writeDatoolNextManifest(options: {
  cwd: string
  pages: DatoolClientPage[]
}) {
  const nextAppDirectory = getGeneratedNextAppDirectory(options.cwd)
  const manifestPath = getGeneratedNextManifestPath(options.cwd)

  await fs.mkdir(nextAppDirectory, {
    recursive: true,
  })

  const pageImports = options.pages
    .map((page, index) => {
      const importPath = stripScriptExtension(
        toImportSpecifier(nextAppDirectory, page.filePath)
      )

      return `import * as PageModule${index} from ${JSON.stringify(importPath)}`
    })
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
  const contents = `"use client"

${pageImports}

import type { DatoolManifestPage } from "datool/next"

export const manifestPages: DatoolManifestPage[] = [
${pageEntries}
]
`

  await writeUtf8FileIfChanged(manifestPath, contents)

  return manifestPath
}

export async function writeDatoolNextClientConfig(options: {
  config: DatoolClientConfig
  cwd: string
}) {
  const nextAppDirectory = getGeneratedNextAppDirectory(options.cwd)
  const clientConfigPath = getGeneratedNextClientConfigPath(options.cwd)

  await fs.mkdir(nextAppDirectory, {
    recursive: true,
  })

  const contents = `import type { DatoolClientConfig } from "datool/page"

export const clientConfig: DatoolClientConfig = ${JSON.stringify(options.config, null, 2)}
`

  await writeUtf8FileIfChanged(clientConfigPath, contents)

  return clientConfigPath
}

export async function writeDatoolNextApp(options: {
  cwd: string
}) {
  const packageDirectory = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    ".."
  )
  const nextAppDirectory = getGeneratedNextAppDirectory(options.cwd)
  const appDirectory = path.join(nextAppDirectory, "app")
  const datoolAppDirectory = getDatoolAppDirectory(options.cwd)
  const sourceIdDirectory = path.join(
    appDirectory,
    "api",
    "sources",
    "[sourceId]"
  )

  await fs.mkdir(path.join(appDirectory, "api", "config"), {
    recursive: true,
  })
  await fs.mkdir(path.join(sourceIdDirectory, "rows"), {
    recursive: true,
  })
  await fs.mkdir(path.join(sourceIdDirectory, "events"), {
    recursive: true,
  })
  await fs.mkdir(path.join(sourceIdDirectory, "actions", "[actionId]"), {
    recursive: true,
  })
  await fs.mkdir(path.join(appDirectory, "[[...slug]]"), {
    recursive: true,
  })

  await writeUtf8FileIfChanged(
    path.join(nextAppDirectory, "next-env.d.ts"),
    `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`
  )

  await writeUtf8FileIfChanged(
    path.join(nextAppDirectory, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          allowJs: false,
          baseUrl: ".",
          esModuleInterop: true,
          incremental: true,
          isolatedModules: true,
          jsx: "preserve",
          lib: ["dom", "dom.iterable", "es2023"],
          module: "esnext",
          moduleResolution: "bundler",
          noEmit: true,
          plugins: [
            {
              name: "next",
            },
          ],
          resolveJsonModule: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2023",
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  )

  await writeUtf8FileIfChanged(
    path.join(nextAppDirectory, "next.config.mjs"),
    `const ignoreTypecheck = process.env.DATOOL_IGNORE_TYPECHECK === "1"

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: ignoreTypecheck,
  },
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["datool"],
}

export default nextConfig
`
  )

  await writeUtf8FileIfChanged(
    path.join(nextAppDirectory, "postcss.config.mjs"),
    `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}

export default config
`
  )

  const consumerSourcePath = toImportSpecifier(
    appDirectory,
    datoolAppDirectory
  )
  const packageClientSourcePath = toImportSpecifier(
    appDirectory,
    path.join(packageDirectory, "client")
  )

  await writeUtf8FileIfChanged(
    path.join(appDirectory, "globals.css"),
    `@import "tailwindcss";
@source "${consumerSourcePath}/**/*.{ts,tsx,js,jsx,mdx}";
@source "${packageClientSourcePath}/**/*.{ts,tsx,js,jsx}";
@import "datool/next/styles.css";
`
  )

  await writeUtf8FileIfChanged(
    path.join(appDirectory, "layout.tsx"),
    `import type { ReactNode } from "react"

import "./globals.css"

export const metadata = {
  title: "Datool",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`
  )

  await writeUtf8FileIfChanged(
    path.join(appDirectory, "[[...slug]]", "page.tsx"),
    `"use client"

import dynamic from "next/dynamic"

import { clientConfig } from "../../datool-client-config"
import { manifestPages } from "../../datool-manifest"

const DatoolNextApp = dynamic(
  () => import("datool/next").then((module) => module.DatoolNextApp),
  {
    ssr: false,
  }
)

export default function DatoolCatchAllPage() {
  return <DatoolNextApp config={clientConfig} manifestPages={manifestPages} />
}
`
  )

  await writeUtf8FileIfChanged(
    path.join(appDirectory, "api", "config", "route.ts"),
    `export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { handleDatoolConfigRequest } from "datool/next/server"

export async function GET() {
  return handleDatoolConfigRequest()
}
`
  )

  await writeUtf8FileIfChanged(
    path.join(sourceIdDirectory, "rows", "route.ts"),
    `import type { NextRequest } from "next/server"

import { handleDatoolSourceRowsRequest } from "datool/next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await context.params

  return handleDatoolSourceRowsRequest(request, sourceId)
}
`
  )

  await writeUtf8FileIfChanged(
    path.join(sourceIdDirectory, "events", "route.ts"),
    `import type { NextRequest } from "next/server"

import { handleDatoolSourceEventsRequest } from "datool/next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await context.params

  return handleDatoolSourceEventsRequest(request, sourceId)
}
`
  )

  await writeUtf8FileIfChanged(
    path.join(sourceIdDirectory, "actions", "[actionId]", "route.ts"),
    `import type { NextRequest } from "next/server"

import { handleDatoolSourceActionRequest } from "datool/next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ actionId: string; sourceId: string }> }
) {
  const { actionId, sourceId } = await context.params

  return handleDatoolSourceActionRequest(request, sourceId, actionId)
}
`
  )

  return nextAppDirectory
}
