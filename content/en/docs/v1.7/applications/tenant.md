---
title: "Справочник по приложению Tenant"
linkTitle: "Tenant"
weight: 50
aliases:
  - /docs/reference/applications/tenant
  - /docs/v1.7/reference/applications/tenant
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.7/applications/_include/tenant.md
source: https://github.com/cozystack/cozystack/blob/release-1.7/packages/apps/tenant/README.md
-->


Тенант — это основная единица безопасности на платформе. Ближайшая аналогия — пространства имён ядра Linux.

Тенанты могут создаваться рекурсивно и подчиняются следующим правилам:

### Именование тенантов

Имена тенантов должны быть буквенно-цифровыми:

-   Только строчные буквы (`a-z`) и цифры (`0-9`)
-   Должны начинаться со строчной буквы
-   Дефисы (`-`) **не допускаются**, в отличие от других сервисов
-   Максимальная длина зависит от конфигурации кластера (префикс Helm-релиза и корневой домен)

Это ограничение существует для поддержания согласованного именования в тенантах, вложенных тенантах и развёрнутых в них сервисах.
Тенант нельзя назвать `foo-bar`, потому что разбор внутренних имён ресурсов вроде `tenant-foo-bar` был бы неоднозначным.

Например:

-   Корневой тенант называется `root`, но внутри он обозначается как `tenant-root`.
-   Вложенный тенант может называться `foo`, что даст `tenant-foo` в именах сервисов и URL.

### Уникальные домены

Каждый тенант имеет собственный домен.
По умолчанию (если не указано иное) он наследует домен своего родителя с префиксом из своего имени.
Например, если у родителя был домен `example.org`, то `tenant-foo` по умолчанию получит домен `foo.example.org`.

Кластеры Kubernetes, созданные в пространстве имён этого тенанта, получат домены вида: `kubernetes-cluster.foo.example.org`

Пример:
```text       
tenant-root (example.org)
└── tenant-foo (foo.example.org)
    └── kubernetes-cluster1 (kubernetes-cluster1.foo.example.org)
```

### Вложенность тенантов и переиспользование родительских сервисов

Тенанты могут быть вложенными.
Администратор тенанта может создавать вложенные тенанты с помощью приложения «Tenant» из каталога.

Тенанты более высокого уровня могут просматривать приложения всех своих дочерних тенантов и управлять ими.
Если тенант не запускает собственные кластерные сервисы, он может использовать сервисы своего родителя.

Например, вы создаёте:
-   Тенант `tenant-u1` с набором сервисов, таких как `etcd`, `ingress`, `monitoring`.
-   Тенант `tenant-u2`, вложенный в `tenant-u1`.

Посмотрим, что произойдёт, когда вы запустите Kubernetes и Postgres в пространстве имён `tenant-u2`.

Поскольку у `tenant-u2` нет собственных кластерных сервисов, таких как `etcd`, `ingress` и `monitoring`,
приложения, работающие в `tenant-u2`, будут использовать кластерные сервисы родительского тенанта.

Это, в свою очередь, означает:

-    Данные кластера Kubernetes будут храниться в `etcd` тенанта `tenant-u1`.
-    Доступ к кластеру будет осуществляться через общий `ingress` тенанта `tenant-u1`.
-    По сути, все метрики будут собираться в `monitoring` тенанта `tenant-u1`, и только этот тенант будет иметь к ним доступ.

Пример:
```
tenant-u1
├── etcd
├── ingress
├── monitoring
└── tenant-u2
    ├── kubernetes-cluster1
    └── postgres-db1
```

### Network isolation

Tenant network isolation is enforced with Cilium network policies. On the `isp-hosted` and `isp-hosted-slim` platform variants the CNI belongs to the host, so these policies are created only if the host serves the Cilium policy API when the tenant is installed or updated. On a host without Cilium, tenants get no network isolation from Cozystack, and isolating them is up to the host. If Cilium appears on the host later, the policies are created on the tenant's next chart or values change, not automatically.

## Параметры

### Общие параметры

