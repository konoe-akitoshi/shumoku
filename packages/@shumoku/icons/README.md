# @shumoku/icons

Vendor-specific icons for Shumoku network diagrams.

## Installation

```bash
npm install @shumoku/icons @shumoku/core
```

## Supported Vendors

| Vendor | Icons | Description |
|--------|-------|-------------|
| Yamaha | 103 | Network equipment (RTX, SWX, WLX series) |
| Aruba | 55 | Wireless and switching |
| AWS | 477 | Cloud services icons |
| Juniper | 343 | Network equipment |

## Usage

```typescript
import { registerAllVendorIcons } from '@shumoku/icons'

// Register all vendor icons with @shumoku/core
registerAllVendorIcons()
```

Then use vendor icons in your YAML:

```yaml
nodes:
  - id: rt-01
    label: "Router"
    type: router
    vendor: yamaha
    model: rtx3510

  - id: ap-01
    label: "Access Point"
    type: access-point
    vendor: aruba
    model: ap-505

  - id: ec2-01
    label: "Web Server"
    vendor: aws
    service: ec2
    resource: instance
```

## Related Packages

- [`@shumoku/core`](https://www.npmjs.com/package/@shumoku/core) - Core library
- [`@shumoku/parser-yaml`](https://www.npmjs.com/package/@shumoku/parser-yaml) - YAML parser

## Documentation

- [Vendor Icons Reference](https://shumoku.packof.me/docs/vendor-icons) - Available icons
- [Playground](https://shumoku.packof.me/) - Interactive demo

## License

MIT
