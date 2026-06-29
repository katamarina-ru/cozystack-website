---
title: "Частые вопросы и практические руководства"
linkTitle: "FAQ и инструкции"
description: "База знаний с частыми вопросами и расширенными настройками"
weight: 100
aliases:
  - /docs/v1.5/faq
  - /docs/v1.5/guides/faq
---

{{% alert title="Диагностика" %}}
Рекомендации по диагностике доступны в [шпаргалке по troubleshooting]({{% ref "/docs/v1.5/operations/troubleshooting" %}}).
{{% /alert %}}


## Развертывание Cozystack

<details>
<summary>Как выделить место на системном диске под пользовательское хранилище</summary>

Развертывание Cozystack, [как установить Talos на машину с одним диском]({{% ref "/docs/v1.5/install/how-to/single-disk" %}})

</details>
<br>

<details>
<summary>Как включить KubeSpan</summary>

Развертывание Cozystack, [как включить KubeSpan]({{% ref "/docs/v1.5/install/how-to/kubespan" %}})

</details>
<br>

<details>
<summary>Как включить HugePages</summary>

Развертывание Cozystack, [как включить HugePages]({{% ref "/docs/v1.5/install/how-to/hugepages" %}}).

</details>
<br>

<details>
<summary>Что делать, если cloud-провайдер не поддерживает MetalLB</summary>

Большинство cloud-провайдеров не поддерживают MetalLB.
Вместо него можно опубликовать основной ingress-контроллер через external IP.

Для развертывания в Hetzner используйте отдельное [руководство по установке в Hetzner]({{% ref "/docs/v1.5/install/providers/hetzner" %}}).
Для других провайдеров используйте раздел [Public IP Setup в руководстве по установке Cozystack]({{% ref "/docs/v1.5/install/cozystack#4b-public-ip-setup" %}}).

</details>
<br>

<details>
<summary>Развертывание Kubernetes в публичной сети</summary>

Развертывание Cozystack, [развертывание с публичными сетями]({{% ref "/docs/v1.5/install/how-to/public-ip" %}}).

</details>

## Эксплуатация

<details>
<summary>Как включить доступ к dashboard через ingress-controller</summary>

Обновите приложение `ingress` и включите в нем параметр `dashboard: true`.
Dashboard станет доступен по адресу: `https://dashboard.<your_domain>`

</details>
<br>

<details>
<summary>Как настраивать Cozystack с помощью FluxCD или ArgoCD</summary>

В этом reference-репозитории показано, как настраивать сервисы Cozystack через GitOps:

- https://github.com/aenix-io/cozystack-gitops-example

</details>
<br>

<details>
<summary>Как сгенерировать kubeconfig для пользователей tenant</summary>

Перенесено в раздел [Как сгенерировать kubeconfig для пользователей tenant]({{% ref "/docs/v1.5/operations/faq/generate-kubeconfig" %}}).

</details>
<br>

<details>
<summary>Как использовать токены ServiceAccount для доступа к API</summary>

См. [Токены ServiceAccount для доступа к API]({{% ref "/docs/v1.5/operations/faq/serviceaccount-api-access" %}}).

</details>
<br>

<details>
<summary>Как ротировать Certificate Authority</summary>

Перенесено в раздел обслуживания кластера: [Как ротировать Certificate Authority]({{% ref "/docs/v1.5/operations/cluster/rotate-ca" %}}).

</details>
<br>

<details>
<summary>Как очистить состояние etcd</summary>

Перенесено в Troubleshooting: [Как очистить состояние etcd]({{% ref "/docs/v1.5/operations/troubleshooting/etcd#how-to-clean-up-etcd-state" %}}).

</details>

## Bundles

<details>
<summary>Как переопределять параметры отдельных компонентов</summary>

Перенесено в конфигурацию кластера: [Справочник компонентов]({{% ref "/docs/v1.5/operations/configuration/components#overwriting-component-parameters" %}}).

</details>
<br>

<details>
<summary>Как отключить отдельные компоненты из bundle</summary>

Перенесено в конфигурацию кластера: [Справочник компонентов]({{% ref "/docs/v1.5/operations/configuration/components#enabling-and-disabling-components" %}}).

</details>
