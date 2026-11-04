# NetBox live fixtures

Seeds a throwaway NetBox with the fictional `fictional-corp` dataset
(`docs/plugins/netbox-mapping.md`, "Test dataset") and records its REST responses as fixtures in
`../src/fixtures/fictional-corp/`. Tested against NetBox 4.7.4.

## 1. Start a NetBox

Use [netbox-community/netbox-docker](https://github.com/netbox-community/netbox-docker), bound to
loopback only. In its `docker-compose.override.yml`:

```yaml
services:
  netbox:
    ports:
      - "127.0.0.1:8001:8080"
```

then `docker compose up -d` and wait until the superuser (`admin`) can log in.

## 2. Make a token

In the UI (User > API Tokens) create a token. NetBox 4.5+ tokens are v2:
the bearer value is `nbt_<key>.<token>`. Give it write access.

## 3. Seed and record

```bash
export NETBOX_URL=http://127.0.0.1:8001
export NETBOX_TOKEN='nbt_...'
bun libs/plugins/netbox/live/seed.ts     # idempotent; safe to re-run
bun libs/plugins/netbox/live/record.ts   # writes src/fixtures/fictional-corp/*.json
```

`record.ts` fetches full (not `?fields=`-trimmed) lists with `limit=1000` and strips `created`,
`last_updated`, `url`, `display_url`. Ids are kept, so re-recording a freshly seeded NetBox gives
the same files.

## How the fixtures are used

Plugin tests feed the recorded `<app>-<endpoint>.json` files to the client/converter in place of
live calls, and assert the expected input-model output from the design doc. The NetBox is not
needed to run tests; only to regenerate the fixtures.

## Deviations from the spec

- FHRP protocol `vrrp` does not exist in NetBox; `vrrp2` is used.
- The patch panel `hq-pp1` needs a device type and role, so a `generic` manufacturer,
  `patch-panel-1u` type and `patch-panel` role exist as well.
- `vc-mpls` virtual circuit type, circuit types `dark-fiber` / `internet` / `ix`, and the
  `hq-pp1` device and extra interfaces (`mgmt`, `vmk0`, `lo0`, `irb.99`) are added because
  NetBox requires them to hold the IP addresses the spec lists.
