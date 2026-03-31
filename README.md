# datool registry

This repo is a registry-first home for three installable shadcn items:

- `data-table`
- `trace-viewer`
- `react-query-datool`

The canonical source lives under [registry](/Users/vinpac/lab/vite-app/registry), and the generated installable JSON files are emitted to `public/r` during the build.

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
npx shadcn@latest add https://YOUR-DOMAIN/r/react-query-datool.json
```

## Source layout

- [registry/data-table](/Users/vinpac/lab/vite-app/registry/data-table): canonical `data-table` source
- [registry/trace-viewer](/Users/vinpac/lab/vite-app/registry/trace-viewer): canonical `trace-viewer` source
- [registry/react-query-datool](/Users/vinpac/lab/vite-app/registry/react-query-datool): canonical `react-query-datool` source
- [public/r](/Users/vinpac/lab/vite-app/public/r): generated registry JSON served by the site

`react-query-datool` is designed to layer on top of the installed `data-table` component, so consumer apps should install both items when using the React Query wrapper.

## Docs

- [Trace viewer guide](/Users/vinpac/lab/vite-app/docs/trace-viewer.md)
