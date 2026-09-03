# Huawei iMaster NCE-Campus V300R024C00 NBI — Research Notes

Source: https://support.huawei.com/enterprise/en/doc/EDOC1100409391/ (Basic Services + Monitoring sections)

## 1. Topology Management — "Query Nodes in a Topology"

- HTTP Method: `GET`
- URI: `/controller/campus/v1/networkresource/topomanager/device/node`
- Constraint: only open API operator role (tenant view + MSP-managed view), requires established session.
- Query parameters (Table 1-276):
  - `parentResId` (string, optional) — Organization or site ID, in UUID format. Example `"d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0"`.
  - `limit` (integer, optional, 0-1000) — max records returned.
  - `marker` (string, optional) — condition for querying remaining data (pagination cursor).
- Response wrapper: `errcode`, `errmsg` (null on success), `nodeData` (REFERENCE → Table 1-278 `TopoNodeDtos`), `linkData` (REFERENCE → Table 1-280 `TopoLinkDtos`).

### Table 1-278 `TopoNodeDtos`
- `nodeData`: ARRAY_REFERENCE, 0-1000 items → Table 1-279. "Topology node information."
- `hasNext`: boolean, default false — whether more data exists.
- `marker`: string — query criteria for next page.

### Table 1-279 `TopoNodeDto` (one node)
- `label` (string) — "Name of a resource." e.g. `"AP1"`.
- `resId` (string) — "Resource ID. It can be an organization ID, a site ID, or a device ID." e.g. `"d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0"`.
- `nativeId` (string) — "Native resource ID." e.g. same UUID format.
- `nodeSize` (integer) — "Node size." e.g. `64`.
- `ownerId` (int64) — "Owner." e.g. `654321`.
- `parentResId` (string) — "Upper-layer resId." e.g. UUID.
- `posX` (string, 0-64 chars) — "X coordinate of the physical view." e.g. `"103.28"`.
- `posY` (string, 0-64 chars) — "Y coordinate of the physical view." e.g. `"37.66"`.

### Table 1-280 `TopoLinkDtos`
- `linkData`: ARRAY_REFERENCE, 0-1000 items → Table 1-281. "Link data."
- `hasNext`: boolean, default false.
- `marker`: string — query criteria for next page.

### Table 1-281 `TopoLinkDto` (one link) — **KEY FINDINGS**
- `label` (string) — "Resource name." e.g. `"21980109442SL4600519_GigabitEthernet0/0/1_DHCPSW_85.7.22.2:10031_GigabitEthernet0/0/7"` (looks like `<deviceA>_<portA>_<deviceB>:<port?>_<portB>` composed name).
- `resId` (string) — "Resource ID. It can be an organization ID, a site ID, or a device ID."
- `topoId` (integer) — "Topology ID." e.g. `5000`.
- `typeId` (string) — "Link type ID." (UUID-shaped example, but semantics unclear beyond "link type ID.")
- **`leftId` (integer)** — **"Topology ID of the left node."** e.g. `0`.
- **`rightId` (integer)** — **"Topology ID of the right node."** e.g. `0`.
- **`leftFdn` (string)** — **"ResId of the left node."** e.g. UUID — i.e. this is the field that matches `nodeData[].resId` (and thus the device UUID from `/controller/campus/v3/devices` when the node is a device).
- **`rightFdn` (string)** — **"ResId of the right node."** — same as above for the right node.
- `leftObjType` (integer) — "Left node type." e.g. `0` (no enum table given in the doc for the values).
- `rightObjType` (integer) — "Right node type." e.g. `0`.
- `linkClass` (integer) — "Link type." e.g. `0` (no enum meanings given).
- `className` (string) — "Object class name." e.g. `"EntNetworkElement"`.
- `isLinkSet` (integer) — "Whether the object is a link set. This field corresponds to the Category field in the traditional topology." e.g. `0`.
- `lineType` (integer) — "Line type of the link." e.g. `0`.
- `lineWidth` (integer) — "Link bandwidth." e.g. `0`.
- `direction` (integer) — "Link direction." e.g. `0`.
- `aPortName` (string) — "Port information of end A, corresponding to leftFdn." e.g. `"GigabitEthernet0/0/24"`.
- `zPortName` (string) — "Port information at end Z, corresponding to rightFdn." e.g. `"GigabitEthernet0/0/24"`.
- **`linkStatus` (integer)** — **"Link status, including 0 (normal), 1 (unknown), 2 (major fault), 3 (emergency fault), 4 (offline), and 5 (not managed)."**

