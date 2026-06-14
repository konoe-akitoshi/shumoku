# Contributing to Shumoku

## Development Setup

```bash
# Clone
git clone https://github.com/konoe-akitoshi/shumoku.git
cd shumoku

# Install (requires Bun)
bun install

# Build
bun run build

# Run the docs site + playground
cd apps/docs && bun run dev
```

## Project Structure

```
libs/
├── shumoku              # All-in-one package
├── @shumoku/core        # Models, parser, layout, themes, plugin kit
├── @shumoku/renderer-*  # SVG / HTML / PNG / Svelte renderers
├── @shumoku/catalog     # Device / service catalog
├── @shumoku/plugin-sdk  # HTTP client for data-source plugins
└── plugins/             # Zabbix, Prometheus, NetBox, Grafana, Aruba, network-scan

apps/
├── server               # Real-time monitoring platform (API + web)
├── editor               # Visual topology designer
├── cli                  # `shumoku render` CLI
└── docs                 # Documentation site + playground
```

## Commands

```bash
bun run build       # Build all packages
bun run dev         # Dev server
bun run typecheck   # Type check
bun run lint        # Lint
bun run format      # Format
bun run test        # Test
```

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/...`)
3. Make your changes
4. Run `bun run typecheck && bun run lint`
5. Commit and push
6. Open a Pull Request

## Code Style

- TypeScript with strict mode
- Biome for formatting and linting
- ESM modules
