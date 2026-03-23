import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const manifestPath =
  process.env.DATOOL_MANIFEST_PATH ??
  path.resolve(__dirname, "./src/client/default-manifest.tsx")
const outDir = process.env.DATOOL_CLIENT_OUTDIR ?? "client-dist"
const apiProxyTarget = process.env.DATOOL_API_PROXY_TARGET

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/client"),
      "@datool-manifest": manifestPath,
      datool: path.resolve(__dirname, "./src/client/public.tsx"),
    },
  },
  server: apiProxyTarget
    ? {
        proxy: {
          "/api": {
            changeOrigin: true,
            target: apiProxyTarget,
          },
        },
      }
    : undefined,
  build: {
    emptyOutDir: true,
    outDir,
  },
})
