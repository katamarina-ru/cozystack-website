---
title: Справочник ApplicationDefinition
linkTitle: ApplicationDefinition
description: Как ресурсы ApplicationDefinition описывают типы приложений и как искать их из клиентского кода
weight: 15
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

A dedicated controller (`applicationdefinition-controller`, shipped with
Cozystack) watches `ApplicationDefinition` and triggers that restart
automatically: on any change to the set it computes a SHA-256 checksum over
the sorted definitions and writes it to the `cozystack.io/config-hash`
annotation on the `cozy-system/cozystack-api` Deployment's pod template,
which Kubernetes then reconciles as a rolling restart. Events are debounced
over a short window, and if the checksum is unchanged the restart is
skipped. Operators do not need to `kubectl rollout restart` by hand.

When a user creates a `Postgres` CR through the dashboard, `kubectl`, or a Go
client, the aggregated layer translates it into a Flux `HelmRelease` that uses
the chart referenced by the definition.

## Naming convention

`ApplicationDefinition` uses two independent naming styles. Each definition
sets them explicitly, and the relationship between them is **not derivable
by any string transform**:

| Field | Style | Example (VM instance) | Example (VM disk) | Example (TCP balancer) |
| --- | --- | --- | --- | --- |
| `metadata.name` | lowercase-with-hyphens | `vm-instance` | `vm-disk` | `tcp-balancer` |
| `spec.application.kind` | CamelCase, preserves acronyms | `VMInstance` | `VMDisk` | `TCPBalancer` |
| `spec.application.singular` | lowercase, no hyphens | `vminstance` | `vmdisk` | `tcpbalancer` |
| `spec.application.plural` | lowercase, no hyphens | `vminstances` | `vmdisks` | `tcpbalancers` |

Note that `metadata.name` is not a function of `spec.application.kind`. The
hyphen positions (`tcp-balancer`, `vm-disk`, `vm-instance`) and the absence of
hyphens in `singular`/`plural` (`tcpbalancer`, `vmdisk`, `vminstance`) are
conventions chosen per application, not outputs of a shared algorithm.
`strings.ToLower(kind)` yields `vminstance`, which matches
`spec.application.singular` but **not** `metadata.name`. A direct lookup by
the lowercased kind therefore fails:

```bash
# Ресурс агрегированного API использует plural в нижнем регистре:
$ kubectl get vminstances --namespace tenant-demo
NAME       READY   AGE   VERSION
frontend   True    2m    1.2.0

# Но ApplicationDefinition, лежащий в его основе, хранится под другим именем:
$ kubectl get applicationdefinition vminstance
Error from server (NotFound): applicationdefinitions.cozystack.io "vminstance" not found

$ kubectl get applicationdefinition vm-instance
NAME          AGE
vm-instance   14d
```

Acronyms make this more visible: `TCPBalancer`, `VMInstance`, and `VMDisk` all
lose their capitalisation in the aggregated resource name (`tcpbalancers`,
`vminstances`, `vmdisks`) but keep hyphens in the CRD name (`tcp-balancer`,
`vm-instance`, `vm-disk`).

## Рекомендуемый шаблон поиска

Client code that needs to resolve a Cozystack kind — for example a dashboard
that receives `VMInstance` from a HelmRelease label and wants to render the
matching form — should **list all `ApplicationDefinition`s and filter by
`spec.application.kind`** instead of attempting a direct `Get` by the lowercased
kind. The set of definitions is small (tens of items) and changes rarely, so
this pattern is cheap and stable. Return the whole matched object so that
downstream callers can read `spec.application.openAPISchema`,
`spec.dashboard`, or any other field without issuing a second API request.

Перед использованием названий группы и ресурса ниже убедитесь в их актуальности для
вашего кластера:

```bash
$ kubectl api-resources | grep applicationdefinition
applicationdefinitions                                cozystack.io/v1alpha1                  false        ApplicationDefinition
```

Строка должна содержать `applicationdefinitions` в столбце `NAME`,
`cozystack.io/v1alpha1` в столбце `APIVERSION`, `false` в столбце
`NAMESPACED` (ресурс имеет кластерный масштаб) и `ApplicationDefinition`
в столбце `KIND`. Если группа отличается в вашем кластере, скорректируйте
`GroupVersionResource` в примере соответственно.

