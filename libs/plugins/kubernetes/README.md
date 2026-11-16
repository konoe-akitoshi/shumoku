# Kubernetes topology

The bundled `kubernetes` data source reads the API of the cluster where Shumoku
runs. It shows Nodes, Pods, Services and Service backend membership from
EndpointSlices. Pod placement uses the model's hosting relationship. Links are
virtual, labelled **backend**, and do not claim that traffic has
flowed or that a NetworkPolicy permits a connection. Endpoint readiness and
termination conditions are retained in link observation metadata; no bandwidth or
traffic metrics are fabricated.

## Run in the cluster

Use a Shumoku release containing this plugin (it is not included in 0.2.0).
Helm can create the ServiceAccount bindings and enable token mounting. RBAC is
**disabled by default**. For a single namespace, use:

```yaml
kubernetesDiscovery:
  enabled: true
  namespaces: [demo]
  includeNodes: false
```

This creates a Role and RoleBinding in `demo`, with **list only** for Pods,
Services and EndpointSlices. An empty `namespaces` list defaults to the Helm
release namespace; it never means all namespaces in scoped mode. Target
namespaces must already exist. The Helm installer needs permission to create
these Roles and RoleBindings there.

To show the whole cluster, including Node placement:

```yaml
kubernetesDiscovery:
  enabled: true
  clusterWide: true
  includeNodes: true
```

This creates a ClusterRole and ClusterRoleBinding with **list only** for Nodes,
Pods, Services and EndpointSlices. No Secrets, logs, exec, nodes/proxy or write
permissions are granted. Cluster-wide mode requires an empty `namespaces` list.
You can also enable `includeNodes` in scoped mode: only Nodes get a cluster-wide
binding; Pods, Services and EndpointSlices remain confined to the listed namespaces.

A dedicated ServiceAccount is created by default. For an existing account, set
`serviceAccount.create: false` and `serviceAccount.name` to its name in the release
namespace. The chart refuses using the shared `default` account for discovery.
Token mounting is enabled automatically when discovery is enabled; explicitly
setting `serviceAccount.automountServiceAccountToken: false` is an error.

Helm configures permissions; it does **not** create the Shumoku data source.
Match the UI configuration to the permissions:

| Helm scope | Data-source configuration |
|---|---|
| `namespaces: [demo]`, `includeNodes: false` | `{"namespaces":["demo"],"includeNodes":false}` |
| `clusterWide: true`, `includeNodes: true` | `{"namespaces":[],"includeNodes":true}` |

In the administrator UI add a **Kubernetes** data source, then attach it as a
source to a topology and sync it. Configuration example:

```json
{ "namespaces": ["demo"], "includeNodes": false }
```

An empty namespace list selects all namespaces and requires cluster-wide RBAC.
The connection test checks Service list access; a sync checks access to all
required resources. Any API failure fails the sync rather than returning a
partial replacement topology. To remove chart-managed access, set `kubernetesDiscovery.enabled: false` and
upgrade the release. Detach the data source and set
`serviceAccount.automountServiceAccountToken: false` if no longer used. Other
RoleBindings granted outside this chart are not affected.

The token and CA are read from the standard projected ServiceAccount directory
on every request. Tokens are never put in data-source configuration. TLS
verification is mandatory and redirects are refused. This first version does
not support remote kubeconfigs or watch streams; it uses the existing source
sync mechanism and follows Kubernetes list pagination.

## Data handling and limits

- Kubernetes Pod list responses contain full Pod specs. The converter copies only
  names, namespaces, UIDs, scheduling, phase and IP into the topology; it does not
  copy environment variables, container arguments, annotations or full API bodies.
  ServiceAccount RBAC still grants Pod reads, so namespace scoping matters.
- Object UIDs identify resources. Pod/Service IPs are displayed as descriptions,
  not cross-source identity keys: reused IPs and hostNetwork Pods must not merge
  unrelated objects.
- Backend links require a Pod targetRef with a matching UID in the same namespace.
  Stale UID references, IP-only external endpoints and unknown targets are omitted.
  IPv4/IPv6 and multiple slice observations collapse into one Service–Pod link;
  distinct endpoint conditions are retained in observation metadata. Ports are not modelled in this MVP.
- Headless Services use EndpointSlices too. ExternalName Services display their
  DNS alias without probing it or inventing a backend.
- This uses several list requests, not a transaction across API resources. Objects
  changing during a sync may appear on the next sync. A list is limited to 100
  pages of 500 objects; narrow namespaces for larger clusters.
- Public demos should expose viewer access only. Cluster-wide RBAC needs the
  cluster operator's review; the showcase's application-only Helm directory is
  not permission to install cluster roles.

References: [API access from a Pod](https://kubernetes.io/docs/tasks/run-application/access-api-from-pod/),
[EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/).

## Example

Synthetic fixture: a Service with two backend Pods on one Node. Namespace is included
in each resource label; Node frames show scheduling rather than namespace grouping.

![Synthetic Kubernetes topology](example.png)
