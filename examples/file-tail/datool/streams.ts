import path from "path"

import { sources } from "datool"

export const file = sources.file({
  defaultHistory: 5,
  path: path.join(import.meta.dir, "..", "fixtures/app.log"),
})
