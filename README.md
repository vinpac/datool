# datool workspace

This repo now contains a Bun workspace for the `datool` package and runnable example projects.

## Workspace layout

- `packages/datool`: the publishable package, CLI, server runtime, built-in sources, frontend, tests, and package README
- `examples/command-jsonl`: example project backed by a local command source
- `examples/file-tail`: example project backed by a tailed local file

## Common commands

```bash
bun install
bun run build
bun run test
```

## Try the examples

```bash
cd examples/command-jsonl
bunx datool
```

```bash
cd examples/file-tail
bunx datool
```

Package usage and API docs live in [packages/datool/README.md](/Users/vinpac/lab/vite-app/packages/datool/README.md).
