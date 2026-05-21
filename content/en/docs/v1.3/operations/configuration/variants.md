---
title: "Варианты Cozystack: обзор и сравнение"
linkTitle: "Варианты"
description: "Справочник по вариантам Cozystack: состав, настройка и сравнение."
weight: 20
aliases:
  - /docs/v1.3/guides/bundles
  - /docs/v1.3/operations/bundles/
  - /docs/v1.3/operations/bundles/isp-full
  - /docs/v1.3/operations/bundles/isp-hosted
  - /docs/v1.3/operations/bundles/paas-full
  - /docs/v1.3/operations/bundles/paas-hosted
  - /docs/v1.3/operations/bundles/distro-full
  - /docs/v1.3/operations/bundles/distro-hosted
  - /docs/v1.3/install/cozystack/bundles
  - /docs/v1.3/operations/configuration/bundles
---

## Введение

**Варианты** — это заранее определенные конфигурации Cozystack, которые задают, какие bundle и компоненты будут включены.
Каждый вариант тестируется, версионируется и гарантированно работает как единое целое.
Варианты упрощают установку, снижают риск неправильной настройки и помогают выбрать подходящий набор функций для конкретного развертывания.

Это руководство предназначено для инфраструктурных инженеров, DevOps-команд и архитекторов платформ, которые планируют развертывать Cozystack в разных окружениях.
Оно объясняет, как варианты Cozystack помогают адаптировать установку под конкретные задачи: от полноценной platform-as-a-service до полностью ручного управления установленными пакетами.


## Обзор вариантов

| Компонент                     | [default]              | [isp-full]             | [isp-full-generic]     | [isp-hosted]           |
|:------------------------------|:-----------------------|:-----------------------|:-----------------------|:-----------------------|
| [Управляемый Kubernetes][k8s] |                        | ✔                      | ✔                      |                        |
| [Управляемые приложения][apps] |                       | ✔                      | ✔                      | ✔                      |
| [Виртуальные машины][vm]      |                        | ✔                      | ✔                      |                        |
| Cozystack Dashboard (UI)      |                        | ✔                      | ✔                      | ✔                      |
| [Cozystack API][api]          |                        | ✔                      | ✔                      | ✔                      |
| [Kubernetes Operators]        |                        | ✔                      | ✔                      | ✔                      |
| [Подсистема мониторинга][monitoring subsystem] |       | ✔                      | ✔                      | ✔                      |
| Подсистема хранения           |                        | [LINSTOR]              | [LINSTOR]              |                        |
| Сетевая подсистема            |                        | [Kube-OVN] + [Cilium]  | [Kube-OVN] + [Cilium]  |                        |
| Подсистема виртуализации      |                        | [KubeVirt]             | [KubeVirt]             |                        |
| Подсистема ОС и [Kubernetes]  |                        | [Talos Linux]          |                        |                        |

[apps]: {{% ref "/docs/v1.3/applications" %}}
[vm]: {{% ref "/docs/v1.3/virtualization" %}}
[k8s]: {{% ref "/docs/v1.3/kubernetes" %}}
[api]: {{% ref "/docs/v1.3/cozystack-api" %}}
[monitoring subsystem]: {{% ref "/docs/v1.3/guides/platform-stack#victoria-metrics" %}}
[linstor]: {{% ref "/docs/v1.3/guides/platform-stack#drbd" %}}
[kube-ovn]: {{% ref "/docs/v1.3/guides/platform-stack#kube-ovn" %}}
[cilium]: {{% ref "/docs/v1.3/guides/platform-stack#cilium" %}}
[kubevirt]: {{% ref "/docs/v1.3/guides/platform-stack#kubevirt" %}}
[talos linux]: {{% ref "/docs/v1.3/guides/platform-stack#talos-linux" %}}
[kubernetes]: {{% ref "/docs/v1.3/guides/platform-stack#kubernetes" %}}
[kubernetes operators]: https://github.com/cozystack/cozystack/blob/main/packages/core/platform/templates/bundles/paas.yaml

