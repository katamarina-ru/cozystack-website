---
title: ApplicationDefinition reference
linkTitle: ApplicationDefinition
description: How ApplicationDefinition resources describe application types and how to look them up from client code
weight: 5
---

## Overview

`ApplicationDefinition` (`applicationdefinitions.cozystack.io/v1alpha1`) is a
cluster-scoped CRD that describes every application type the platform
exposes. Each definition declares the Kubernetes kind that tenants use in
the aggregated API (`spec.application.kind`), the OpenAPI schema used to
render the dashboard form and validate user input
(`spec.application.openAPISchema`), and dashboard metadata such as
category, icon, and display names (`spec.dashboard`).

The aggregated API server (`cozystack-api`) lists every `ApplicationDefinition`
**once at startup** and registers a matching resource under
`apps.cozystack.io/v1alpha1`. The set of tenant-facing kinds does not change
while the API server is running — adding, removing, or renaming an
`ApplicationDefinition` takes effect only after `cozystack-api` restarts.

When a user creates a `Postgres` CR through the dashboard, `kubectl`, or a Go
client, the aggregated layer translates it into a Flux `HelmRelease` that uses
the chart referenced by the definition.

## Naming convention

`ApplicationDefinition` uses two independent naming styles. Each definition
sets them explicitly, and the relationship between them is **not derivable
by any string transform**:

| Field | Style | Example (HTTP cache) | Example (VM disk) | Example (TCP balancer) |
| --- | --- | --- | --- | --- |
| `metadata.name` | lowercase with hyphens | `http-cache` | `vm-disk` | `tcp-balancer` |
| `spec.application.kind` | CamelCase, preserves acronyms | `HTTPCache` | `VMDisk` | `TCPBalancer` |
| `spec.application.singular` | lowercase, no hyphens | `httpcache` | `vmdisk` | `tcpbalancer` |
| `spec.application.plural` | lowercase, no hyphens | `httpcaches` | `vmdisks` | `tcpbalancers` |

Note that `metadata.name` is not a function of `spec.application.kind`. The
hyphen positions (`tcp-balancer`, `vm-disk`, `http-cache`) and the absence of
hyphens in `singular`/`plural` (`tcpbalancer`, `vmdisk`, `httpcache`) are
conventions chosen per application, not outputs of a shared algorithm.
`strings.ToLower(kind)` yields `httpcache`, which matches
`spec.application.singular` but **not** `metadata.name`. A direct lookup by
the lowercased kind therefore fails:

```bash
# The aggregated API resource uses the lowercased plural:
$ kubectl get httpcaches --namespace tenant-demo
NAME       READY   AGE   VERSION
frontend   True    2m    1.2.0

# But the ApplicationDefinition that backs it is stored under a different name:
$ kubectl get applicationdefinition httpcache
Error from server (NotFound): applicationdefinitions.cozystack.io "httpcache" not found

$ kubectl get applicationdefinition http-cache
NAME         AGE
http-cache   14d
```

Acronyms make this more visible: `TCPBalancer`, `HTTPCache`, and `VMDisk` all
lose their capitalisation in the aggregated resource name (`tcpbalancers`,
`httpcaches`, `vmdisks`) but keep hyphens in the CRD name (`tcp-balancer`,
`http-cache`, `vm-disk`).

## Recommended lookup pattern

Client code that needs to resolve a Cozystack kind — for example a dashboard
that receives `HTTPCache` from a HelmRelease label and wants to render the
matching form — should **list all `ApplicationDefinition`s and filter by
`spec.application.kind`** instead of attempting a direct `Get` by the lowercased
kind. The set of definitions is small (tens of items) and changes rarely, so
this pattern is cheap and stable.

```go
import (
    "context"
    "fmt"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
    "k8s.io/apimachinery/pkg/runtime/schema"
    "k8s.io/client-go/dynamic"
)

// findByKind returns the ApplicationDefinition whose spec.application.kind
// matches the requested kind, or an error if no match is found.
func findByKind(ctx context.Context, client dynamic.Interface, kind string) (string, error) {
    gvr := schema.GroupVersionResource{
        Group:    "cozystack.io",
        Version:  "v1alpha1",
        Resource: "applicationdefinitions",
    }

    list, err := client.Resource(gvr).List(ctx, metav1.ListOptions{})
    if err != nil {
        return "", fmt.Errorf("list ApplicationDefinitions: %w", err)
    }
    for i := range list.Items {
        specKind, found, err := unstructured.NestedString(
            list.Items[i].Object, "spec", "application", "kind")
        if err != nil || !found {
            // Skip definitions with missing or non-string kind so an empty
            // `kind` argument cannot silently match a malformed entry.
            continue
        }
        if specKind == kind {
            return list.Items[i].GetName(), nil
        }
    }
    return "", fmt.Errorf("no ApplicationDefinition matches kind %q", kind)
}
```

Because the set of `ApplicationDefinition`s is frozen at `cozystack-api`
startup (see [Overview](#overview)), clients that talk only to the aggregated
API can cache the resolved `metadata.name` for the lifetime of their own
process. Clients that also watch `applicationdefinitions.cozystack.io` directly
can additionally invalidate the cache when the CRD list changes, but doing so
will not make new kinds available until the API server is restarted.

{{% alert color="info" %}}
The lowercased plural (`httpcaches`, `vmdisks`) **is** the correct name for
tenant-facing resources under `apps.cozystack.io/v1alpha1`. It is only the
`applicationdefinitions.cozystack.io` CRD that uses the hyphenated form.
{{% /alert %}}

## See also

- [Cozystack API overview]({{% ref "/docs/v1/cozystack-api" %}}) — kubectl,
  Terraform, and Go client usage for tenant-facing resources.
- [Go Types]({{% ref "/docs/v1/cozystack-api/go-types" %}}) — typed Go clients
  for `apps.cozystack.io/v1alpha1` resources.
