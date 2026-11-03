---
title: "Варианты Cozystack: обзор и сравнение"
linkTitle: "Варианты"
description: "Справочник по вариантам Cozystack: состав, конфигурация и сравнение."
weight: 20
aliases:
  - /docs/v1.7/guides/bundles
  - /docs/v1.7/operations/bundles/
  - /docs/v1.7/operations/bundles/isp-full
  - /docs/v1.7/operations/bundles/isp-hosted
  - /docs/v1.7/operations/bundles/paas-full
  - /docs/v1.7/operations/bundles/paas-hosted
  - /docs/v1.7/operations/bundles/distro-full
  - /docs/v1.7/operations/bundles/distro-hosted
  - /docs/v1.7/install/cozystack/bundles
  - /docs/v1.7/operations/configuration/bundles
---

## Введение

**Variants** - это предопределенные конфигурации Cozystack, определяющие, какие bundles и компоненты включены.
Каждый вариант тестируется, версионируется и гарантированно работает как единое целое.
Они упрощают установку, снижают риск неправильной конфигурации и помогают выбрать подходящий набор возможностей для вашего развертывания.

Это руководство предназначено для infrastructure engineers, DevOps-команд и platform architects, которые планируют разворачивать Cozystack в разных окружениях.
В нем объясняется, как варианты Cozystack помогают адаптировать установку под конкретные потребности: от полнофункциональной platform-as-a-service до полного ручного контроля над установленными packages.


## Обзор вариантов

| Component                     | [default]              | [isp-full]             | [isp-full-generic]     | [isp-hosted]           | [isp-slim]             | [isp-slim-generic]     | [isp-hosted-slim]      |
|:------------------------------|:-----------------------|:-----------------------|:-----------------------|:-----------------------|:-----------------------|:-----------------------|:-----------------------|
| [Managed Kubernetes][k8s]     |                        | ✔                      | ✔                      |                        |                        |                        |                        |
| [Managed Applications][apps]  |                        | ✔                      | ✔                      | ✔                      | opt-in                 | opt-in                 | opt-in                 |
| [Virtual Machines][vm]        |                        | ✔                      | ✔                      |                        |                        |                        |                        |
| Cozystack Dashboard (UI)      |                        | ✔                      | ✔                      | ✔                      | ✔                      | ✔                      | ✔                      |
| [Cozystack API][api]          |                        | ✔                      | ✔                      | ✔                      | ✔                      | ✔                      | ✔                      |
| [Kubernetes Operators]        |                        | ✔                      | ✔                      | ✔                      | opt-in                 | opt-in                 | opt-in                 |
| [Monitoring subsystem]        |                        | ✔                      | ✔                      | ✔                      | opt-in                 | opt-in                 | opt-in                 |
| Backups                       |                        | ✔                      | ✔                      | ✔                      | opt-in                 | opt-in                 | opt-in                 |
| Storage subsystem             |                        | [LINSTOR]              | [LINSTOR]              |                        | [LINSTOR]              | [LINSTOR]              |                        |
| Networking subsystem          |                        | [Kube-OVN] + [Cilium]  | [Kube-OVN] + [Cilium]  |                        | [Cilium]               | [Cilium]               |                        |
| Virtualization subsystem      |                        | [KubeVirt]             | [KubeVirt]             |                        |                        |                        |                        |
| OS and [Kubernetes] subsystem |                        | [Talos Linux]          |                        |                        | [Talos Linux]          |                        |                        |

