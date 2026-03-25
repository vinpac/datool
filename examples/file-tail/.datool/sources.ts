import path from "path"
import { fileURLToPath } from "url"

import { sources } from "datool"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

export const file = sources.file({
  defaultHistory: 1000,
  path: path.join(currentDirectory, "..", "fixtures/app.log"),
})
