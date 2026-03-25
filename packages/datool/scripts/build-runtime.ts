import { existsSync } from "fs"
import fs from "fs/promises"
import path from "path"
import { transform } from "esbuild"

const packageRoot = path.resolve(import.meta.dir, "..")
const sourceDirectory = path.join(packageRoot, "src")
const distDirectory = path.join(packageRoot, "dist")
const scriptExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return walkFiles(entryPath)
      }

      return [entryPath]
    })
  )

  return nested.flat()
}

function toOutputScriptPath(sourceFilePath: string) {
  const relativePath = path.relative(sourceDirectory, sourceFilePath)

  return path.join(
    distDirectory,
    relativePath.replace(/\.(tsx|ts|mts|cts|jsx|js|mjs|cjs)$/, ".js")
  )
}

function splitSpecifierSuffix(specifier: string) {
  const queryIndex = specifier.indexOf("?")
  const hashIndex = specifier.indexOf("#")
  let suffixStart = -1

  if (queryIndex >= 0 && hashIndex >= 0) {
    suffixStart = Math.min(queryIndex, hashIndex)
  } else if (queryIndex >= 0) {
    suffixStart = queryIndex
  } else if (hashIndex >= 0) {
    suffixStart = hashIndex
  }

  if (suffixStart === -1) {
    return {
      pathName: specifier,
      suffix: "",
    }
  }

  return {
    pathName: specifier.slice(0, suffixStart),
    suffix: specifier.slice(suffixStart),
  }
}

function rewriteRelativeSpecifier(sourceFilePath: string, specifier: string) {
  if (!specifier.startsWith(".")) {
    return specifier
  }

  const { pathName, suffix } = splitSpecifierSuffix(specifier)
  const extension = path.extname(pathName)

  if (extension) {
    if (scriptExtensions.includes(extension)) {
      return `${pathName.slice(0, -extension.length)}.js${suffix}`
    }

    return specifier
  }

  const basePath = path.resolve(path.dirname(sourceFilePath), pathName)

  for (const scriptExtension of scriptExtensions) {
    if (existsSync(`${basePath}${scriptExtension}`)) {
      return `${pathName}.js${suffix}`
    }
  }

  for (const scriptExtension of scriptExtensions) {
    if (existsSync(path.join(basePath, `index${scriptExtension}`))) {
      return `${pathName.replace(/\/$/, "")}/index.js${suffix}`
    }
  }

  return specifier
}

function rewriteModuleSpecifiers(sourceFilePath: string, sourceText: string) {
  const fromPattern = /\b(from\s*)(["'])([^"']+)\2/g
  const dynamicImportPattern = /\b(import\s*\(\s*)(["'])([^"']+)\2(\s*\))/g

  return sourceText
    .replace(fromPattern, (match, prefix, quote, specifier) => {
      const rewrittenSpecifier = rewriteRelativeSpecifier(sourceFilePath, specifier)

      if (rewrittenSpecifier === specifier) {
        return match
      }

      return `${prefix}${quote}${rewrittenSpecifier}${quote}`
    })
    .replace(
      dynamicImportPattern,
      (match, prefix, quote, specifier, suffix) => {
        const rewrittenSpecifier = rewriteRelativeSpecifier(
          sourceFilePath,
          specifier
        )

        if (rewrittenSpecifier === specifier) {
          return match
        }

        return `${prefix}${quote}${rewrittenSpecifier}${quote}${suffix}`
      }
    )
}

async function transpileSourceFile(sourceFilePath: string) {
  const sourceText = await fs.readFile(sourceFilePath, "utf8")
  const shebangMatch = sourceText.match(/^#![^\n]*\n/)
  const sourceBody = shebangMatch ? sourceText.slice(shebangMatch[0].length) : sourceText
  const rewrittenSourceText = rewriteModuleSpecifiers(sourceFilePath, sourceBody)
  const extension = path.extname(sourceFilePath)
  const loader =
    extension === ".tsx"
      ? "tsx"
      : extension === ".jsx"
        ? "jsx"
        : extension === ".js" || extension === ".mjs" || extension === ".cjs"
          ? "js"
          : "ts"
  const outputFilePath = toOutputScriptPath(sourceFilePath)
  const transformed = await transform(rewrittenSourceText, {
    format: "esm",
    jsx: loader === "tsx" || loader === "jsx" ? "automatic" : undefined,
    loader,
    sourcefile: sourceFilePath,
    target: "es2023",
  })
  const outputText = shebangMatch
    ? `${shebangMatch[0]}${transformed.code}`
    : transformed.code

  await fs.mkdir(path.dirname(outputFilePath), {
    recursive: true,
  })
  await fs.writeFile(outputFilePath, outputText, "utf8")

  if (path.relative(sourceDirectory, sourceFilePath) === path.join("node", "cli.ts")) {
    await fs.chmod(outputFilePath, 0o755)
  }
}

async function copyRuntimeAsset(sourceFilePath: string) {
  const relativePath = path.relative(sourceDirectory, sourceFilePath)
  const outputFilePath = path.join(distDirectory, relativePath)

  await fs.mkdir(path.dirname(outputFilePath), {
    recursive: true,
  })
  await fs.copyFile(sourceFilePath, outputFilePath)
}

await fs.rm(distDirectory, {
  force: true,
  recursive: true,
})

const sourceFiles = await walkFiles(sourceDirectory)

for (const sourceFilePath of sourceFiles) {
  if (sourceFilePath.endsWith(".d.ts")) {
    continue
  }

  if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(sourceFilePath)) {
    await transpileSourceFile(sourceFilePath)
    continue
  }

  if (/\.(css|module\.css)$/.test(sourceFilePath)) {
    await copyRuntimeAsset(sourceFilePath)
  }
}