**Answer to the key question:** `leftFdn`/`rightFdn` are explicitly documented as "ResId of the left/right node" — i.e. they match `nodeData[].resId` (which itself "can be an organization ID, a site ID, or a device ID" — the device ID being the same UUID returned by `/controller/campus/v3/devices`). `leftId`/`rightId` are separate, purely-internal integer "Topology ID of the left/right node" values (distinct from `topoId` on the link itself, and not shown to map to any exposed `nodeData` integer field — nodeData has no bare `id` field, only `resId`/`nativeId` strings and `ownerId` int64). So for joining link endpoints back to devices, use `leftFdn`/`rightFdn` (→ `resId`), not `leftId`/`rightId`. Port names are carried separately in `aPortName`/`zPortName`.

### Sample Response (sanitized)
```json
{
  "errcode": "0",
  "errmsg": null,
  "nodeData": {
    "nodeData": [
      {
        "label": "AP1",
        "resId": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "nativeId": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "nodeSize": 64,
        "ownerId": 654321,
        "parentResId": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "posX": "103.28",
        "posY": "37.66"
      }
    ],
    "hasNext": false,
    "marker": "1009"
  },
  "linkData": {
    "linkData": [
      {
        "label": "21980109442SL4600519_GigabitEthernet0/0/1_DHCPSW_85.7.22.2:10031_GigabitEthernet0/0/7",
        "resId": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "topoId": 5000,
        "typeId": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "leftId": 0,
        "rightId": 0,
        "leftFdn": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "rightFdn": "d4e8513d-69f7-41bb-a3f5-b3a0fcc7b6e0",
        "leftObjType": 0,
        "rightObjType": 0,
        "linkClass": 0,
        "className": "EntNetworkElement",
        "isLinkSet": 0,
        "lineType": 0,
        "lineWidth": 0,
        "direction": 0,
        "aPortName": "GigabitEthernet0/0/24",
        "zPortName": "GigabitEthernet0/0/24",
        "linkStatus": 0
      }
    ],
    "hasNext": false,
    "marker": "1009"
  }
}
```
(Note: the doc's own sample uses `0` for most enum-like fields, so it doesn't show non-default enum values in practice — meanings above come from the Description column text, not from varied examples.)

---

## 2. "Query LAGs in LACP Mode"

- HTTP Method: `GET`
- URI: `/controller/campus/v1/networkresource/topomanager/device/{deviceId}/ethtrunk`
- Constraints: only supported by LSWs; open API operator role required; querying can be slow for large data.
- Path parameter: `deviceId` (string, 36 chars, required) — "Device ID in UUID format."
- Request Parameters: N/A (no query params beyond path).
- Response (`data` → Table 1-284 → `ethtrunk` array → Table 1-285 `EthTrunkDto`):
  - `lagId` (integer) — "LAG ID." e.g. `1`.
  - `mode` (string) — "Trunk mode. The value can be lacp or manual." e.g. `"lacp"`.
  - `hash` (string) — "Hash algorithm for port load balancing. The value can be dst-ip, dst-mac, src-ip, src-mac, src-dst-ip, src-dst-mac, enhanced, or diffluence." e.g. `"diffluence"`.
  - `leastActive` (integer) — "Minimum number of active links in an Eth-trunk." e.g. `20`.
  - `maxActive` (integer) — "Maximum number of active links." e.g. `64`.
  - `opStatus` (string) — "Operating status. The value can be up or down." e.g. `"up"`.
  - `portCount` (integer) — port count (row truncated in extraction but present, example `10`).
  - `sysPrio` (integer) — system priority, example `10`.
  - `sysId` (string) — "Local system ID." e.g. `"xx:xx:xx:xx:xx:xx"`.
  - `interfaces` (ARRAY_REFERENCE → Table 1-286 `EthTrunkInterfacesDto`) — "Interface list."
    - `ifId` (integer) — "Interface ID" e.g. `1`.
    - `ifName` (string) — "Interface name." e.g. `"interface 0/0/1"`.
    - `remPrio` (integer) — "Remote system priority." e.g. `10`.
    - `remId` (string) — "Remote system ID." e.g. `"xx:xx:xx:xx:xx:xx"`.
    - `ifOpStatus` (string) — "Operating status. The value can be up or down." e.g. `"up"`.
    - `ifWeight` (integer) — "Interface load weight." e.g. `30`.

