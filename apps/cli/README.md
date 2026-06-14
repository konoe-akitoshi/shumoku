# @shumoku/cli

Command-line renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Turns a `NetworkGraph` YAML or JSON file into an **SVG**, interactive **HTML**, or **PNG** diagram.

## Install

No install needed — run it with `npx`:

```bash
npx shumoku render network.yaml -o diagram.svg
```

Or install globally:

```bash
npm install -g @shumoku/cli
shumoku render network.yaml -o diagram.svg
```

## Usage

```
shumoku render [options] <input>
```

| Argument / option | Description |
|-------------------|-------------|
| `<input>` | NetworkGraph YAML or JSON file. Use `-` to read from stdin. Format auto-detected from extension (`.yaml`, `.yml`, `.json`) |
| `-f, --format <type>` | Output format: `svg` \| `html` \| `png` (default: auto from output extension) |
| `-o, --output <file>` | Output file (default: `output.svg`) |
| `--theme <theme>` | `light` \| `dark` (default: `light`) |
| `--scale <number>` | PNG scale factor (default: `2`) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Examples

```bash
# SVG (default)
shumoku render network.yaml -o diagram.svg

# Interactive HTML (pan / zoom / tooltips)
shumoku render network.yaml -f html -o diagram.html

# High-resolution PNG
shumoku render network.yaml -f png -o diagram.png --scale 3

# JSON input, dark theme
shumoku render topology.json --theme dark -o diagram.svg

# Pipe from stdin
cat network.yaml | shumoku render - -o diagram.svg
```

See the [YAML Reference](https://www.shumoku.dev/docs/npm/yaml-reference) for the input format. For programmatic rendering, use the [`shumoku`](../../libs/shumoku) library directly.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