[apps]: {{% ref "/docs/v1.7/applications" %}}
[vm]: {{% ref "/docs/v1.7/virtualization" %}}
[k8s]: {{% ref "/docs/v1.7/kubernetes" %}}
[api]: {{% ref "/docs/v1.7/cozystack-api" %}}
[monitoring subsystem]: {{% ref "/docs/v1.7/guides/platform-stack#observability" %}}
[linstor]: {{% ref "/docs/v1.7/guides/platform-stack#storage-and-backup" %}}
[kube-ovn]: {{% ref "/docs/v1.7/guides/platform-stack#networking" %}}
[cilium]: {{% ref "/docs/v1.7/guides/platform-stack#networking" %}}
[kubevirt]: {{% ref "/docs/v1.7/guides/platform-stack#cluster-provisioning-and-virtualization" %}}
[talos linux]: {{% ref "/docs/v1.7/guides/platform-stack#operating-system-and-kubernetes-runtime" %}}
[kubernetes]: {{% ref "/docs/v1.7/guides/platform-stack#operating-system-and-kubernetes-runtime" %}}
[kubernetes operators]: https://github.com/cozystack/cozystack/blob/main/packages/core/platform/templates/bundles/paas.yaml

[default]: {{% ref "/docs/v1.7/operations/configuration/variants#default" %}}
[isp-full]: {{% ref "/docs/v1.7/operations/configuration/variants#isp-full" %}}
[isp-full-generic]: {{% ref "/docs/v1.7/operations/configuration/variants#isp-full-generic" %}}
[isp-hosted]: {{% ref "/docs/v1.7/operations/configuration/variants#isp-hosted" %}}
[isp-slim]: {{% ref "/docs/v1.7/operations/configuration/variants#isp-slim" %}}
[isp-slim-generic]: {{% ref "/docs/v1.7/operations/configuration/variants#isp-slim-generic" %}}
[isp-hosted-slim]: {{% ref "/docs/v1.7/operations/configuration/variants#isp-hosted-slim" %}}


## Выбор подходящего варианта

Variants объединяют bundles из разных слоев под конкретные задачи.
Одни рассчитаны на полноценные platform-сценарии, другие - на workloads в cloud-hosted окружениях или полностью ручное управление packages.

### `default`