Useful for link modeling: LAG member interfaces + remote system ID/priority per member, could help correlate Eth-Trunk members to individual physical links from the topology `linkData`.

---

## 3. "Query LLDP Information" — paging semantics

- HTTP Method: `GET`
- URI: `/controller/campus/v1/networkresource/topomanager/device/{deviceId}/neighbors`
- Constraints: only LSWs, APs, ARs, firewalls, WACs; open API operator role required.
- Path parameter: `deviceId` (string, UUID, required).
- Query parameters (Table 1-288):
  - `localIfName` (string, optional, 0-128 chars) — local interface name; if omitted, all interfaces of the device are queried.
  - **`pageIndex`** (integer, optional, range `[0-2147483647]`, **default `0`**) — "Index of the current page. If the value is equal to or lower than 0, data on all pages will be obtained."
  - **`pageSize`** (integer, optional, range `[0-2147483647]`, **default `20`**) — "Length of data on the current page. If the value of pageIndex is empty or equal to or lower than 0, this parameter is invalid."
- Response: `errcode`, `errmsg`, **`totalRecords`** (integer) — "Total number of [records]" (description truncated in extraction but clearly a total-count field, standard offset-style paging: combine with `pageIndex`/`pageSize` to know when you've reached the end, rather than a `hasNext`/`marker` cursor style like the topology API).

**Confirmed:** default `pageIndex=0` and `pageSize=20`. Passing `pageIndex<=0` returns ALL pages (pageSize is then ignored) — i.e. you can get everything in one call by leaving pageIndex unset/0, or paginate explicitly by setting pageIndex >= 1 and using `totalRecords` to know when to stop.

---

## 4. "Query Historical Performance Metrics of a Device" (Monitoring)

- HTTP Method: `GET`
- URI: `/controller/campus/v1/performanceservice/basicperformance/device/history/performance`
- Constraint: open API operator role (tenant view or MSP-managed view), established session required.
- Query parameters (Table 1-4908):
  - `deviceIds` (array<string>, optional, 0-5000 items) — "Device ID." Example: `"dd65d41c-cc4e-31e0-8823-3958d764ef6e,dd65d41c-cc4e-31e0-8823-3958d764ef6d"` (comma-separated device UUIDs, same UUID space as `/controller/campus/v3/devices`).
  - `timeGranularity` (string, optional, enum `day|week|month|year`) — "Time granularity for statistics collection."
  - `startTime` (int64, optional, `[0-9223372036854775807]`) — "Start time (GMT). The time is accurate to seconds." e.g. `1537408636` (Unix epoch seconds).
  - `endTime` (int64, optional, same range) — "End time (GMT). The time is accurate to seconds."
- Response (`HistoryQueryDataResponse` → `data` array of `DeviceHistoryData`):
  - `resultCode` (int32) — 0 (success) or 1 (failure).
  - `resultDesc` (string) — result description.
  - `data[]` → `DeviceHistoryData`:
    - `devicePerfList` (ARRAY_REFERENCE → `Table 1-4911`) — per-device board/CPU/memory/fan/power performance.
    - `sftPerfList` (ARRAY_REFERENCE → `Table 1-4916` `SfpPerfDto`) — per-device SFP/physical-interface optical performance.

### `DevicePerf` (Table 1-4911, device-level entry)
- `deviceId`, `deviceMac`, `deviceSlot` (all string) — device/slot identifiers.
- `singleDevicePerf` (REFERENCE → Table 1-4912 `SingleDevicePerf`) — "Board performance."
- `powerPerf` (REFERENCE → Table 1-4914 `PowerPerf`) — "Power supply performance."
- `fanPerf` (REFERENCE → Table 1-4915 `FanPerf`) — "Fan module performance."

### **Metric keys found** (each is `ARRAY_REFERENCE` of `{timestamp, value}` pairs — Table 1-4913 `PerfData`, confirmed via the sample JSON):
- `SingleDevicePerf`: `cpuUsage` ("CPU usage"), `memoryUsage` ("Memory usage"), `usedDiskSpace` ("Used space"), `totalDiskSpace` ("Total space"), `diskSpaceUsage` ("Disk usage"), `temperature`.
- `PowerPerf`: `ratedPower` ("Rated power of the power supply"), `realtimePower` ("Real-time power of the power supply").
- `FanPerf`: `fanSpeed` ("Fan speed"), `fanState` (int32 — "Fan module status", no enum table given).
- `SfpPerfDto` (per-SFP-slot): `deviceId`, `deviceMac`, `deviceSlot`, `interfacePerf` (ARRAY_REFERENCE → Table 1-4917 `SingleInterfacePerf`).
- `SingleInterfacePerf`: `interfaceName` (string), `transMode` (int32 — "Transport mode", no enum table given), `bandWidth` (int32), `temperature`, `rxPower` ("Receive optical power"), `txPower` ("Transmit optical power") — each an array of `{timestamp, value}`.

Each `{timestamp, value}` pair: `timestamp` and `value` are both left as empty-string placeholders in the sample (types not explicitly given in the extracted table, but by convention `timestamp` is epoch and `value` is the metric reading, likely string-encoded numbers based on the JSON sample using `""`).

Response also documents `400 Bad request` — details in the message body.

---

## 5. Alarm filter details (Monitoring: "Query Current Alarms in Batches") + separate Alarm Management section

### 5a. "Query Current Alarms in Batches" (Monitoring section, scroll/iterator style)
- HTTP Method: `POST`
- URI: `/v1/perfservice/alarms/current-alarms/action/scroll`
- Function: "Query uncleared alarms in iterative mode."
- Constraint: open API operator role, established session.
- Request body (`AlarmParamInput`, Table 1-4993):
  - `filter` (REFERENCE → Table 1-4994 `AlarmFilterData`, optional) — filter criteria.
  - `iterator` (string, optional, 0-256 chars) — "Transfer the iterator returned last time." Not needed on first call. Example value shape: `"1&-1283131115#ccf99fa3-5c2d-48a7-a7c4-94116a0f1270"`.
  - `size` (int32, optional, range `[1-100]`, **default `10`**) — "Number of records to be queried at a time."
- **`AlarmFilterData` (Table 1-4994) — the exact filter object requested:**
  - `deviceGroupIds` (array<string>, optional, 0-1000 items, each 0-64 chars) — "Site ID list." Example: `["ea25fdbf-...59ca","ea25fdbf-...58ca"]`.
  - `csn` (string, optional, 1-256 chars) — "Alarm SN."
  - **`alarmLevels`** (array<integer>, optional, 0-4 items, each in `[1-4]`) — **"Alarm severity. The value can be 1 (critical), 2 (major), 3 (minor), or 4 (warning)."** Example: `["3","4"]`. **Note: this is a different numeric scale than the topology `linkStatus` enum, and different again from the separate RESTCONF alarm API's string enum below — do not conflate the three.**
  - `keyword` (string, optional, 0-256 chars) — "Keyword for fuzzy search. Only the alarm name and device ESN can be used as keywords."
- Response (`CurrentAlarmOutput`, Table 1-4995):
  - `errcode`, `errmsg` (string).
  - `iterator` (string) — "Query iterator. This parameter does not need to be transferred for the first query." Pass the returned value back in the next request's `iterator` field to continue.
  - `data` (ARRAY_REFERENCE, 0-100 items → Table 1-4996 `AlarmRecordData`) — alarm data.
- `AlarmRecordData` fields: `csn`, `alarmName`, `alarmLevel` (int32 `[1-4]`, same 1-4 critical/major/minor/warning scale), `alarmId`, `alarmResId` ("Alarm source ID", e.g. `"OSS"`), `alarmResName`, `latestOccurUtc` (string, epoch-ms as string e.g. `"1711029340291"`), `alarmCategory` (string, e.g. `"1"` — no enum table given), `additionalInformation`, `cleared` (int32 `[0-1]`, 0=uncleared/1=cleared), `probableCause`, `repairAction`, `alarmGroupId`.
- **Iterator/termination contract**: the doc text does not explicitly state a "no more data" signal (e.g. no documented empty-iterator or `hasNext` flag) — inferred from the scroll-API pattern that the loop should stop when `data` comes back empty or shorter than `size`, but this is NOT explicitly confirmed in the doc text (marked as inferred, not verified).

### 5b. Separate "Alarm Management" top-level section — richer query: **"Query Current and Historical Alarms"**
- HTTP Method: `GET`
- URI: `/restconf/v1/data/ietf-alarms:alarms/alarm-list` (RESTCONF / IETF alarms YANG model style — a completely different, more standards-based alarm API from the scroll one above)
- Function: "Query active or historical alarms."
- Constraints:
  1. **Maximum API concurrency: 2.**
  2. In pagination mode, filter criteria (`is-cleared`, `alarm-type-qualifier`, `perceived-severity`, `resource`, `alarm-serial-number`) must stay identical across paged requests.
  3. **If start/end time are not specified, only the past 3 days of historical alarms are returned by default** — must specify `start-time`/`end-time` explicitly to reach further back.
  4. Query parameter count is limited by max URL length.
- Query parameters (Table 1-5151):
  - `is-cleared` (boolean, optional) — if unset, all alarms (cleared + uncleared) returned.
  - **`limit`** (int32, optional, `[1-5000]`, **default `1000`**) — records per page.
  - **`marker`** (string, optional, UUID format) — "Iteration sub-index" (paging cursor, distinct concept from `limit`).
  - `alarm-type-qualifier` (array<string>, optional) — Alarm ID filter.
  - **`perceived-severity`** (array<string>, optional, each item one of **`critical | major | minor | warning | indeterminate`**) — "Alarm severity. The indeterminate severity is not supported [as a filter value, per the constraint note]." **This is the IETF-standard string enum — different from the `alarmLevels` 1-4 integer scale in 5a.**
  - `resource` (array<string>, optional) — "Alarm source, that is, resource UUID. If an NE UUID is delivered, alarms on the NE and all sub-objects of the NE will be returned."
  - `start-time` / `end-time` (string, optional, ISO-8601 format e.g. `2021-09-10T00:00:00Z`) — work together; time-range query.
  - `alarm-serial-number` (array<string>, optional) — Alarm SN filter.
  - `impacted-resource` (array<string>, optional) — "List of resources (that is, service names) affected by alarms."
  - Header param: `fileLocationURI` (string, optional, SFTP URI) — path to export alarm files, e.g. `sftp://root:root@10.22.44.148:22/home/ftproot/alarm.json`.
  - Sample request URL: `...?limit=2000&is-cleared=false&start-time=2019-05-30T06:35:38Z&end-time=2019-05-30T14:35:38Z`.
- Response (`alarm-list`, Table 1-5153):
  - `alarm` (ARRAY_REFERENCE → Table 1-5154) — the alarm list.
  - `last-changed` (string, reserved) — last modification time of the list.
  - `number-of-alarms` (string, reserved).
- `alarm` object (Table 1-5154) — much richer than the scroll API's flat record, nests into sub-structures:
  - `time-created` (string, timestamp).
  - `is-acked` (boolean) — acknowledgment status.
  - `resource-alarm-parameters` (REFERENCE → Table 1-5155): `perceived-severity` (REFERENCE → Table 1-5156, string enum `indeterminate|minor|major|critical|...` — "Current alarm severity"), `is-cleared` (boolean), `status-change` (history array), `last-changed` (string) — "For a fault alarm, enter its occurrence time. For a clear alarm, enter the clearance time."
  - `x733-alarm-parameters` (REFERENCE → Table 1-5158) — X.733 standard alarm parameters.
  - `operator-state-change` (ARRAY_REFERENCE → Table 1-5159) — history of operator actions on the alarm.
  - `alarm-parameters` (REFERENCE → Table 1-5160) — "Extended parameters in the northbound alarm model, compared with IETF."
  - `common-alarm-parameters` (REFERENCE → Table 1-5161) — "General alarm attributes" (not fully expanded in this pass — likely holds device/resource name mapping fields; worth a follow-up read if the plugin needs richer alarm-to-device correlation than the scroll API's `alarmResId`/`alarmResName`).

**Recommendation for the plugin:** the scroll API (5a) is simpler (flat records, numeric severity, integer `cleared` flag) and matches typical plugin-kit alert shapes more directly. The RESTCONF API (5b) is more powerful for historical/time-ranged queries and exports but has a stricter concurrency limit (2) and a more deeply nested response shape requiring extra mapping work.

---

## 6. SSID list / Radio list APIs (Monitoring)

### "Query the SSID List of a Single Device"
- HTTP Method: `GET`
- URI: `/controller/campus/v5/performance/ssid/devicessidconfiglist`
- Constraint: "This API can be invoked by registered users" (no explicit open-API-operator-role constraint mentioned, unlike most others).
- Query parameter: `deviceId` (string, required, 36 chars UUID).
- Response (`SsidListDto`, Table 1-5093), per-SSID fields include:
  - `id` (string, 36 chars) — "ssidId".
  - `ssidName` (string) — "SSID name. This field corresponds to 'SSID Name' on the controller UI."
  - `enable` (boolean, default `false`) — whether uplink/downlink traffic rate limiting is enabled ("Service Traffic" on UI) — note: despite the generic name, the description is specifically about traffic rate limiting, not "SSID enabled/disabled".
  - `wlanId` (string, 0-8 chars) — "VLAN to which users associated with the SSID belong" ("VLAN ID" on UI) — field is misleadingly named `wlanId` but is actually the VLAN ID.
  - `authenticationMode` (string, 0-16 chars, e.g. `"open"`) — authentication mode.
  - (truncated after this point — additional fields like `upflow`/`downflow` rate-limit values likely follow but weren't captured in this pass.)

### "Query the Radio List of a Device Group or a Single Device"
- HTTP Method: `POST`
- URI: `/controller/campus/v5/performance/radio/radios`
- Query parameter: `mode` (string, required) — "Query type. The value can be `device` or `group`."
- Request body (`radioRequest`, Table 1-5083 + sample JSON): `pageIndex`, `pageSize` (default `20`), `sort`, `id`, `deviceType` (int32 `[0-10]`, "1 (AP), 2 (AR), 3 (firewall), or 4 (LSW)"), `frequencyBand` (string, "1 (2.4 GHz) or 2 (5 GHz)"), `apName` (device name filter), `timestamp`, `sortMode`, `sortColumn`.
- Response (`Radio`, Table 1-5085), per-radio fields:
  - `interferenceRatio` (integer `[0-100]`) — interference rate.
  - `frequencyBand` (int32) — 1 (2.4 GHz) or 2 (5 GHz).
  - `state` (int32 `[0-100]`) — status (no enum meanings given beyond range).
  - `deviceName` (string) — AP name.
  - **`deviceStatus`** (int32 `[0-4]`, default `0`) — **"Device status. The value can be 0 (normal), 1 (alarm), 3 (offline), or 4 (not registered)."** (note: 2 is skipped/undocumented).
  - `channelRatio` (int32 `[0-100]`) — channel utilization.
  - `deviceId` (string) — device UUID.
  - `channel` (int32 `[1-256]`) — radio channel.
  - `bandWidth` (integer `[0-2]`) — "0 (20 MHz), 1 (40 MHz), or 2 (80 MHz)."
  - `userNum` (int32 `[0-100000000]`) — number of associated users.

---

## 7. "Query Devices in Batches" vs `/controller/campus/v3/devices`

- HTTP Method: `POST`
- URI: `/v1/devicemgr/access-approvals/action/batch-query`
- Typical Scenario: "Approval-free devices in ESN-free access and all-in-one device access scenarios need to be queried."
- Function: "Query approval-free devices in batches."
- Constraint: northbound tenant and MSP administrators attached to the open API operator role, requires established session.
- Request body (Table 1-33 → Table 1-34 `BatchQueryParameters`): `queryParameters` (required REFERENCE) containing at least `keyWord` (string, optional, 0-128 chars) — device search keyword (rest of table not fully captured).

**Conclusion:** this is a *different* API from `/controller/campus/v3/devices` — it's POST-based, batch-query style, specifically for the ESN-free / approval-free / all-in-one device *approval* workflow (device onboarding approvals), not a general device inventory listing. `/controller/campus/v3/devices` (used by the existing plugin) remains the correct general-purpose device list endpoint; this API is only relevant if the plugin needs to handle approval-free device onboarding status.

---

## 8. Link Management top-level section

This is a **separate top-level sidebar section** (distinct from Basic Services' Topology Management) containing exactly one topic: **"Querying the Network Link List"**.

- HTTP Method: `GET`
- URI: `/rest/openapi/network/link` (note: different URL family — `/rest/openapi/...` vs. the `/controller/campus/v1/...` family used elsewhere — this looks like an older/parallel "traditional NMS" style link API.)
- Function: "query network link information, including the link list, total number of device records meeting the query condition, and total number of pages for displaying records."
- Constraint: northbound users, established session.
- Query parameters (Table 1-5096) — a rich source/sink (a/z) filter set:
  - `anedn` (string) — Source NE DN, e.g. `"NE=40000015"`.
  - `anename` (string) — Source NE name.
  - `aneip` (string) — Source NE IP.
  - `anestate` (integer, enum `0-3`) — Source NE status: `0` unmanaged, `1` online, `2` offline(?), `3` unknown (exact mapping for 1-3 partially captured — 0=unmanaged confirmed, others inferred symmetric with `znestate`).
  - `aportstate`/`...portstatus` fields — Source port running status (integer enum `1-7`: `1` up, `2` down, `3` testing, `4` unknown, `5` dormant, `6` notPresent, `7` lowerLayerDown).
  - `znedn`, `znename`, `zneip` — Sink (Z-end) NE DN/name/IP, mirroring the A-end fields.
  - `znestate` (integer, enum `0-3`) — Sink NE status: `0` unmanaged, `1` online, `2` offline, `3` unknown.
  - `zportdn` (string) — Sink port DN, e.g. `"e082c05b-99f6-3f25-8dd7-2bcd90a1703d"` (UUID-shaped).
  - `zportname` (string) — Sink port name, e.g. `"10GE1/0/28"`.
  - `zportip` (string) — Sink port IP.
  - `zportadminstatus` (integer, enum `1-3`).
  - **`linkstatus`** (integer, enum `0-6`): **`0` normal, `1` unknown, `2` major, `3` critical, `4` offline, `5` unmanaged, `6` faulty (major or critical fault)** — a *different* enum from both the topology `linkStatus` (0-5) and the alarm severity scales; do not conflate.
  - **`linktype`** (integer, enum `1,2,3,4,5,6,99`): **`1` LLDP, `2` side-by-side link, `3` MACARP, `4` CDP, `5` IP, `6` Eth-Trunk links generated by physical links, `99` manual.** Very useful for distinguishing discovery method per link.
  - `speed` (string) — link speed, unit Mbit/s, e.g. `"10000"`.
  - `start` (integer, default `0`) — "Start position where the query result set is returned." (offset-based paging)
  - `size` (integer, default `20`) — "Total number of returned query result sets."
  - `orderby` (string, default `"linkdn"`) — sort field.
- Response (`NorthResponse`, Table 1-5097):
  - `code` (integer: `0` success, other = failed).
  - `data` (ARRAY_REFERENCE → Table 1-5098 `LinkDataModel`).
  - `description` (string) — API invocation result description.
  - `size` (integer, default `0`) — total number of links matching the query.
  - `totalPage` (integer, default `0`) — total pages.
- `LinkDataModel` fields (Table 1-5098): `linkdn`, `linkname`, `anedn`, `anename`, `aneip` (mirrors the query filter fields, i.e. this is a fully denormalized a/z link record with NE names/IPs/DNs on both ends, plus `linkstatus`/`linktype`/`speed`) — much richer than the topology API's `TopoLinkDto`, which only carries `leftFdn`/`rightFdn` resIds and port names.

**Relevance to the plugin:** this API could be a better/alternative link discovery source than the Topology Management `linkData`, since it carries both device names/IPs directly (no need to cross-reference `nodeData`) plus an explicit `linktype` (LLDP vs. CDP vs. manual vs. Eth-Trunk-derived) and a 7-value `linkstatus` enum finer-grained than the topology one.

---

## 9. About RESTful APIs (rate limits, token lifetime, headers)

The "About RESTful APIs" section has several sub-pages; the relevant ones:

### HTTP Headers (required headers)
- `Content-Type` — MIME type of the document.
- `Accept` — MIME types the client accepts.
- `Accept-Language` — language of returned messages; **default `en-US`** if not specified.
- **`X-ACCESS-TOKEN` / `X-AUTH-TOKEN`** — "indicates the token information sent to the server. Select either X-ACCESS-TOKEN or X-AUTH-TOKEN." (confirms both header names are accepted interchangeably for the auth token, not just `X-ACCESS-TOKEN` as commonly shown in examples.)

### RESTful API Security — token lifecycle (no fixed lifetime constant documented; it's server-returned)
- Login: `POST /controller/v2/tokens` with `{"userName", "password"}` body.
- Success response: `{"errcode":"0","errmsg":"get token successfully.","data":{"expiredDate":"2016-10-25 12:03:37","token_id":"<token>"}}` — **the token's expiry (`expiredDate`) is returned dynamically by the server at login time, not a fixed documented constant** (no NBI-guide-stated default TTL such as "30 minutes" was found in this section).
- **The token is bound to the client IP address used at creation time** — "The token can only be applied to the IP address used during creation." (important operational note — a token minted from one source IP cannot be reused from another IP.)
- Every RESTful request must carry the token in `X-ACCESS-TOKEN` (or `X-AUTH-TOKEN`); a request missing this header is rejected outright.
- When the token expires, the client must re-authenticate (`POST /controller/v2/tokens` again) to get a new one — no refresh-token mechanism documented.
- Deregistration: `DELETE /controller/v2/tokens` with `{"token": "<token>"}` body — explicit logout/token revocation endpoint (a user can only deregister their own token).
- TLS: HTTPS-only interfaces; server supports TLS 1.2 by default (TLS 1.1 can be enabled for compatibility with limited cipher suites); recommended ciphers: `ECDHE-RSA-AES128-GCM-SHA256`, `ECDHE-ECDSA-AES256-SHA384`, `ECDHE-RSA-AES256-SHA384`, `ECDHE-ECDSA-AES128-SHA256`, `ECDHE-RSA-AES128-SHA256`.

### Rate limits
**No explicit global rate-limit numbers (e.g. requests/second) were found** in "About RESTful APIs" or its sub-pages. The only concurrency-style limit found anywhere in the doc is API-specific: the Alarm Management RESTCONF alarm-list API states **"Maximum concurrency of the API: 2"** (see item 5b) — this appears to be a per-API constraint documented at the individual API level, not a site-wide rate limit policy. **Marked as NOT FOUND for a general/global rate limit** — searched "About RESTful APIs", "Restrictions and Precautions", "Interface Rules", "HTTP Headers", and "RESTful API Security" sub-pages.

### Restrictions and Precautions (misc, potentially useful)
- All API request/response bodies are UTF-8 encoded.
- PUT semantics: omitted optional fields (or fields set to `null`) are NOT modified; to clear a string field, explicitly set it to `""`.
- **Host port changed from 18008 to 18002** in all current API request packets (matches the `18002` port seen throughout the sample requests above).
- URLs must be URL-encoded before invocation; special characters (`+ space / ? % # & =`) must be percent-escaped per a documented table (e.g. `&` → `%26`).
- Enum-type parameters: an out-of-range input value is silently treated as `NULL` server-side (not rejected with an error) — worth noting as a footgun for plugin request-building.

---

## Remaining work / gaps

- Item 4: `timestamp`/`value` field *types* inside the metric `{timestamp, value}` pairs weren't explicitly given a type in the extracted table (sample JSON shows them as empty strings, so likely epoch-string and numeric-string, but not confirmed from a Value-Range/Type column).
- Item 5b: `x733-alarm-parameters` (Table 1-5158), `operator-state-change` (Table 1-5159), `alarm-parameters` (Table 1-5160), and `common-alarm-parameters` (Table 1-5161) sub-tables were not expanded field-by-field — only their high-level purpose was captured. Worth a follow-up pass if the plugin needs deep alarm-to-device correlation beyond `alarmResId`/`resource`.
- Item 6: SSID list response table was truncated after `authenticationMode` — likely more fields follow (e.g. `upflow`/`downflow` rate limit values) that weren't captured.
- Item 7: `BatchQueryParameters` (Table 1-34) fields beyond `keyWord` weren't fully enumerated (not critical — this API was confirmed to be a different approval-workflow endpoint, not a device-inventory alternative).
- Global rate limit (requests/sec or similar) — NOT FOUND anywhere in the doc; only an API-specific concurrency limit (2) was found for one alarm API.
