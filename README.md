# datool registry

This repo now ships a deployable shadcn registry for two install targets:

- `data-table`
- `trace-viewer`

The source registry items live in [registry/new-york](/Users/vinpac/lab/vite-app/registry/new-york), and the generated installable JSON files are emitted to `public/r` during the build.

## Build the registry and site

```bash
bun install
bun run build
```

## Run the landing page locally

```bash
bun run dev
```

## Deploy to Vercel

The root app is a Vite site. Vercel can deploy it directly from the repo root using:

```bash
bun run build
```

After deployment, install directly from the generated item URLs:

```bash
npx shadcn@latest add https://YOUR-DOMAIN/r/data-table.json
npx shadcn@latest add https://YOUR-DOMAIN/r/trace-viewer.json
```

The original `datool` package source still lives in [packages/datool](/Users/vinpac/lab/vite-app/packages/datool).
