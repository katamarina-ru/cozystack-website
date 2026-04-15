---
title: Tenant System
description: "Learn about tenants, the way Cozystack helps manage resources and improve security."
weight: 17
---

## Introduction

A **tenant** in Cozystack is the primary unit of isolation and security, analogous to a Kubernetes namespace but with enhanced scope.
Each tenant represents an isolated environment with its own resources, networking, and RBAC (role-based access control).
Some cloud providers use the term "projects" for a similar entity.

Cozystack administrators and users create tenants using the [Tenant application]({{% ref "/docs/v1.2/applications/tenant" %}})
from the application catalog.
Tenants can be created via the Cozystack dashboard (UI), `kubectl`, or directly via Cozystack API.


### Tenant Nesting

All user tenants belong to the base `root` tenant.
This `root` tenant is used only to deploy user tenants and system components.
All user-side applications are deployed in their respective tenants.

Tenants can be nested further: an administrator of a tenant can create sub-tenants as applications in the Cozystack catalog.
Parent tenants can share their resources with their children and oversee their applications.
In turn, children can use their parent's services.

![tenant hierarchy diagram](./tenants1.png)


### Sharing Cluster Services

Tenants may have [cluster services]({{% ref "/docs/v1.2/operations/services" %}}) deployed in them.
Cluster services are middleware services providing core functionality to the tenants and user-facing applications.

The `root` tenant has a set of services like `etcd`, `ingress`, and `monitoring` by default.
Lower-level tenants can run their own cluster services or access ones of their parent.

For example, a Cozystack user creates the following tenants and services:

- Tenant `foo` inside of tenant `root`, having its own instances of `etcd` and `monitoring` running.
- Tenant `bar` inside of tenant `foo`, having its own instance of `etcd`.
- [Tenant Kubernetes cluster]({{% ref "/docs/v1.2/kubernetes" %}}) and a
  [Postgres database]({{% ref "/docs/v1.2/applications/postgres" %}}) in the tenant `bar`.

All applications need services like `ingress` and `monitoring`. 
Since tenant `bar` does not have these services, the applications will use the parent tenant's services.

Here's how this configuration will be resolved:

-   The tenant Kubernetes cluster will store its data in the `bar` tenant's own `etcd` service.
-   All metrics will be collected in the monitoring stack of the parent tenant `foo`.
-   Access to the applications will be through the common `ingress` deployed in the tenant `root`.

![tenant services](./tenants2.png)


### Network Isolation Between Tenants

Every tenant namespace is isolated from its siblings by Cilium network
policies installed automatically by the `tenant` chart. There is no
per-tenant opt-out: the previous `isolated` field was removed in
Cozystack v1.0. Pods inside a tenant namespace also cannot reach
`kube-apiserver` by default, or the tenant's own `etcd` when the tenant
was created with `etcd: true` — they need to opt in with one of two pod
labels:

-   `policy.cozystack.io/allow-to-apiserver: "true"` — reach the
    in-cluster Kubernetes API (for operators, dashboards, etc.).
-   `policy.cozystack.io/allow-to-etcd: "true"` — reach the tenant's
    own etcd (only applicable when the tenant was created with
    `etcd: true`).

See [Tenant `isolated` flag removed]({{% ref "/docs/v1.2/operations/upgrades#tenant-isolated-flag-removed" %}})
in the upgrade notes for a full worked example.


### Customizing Tenant Services

The tenant flags `etcd`, `monitoring`, `ingress`, and `seaweedfs` install a
*default* configuration of each service. After the service is running, you
can change its spec — add storage pools, tune resource quotas, switch a
SeaweedFS topology to `MultiZone`, etc. — by editing the underlying
application CR. Those manual edits are **not** overwritten when the parent
`Tenant` reconciles.

The workflow has two steps:

1. Turn on the flag on the tenant (checkbox in the Dashboard, or `etcd: true` /
   `seaweedfs: true` / ... under `spec.values` in the Tenant `HelmRelease`
   manifest you apply with `kubectl`). Cozystack creates the matching
   application CR with defaults.
2. Edit the application CR in place. For example, to add a pool to the
   tenant-root SeaweedFS instance:

   ```bash
   kubectl edit -n tenant-root seaweedfses.apps.cozystack.io seaweedfs
   ```

   Or patch it non-interactively:

   ```bash
   kubectl patch -n tenant-root seaweedfses.apps.cozystack.io seaweedfs \
     --type=merge -p '{"spec":{"volume":{"pools":{"ssd":{"diskType":"ssd","size":"50Gi"}}}}}'
   ```

The same pattern applies to every tenant-level application CR: `etcd`,
`monitoring`, `ingress`, `seaweedfs`. See
[SeaweedFS storage pools]({{% ref "/docs/v1.2/operations/services/object-storage/storage-pools" %}})
for a worked example that walks the full flow — enabling SeaweedFS on the
tenant and then customizing the resulting CR.

{{% alert color="warning" %}}
Do not try to preconfigure a tenant-level service by applying its CR manifest
*before* the tenant is created — you will hit "namespace not found". And
editing the `Tenant` resource itself to nest service-specific fields (like
SeaweedFS `pools`) under the `Tenant` spec does not work either: tenant-level
flags are booleans, the per-service spec is a separate resource. Enable the
flag first, edit the downstream CR second.
{{% /alert %}}


### Unique Domain Names

Each tenant has its own domain.
By default, (unless otherwise specified), it inherits the domain of its parent with a prefix of its name.
For example, if the `root` tenant has domain `example.org`, then tenant `foo` gets the domain `foo.example.org` by default.
However, it can be redefined to have another domain, such as `example.com`.

Kubernetes clusters created in this tenant namespace would get domains like: `kubernetes-cluster.foo.example.org`


### Tenant Naming Limitations

Tenant names must be alphanumeric.
Using dashes (`-`) in tenant names is not allowed, unlike with other services.
This limitation exists to keep consistent naming in tenants, nested tenants, and services deployed in them.

For example:

-   The root tenant is named `root`, but internally it's referenced as `tenant-root`.
-   A user tenant is named `foo`, which results in `tenant-foo`.
-   However, a tenant cannot be named `foo-bar`, because parsing names like `tenant-foo-bar` can be ambiguous.


### Reference

See the reference for the application implementing tenant management: [`tenant`]({{% ref "/docs/v1.2/applications/tenant#parameters" %}})