`default` - минимальный вариант, который предоставляет только набор PackageSources (ссылки на package registry).
Bundles и компоненты заранее не настроены: все packages управляются вручную через [cozypkg](https://github.com/cozystack/cozystack/tree/main/cmd/cozypkg).
Используйте этот вариант, когда нужен полный контроль над тем, какие packages установлены и настроены.
Именно этот вариант используется в workflow [Build Your Own Platform (BYOP)]({{% ref "/docs/v1.7/install/cozystack/kubernetes-distribution" %}}).

Пример конфигурации:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: default
```

### `isp-full`

`isp-full` - полнофункциональный вариант PaaS и IaaS, предназначенный для установки на Talos Linux.
Он включает все bundles и предоставляет полный набор компонентов Cozystack, создавая полноценный PaaS-опыт.
Некоторые компоненты верхних слоев опциональны и могут быть исключены при установке.

`isp-full` предназначен для установки на bare-metal servers или VM.

Пример конфигурации:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-full
  components:
    platform:
      values:
        networking:
          podCIDR: "10.244.0.0/16"
          podGateway: "10.244.0.1"
          serviceCIDR: "10.96.0.0/16"
          joinCIDR: "100.64.0.0/16"
        publishing:
          host: "example.org"
          apiServerEndpoint: "https://192.168.100.10:6443"
          exposedServices:
            - api
            - dashboard
            - cdi-uploadproxy
            - vm-exportproxy
```

### `isp-full-generic`

`isp-full-generic` предоставляет такой же полнофункциональный PaaS и IaaS, как `isp-full`, но предназначен для обычных дистрибутивов Kubernetes, таких как k3s, kubeadm или RKE2.
Используйте этот вариант, если нужен полный набор возможностей Cozystack без обязательного Talos Linux.

Подробные инструкции по установке см. в [руководстве Generic Kubernetes]({{% ref "/docs/v1.7/install/kubernetes/generic" %}}).

Пример конфигурации:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-full-generic
  components:
    platform:
      values:
        networking:
          podCIDR: "10.244.0.0/16"
          podGateway: "10.244.0.1"
          serviceCIDR: "10.96.0.0/16"
          joinCIDR: "100.64.0.0/16"
        publishing:
          host: "example.org"
          apiServerEndpoint: "https://192.168.100.10:6443"
          exposedServices:
            - api
            - dashboard
            - cdi-uploadproxy
            - vm-exportproxy
```

### `isp-hosted`

Cozystack можно установить как platform-as-a-service (PaaS) поверх существующего managed Kubernetes-кластера,
обычно созданного cloud provider.
Для этого сценария предназначен вариант `isp-hosted`.
Его можно использовать с [kind](https://kind.sigs.k8s.io/) и любыми cloud-based Kubernetes-кластерами.

`isp-hosted` включает PaaS и NaaS bundles, предоставляя Cozystack API и UI, managed applications и tenant Kubernetes clusters.
Он не включает CNI plugins, виртуализацию или хранилище.

Kubernetes-кластер, используемый для развертывания Cozystack, должен соответствовать следующим требованиям:

-   Listening address некоторых компонентов Kubernetes должен быть изменен с `localhost` на маршрутизируемый адрес.
-   Kubernetes API server должен быть доступен на `localhost`.

Пример конфигурации:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-hosted
  components:
    platform:
      values:
        publishing:
          host: "example.org"
          apiServerEndpoint: "https://192.168.100.10:6443"
          exposedServices:
            - api
            - dashboard
```

### `isp-slim`

`isp-slim` is the minimal counterpart of `isp-full` for Talos Linux, meant for small installations such as arm64 clusters, labs and edge sites. It installs the base platform only: Cilium networking, LINSTOR storage, the Cozystack API and dashboard, tenants, ingress and Gateway API. Everything else, including managed applications, their operators, monitoring and backups, is opt-in (with `authentication.oidc.enabled`, Keycloak, `cozystack.keycloak-operator` and `cozystack.postgres-operator` are installed as well): add the packages you need to `bundles.enabledPackages` (see [Enabling components on slim variants](#enabling-components-on-slim-variants)).

Virtualization and managed Kubernetes are not available on slim variants: enabling the `iaas` bundle fails the render. Use `isp-full` or `isp-full-generic` if you need them.

Networking runs on Cilium alone, without Kube-OVN, so `networking.podCIDR`, `networking.podGateway`, `networking.serviceCIDR` and `networking.joinCIDR` are not used: pods get addresses from the pod CIDR Kubernetes assigns to each node. `networking.encryption.enabled` is not supported on `isp-slim` and `isp-slim-generic` and fails the render.

MetalLB is not installed. `LoadBalancer` Services get their addresses from Cilium: create a pool and an L2 announcement policy, for example:

```yaml
apiVersion: cilium.io/v2
kind: CiliumLoadBalancerIPPool
metadata:
  name: default
spec:
  blocks:
    - start: 192.0.2.10
      stop: 192.0.2.20
---
apiVersion: cilium.io/v2alpha1
kind: CiliumL2AnnouncementPolicy
metadata:
  name: default
spec:
  loadBalancerIPs: true
```

With `publishing.externalIPs` set, the host ingress needs no load balancer at all, but a Gateway still creates a `LoadBalancer` Service and needs the pool. MetalLB is still available as an opt-in package, `cozystack.metallb`.

Example configuration:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-slim
  components:
    platform:
      values:
        publishing:
          host: "example.org"
          apiServerEndpoint: "https://192.168.100.10:6443"
          exposedServices:
            - api
            - dashboard
```

### `isp-slim-generic`

`isp-slim-generic` is the same minimal platform as `isp-slim`, with the same Cilium-only networking, for generic Kubernetes distributions such as k3s, kubeadm or RKE2. Node requirements are those of `isp-full-generic`; see the [Generic Kubernetes guide]({{% ref "/docs/v1.7/install/kubernetes/generic" %}}) and set `variant: isp-slim-generic` in the Platform Package.

### `isp-hosted-slim`

`isp-hosted-slim` is the minimal counterpart of `isp-hosted`: the host cluster provides CNI and storage, and Cozystack installs only the API, dashboard, tenants, ingress and Gateway API. Cluster requirements are those of `isp-hosted`. Managed applications are opt-in, as on the other slim variants.

### Enabling components on slim variants

On a slim variant, a package is installed only when it is listed in `bundles.enabledPackages` of the Platform Package. A package does not pull in its dependencies: list every package from its row below, otherwise the Package stays in `DependenciesNotReady`.

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-slim
  components:
    platform:
      values:
        bundles:
          enabledPackages:
            - cozystack.postgres-operator
            - cozystack.postgres-application
```

| Component | Packages to add to `bundles.enabledPackages` |
| --- | --- |
| A managed application, for example PostgreSQL | The application and its operator: `cozystack.postgres-application`, `cozystack.postgres-operator`. The same pattern applies to MariaDB, Kafka, ClickHouse, FoundationDB, RabbitMQ, Redis, MongoDB and OpenSearch. Valkey uses `cozystack.redis-operator`; Harbor also needs `cozystack.postgres-operator`, `cozystack.redis-operator` and `cozystack.seaweedfs-application`, and its tenant needs SeaweedFS enabled for the registry bucket. NATS, OpenBao, Qdrant, `cozystack.tcp-balancer-application` and `cozystack.vpn-application` need no operator. |
| Monitoring | `cozystack.monitoring-application`, `cozystack.grafana-operator`, `cozystack.postgres-operator`, `cozystack.monitoring-agents`, `cozystack.metrics-server`, `cozystack.vertical-pod-autoscaler`. Also set `monitoring.rootEnabled: true` in the platform values and `spec.monitoring: true` on the root Tenant. |
| etcd for tenants | `cozystack.etcd-application`, `cozystack.etcd-operator`, `cozystack.vertical-pod-autoscaler` |
| SeaweedFS and buckets | `cozystack.seaweedfs-application`, `cozystack.bucket-application` |
| Backups | `cozystack.backupstrategy-controller`, `cozystack.backup-controller`, `cozystack.velero`, `cozystack.bucket-application`, `cozystack.monitoring-agents`, `cozystack.metrics-server`, `cozystack.vertical-pod-autoscaler`. The default backup bucket lives in the root Tenant, so also add `cozystack.seaweedfs-application` and set `spec.seaweedfs: true` on the root Tenant. |
| Metrics API (`kubectl top`, HPA) | `cozystack.metrics-server` |
| Multus | `cozystack.multus`. Not available on `isp-hosted-slim`. |
| MetalLB | `cozystack.metallb`. Not available on `isp-hosted-slim`. |

Slim variants are meant for new installations. Do not switch a running `isp-full` or `isp-full-generic` cluster to a slim variant: the networking Package moves from Kube-OVN with Cilium to Cilium alone, Kube-OVN is removed, and running pods lose networking. The other platform components stay installed (their Packages carry `helm.sh/resource-policy: keep`), so the switch does not make the cluster smaller.

## Подробнее

Полный список параметров конфигурации для каждого варианта см. в
[справочнике по конфигурации]({{% ref "/docs/v1.7/operations/configuration" %}}).

Полный список компонентов и инструкции по их включению и отключению см. в
[справочнике компонентов]({{% ref "/docs/v1.7/operations/configuration/components" %}}).

Чтобы развернуть выбранный вариант, следуйте [руководству по установке Cozystack]({{% ref "/docs/v1.7/install/cozystack" %}})
или [руководствам для конкретных провайдеров]({{% ref "/docs/v1.7/install/providers" %}}).
Если вы устанавливаете Cozystack впервые, лучше использовать вариант `isp-full` и пройти [tutorial Cozystack]({{% ref "/docs/v1.7/getting-started" %}}).