| Name              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Type                  | Value   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------- |
| `host`            | The hostname used to access tenant services (defaults to using the tenant name as a subdomain for its parent tenant host).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `string`              | `""`    |
| `etcd`            | Deploy own Etcd cluster.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `bool`                | `false` |
| `monitoring`      | Deploy own Monitoring Stack.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `bool`                | `false` |
| `tracingCentral`  | Send this tenant's traces to the shared VictoriaTraces store in tenant-root instead of a per-tenant backend; its Grafana reads them through a vmauth there that pins the tenant's own account, so tenants sharing the store cannot read each other's traces. It needs the tenant's own Monitoring (`monitoring: true`) and tenant-root hosting the store (`tracingCentralHost: true` on its Monitoring, with a `cluster`-mode tracingStorages entry named `generic`); without that the tenant's monitoring render fails rather than dropping spans. tenant-root, and whoever it admits to its Grafana, are inside the store's trust boundary. Applications should export over OTLP/HTTP, in requests below 3 MiB: spans above the platform's per-tenant write rate are retried over HTTP but dropped over gRPC, and a larger request is refused and not retried. | `bool`                | `false` |
| `ingress`         | Deploy own Ingress Controller.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `bool`                | `false` |
| `gateway`         | Deploy own Gateway API Gateway (backed by Cilium Gateway API controller). When unset (the default) or set to `false`, the tenant does not own a Gateway and instead publishes through the nearest ancestor tenant that owns one, regardless of whether `host` is empty or custom (`false` currently behaves the same as unset and does not opt out of that inheritance). Set to `true` to give the tenant its own Gateway with its own LoadBalancer IP and Certificate. A tenant with a custom (non-derived) `host` that needs its apex publicly reachable must set `true` explicitly, because an ancestor's TLS certificate does not cover a custom apex. Note: leave the key absent (do not write `gateway: null`): the chart distinguishes "unset" via missing-key, not via null value, to satisfy the JSON schema generated from this comment.               | `bool`                | `false` |
| `gatewayClass`    | GatewayClass for this tenant's own Gateway. Empty uses the platform default (`gateway.className`). Only the classes the operator lists in the platform's `gateway.tenantSelectableClasses`, plus that default, may be named here — anything else fails this tenant's own gateway release and reaches no other tenant. Read only when this tenant owns a Gateway; an inheriting tenant uses its ancestor's. Whether a class terminates TLS itself or at its provider's edge is declared once per class on the platform, not here.                                                                                                                                                                                                                                                                                                                               | `string`              | `""`    |
| `seaweedfs`       | Deploy own SeaweedFS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `bool`                | `false` |
| `computeplane`    | Deploy own ComputePlane — a single-tenant, Cozystack-managed cluster for untrusted-code applications. The tenant receives no admin kubeconfig for it. Automatic routing of catalog applications onto it (placement: ComputePlane) is a planned follow-up and is not available yet; until it lands, external catalogs target the cluster via its computeplane-cluster-admin-kubeconfig Secret. See design-proposals/compute-plane in cozystack/community.                                                                                                                                                                                                                                                                                                                                                                                                       | `bool`                | `false` |
| `schedulingClass` | The name of a SchedulingClass CR to apply scheduling constraints for this tenant's workloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `string`              | `""`    |
| `resourceQuotas`  | Define resource quotas for the tenant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `map[string]quantity` | `{}`    |


## Конфигурация

### Квоты ресурсов

Параметр `resourceQuotas` позволяет ограничить ресурсы, доступные тенанту. Поддерживаемые ключи:

**Вычислительные ресурсы** (преобразуются в `requests.X` и `limits.X`):
- `cpu` — Суммарное число ядер CPU (например, `"4"` или `"500m"`)
- `memory` — Суммарный объём памяти (например, `"4Gi"` или `"512Mi"`)
- `ephemeral-storage` — Лимит эфемерного хранилища (например, `"10Gi"`)
- `storage` — Суммарный объём постоянного хранилища (например, `"100Gi"`)

**Квоты на количество объектов** (передаются как есть):
- `pods` — Максимальное число подов
- `services` — Максимальное число сервисов
- `services.loadbalancers` — Максимальное число сервисов типа LoadBalancer
- `services.nodeports` — Максимальное число сервисов типа NodePort
- `configmaps` — Максимальное число ConfigMap
- `secrets` — Максимальное число Secret
- `persistentvolumeclaims` — Максимальное число PVC

**Пример:**
```yaml
resourceQuotas:
  cpu: 4
  memory: 4Gi
  storage: 10Gi
  services.loadbalancers: "3"
  pods: "50"
```
