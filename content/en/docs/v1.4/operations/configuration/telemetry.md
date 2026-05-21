---
title: "Telemetry"
linkTitle: "Телеметрия"
description: "Телеметрия Cozystack"
weight: 60
aliases:
  - /docs/v1.4/telemetry
  - /docs/v1.4/operations/telemetry
---

В этом документе описана телеметрия в проекте Cozystack: зачем собираются данные, какие именно данные собираются, как они обрабатываются и как отказаться от участия.

## Зачем мы собираем телеметрию

Cozystack как open source проект развивается благодаря обратной связи сообщества и пониманию реального использования. Данные телеметрии позволяют maintainers понимать, как Cozystack применяется в реальных сценариях. Эти данные помогают принимать решения о приоритете функций, стратегиях тестирования, исправлениях ошибок и общем развитии проекта. Без телеметрии решения приходилось бы принимать на основе предположений или ограниченной обратной связи, что могло бы замедлить улучшения или привести к функциям, которые не соответствуют потребностям пользователей. Телеметрия помогает направлять разработку реальными паттернами использования и требованиями сообщества, делая платформу более надежной и ориентированной на пользователей.

## Что и как мы собираем

Cozystack стремится соблюдать [LF Telemetry Data Policy](https://www.linuxfoundation.org/legal/telemetry-data-policy), обеспечивая ответственную практику сбора данных с уважением к приватности пользователей и прозрачности.

Мы собираем не персональные сведения о пользователях, а неперсональные метрики использования компонентов Cozystack. В частности, собирается информация об инфраструктуре кластера (узлы, хранилище, сеть), установленных packages и экземплярах приложений. Эти данные помогают понимать распространенные конфигурации и тенденции использования в разных установках.

Телеметрию собирают два компонента:
- **cozystack-operator** - собирает метрики уровня кластера (узлы, хранилище, packages)
- **cozystack-controller** - собирает метрики уровня приложений (развернутые экземпляры приложений)

Чтобы подробно увидеть, какие данные собираются, можно изучить реализацию телеметрии:
- [Telemetry Client](https://github.com/cozystack/cozystack/tree/main/internal/telemetry)
- [Telemetry Server](https://github.com/cozystack/cozystack-telemetry-server/)

### Пример telemetry payload

Ниже показан типичный telemetry payload в Cozystack.

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

Данные собираются компонентами, работающими внутри Cozystack. Они периодически собирают и отправляют статистику использования в наш защищенный backend. Система телеметрии обеспечивает анонимизацию, агрегацию и безопасное хранение данных, а доступ к ним строго контролируется для защиты приватности пользователей.

## Отказ от телеметрии

Мы уважаем вашу приватность и выбор в отношении телеметрии. Если вы не хотите участвовать в сборе telemetry data, Cozystack предоставляет простой способ отказаться.

Отключение:

Чтобы отключить отправку телеметрии, обновите Helm release оператора Cozystack с флагом `disableTelemetry`:

```bash
helm upgrade cozystack oci://ghcr.io/cozystack/cozystack/cozy-installer \
  --namespace cozy-system \
  --version X.Y.Z \
  --set cozystackOperator.disableTelemetry=true
```

Замените `X.Y.Z` на установленную у вас версию Cozystack.

{{< reuse-values-warning >}}

Эта команда обновляет оператор и отключает сбор телеметрии. Если позже нужно снова включить телеметрию, выполните ту же команду с `disableTelemetry=false`.

## Заключение

Телеметрия в Cozystack нужна, чтобы развитие проекта опиралось на данные, отвечало потребностям сообщества и обеспечивало постоянное улучшение. Ваше участие или отказ от него помогает формировать будущее Cozystack и делать платформу более эффективной и удобной для всех.
