---
title: "Варианты Cozystack: обзор и сравнение"
linkTitle: "Варианты"
description: "Справочник по вариантам Cozystack: состав, конфигурация и сравнение."
weight: 20
aliases:
  - /docs/v1.6/guides/bundles
  - /docs/v1.6/operations/bundles/
  - /docs/v1.6/operations/bundles/isp-full
  - /docs/v1.6/operations/bundles/isp-hosted
  - /docs/v1.6/operations/bundles/paas-full
  - /docs/v1.6/operations/bundles/paas-hosted
  - /docs/v1.6/operations/bundles/distro-full
  - /docs/v1.6/operations/bundles/distro-hosted
  - /docs/v1.6/install/cozystack/bundles
  - /docs/v1.6/operations/configuration/bundles
---

## Введение

**Variants** - это предопределенные конфигурации Cozystack, определяющие, какие bundles и компоненты включены.
Каждый вариант тестируется, версионируется и гарантированно работает как единое целое.
Они упрощают установку, снижают риск неправильной конфигурации и помогают выбрать подходящий набор возможностей для вашего развертывания.

Это руководство предназначено для infrastructure engineers, DevOps-команд и platform architects, которые планируют разворачивать Cozystack в разных окружениях.
В нем объясняется, как варианты Cozystack помогают адаптировать установку под конкретные потребности: от полнофункциональной platform-as-a-service до полного ручного контроля над установленными packages.


## Обзор вариантов

| Компонент                     | [default]              | [isp-full]             | [isp-full-generic]     | [isp-hosted]           |
|:------------------------------|:-----------------------|:-----------------------|:-----------------------|:-----------------------|
| [Managed Kubernetes][k8s]     |                        | ✔                      | ✔                      |                        |
| [Managed Applications][apps]  |                        | ✔                      | ✔                      | ✔                      |
| [Virtual Machines][vm]        |                        | ✔                      | ✔                      |                        |
| Cozystack Dashboard (UI)      |                        | ✔                      | ✔                      | ✔                      |
| [Cozystack API][api]          |                        | ✔                      | ✔                      | ✔                      |
| [Kubernetes Operators]        |                        | ✔                      | ✔                      | ✔                      |
| [Monitoring subsystem]        |                        | ✔                      | ✔                      | ✔                      |
| Подсистема хранения           |                        | [LINSTOR]              | [LINSTOR]              |                        |
| Сетевая подсистема            |                        | [Kube-OVN] + [Cilium]  | [Kube-OVN] + [Cilium]  |                        |
| Подсистема виртуализации      |                        | [KubeVirt]             | [KubeVirt]             |                        |
| Подсистема OS и [Kubernetes]  |                        | [Talos Linux]          |                        |                        |

[apps]: {{% ref "/docs/v1.6/applications" %}}
[vm]: {{% ref "/docs/v1.6/virtualization" %}}
[k8s]: {{% ref "/docs/v1.6/kubernetes" %}}
[api]: {{% ref "/docs/v1.6/cozystack-api" %}}
[monitoring subsystem]: {{% ref "/docs/v1.6/guides/platform-stack#victoria-metrics" %}}
[linstor]: {{% ref "/docs/v1.6/guides/platform-stack#drbd" %}}
[kube-ovn]: {{% ref "/docs/v1.6/guides/platform-stack#kube-ovn" %}}
[cilium]: {{% ref "/docs/v1.6/guides/platform-stack#cilium" %}}
[kubevirt]: {{% ref "/docs/v1.6/guides/platform-stack#kubevirt" %}}
[talos linux]: {{% ref "/docs/v1.6/guides/platform-stack#talos-linux" %}}
[kubernetes]: {{% ref "/docs/v1.6/guides/platform-stack#kubernetes" %}}
[kubernetes operators]: https://github.com/cozystack/cozystack/blob/main/packages/core/platform/templates/bundles/paas.yaml

[default]: {{% ref "/docs/v1.6/operations/configuration/variants#default" %}}
[isp-full]: {{% ref "/docs/v1.6/operations/configuration/variants#isp-full" %}}
[isp-full-generic]: {{% ref "/docs/v1.6/operations/configuration/variants#isp-full-generic" %}}
[isp-hosted]: {{% ref "/docs/v1.6/operations/configuration/variants#isp-hosted" %}}


## Выбор подходящего варианта

Variants объединяют bundles из разных слоев под конкретные задачи.
Одни рассчитаны на полноценные platform-сценарии, другие - на workloads в cloud-hosted окружениях или полностью ручное управление packages.

### `default`

`default` - минимальный вариант, который предоставляет только набор PackageSources (ссылки на package registry).
Bundles и компоненты заранее не настроены: все packages управляются вручную через [cozypkg](https://github.com/cozystack/cozystack/tree/main/cmd/cozypkg).
Используйте этот вариант, когда нужен полный контроль над тем, какие packages установлены и настроены.
Именно этот вариант используется в workflow [Build Your Own Platform (BYOP)]({{% ref "/docs/v1.6/install/cozystack/kubernetes-distribution" %}}).

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

Подробные инструкции по установке см. в [руководстве Generic Kubernetes]({{% ref "/docs/v1.6/install/kubernetes/generic" %}}).

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

## Подробнее

Полный список параметров конфигурации для каждого варианта см. в
[справочнике по конфигурации]({{% ref "/docs/v1.6/operations/configuration" %}}).

Полный список компонентов и инструкции по их включению и отключению см. в
[справочнике компонентов]({{% ref "/docs/v1.6/operations/configuration/components" %}}).

Чтобы развернуть выбранный вариант, следуйте [руководству по установке Cozystack]({{% ref "/docs/v1.6/install/cozystack" %}})
или [руководствам для конкретных провайдеров]({{% ref "/docs/v1.6/install/providers" %}}).
Если вы устанавливаете Cozystack впервые, лучше использовать вариант `isp-full` и пройти [tutorial Cozystack]({{% ref "/docs/v1.6/getting-started" %}}).
