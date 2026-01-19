# @shumoku/netbox

NetBox API client and converter for Shumoku network diagrams.

## Installation

```bash
npm install @shumoku/netbox
```

## Usage

### As a Library

```typescript
import { NetBoxClient, convertToShumoku } from '@shumoku/netbox'

// Create client
const client = new NetBoxClient({
  url: 'https://netbox.example.com',
  token: 'your-api-token'
})

// Fetch devices and convert to Shumoku format
const devices = await client.getDevices()
const cables = await client.getCables()

const graph = convertToShumoku({ devices, cables })
```

### As a CLI

```bash
# Convert NetBox data to Shumoku YAML
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_TOKEN

# Output to file
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_TOKEN -o network.yaml

# Generate SVG with legend
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_TOKEN --legend -o network.svg

# Export as NetworkGraph JSON (for integration with other tools)
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_TOKEN -f json -o network.json
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-u, --url <url>` | NetBox API URL (or set `NETBOX_URL` env var) |
| `-t, --token <token>` | API token (or set `NETBOX_TOKEN` env var) |
| `-f, --format <type>` | Output format: yaml, json, svg, html (default: auto from extension) |
| `-o, --output <file>` | Output file (default: topology.yaml) |
| `--theme <theme>` | Theme: light or dark (default: light) |
| `-s, --site <slug>` | Filter by site slug |
| `-r, --role <slug>` | Filter by device role slug |
| `--status <status>` | Filter by status |
| `--tag <slug>` | Filter by tag slug |
| `-g, --group-by <type>` | Group by: tag, site, location, prefix, none |
| `--no-ports` | Don't include port names in links |
| `--no-colors` | Don't color links by cable type |
| `--color-by-status` | Color devices by their status |
| `--legend` | Show legend in the diagram (SVG only) |
| `-d, --debug` | Show debug output (API requests/responses) |

### Integration Workflow

Export NetBox data as JSON, merge with custom data, then render:

```bash
# Step 1: Export from NetBox as JSON
npx netbox-to-shumoku -f json -o netbox.json

# Step 2: Merge or modify the JSON with your custom data (via script)
# The JSON follows the NetworkGraph schema

# Step 3: Render the final JSON to SVG or HTML
npx shumoku render merged.json -o diagram.html
```

## API

### NetBoxClient

```typescript
const client = new NetBoxClient({
  url: string,      // NetBox URL
  token: string,    // API token
  debug?: boolean   // Enable debug output (default: false)
})

// Methods
client.getDevices(): Promise<NetBoxDevice[]>
client.getCables(): Promise<NetBoxCable[]>
client.getSites(): Promise<NetBoxSite[]>
```

### convertToShumoku

```typescript
import { convertToShumoku } from '@shumoku/netbox'

const graph = convertToShumoku({
  devices: NetBoxDevice[],
  cables: NetBoxCable[],
  sites?: NetBoxSite[]
})
```

## Related Packages

- [`shumoku`](https://www.npmjs.com/package/shumoku) - Main package
- [`@shumoku/core`](https://www.npmjs.com/package/@shumoku/core) - Core library

## License

MIT
