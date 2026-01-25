# @shumoku/server

Real-time network topology visualization server with Zabbix integration for Shumoku.

## Features

- **Web UI Configuration**: Grafana-like interface for managing data sources and topologies
- **Real-time Metrics**: WebSocket-based live updates for link utilization and node status
- **Weathermap Visualization**: Color-coded links based on traffic utilization
- **Zabbix Integration**: Pull metrics from Zabbix monitoring system
- **Docker Ready**: Single container deployment with SQLite persistence
- **Interactive Diagrams**: Pan, zoom, and explore network topologies

## Quick Start

### Option 1: Docker (Recommended)

```bash
cd apps/server
docker compose up -d

# Use port 80 (for production)
SHUMOKU_PORT=80 docker compose up -d

# With sample network for demo
DEMO_MODE=true docker compose up -d
```

### Option 2: Local (Bun)

```bash
cd apps/server

# Setup (first time only)
make setup

# Start server
make dev

# With sample network for demo
DEMO_MODE=true make dev
```

Open http://localhost:3000 to access the Web UI.

## Available Commands

```bash
make setup      # Initial setup (install deps & build)
make dev        # Start development server
make start      # Start production server
make docker     # Start with Docker Compose
make help       # Show all commands
```

## Development

For development with hot reload:

```bash
make dev        # Start server (watches for changes)
make dev-web    # Start web UI dev server (separate terminal)
```

## Data Persistence

All configuration is stored in SQLite and managed via the Web UI:

- **Data Sources**: Configure Zabbix API connections
- **Topologies**: Upload and manage network topology YAML files
- **Settings**: Application-wide configuration

Data is persisted in `/data/shumoku.db` (Docker volume: `shumoku-data`).

## Web UI

### Pages

| Path | Description |
|------|-------------|
| `/` | Home - Dashboard overview |
| `/topologies` | Topology list and management |
| `/topologies/:id` | Topology viewer with live metrics |
| `/datasources` | Data source (Zabbix) configuration |
| `/settings` | Application settings |

### Managing Data Sources

1. Navigate to **Data Sources** in the sidebar
2. Click **Add Data Source**
3. Enter Zabbix server URL and API token
4. Click **Test Connection** to verify
5. Save the configuration

### Managing Topologies

1. Navigate to **Topologies** in the sidebar
2. Click **Add Topology**
3. Upload a YAML topology file or paste YAML content
4. Optionally link to a data source for live metrics
5. Configure Zabbix mapping for nodes and links

## API

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/datasources` | GET | List all data sources |
| `/api/datasources` | POST | Create data source |
| `/api/datasources/:id` | GET | Get data source details |
| `/api/datasources/:id` | PUT | Update data source |
| `/api/datasources/:id` | DELETE | Delete data source |
| `/api/datasources/:id/test` | POST | Test connection |
| `/api/topologies` | GET | List all topologies |
| `/api/topologies` | POST | Create topology |
| `/api/topologies/:id` | GET | Get topology details |
| `/api/topologies/:id` | PUT | Update topology |
| `/api/topologies/:id` | DELETE | Delete topology |
| `/api/topologies/:id/render` | GET | Get rendered SVG |
| `/api/health` | GET | Health check |

### WebSocket

Connect to `ws://<host>/ws` for real-time metrics.

**Client Messages:**

```javascript
// Subscribe to topology updates
{ "type": "subscribe", "topology": "<topology-id>" }

// Filter specific nodes/links
{ "type": "filter", "nodes": ["router1"], "links": ["link-0"] }
```

**Server Messages:**

```javascript
{
  "type": "metrics",
  "data": {
    "nodes": {
      "router1": { "status": "up" }
    },
    "links": {
      "link-0": { "status": "up", "utilization": 45.2 }
    },
    "timestamp": 1705849200000
  }
}
```

## Topology YAML Format

```yaml
name: My Network
nodes:
  - id: router1
    label: Core Router
    type: router
  - id: switch1
    label: Distribution Switch
    type: switch
  - id: server1
    label: Web Server
    type: server
links:
  - from: router1
    to: switch1
    bandwidth: 10G
  - from: switch1
    to: server1
    bandwidth: 1G
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `HOST` | Bind address | 0.0.0.0 |
| `DATA_DIR` | Data directory for SQLite | /data |
| `SHUMOKU_PORT` | External port (Docker Compose) | 3000 |
| `DEMO_MODE` | Load sample network on empty DB (`true`/`false`) | `false` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (SPA)                          │
│  ┌─────────┐  ┌─────────────────────────────────────────┐  │
│  │ Sidebar │  │  Main Content (Topology / Settings)     │  │
│  └─────────┘  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTP / WebSocket
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Shumoku Server (Bun)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Routes  │  │  WebSocket   │  │ Static Files │      │
│  │   /api/*     │  │    /ws       │  │  /assets/*   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services (DataSource, Topology, Metrics)            │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   SQLite     │  │  Zabbix API  │                        │
│  │   /data/     │  │  (External)  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### Option 1: Docker (Recommended)

```bash
cd apps/server
docker compose up -d
```

Data is persisted in Docker volume `shumoku-data`.

### Option 2: Systemd (Linux)

#### Prerequisites

- [Bun](https://bun.sh) runtime installed
- Git

#### Installation

```bash
# Clone repository
git clone https://github.com/konoe-akitoshi/shumoku.git /opt/shumoku
cd /opt/shumoku/apps/server

# Setup (install dependencies and build)
make setup

# Create data directory
sudo mkdir -p /var/lib/shumoku
sudo chown shumoku:shumoku /var/lib/shumoku

# Install systemd service
sudo cp scripts/shumoku.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable shumoku
sudo systemctl start shumoku
```

#### Service Management

```bash
# Status
sudo systemctl status shumoku

# Logs
sudo journalctl -u shumoku -f

# Restart
sudo systemctl restart shumoku

# Stop
sudo systemctl stop shumoku
```

#### Update

```bash
cd /opt/shumoku
git pull
cd apps/server
make setup
sudo systemctl restart shumoku
```

### Option 3: Manual

```bash
cd apps/server

# Setup (first time)
make setup

# Start (foreground)
make start

# Or with custom settings
DATA_DIR=/path/to/data PORT=8080 bun dist/index.js
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name shumoku.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Backup & Restore

```bash
# Backup (Docker)
docker compose cp shumoku:/data/shumoku.db ./backup.db

# Backup (Systemd)
cp /var/lib/shumoku/shumoku.db ./backup.db

# Restore
cp ./backup.db /var/lib/shumoku/shumoku.db
sudo systemctl restart shumoku
```

---

## Docker Compose

The `compose.yaml` provides a production-ready configuration:

```yaml
services:
  shumoku:
    build:
      context: ../..
      dockerfile: apps/server/Dockerfile
    ports:
      - "${SHUMOKU_PORT:-3000}:3000"
    volumes:
      - shumoku-data:/data
    restart: unless-stopped

volumes:
  shumoku-data:
```

### Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose up -d --build

# Backup database
docker compose cp shumoku:/data/shumoku.db ./backup.db

# Restore database
docker compose cp ./backup.db shumoku:/data/shumoku.db
```

## License

MIT
