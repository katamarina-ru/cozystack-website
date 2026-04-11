---
title: ApplicationDefinition reference
linkTitle: ApplicationDefinition
description: How ApplicationDefinition resources describe application types and how to look them up from client code
weight: 5
---

## Overview

`ApplicationDefinition` (`applicationdefinitions.cozystack.io/v1alpha1`) is a
cluster-scoped CRD that describes every application type the platform
exposes. Each definition declares:

- the Kubernetes kind that tenants use in the aggregated API
  (`spec.application.kind`),
- the Helm release prefix and chart reference that back the application
  (`spec.release`),
- the OpenAPI schema used to render the dashboard form and validate user
  input (`spec.application.openAPISchema`),
- dashboard metadata such as category, icon, and display names
  (`spec.dashboard`).

The aggregated API server (`cozystack-api`) reads every `ApplicationDefinition`
at startup and serves a matching resource under `apps.cozystack.io/v1alpha1`.
When a user creates a `Postgres` CR through the dashboard, `kubectl`, or a Go
client, the aggregated layer translates it into a Flux `HelmRelease` that uses
the chart referenced by the definition.

## Naming convention

`ApplicationDefinition` uses two independent naming styles that are **not**
related by a simple string transform:

| Field | Style | Example (HTTP cache) | Example (VM disk) |
| --- | --- | --- | --- |
| `metadata.name` | lowercase with hyphens | `http-cache` | `vm-disk` |
| `spec.application.kind` | CamelCase, preserves acronyms | `HTTPCache` | `VMDisk` |
| `spec.application.singular` | lowercase, no hyphens | `httpcache` | `vmdisk` |
| `spec.application.plural` | lowercase, no hyphens | `httpcaches` | `vmdisks` |

This means `strings.ToLower(kind)` yields `httpcache`, which matches
`spec.application.singular` but **not** `metadata.name`. A direct lookup by
the lowercased kind therefore fails:

```bash
# The aggregated API resource uses the lowercased plural:
$ kubectl get httpcaches --namespace tenant-demo
NAME       READY   AGE
frontend   True    2m

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

var applicationDefinitionGVR = schema.GroupVersionResource{
    Group:    "cozystack.io",
    Version:  "v1alpha1",
    Resource: "applicationdefinitions",
}

// findByKind returns the ApplicationDefinition whose spec.application.kind
// matches the requested kind, or an error if no match is found.
func findByKind(ctx context.Context, client dynamic.Interface, kind string) (string, error) {
    list, err := client.Resource(applicationDefinitionGVR).List(ctx, metav1.ListOptions{})
    if err != nil {
        return "", err
    }
    for i := range list.Items {
        specKind, _, _ := unstructured.NestedString(list.Items[i].Object, "spec", "application", "kind")
        if specKind == kind {
            return list.Items[i].GetName(), nil
        }
    }
    return "", fmt.Errorf("no ApplicationDefinition matches kind %q", kind)
}
```

Because the result is stable per kind, clients should cache the resolved
`metadata.name` locally and refresh only when the watch on
`applicationdefinitions.cozystack.io` reports a change.

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
