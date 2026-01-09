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

# Run playground
cd apps/playground && bun run dev
```

## Project Structure

```
packages/
├── @shumoku/core         # Core library
├── @shumoku/parser-yaml  # YAML parser
└── @shumoku/netbox       # NetBox integration

apps/
└── playground            # Demo site
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
