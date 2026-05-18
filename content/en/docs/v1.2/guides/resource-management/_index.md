---
title: Управление ресурсами в Cozystack
linkTitle: Управление ресурсами
description: >
  Как CPU, memory и presets работают для ВМ, Kubernetes-кластеров и managed
  workloads в Cozystack; и как перенастраивать ресурсы через UI, CLI или API.
weight: 25
---

## Введение

Cozystack запускает все, включая системные компоненты и пользовательские приложения, как сервисы в Kubernetes-кластере
с конечным пулом CPU и memory.

В этом руководстве описано, как пользователи могут настраивать ресурсы, доступные приложению, и как Cozystack обрабатывает такую конфигурацию.

## Настройка ресурсов сервиса

Ресурсы, доступные каждому сервису (managed application, ВМ или tenant cluster), задаются в его configuration file.
В Cozystack есть два способа указать CPU time и memory, доступные сервису:

-   С помощью resource presets.
-   С помощью явной resource configuration.

### Использование resource presets

Cozystack предоставляет набор именованных resource presets.
У каждого пользовательского сервиса, включая managed applications, tenant Kubernetes clusters и virtual machines, есть preset по умолчанию.

При развертывании сервиса preset задается в переменной конфигурации `resourcesPreset`, например:

```yaml
## @param resourcesPreset Default sizing preset used when `resources` is omitted.
## Allowed values: none, nano, micro, small, medium, large, xlarge, 2xlarge.
resourcesPreset: "small"
```

| Название preset | CPU    | memory  |
|-----------------|--------|---------|
| `nano`          | `100m` | `128Mi` |
| `micro`         | `250m` | `256Mi` |
| `small`         | `500m` | `512Mi` |
| `medium`        | `500m` | `1Gi`   |
| `large`         | `1`    | `2Gi`   |
| `xlarge`        | `2`    | `4Gi`   |
| `2xlarge`       | `4`    | `8Gi`   |

Для CPU единица `m` означает 1/1000 полной CPU time.

Presets Cozystack определены во внутренней библиотеке
[`cozy-lib`](https://github.com/cozystack/cozystack/tree/main/packages/library/cozy-lib).

### Явное определение ресурсов

Конфигурация сервиса может явно задавать доступные CPU и memory через переменную `resources`.
В Cozystack используется простой формат resource configuration для `cpu` и `memory`:

```yaml
## @param resources Explicit CPU and memory configuration for each ClickHouse replica.
## When left empty, the preset defined in `resourcesPreset` is applied.
resources:
  cpu: 1
  memory: 2Gi
```

Если одновременно заданы `resources` и `resourcesPreset`, используется `resources`, а `resourcesPreset` игнорируется.

## Resource requests и limits

В Cozystack все запускается как Kubernetes services, а Kubernetes использует два важных механизма управления ресурсами:
requests и limits.
Сначала разберем, что это такое.

-   **Resource request** определяет объем ресурса, который будет зарезервирован для сервиса и всегда предоставлен.
    Если ресурса недостаточно для выполнения request, сервис вообще не запустится.

-   **Resource limit** определяет, сколько сервис может использовать из свободного пула ресурсов.

{{% alert color="info" %}}
Подробное объяснение того, как requests и limits работают в Kubernetes, см. в разделе [Resource Management for Pods and Containers](
https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/).
{{% /alert %}}

CPU time легко делится между несколькими сервисами с неравномерной CPU load.
Поэтому распространенная практика — задавать низкие CPU requests и значительно более высокие limits.
Для CPU-intensive сервисов оптимальным может быть соотношение 1:2 или 1:4.
Для менее CPU-intensive сервисов даже 1:10 может дать хорошую resource efficiency и при этом быть достаточным.

Memory, наоборот, это ресурс, который после выдачи сервису обычно нельзя забрать обратно без OOM-kill сервиса.
Поэтому memory requests обычно лучше задавать на уровне, который гарантирует работу сервиса.

## CPU Allocation Ratio

В Cozystack есть единая configuration variable `cpuAllocationRatio`, являющаяся single source of truth.
Она определяет соотношение между CPU requests и limits для всех сервисов.

CPU allocation ratio задается в Platform Package:

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
        # ...
        resources:
          cpuAllocationRatio: 4
```

По умолчанию `cpuAllocationRatio` равен 10. Это значит, что CPU requests будут составлять 1/10 от CPU limits.
Cozystack заимствует это значение по умолчанию из [KubeVirt](https://kubevirt.io/user-guide/compute/resources_requests_and_limits/#cpu).

### Как Cozystack выводит CPU requests и limits

```yaml
## @param resources Explicit CPU and memory configuration for each ClickHouse replica.
## When left empty, the preset defined in `resourcesPreset` is applied.
resources:
  cpu: 1
  ## actual cpu limit: 1
  ## actual cpu request: (cpu / cpu-allocation-ratio)
  memory: 2Gi
```

### Пример 1, настройка по умолчанию: `cpu-allocation-ratio: 10`

| Название preset | `resources.cpu` | фактический CPU request | фактический CPU limit |
|-----------------|-----------------|-------------------------|-----------------------|
| `nano`          | `100m`          | `10m`                   | `100m`                |
| `micro`         | `250m`          | `25m`                   | `250m`                |
| `small`         | `500m`          | `50m`                   | `500m`                |
| `medium`        | `500m`          | `50m`                   | `500m`                |
| `large`         | `1`             | `100m`                  | `1`                   |
| `xlarge`        | `2`             | `200m`                  | `2`                   |
| `2xlarge`       | `4`             | `400m`                  | `4`                   |

### Пример 2: `cpu-allocation-ratio: 4`

| Название preset | `resources.cpu` | фактический CPU request | фактический CPU limit |
|-----------------|-----------------|-------------------------|-----------------------|
| `nano`          | `100m`          | `25m`                   | `100m`                |
| `micro`         | `250m`          | `63m`                   | `250m`                |
| `small`         | `500m`          | `125m`                  | `500m`                |
| `medium`        | `500m`          | `125m`                  | `500m`                |
| `large`         | `1`             | `250m`                  | `1`                   |
| `xlarge`        | `2`             | `500m`                  | `2`                   |
| `2xlarge`       | `4`             | `1`                     | `4`                   |

## Формат конфигурации до v0.31.0

До Cozystack v0.31.0 конфигурация сервисов позволяла пользователям явно задавать requests и limits.
После обновления Cozystack с более ранних версий до v0.31.0 или новее такие сервисы не требуют немедленных действий.

При обновлении таких приложений пользователям нужно изменить конфигурацию на новый формат.

```yaml
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 1
    memory: 2Gi
```

У этого изменения было несколько причин.

Managed applications предполагают, что пользователю не нужно глубоко знать Kubernetes.
Однако явная настройка requests/limits была "leaky abstraction": она путала пользователей и приводила к misconfigurations.

Для hosting companies, запускающих public clouds на Cozystack, единое соотношение по всему cloud критически важно.
Такой подход помогает обеспечить стабильный уровень сервиса и упрощает billing.

Пользователи, которые разворачивают собственные приложения в tenant Kubernetes clusters, по-прежнему могут задавать точные resource requests и limits.
