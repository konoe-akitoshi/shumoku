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
```

## API

### NetBoxClient

```typescript
const client = new NetBoxClient({
  url: string,      // NetBox URL
  token: string     // API token
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
