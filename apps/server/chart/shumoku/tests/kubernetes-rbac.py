#!/usr/bin/env python3
"""Verify rendered permissions, namespace scope and ServiceAccount wiring."""
import subprocess
from pathlib import Path

import yaml

CHART = Path(__file__).resolve().parent.parent


def render(*settings, namespace="shumoku", failure=None):
    command = ["helm", "template", "test", str(CHART), "--namespace", namespace]
    for setting in settings:
        command += ["--set", setting]
    result = subprocess.run(command, capture_output=True, text=True)
    if failure:
        assert result.returncode != 0 and failure in result.stderr, result.stderr
        return []
    assert result.returncode == 0, result.stderr
    return [doc for doc in yaml.safe_load_all(result.stdout) if doc]


def kinds(docs, kind):
    return [doc for doc in docs if doc["kind"] == kind]


def permissions(role):
    result = set()
    for rule in role["rules"]:
        assert rule["verbs"] == ["list"], rule
        assert not rule.get("nonResourceURLs"), rule
        for group in rule["apiGroups"]:
            result.update((group, resource) for resource in rule["resources"])
    return result


NAMESPACED = {("", "pods"), ("", "services"), ("discovery.k8s.io", "endpointslices")}
POD_ONLY = NAMESPACED.copy()
NAMESPACED |= {("apps", name) for name in ["deployments", "replicasets", "statefulsets", "daemonsets"]}
NAMESPACED |= {("batch", name) for name in ["jobs", "cronjobs"]}
NODES = {("", "nodes")}
ENABLED = "kubernetesDiscovery.enabled=true"

for settings in [(), ("kubernetesDiscovery.clusterWide=true", "kubernetesDiscovery.includeNodes=true")]:
    docs = render(*settings)
    assert not any(kinds(docs, kind) for kind in ["Role", "RoleBinding", "ClusterRole", "ClusterRoleBinding"])
    assert "automountServiceAccountToken" not in kinds(docs, "Deployment")[0]["spec"]["template"]["spec"]

# Scoped defaults only grant access to the release namespace, never Nodes.
docs = render(ENABLED)
role = kinds(docs, "Role")[0]
assert role["metadata"]["namespace"] == "shumoku"
assert permissions(role) == NAMESPACED
assert not kinds(docs, "ClusterRole")
assert kinds(docs, "Deployment")[0]["spec"]["template"]["spec"]["automountServiceAccountToken"] is True

for cluster_wide in [False, True]:
    for include_nodes in [False, True]:
        settings = [ENABLED, f"kubernetesDiscovery.clusterWide={str(cluster_wide).lower()}",
                    f"kubernetesDiscovery.includeNodes={str(include_nodes).lower()}",
                    "serviceAccount.create=false", "serviceAccount.name=existing-reader"]
        if not cluster_wide:
            settings += ["kubernetesDiscovery.namespaces={demo,other,demo}"]
        docs = render(*settings)
        roles = kinds(docs, "Role")
        cluster_roles = kinds(docs, "ClusterRole")
        assert len(roles) == (0 if cluster_wide else 2)
        assert len(cluster_roles) == (1 if cluster_wide or include_nodes else 0)
        for role in roles:
            assert role["metadata"]["namespace"] in {"demo", "other"}
            assert permissions(role) == NAMESPACED
        for role in cluster_roles:
            assert permissions(role) == ((NAMESPACED if cluster_wide else set()) | (NODES if include_nodes else set()))
        for kind, role_kind in [("RoleBinding", "Role"), ("ClusterRoleBinding", "ClusterRole")]:
            bindings = kinds(docs, kind)
            assert len(bindings) == len(kinds(docs, role_kind))
            for binding in bindings:
                assert binding["subjects"] == [{"kind": "ServiceAccount", "name": "existing-reader", "namespace": "shumoku"}]
                assert binding["roleRef"]["kind"] == role_kind
                assert any(role["metadata"]["name"] == binding["roleRef"]["name"] for role in kinds(docs, role_kind))
        assert not kinds(docs, "ServiceAccount")

assert permissions(kinds(render(ENABLED, "kubernetesDiscovery.includeWorkloads=false"), "Role")[0]) == POD_ONLY

names = []
for namespace in ["one", "two"]:
    docs = render(ENABLED, "kubernetesDiscovery.clusterWide=true", "fullnameOverride=" + "a" * 63, namespace=namespace)
    name = kinds(docs, "ClusterRole")[0]["metadata"]["name"]
    assert len(name) <= 63
    names.append(name)
assert len(set(names)) == 2

render(ENABLED, "serviceAccount.create=false", failure="dedicated")
render(ENABLED, "serviceAccount.automountServiceAccountToken=false", failure="automountServiceAccountToken")
render(ENABLED, "kubernetesDiscovery.clusterWide=true", "kubernetesDiscovery.namespaces={demo}", failure="must be empty")
render(ENABLED, "kubernetesDiscovery.namespaces=demo", failure="must be a list")
render(ENABLED, "kubernetesDiscovery.namespaces={../bad}", failure="valid namespace")
render(ENABLED, "kubernetesDiscovery.clusterWide=oops", failure="must be a boolean")
print("Kubernetes RBAC rendering checks passed")

GATEWAY = {("gateway.networking.k8s.io", r) for r in ["gateways", "httproutes", "referencegrants"]}
for cluster_wide in [False, True]:
    docs = render(ENABLED, "kubernetesDiscovery.includeGatewayAPI=true", f"kubernetesDiscovery.clusterWide={str(cluster_wide).lower()}")
    role = kinds(docs, "ClusterRole" if cluster_wide else "Role")[0]
    assert permissions(role) == NAMESPACED | GATEWAY
render(ENABLED, "kubernetesDiscovery.includeGatewayAPI=oops", failure="must be a boolean")

# Hubble only mounts a named Secret; it never grants Kubernetes Secret read access.
for tls in [False, True]:
    settings = ["hubble.enabled=true", f"hubble.tls.enabled={str(tls).lower()}"]
    if tls:
        settings += ["hubble.tls.existingSecret=hubble-client", "hubble.tls.clientAuth=true"]
    docs = render(*settings)
    spec = kinds(docs, "Deployment")[0]["spec"]["template"]["spec"]
    env = {e["name"]: e.get("value") for e in spec["containers"][0]["env"]}
    assert env["SHUMOKU_HUBBLE_ENABLED"] == "true"
    assert env["SHUMOKU_HUBBLE_INSECURE"] == str(not tls).lower()
    volumes = [v for v in spec["volumes"] if v["name"] == "hubble-tls"]
    assert len(volumes) == int(tls)
    if tls:
        assert volumes[0]["secret"]["secretName"] == "hubble-client"
        assert len(volumes[0]["secret"]["items"]) == 3
    assert not kinds(docs, "Role") and not kinds(docs, "ClusterRole")
render("hubble.enabled=true", "hubble.tls.enabled=false", "hubble.tls.existingSecret=bad", failure="TLS credentials")
render("hubble.enabled=true", "hubble.tls.clientAuth=true", failure="requires tls.existingSecret")
render("hubble.enabled=true", "hubble.address=https://bad", failure="host:port")
