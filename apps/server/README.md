# @shumoku/server

Real-time network topology visualization and monitoring server for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Connect data sources, overlay live metrics and alerts on your diagrams, build dashboards, and share read-only views.

A **Bun + [Hono](https://hono.dev)** API with an SQLite store and a **SvelteKit** web UI, split into two workspaces:

- [`api/`](api) — `@shumoku/server-api`: HTTP + WebSocket, SQLite, the data-source plugin loader
- [`web/`](web) — `@shumoku/server-web`: SvelteKit single-page UI

> The server **runs from source** — it is not a published npm package. Use Docker, the workspace dev scripts, or a build (below).

## Features

- **Multi-source** — Zabbix, Prometheus, NetBox, Grafana, Aruba Instant On, and SNMP/LLDP network discovery
- **Real-time metrics** — WebSocket live updates for link utilization and node status
- **Weathermap** — links color-coded by traffic load
- **Dashboards** — gridstack widget layouts combining topologies and metrics
- **Shareable links** — token-gated, read-only public views (no login)
- **Interactive diagrams** — pan, zoom, drill-in
- **Docker-ready** — single container with SQLite persistence

## Quick start

### Docker image (quickest — no clone)

Pull the published image from GitHub Container Registry:

```bash
docker run -d -p 8080:8080 -v shumoku-data:/data \
  ghcr.io/konoe-akitoshi/shumoku:latest          # http://localhost:8080

# preload a sample network:
docker run -d -p 8080:8080 -e DEMO_MODE=true ghcr.io/konoe-akitoshi/shumoku:latest
```

Tags: `X.Y.Z` is the immutable production release and `latest` follows the
newest stable release. `X.Y.Z-beta.N` is an immutable beta and `beta` follows
the newest beta. Main and pull requests are built without being pushed. See the
[container package](https://github.com/konoe-akitoshi/shumoku/pkgs/container/shumoku)
and the [release process](../../docs/releasing.md).

For production, pin an exact version rather than `latest`:

```bash
docker run -d -p 8080:8080 -v shumoku-data:/data \
  ghcr.io/konoe-akitoshi/shumoku:0.1.1
```

Test the newest beta without changing `latest`:

```bash
docker run -d -p 8080:8080 -v shumoku-beta-data:/data \
  ghcr.io/konoe-akitoshi/shumoku:beta
```

### Docker Compose

```bash
cd apps/server
SHUMOKU_VERSION=0.1.1 docker compose up -d
SHUMOKU_PORT=80 docker compose up -d    # production port
DEMO_MODE=true docker compose up -d     # preload a sample network
```

Upgrade by changing `SHUMOKU_VERSION`, then recreating the service:

```bash
docker compose pull
docker compose up -d
```

### From the repo root (Bun, dev)

```bash
bun install
bun run dev:server     # turbo: API (:8080) + web UI (:5173, HMR)
```

### From apps/server (Bun)

```bash
cd apps/server
make setup     # first run: install deps + build
make dev       # dev server (or: bun run dev)
make start     # production (or: bun run start)
make help      # list all targets
```

Web UI: **http://localhost:8080** (prod) or **http://localhost:5173** (dev — proxies `/api` and `/ws` to `:8080`).

## Data sources

Configured entirely from the web UI — forms render generically from each plugin's schema (no per-plugin UI code). Bundled plugins (see each one's README under [`libs/plugins`](../../libs/plugins)):

| Source | Pulls |
|--------|-------|
| **Zabbix** | metrics, hosts, LLDP topology, alerts |
| **Prometheus** | metrics, hosts, alerts (Alertmanager) |
| **NetBox** | topology, hosts |
| **Grafana** | alerts (webhook or Alertmanager) |
| **Aruba Instant On** | hosts, metrics, alerts |
| **Network discovery** | SNMP + LLDP seed-crawl (autoscan) |

## Web UI

| Path | Description |
|------|-------------|
| `/` | Home / overview |
| `/topologies`, `/topologies/:id` | Topology list and live viewer |
| `/dashboards` | Custom widget dashboards |
| `/datasources` | Data source configuration |
| `/plugins` | Installed plugins |
| `/settings` | Application settings |
| `/share/:token` | Public, read-only shared view |
| `/login` | Authentication |

## API

Base path `/api`. (`/api/auth` and `/api/share` are public; everything else requires a session.)

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check with running build metadata |
| `GET /api/system` | Current build and cached latest-release information |
| `/api/auth/*` | Authentication |
| `/api/datasources`, `/:id/test`, `/:id/scan` | Data source CRUD, connection test, discovery scan |
| `/api/plugins` | Plugin registry |
| `/api/topologies`, `/:id/render` | Topology CRUD and SVG/HTML render |
| `/api/topologies/:id/sources` | Data sources linked to a topology |
| `/api/topologies/:id/observations`, `/resolved` | Observation history and resolved graph |
| `/api/topologies/:id/discovery-policy` | Network discovery rules |
| `/api/dashboards` | Dashboard CRUD |
| `/api/settings` | Application settings |
| `/api/webhooks` | Inbound webhooks (e.g. Grafana alerts) |
| `/api/share/*` | Public shared topology / dashboard views |
| `GET /api/runtime.js` | Interactive render runtime (IIFE) for the browser |
| `/ws` | WebSocket — real-time metrics stream |

### WebSocket

Connect to `ws://<host>/ws` for real-time metrics.

**Client → server:**

```javascript
{ "type": "subscribe", "topology": "<topology-id>" }
{ "type": "filter", "nodes": ["router1"], "links": ["link-0"] }
```

**Server → client:**

```javascript
{
  "type": "metrics",
  "data": {
    "nodes": { "router1": { "status": "up" } },
    "links": { "link-0": { "status": "up", "utilization": 45.2 } },
    "timestamp": 1705849200000
  }
}
```

## Topology YAML

```yaml
name: My Network
nodes:
  - id: router1
    label: Core Router
    type: router
  - id: switch1
    label: Distribution Switch
    type: l2-switch
links:
  - from: router1
    to: switch1
    bandwidth: 10G
```

See the [YAML Reference](https://www.shumoku.dev/docs/npm/yaml-reference) for the full format.

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `HOST` | Bind address | `0.0.0.0` |
| `DATA_DIR` | SQLite data directory | `/data` |
| `SHUMOKU_PORT` | External port (Docker Compose) | `8080` |
| `DEMO_MODE` | Load the sample network on an empty DB (`true`/`false`) | `false` |
| `SHUMOKU_UPDATE_CHECK` | Set to `off` to disable GitHub release checks | enabled |
| `SHUMOKU_GITHUB_TOKEN` | Optional token for a higher GitHub API rate limit | — |

Configuration is otherwise stored in SQLite (`$DATA_DIR/shumoku.db`) and managed from the web UI.

## Deployment

### Docker (recommended)

Use the [published image](https://github.com/konoe-akitoshi/shumoku/pkgs/container/shumoku)
(`ghcr.io/konoe-akitoshi/shumoku`). The included Compose file pulls that image:

```bash
cd apps/server
docker compose up -d
```

`compose.yaml` persists data in the `shumoku-data` volume:

```yaml
services:
  shumoku:
    image: ghcr.io/konoe-akitoshi/shumoku:${SHUMOKU_VERSION:-latest}
    ports:
      - "${SHUMOKU_PORT:-8080}:8080"
    volumes:
      - shumoku-data:/data
    restart: unless-stopped

volumes:
  shumoku-data:
```

```bash
docker compose up -d            # start
docker compose down             # stop
docker compose logs -f          # logs
docker compose pull             # fetch the configured release
docker compose up -d            # recreate after an upgrade
```

### Kubernetes (Helm)

A Helm chart is provided under [`chart/shumoku`](chart/shumoku):

```bash
helm install shumoku ./chart/shumoku
```

### Systemd (Linux)

Requires [Bun](https://bun.sh) and Git.

```bash
git clone https://github.com/konoe-akitoshi/shumoku.git /opt/shumoku
cd /opt/shumoku/apps/server
make setup

sudo mkdir -p /var/lib/shumoku
sudo chown shumoku:shumoku /var/lib/shumoku

sudo cp scripts/shumoku.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shumoku
```

Manage with `systemctl status|restart|stop shumoku` and `journalctl -u shumoku -f`. To update: `git pull && make setup && sudo systemctl restart shumoku`.

### Manual

```bash
cd apps/server
make setup
make start                                  # or: DATA_DIR=/path PORT=8080 bun dist/index.js
```

### Reverse proxy (nginx)

```nginx
server {
    listen 80;
    server_name shumoku.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Backup & restore

```bash
# Docker
docker compose cp shumoku:/data/shumoku.db ./backup.db    # backup
docker compose cp ./backup.db shumoku:/data/shumoku.db    # restore

# Systemd
cp /var/lib/shumoku/shumoku.db ./backup.db
```

## License

AGPL-3.0-only — part of the [Shumoku](https://github.com/konoe-akitoshi/shumoku) monorepo. For commercial licensing, contact contact@shumoku.dev.