[default]: {{% ref "/docs/v1.3/operations/configuration/variants#default" %}}
[isp-full]: {{% ref "/docs/v1.3/operations/configuration/variants#isp-full" %}}
[isp-full-generic]: {{% ref "/docs/v1.3/operations/configuration/variants#isp-full-generic" %}}
[isp-hosted]: {{% ref "/docs/v1.3/operations/configuration/variants#isp-hosted" %}}


## Выбор подходящего варианта

Варианты объединяют bundle из разных уровней, чтобы закрыть разные сценарии.
Одни варианты рассчитаны на полноценную платформу, другие — на workloads в облачных Kubernetes-кластерах или на полностью ручное управление пакетами.

### `default`

`default` — минимальный вариант, который предоставляет только набор PackageSource, то есть ссылок на реестры пакетов.
Bundle и компоненты в нем не настроены заранее: всеми пакетами нужно управлять вручную через [cozypkg](https://github.com/cozystack/cozystack/tree/main/cmd/cozypkg).
Используйте этот вариант, если вам нужен полный контроль над тем, какие пакеты установлены и как они настроены.
Именно этот вариант используется в сценарии [Build Your Own Platform (BYOP)]({{% ref "/docs/v1.3/install/cozystack/kubernetes-distribution" %}}).

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

`isp-full` — полнофункциональный вариант PaaS и IaaS, рассчитанный на установку поверх Talos Linux.
Он включает все bundle и предоставляет полный набор компонентов Cozystack, формируя полноценную PaaS-платформу.
Некоторые компоненты верхних уровней являются необязательными и могут быть исключены при установке.

`isp-full` предназначен для установки на bare-metal серверы или виртуальные машины.

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

`isp-full-generic` предоставляет тот же полнофункциональный опыт PaaS и IaaS, что и `isp-full`, но рассчитан на обычные дистрибутивы Kubernetes, такие как k3s, kubeadm или RKE2.
Используйте этот вариант, если нужен полный набор возможностей Cozystack без обязательного использования Talos Linux.

Подробные инструкции по установке см. в [руководстве для Generic Kubernetes]({{% ref "/docs/v1.3/install/kubernetes/generic" %}}).

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

Cozystack можно установить как platform-as-a-service (PaaS) поверх существующего управляемого Kubernetes-кластера,
обычно предоставленного облачным провайдером.
Для этого сценария предназначен вариант `isp-hosted`.
Его можно использовать с [kind](https://kind.sigs.k8s.io/) и любыми Kubernetes-кластерами в облаке.

`isp-hosted` включает PaaS и NaaS bundle, предоставляет Cozystack API и UI, управляемые приложения и tenant Kubernetes-кластеры.
Он не включает CNI-плагины, виртуализацию и хранилище.

Kubernetes-кластер, в котором разворачивается Cozystack, должен соответствовать следующим требованиям:

- адрес прослушивания некоторых компонентов Kubernetes должен быть изменен с `localhost` на маршрутизируемый адрес;
- Kubernetes API server должен быть доступен на `localhost`.

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

## Дополнительно

Полный список параметров конфигурации для каждого варианта см. в
[справочнике по настройке]({{% ref "/docs/v1.3/operations/configuration" %}}).

Полный список компонентов и описание того, как включать и отключать их, см. в
[справочнике компонентов]({{% ref "/docs/v1.3/operations/configuration/components" %}}).

Чтобы развернуть выбранный вариант, следуйте [руководству по установке Cozystack]({{% ref "/docs/v1.3/install/cozystack" %}})
или [руководствам для конкретных провайдеров]({{% ref "/docs/v1.3/install/providers" %}}).
Если вы устанавливаете Cozystack впервые, лучше использовать вариант `isp-full` и пройти
[учебное руководство Cozystack]({{% ref "/docs/v1.3/getting-started" %}}).
