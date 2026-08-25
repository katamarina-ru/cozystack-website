---
title: "Запуск контейнерных рабочих нагрузок с GPU"
linkTitle: "Контейнеры с GPU"
description: "Запуск подов с CUDA и других контейнерных рабочих нагрузок с GPU на узлах management-кластера Cozystack, где драйвер NVIDIA и container toolkit установлены из пакетного менеджера дистрибутива."
weight: 160
---

На этой странице описан запуск рабочих нагрузок с GPU в обычных подах Kubernetes (CUDA, обучение ML, инференс) на узлах management-кластера Cozystack. Она рассчитана на типовую конфигурацию Linux-узла с GPU — драйвер NVIDIA, установленный через `apt`, плюс `nvidia-container-toolkit` на Ubuntu/Debian — и использует вариант `container` пакета `cozystack.gpu-operator`. Другие дистрибутивы с аналогичным набором пакетов драйвера и toolkit должны работать так же, но регулярно не тестируются.

Если вместо этого вам нужно передать GPU целиком в ВМ KubeVirt, см. [проброс GPU (passthrough)](/docs/v1.6/virtualization/gpu/) и [GPU Sharing с HAMi](/docs/v1.6/kubernetes/gpu-sharing/) (HAMi обеспечивает дробное разделение в tenant-кластерах Kubernetes; комбинация HAMi напрямую поверх варианта `container` на management-кластере пока не поддерживается — см. [Дробное разделение GPU](#дробное-разделение-gpu) ниже).

{{< note >}}

Вариант `container` проверен в апстриме через `helm template` и юнит-тесты, но end-to-end на физическом железе NVIDIA пока не прогонялся. Считайте описанный ниже сценарий с подом CUDA предварительным и проверьте его на своём узле с GPU, прежде чем полагаться на него в production.

{{< /note >}}

## Когда выбирать этот вариант

Пакет `cozystack.gpu-operator` предоставляет три архитектурных варианта. Выбирайте `container`, когда выполняются **все** следующие условия:

- На хосте уже работает драйвер NVIDIA, установленный через пакетный менеджер дистрибутива (`apt install nvidia-driver-*` на Ubuntu/Debian; другие дистрибутивы с аналогичным пакетом драйвера должны работать так же, но регулярно не тестируются). Оператор не должен загружать собственный модуль ядра.
- На хосте уже установлен `nvidia-container-toolkit` (`apt install nvidia-container-toolkit`) и зарегистрирован в containerd. Оператор не должен разворачивать собственный DaemonSet с toolkit — это перезапишет `/etc/containerd/config.toml`, настроенный хостом (через `nvidia-ctk runtime configure`), и сломает привязку рантайма на хосте.
- Вам нужно, чтобы GPU отдавались контейнерам как `nvidia.com/gpu`, а не пробрасывались в ВМ KubeVirt.

Два других варианта существуют для противоположной конфигурации хоста: `default` (проброс) отвязывает хостовый драйвер и привязывает `vfio-pci` для проброса в ВМ, а `vgpu` требует проприетарного хостового драйвера NVIDIA vGPU и сервера лицензий. Ни один из этих путей не даст работающей конфигурации на хосте, где драйвер и container toolkit уже установлены через apt: оператор и установленное на хосте ПО начинают конфликтовать друг с другом.

## Предварительные требования

- Management-кластер Cozystack как минимум с одним узлом с поддержкой GPU.
- На узле с GPU работает Ubuntu или Debian с драйвером NVIDIA, установленным через пакетный менеджер дистрибутива (другие дистрибутивы с аналогичным набором пакетов драйвера и toolkit должны работать так же, но регулярно не тестируются). Проверьте это командой `nvidia-smi` по SSH или через `kubectl debug node/<node-name>` — она должна перечислить физические GPU и показать рабочую версию драйвера.
- На узле с GPU не должно остаться метки `nvidia.com/gpu.workload.config` от настройки проброса (снять: `kubectl label node <node-name> nvidia.com/gpu.workload.config-`). Вариант `container` опирается на апстримное значение по умолчанию — рабочую нагрузку `container` для узлов без метки; оставшаяся метка `vm-passthrough` переопределяет его для конкретного узла, и device-плагин не отдаст GPU. Снимите её до шага регистрации в containerd (или вместе с ним), если переводите узел с настройки проброса.
- На том же узле установлен `nvidia-container-toolkit` и зарегистрирован в containerd. `apt install nvidia-container-toolkit` раскладывает только бинарники — containerd он не настраивает. Зарегистрируйте рантайм явно:

  ```bash
  sudo nvidia-ctk runtime configure --runtime=containerd
  sudo systemctl restart containerd
  grep nvidia /etc/containerd/config.toml   # должна быть видна запись о рантайме
  ```

- `kubectl`, настроенный на management-кластер.

При `driver.enabled=false` оператор использует предустановленный хостовый драйвер по его стандартному пути, поэтому на обычной установке Ubuntu/Debian переопределение `hostPaths.driverInstallDir` не требуется. Talos ставит драйвер в нестандартный префикс, поэтому по пути по умолчанию оператор его не находит и требует другой отправной точки — рабочий пример с DaemonSet-ом совместимости и соответствующим переопределением `driverInstallDir` см. в `packages/system/gpu-operator/examples/values-native-talos.yaml` в [репозитории cozystack](https://github.com/cozystack/cozystack).

## 1. Установка GPU Operator (вариант container)

Для этого варианта **не добавляйте** `cozystack.gpu-operator` в `bundles.enabledPackages`. Бандл `iaas` рендерит GPU Operator из `bundles.iaas.gpuOperatorVariant`, а тот принимает только `default` или `vgpu`: любое другое значение, включая `container`, приводит к ошибке рендеринга чарта платформы в Helm (`packages/core/platform/templates/bundles/iaas.yaml`). Вместо этого примените `Package` CR напрямую — контроллер платформы установит его без записи в бандле и без ограничения на вариант.

Примените `Package` CR с `variant: container`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.gpu-operator
spec:
  variant: container
```

```bash
kubectl apply -f gpu-operator-container.yaml
```

Контроллер платформы сопоставляет вариант с `PackageSource` (`packages/core/platform/sources/gpu-operator.yaml`), забирает `values.yaml` и `values-container.yaml` из OCI-репозитория и устанавливает чарт в `cozy-gpu-operator`.

## 2. Проверка работоспособности оператора

Все поды в пространстве имён `cozy-gpu-operator` должны перейти в состояние `Running`:

```bash
kubectl get pods --namespace cozy-gpu-operator
```

Пример вывода (имена подов будут отличаться):

```console
NAME                                                          READY   STATUS    RESTARTS   AGE
gpu-feature-discovery-7jpzv                                   1/1     Running   0          2m
gpu-operator-7976b5b8fb-xqg2z                                 1/1     Running   0          3m
nvidia-cuda-validator-tjkfh                                   0/1     Completed 0          2m
nvidia-dcgm-exporter-rmpfg                                    1/1     Running   0          2m
nvidia-device-plugin-daemonset-cqj9w                          1/1     Running   0          2m
nvidia-operator-validator-q5n4k                               1/1     Running   0          3m
```

Вариант `container` **не** поднимает `nvidia-driver-daemonset`, `nvidia-container-toolkit-daemonset` и `nvidia-vfio-manager` — все три отключены намеренно.

Узел должен анонсировать `nvidia.com/gpu` как доступный (allocatable) ресурс:

```bash
kubectl describe node <node-name>
```

```console
...
Capacity:
  ...
  nvidia.com/gpu:         2
  ...
Allocatable:
  ...
  nvidia.com/gpu:         2
...
```

## 3. Запуск тестового пода CUDA

Создайте под, который запрашивает один GPU и запускает `nvidia-smi`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cuda-smoke
spec:
  restartPolicy: OnFailure
  containers:
  - name: cuda
    image: nvcr.io/nvidia/cuda:12.4.1-base-ubuntu22.04
    command: ["nvidia-smi"]
    resources:
      limits:
        nvidia.com/gpu: 1
```

```bash
kubectl apply -f cuda-smoke.yaml
kubectl wait --for=jsonpath='{.status.phase}'=Succeeded pod/cuda-smoke --timeout=5m
kubectl logs cuda-smoke
```

В выводе должны быть перечислены GPU, видимые поду, и версия драйвера, работающего на хосте.

## Дробное разделение GPU

Вариант `container` отдаёт GPU целиком через апстримный device-плагин NVIDIA. Для дробного разделения (квоты по памяти и вычислительным ресурсам на каждый под) см. [GPU Sharing с HAMi](/docs/v1.6/kubernetes/gpu-sharing/) — сейчас это описано для tenant-кластеров Kubernetes, где включение HAMi автоматически отключает встроенный device-плагин GPU Operator, чтобы не возникало конфликта при регистрации ресурсов. Ставить пакет `cozystack.hami` напрямую поверх варианта `container` на management-кластере пока не поддерживается: этот вариант жёстко включает device-плагин NVIDIA, а HAMi несёт собственный, и оба зарегистрировали бы `nvidia.com/gpu`. PackageSource `cozystack.hami` объявляет `dependsOn: cozystack.gpu-operator` только для порядка установки — он не отключает device-плагин оператора так, как это делает чарт приложения `kubernetes` для тенанта.

## Сравнение вариантов

| Тип рабочей нагрузки | Вариант | Драйвер на хосте | Container toolkit на хосте | Примечания |
| --- | --- | --- | --- | --- |
| Контейнеры (поды CUDA, ML) | `container` | требуется | требуется | Эта страница |
| GPU целиком одной ВМ | `default` | НЕ должен быть загружен — оператор привязывает `vfio-pci` | не используется | [Проброс GPU (passthrough)](/docs/v1.6/virtualization/gpu/) |
| GPU, поделённый между несколькими ВМ | `vgpu` | проприетарный хостовый драйвер NVIDIA vGPU | не используется | Требует лицензию NVIDIA vGPU и эндпоинт Delegated License Service |
