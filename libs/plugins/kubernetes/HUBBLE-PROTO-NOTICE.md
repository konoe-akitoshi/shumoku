# Hubble protobuf descriptor

`src/hubble-proto.json` is generated from Cilium v1.18.3:

- https://github.com/cilium/cilium/blob/v1.18.3/api/v1/observer/observer.proto
- https://github.com/cilium/cilium/blob/v1.18.3/api/v1/flow/flow.proto
- https://github.com/cilium/cilium/blob/v1.18.3/api/v1/relay/relay.proto

Copyright Authors of Hubble. SPDX-License-Identifier: Apache-2.0.
Google protobuf well-known descriptors are included by protobufjs (BSD-3-Clause).
The generated descriptor preserves field numbers and names from the upstream API;
no hand-written alternate protocol is used. Unknown protobuf fields are ignored.

To regenerate, download those files retaining observer/, flow/, relay/ directories.
Load observer/observer.proto using `new protobuf.Root().loadSync(...)` with
`keepCase: true`, a resolvePath that resolves relative imports to that download
directory (leave google/ imports to protobufjs), call resolveAll(), and write
JSON.stringify(root.toJSON()). Runtime uses this embedded descriptor so the
bundled server needs no external .proto files.

The Relay schema credits Authors of Cilium. Bundled well-known protobuf
schemas are supplied by protobufjs under its BSD-3-Clause license:
https://github.com/protobufjs/protobuf.js/blob/master/LICENSE