```go
import (
    "context"
    "fmt"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
    "k8s.io/apimachinery/pkg/runtime/schema"
    "k8s.io/client-go/dynamic"
)

// findByKind возвращает ApplicationDefinition, чей spec.application.kind
// совпадает с запрошенным kind, или ошибку, если совпадение не найдено. Вызывающий
// получает полный объект, поэтому поля вроде spec.application.openAPISchema
// доступны без второго обращения к API.
func findByKind(ctx context.Context, client dynamic.Interface, kind string) (*unstructured.Unstructured, error) {
    if kind == "" {
        return nil, fmt.Errorf("kind must not be empty")
    }

    gvr := schema.GroupVersionResource{
        Group:    "cozystack.io",
        Version:  "v1alpha1",
        Resource: "applicationdefinitions",
    }

    // Набор ApplicationDefinition на кластере Cozystack невелик
    // (порядка десятков), поэтому одного непагинированного List достаточно.
    // Если вы адаптируете этот хелпер для большего каталога, задайте ListOptions.Limit
    // и переходите по continue-токену, чтобы избежать неявного усечения.
    list, err := client.Resource(gvr).List(ctx, metav1.ListOptions{})
    if err != nil {
        return nil, fmt.Errorf("list %s/%s/%s: %w",
            gvr.Group, gvr.Version, gvr.Resource, err)
    }
    for i := range list.Items {
        specKind, found, err := unstructured.NestedString(
            list.Items[i].Object, "spec", "application", "kind")
        if err != nil || !found {
            // Пропускаем определения с отсутствующим или нестроковым kind, чтобы
            // итерация не совпала с некорректной записью.
            continue
        }
        if specKind == kind {
            return &list.Items[i], nil
        }
    }
    // Включаем GVR в ошибку, чтобы неверная группа (например после переименования
    // CRD) отличалась от настоящего "такого kind нет".
    return nil, fmt.Errorf("no ApplicationDefinition with spec.application.kind %q found under %s/%s/%s",
        kind, gvr.Group, gvr.Version, gvr.Resource)
}
```

Набор `ApplicationDefinition`, предоставляемых через агрегированный API, заморожен
на момент запуска `cozystack-api` (см. [Обзор](#обзор)), однако базовые
CRD можно редактировать в режиме реального времени: администратор может изменить
`spec.application.openAPISchema` или `spec.dashboard` в существующем
определении или добавить новый Kind — `applicationdefinition-controller` затем
инициирует плавный перезапуск `cozystack-api`, чтобы изменение стало
доступным через агрегированный API без ручного вмешательства. Насколько
агрессивно клиент должен кэшировать — зависит от его собственного времени жизни:

- **Короткоживущие процессы** (CLI-инструменты, одноразовые скрипты, serverless-функции)
  могут безопасно кэшировать результат `findByKind` на всё время жизни процесса.
- **Долгоживущие процессы** (дашборды, контроллеры, операторы) должны
  повторно получать список `ApplicationDefinition` с периодичностью, соответствующей тому,
  как часто их операторы редактируют схемы — обычно раз в несколько минут достаточно.
  Определения меняются редко, поэтому watch не оправдывает сложности. Новый
  `ApplicationDefinition` станет доступен через агрегированный API вскоре после создания,
  как только инициированный контроллером плавный перезапуск `cozystack-api` завершится.

{{% alert color="info" %}}
The lowercased plural (`vminstances`, `vmdisks`) **is** the correct name for
tenant-facing resources under `apps.cozystack.io/v1alpha1`. It is only the
`applicationdefinitions.cozystack.io` CRD that uses the hyphenated form.
{{% /alert %}}

## См. также

- [Обзор Cozystack API]({{% ref "/docs/v1.7/cozystack-api" %}}) — использование kubectl,
  Terraform и Go-клиента для тенант-ориентированных ресурсов.
- [Go Types]({{% ref "/docs/v1.7/cozystack-api/go-types" %}}) — типизированные Go-клиенты
  для ресурсов `apps.cozystack.io/v1alpha1`.
