---
title: "GPU Sharing с HAMi"
linkTitle: "GPU Sharing"
description: "Как включить дробное разделение GPU в tenant-кластерах Kubernetes с помощью HAMi."
weight: 50
---

[HAMi](https://github.com/Project-HAMi/HAMi) (Heterogeneous AI Computing Virtualization Middleware) — проект CNCF Sandbox, который включает дробное разделение GPU в Kubernetes. Вместо выделения целого GPU под одну рабочую нагрузку HAMi позволяет контейнерам запрашивать конкретный объем GPU-памяти и вычислительных ядер.

{{% alert color="info" %}}
Это руководство описывает GPU шаринг для **контейнеров в tenant-кластерах Kubernetes**. О пробросе GPU в виртуальные машины на управляемом кластере см. [GPU Passthrough](/docs/v1.4/virtualization/gpu/).
{{% /alert %}}

## Как это работает

HAMi работает между планировщиком Kubernetes и драйвером NVIDIA GPU:

- **Scheduler Extender** добавляет GPU-aware решения при планировании (filtering и binding), чтобы pod попадали на ноды с достаточной GPU-емкостью.
- **Device Plugin** регистрирует виртуальные GPU-ресурсы (`nvidia.com/gpu`, `nvidia.com/gpumem`, `nvidia.com/gpucores`) в kubelet.
- **MutatingWebhook** автоматически направляет GPU pod в планировщик HAMi.
- **HAMi-core** (`libvgpu.so`) внедряется в контейнеры рабочей нагрузки через `LD_PRELOAD`, чтобы обеспечить изоляцию памяти и вычислений на уровне CUDA API.

Когда HAMi включен, встроенный плагин устройств GPU Operator автоматически отключается, чтобы избежать конфликтов при регистрации ресурсов.

## Требования

- Tenant-кластер Kubernetes с worker нодами, для которых включены GPU (node groups с настроенными GPU).
- Расширение GPU Operator включен в tenant-кластере.

## Включение HAMi

Включите GPU Operator и HAMi в конфигурации tenant-кластера Kubernetes:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Kubernetes
metadata:
  name: my-cluster
  namespace: tenant-example
spec:
  nodeGroups:
    gpu-workers:
      minReplicas: 1
      maxReplicas: 3
      instanceType: u1.xlarge
      gpus:
        - name: nvidia.com/GA102GL_A10
  addons:
    gpuOperator:
      enabled: true
    hami:
      enabled: true
```

Примените эту конфигурацию:

```bash
kubectl apply -f my-cluster.yaml
```

## Запрос дробных GPU-ресурсов

После запуска HAMi рабочие нагрузки могут запрашивать дробные GPU-ресурсы:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-workload
spec:
  containers:
    - name: cuda-app
      image: nvcr.io/nvidia/cuda:11.8.0-base-ubuntu20.04
      resources:
        limits:
          nvidia.com/gpu: 1
          nvidia.com/gpumem: 3000
          nvidia.com/gpucores: 30
```

В примере выше используется абсолютный объем памяти (`gpumem`). Используйте `gpumem-percentage`, если нужна переносимость между моделями GPU с разным объемом памяти.

| Ресурс | Описание |
| --- | --- |
| `nvidia.com/gpu` | Запрошенное количество виртуальных GPU |
| `nvidia.com/gpumem` | Лимит GPU-памяти в MiB |
| `nvidia.com/gpucores` | Доля вычислительных ядер GPU в процентах (1–100) |
| `nvidia.com/gpumem-percentage` | Лимит GPU-памяти в процентах (1–100) |

Используйте `nvidia.com/gpumem-percentage` вместо `nvidia.com/gpumem`, если нужен переносимый лимит, который работает на разных моделях GPU без знания точного объема памяти.

Если `gpumem` и `gpucores` не указаны, контейнер получает доступ ко всей памяти и вычислительной емкости GPU. При этом слой виртуализации HAMi остается активным — это не то же самое, что проброс GPU на bare-metal-уровне.

## Пользовательская конфигурация

Поведение HAMi можно настроить через `valuesOverride` в конфигурации расширения:

```yaml
addons:
  hami:
    enabled: true
    valuesOverride:
      hami:
        devicePlugin:
          deviceSplitCount: 10
          deviceMemoryScaling: 1
        scheduler:
          defaultSchedulerPolicy:
            nodeSchedulerPolicy: binpack
            gpuSchedulerPolicy: spread
```

Все параметры ниже указываются относительно ключа `valuesOverride.hami`, показанного в примере выше.

| Параметр | Описание | По умолчанию |
| --- | --- | --- |
| `devicePlugin.deviceSplitCount` | Максимальное количество виртуальных GPU на один физический GPU | `10` |
| `devicePlugin.deviceMemoryScaling` | Коэффициент избыточности для памяти (>1.0 включает избыточность) | `1` |
| `scheduler.defaultSchedulerPolicy.nodeSchedulerPolicy` | Стратегия размещения по нодам: `binpack` или `spread` | `binpack` |
| `scheduler.defaultSchedulerPolicy.gpuSchedulerPolicy` | Стратегия размещения по GPU: `binpack` или `spread` | `spread` |

## Известные ограничения

### Совместимость с glibc

HAMi-core использует приватный символ glibc (`_dl_sym`), который был удален в glibc 2.34. Это влияет **только для образов контейнеров рабочей нагрузки** — собственные компоненты HAMi и host OS не затрагиваются.

| Base image | glibc | Изоляция |
| --- | --- | --- |
| Ubuntu 20.04 | 2.31 | Полная (memory + compute) |
| Ubuntu 22.04 | 2.35 | Только изоляция памяти (Изоляция вычислительных ресурсов завершается неявной ошибкой) |
| Ubuntu 24.04 | 2.39 | Изоляции нет (HAMi-core тихо не загружается) |
| Alpine (musl) | N/A | Несовместим |

{{% alert color="warning" %}}
Когда HAMi-core не загружается, рабочие нагрузки продолжают работать, но без каких-либо лимитов GPU-ресурсов. Это может привести к ошибкам GPU out-of-memory у рабочих нагрузок, размещенных на том же GPU.
{{% /alert %}}

Разница в поведении Ubuntu 22.04 и 24.04 основана на upstream-тестировании — подробности см. в [HAMi-core #174](https://github.com/Project-HAMi/HAMi-core/issues/174).

Большинство актуальных образов CUDA 12.x и PyTorch 2.x используют Ubuntu 22.04+, поэтому изоляция вычислительных ресурсов с ними работать не будет. Для полной изоляции используйте образа на базе Ubuntu 20.04 или старше, пока не будет принят [upstream fix](https://github.com/Project-HAMi/HAMi-core/issues/174).

### Alpine / musl libc

HAMi-core несовместим с musl libc. Поддерживаются только образа контейнеров на базе glibc (Debian, Ubuntu, RHEL).
