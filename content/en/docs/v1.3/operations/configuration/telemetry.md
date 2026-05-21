---
title: "Телеметрия"
linkTitle: "Телеметрия"
description: "Телеметрия Cozystack"
weight: 60
aliases:
  - /docs/v1.3/telemetry
  - /docs/v1.3/operations/telemetry
---

В этом документе описана телеметрия в проекте Cozystack: зачем собираются данные, какие именно данные собираются, как они обрабатываются и как отказаться от участия.

## Зачем мы собираем телеметрию

Cozystack — open source проект, которому важны обратная связь сообщества и понимание реального использования платформы. Телеметрия помогает сопровождающим понять, как Cozystack используется на практике. Эти данные влияют на приоритизацию функций, стратегию тестирования, исправление ошибок и развитие проекта в целом. Без телеметрии решения пришлось бы принимать на основе предположений или ограниченной обратной связи, что могло бы замедлить улучшения или привести к появлению функций, не соответствующих потребностям пользователей. Телеметрия помогает развивать платформу на основе реальных сценариев использования и требований сообщества.

## Что мы собираем и как

Cozystack стремится соблюдать [LF Telemetry Data Policy](https://www.linuxfoundation.org/legal/telemetry-data-policy) и ответственно собирать данные с учетом приватности пользователей и прозрачности процесса.

Мы собираем неперсональные метрики использования компонентов Cozystack, а не личную информацию пользователей. В частности, собираются сведения об инфраструктуре кластера: узлах, хранилище, сети, установленных пакетах и экземплярах приложений. Эти данные помогают понимать распространенные конфигурации и тенденции использования в разных установках.

Телеметрию собирают два компонента:

- **cozystack-operator** — собирает метрики уровня кластера: узлы, хранилище, пакеты;
- **cozystack-controller** — собирает метрики уровня приложений: развернутые экземпляры приложений.

Подробный список собираемых данных можно посмотреть в реализации телеметрии:

- [Telemetry Client](https://github.com/cozystack/cozystack/tree/main/internal/telemetry)
- [Telemetry Server](https://github.com/cozystack/cozystack-telemetry-server/)

### Пример payload телеметрии

Ниже показан типичный payload телеметрии в Cozystack.

**От cozystack-operator** (инфраструктура кластера):

```prometheus
cozy_cluster_info{cozystack_version="v1.0.0",kubernetes_version="v1.31.4"} 1
cozy_nodes_count{os="linux (Talos (v1.8.4))",kernel="6.6.64-talos"} 3
cozy_cluster_capacity{resource="cpu"} 168
cozy_cluster_capacity{resource="memory"} 811020009472
cozy_cluster_capacity{resource="nvidia.com/TU104GL_TESLA_T4"} 3
cozy_loadbalancers_count 1
cozy_pvs_count{driver="linstor.csi.linbit.com",size="5Gi"} 7
cozy_pvs_count{driver="linstor.csi.linbit.com",size="10Gi"} 6
cozy_package_info{name="cozystack.core",variant="default"} 1
cozy_package_info{name="cozystack.storage",variant="linstor"} 1
cozy_package_info{name="cozystack.monitoring",variant="default"} 1
```

**От cozystack-controller** (экземпляры приложений):

```prometheus
cozy_application_count{kind="Tenant"} 2
cozy_application_count{kind="Postgres"} 5
cozy_application_count{kind="Redis"} 3
cozy_application_count{kind="Kubernetes"} 2
cozy_application_count{kind="VirtualMachine"} 0
```

Данные собираются компонентами, работающими внутри Cozystack. Эти компоненты периодически собирают и отправляют статистику использования в защищенный backend. Система телеметрии обеспечивает анонимизацию, агрегацию и безопасное хранение данных, а доступ к ним строго контролируется для защиты приватности пользователей.

## Отключение телеметрии

Мы уважаем вашу приватность и право выбора. Если вы не хотите участвовать в сборе телеметрии, Cozystack предоставляет простой способ отключить отправку данных.

Чтобы отключить отправку телеметрии, обновите Helm release оператора Cozystack с флагом `disableTelemetry`:

```bash
helm upgrade cozystack oci://ghcr.io/cozystack/cozystack/cozy-installer \
  --namespace cozy-system \
  --version X.Y.Z \
  --set cozystackOperator.disableTelemetry=true
```

Замените `X.Y.Z` на установленную у вас версию Cozystack.

<div class="alert alert-warning" role="alert">
Не используйте <code>--reuse-values</code> при обновлении оператора Cozystack. Значения Helm chart содержат жестко заданные ссылки на platform OCI repository. Если повторно использовать старые значения, оператор будет указывать на старые версии пакетов.
<br/><br/>
Если у вас есть пользовательские значения, например <code>disableTelemetry</code>, передавайте их явно через <code>--set</code>.
</div>

Эта команда обновляет оператор и отключает сбор телеметрии. Чтобы снова включить телеметрию в будущем, выполните ту же команду с `disableTelemetry=false`.

## Заключение

Телеметрия в Cozystack помогает развивать проект на основе данных и реагировать на потребности сообщества. Ваше участие — или решение отказаться от участия — влияет на будущее Cozystack и помогает сделать платформу более полезной и ориентированной на пользователей.
