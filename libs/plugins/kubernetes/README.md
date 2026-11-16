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
Enable the projected ServiceAccount credential in Helm values:

```yaml
serviceAccount:
  create: true
  automountServiceAccountToken: true
```

Apply the following RBAC after installing Shumoku as release `shumoku` in
namespace `shumoku`. This permits cluster-wide topology discovery. It does not
grant access to Secrets, logs, exec, nodes/proxy or writes.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: shumoku-kubernetes-reader
rules:
  - apiGroups: [""]
    resources: [nodes, pods, services]
    verbs: [list]
  - apiGroups: [discovery.k8s.io]
    resources: [endpointslices]
    verbs: [list]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: shumoku-kubernetes-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: shumoku-kubernetes-reader
subjects:
  - kind: ServiceAccount
    name: shumoku
    namespace: shumoku
```

For namespace-only access, use a Role and RoleBinding in each selected namespace,
remove `nodes` from the resource list, and set `includeNodes: false`. Do not
create a ClusterRoleBinding for that mode. The API calls are scoped to each
configured namespace; the plugin does not fetch all Pods and filter afterward.

In the administrator UI add a **Kubernetes** data source, then attach it as a
source to a topology and sync it. Configuration example:

```json
{ "namespaces": ["demo"], "includeNodes": true }
```

An empty namespace list selects all namespaces and requires cluster-wide RBAC.
The connection test checks Service list access; a sync checks access to all
required resources. Any API failure fails the sync rather than returning a
partial replacement topology. Revoke the RoleBinding/ClusterRoleBinding to
remove access, detach the source, and disable token automount if no longer used.

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
