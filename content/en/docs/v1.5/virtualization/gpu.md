---
title: "Запуск ВМ с пробросом GPU (passthrough)"
linkTitle: "Проброс GPU (passthrough)"
description: "Запуск ВМ с пробросом GPU (passthrough)"
weight: 40
aliases:
  - /docs/v1.5/operations/virtualization/gpu
---

В этом разделе показано, как развёртывать виртуальные машины (ВМ) с пробросом GPU (passthrough) с помощью Cozystack.
Сначала мы развернём GPU Operator, чтобы настроить рабочий узел для проброса GPU (passthrough)
Затем мы развернём ВМ [KubeVirt](https://kubevirt.io/), запрашивающую GPU.

По умолчанию для обеспечения проброса GPU (passthrough) GPU Operator развёртывает следующие компоненты:

- **VFIO Manager** для привязки драйвера `vfio-pci` ко всем GPU на узле.
- **Sandbox Device Plugin** для обнаружения проброшенных GPU и их анонсирования kubelet.
- **Sandbox Validator** для проверки остальных операндов.

## Предварительные требования

- Кластер Cozystack с хотя бы одним узлом с поддержкой GPU.
- Установленный kubectl и настроенные учётные данные для доступа к кластеру.

## 1. Установка GPU Operator

Выполните следующие шаги:

1.  Явно пометьте рабочий узел меткой для рабочих нагрузок с пробросом GPU (passthrough):

    ```bash
    kubectl label node <node-name> --overwrite nvidia.com/gpu.workload.config=vm-passthrough
    ```

2.  Включите GPU Operator в вашем Platform Package, добавив его в список включённых пакетов:

    ```bash
    kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
      -p '[{"op": "add", "path": "/spec/components/platform/values/bundles/enabledPackages/-", "value": "cozystack.gpu-operator"}]'
    ```

    Это развернёт компоненты (операнды).

3.  Убедитесь, что все поды находятся в состоянии running и все проверки компонента sandbox-validator проходят успешно:

    ```bash
    kubectl get pods -n cozy-gpu-operator
    ```

    Пример вывода (имена ваших подов могут отличаться):

    ```console
    NAME                                            READY   STATUS    RESTARTS   AGE
    ...
    nvidia-sandbox-device-plugin-daemonset-4mxsc    1/1     Running   0          40s
    nvidia-sandbox-validator-vxj7t                  1/1     Running   0          40s
    nvidia-vfio-manager-thfwf                       1/1     Running   0          78s
    ```

Чтобы проверить привязку GPU, получите доступ к узлу с помощью `kubectl node-shell -n cozy-system -x` или `kubectl debug node` и выполните:

```bash
lspci -nnk -d 10de:
```

Под vfio-manager привяжет все GPU на узле к драйверу vfio-pci. Пример вывода:

```console
3b:00.0 3D controller [0302]: NVIDIA Corporation Device [10de:2236] (rev a1)
       Subsystem: NVIDIA Corporation Device [10de:1482]
       Kernel driver in use: vfio-pci
86:00.0 3D controller [0302]: NVIDIA Corporation Device [10de:2236] (rev a1)
       Subsystem: NVIDIA Corporation Device [10de:1482]
       Kernel driver in use: vfio-pci
```

sandbox-device-plugin обнаружит эти ресурсы и анонсирует их kubelet.
В этом примере узел показывает два GPU A10 как доступные ресурсы:

```bash
kubectl describe node <node-name>
```

Пример вывода:

```console
...
Capacity:
  ...
  nvidia.com/GA102GL_A10:         2
  ...
Allocatable:
  ...
  nvidia.com/GA102GL_A10:         2
...
```

{{% alert color="info" %}}
**Примечание:** Имена ресурсов формируются путём объединения столбцов `device` и `device_name` из [базы данных PCI IDs](https://pci-ids.ucw.cz/v2.2/pci.ids).
Например, запись в базе данных для A10 выглядит как `2236  GA102GL [A10]`, что приводит к имени ресурса `nvidia.com/GA102GL_A10`.
{{% /alert %}}

## 2. Обновление Custom Resource KubeVirt

Далее мы обновим Custom Resource KubeVirt, как описано в
[руководстве пользователя KubeVirt](https://kubevirt.io/user-guide/virtual_machines/host-devices/#listing-permitted-devices),
чтобы проброшенные GPU были разрешены и могли запрашиваться ВМ KubeVirt.

Подберите значения `pciVendorSelector` и `resourceName` под вашу конкретную модель GPU.
Установка `externalResourceProvider=true` указывает, что этот ресурс предоставляется внешним device plugin,
в данном случае `sandbox-device-plugin`, который развёртывается оператором.

```bash
kubectl edit kubevirt -n cozy-kubevirt
```
пример конфигурации:
```yaml
  ...
  spec:
    configuration:
      permittedHostDevices:
        pciHostDevices:
        - externalResourceProvider: true
          pciVendorSelector: 10DE:2236
          resourceName: nvidia.com/GA102GL_A10
  ...
```

## 3. Создание виртуальной машины

Теперь мы готовы создать ВМ.

1.  Создайте тестовую виртуальную машину с помощью следующей спецификации VMI, которая запрашивает ресурс `nvidia.com/GA102GL_A10`.

    **vmi-gpu.yaml**:

    ```yaml
    ---
    apiVersion: apps.cozystack.io/v1alpha1
    appVersion: '*'
    kind: VirtualMachine
    metadata:
      name: gpu
      namespace: tenant-example
    spec:
      running: true
      instanceProfile: ubuntu
      instanceType: u1.medium
      systemDisk:
        image: ubuntu
        storage: 5Gi
        storageClass: replicated
      gpus:
      - name: nvidia.com/GA102GL_A10
      cloudInit: |
        #cloud-config
        password: ubuntu
        chpasswd: { expire: False }
    ```

    ```bash
    kubectl apply -f vmi-gpu.yaml
    ```

    Пример вывода:
    ```console
    virtualmachines.apps.cozystack.io/gpu created
    ```

2.  Проверьте статус ВМ:

    ```bash
    kubectl get vmi
    ```

    ```console
    NAME                       AGE   PHASE     IP             NODENAME        READY
    virtual-machine-gpu        73m   Running   10.244.3.191   luc-csxhk-002   True
    ```

3.  Войдите в ВМ и убедитесь, что у неё есть доступ к GPU:

    ```bash
    virtctl console virtual-machine-gpu
    ```

    Пример вывода:
    ```console
    Successfully connected to vmi-gpu console. The escape sequence is ^]

    vmi-gpu login: ubuntu
    Password:

    ubuntu@virtual-machine-gpu:~$ lspci -nnk -d 10de:
    08:00.0 3D controller [0302]: NVIDIA Corporation GA102GL [A10] [10de:26b9] (rev a1)
            Subsystem: NVIDIA Corporation GA102GL [A10] [10de:1851]
            Kernel driver in use: nvidia
            Kernel modules: nvidiafb, nvidia_drm, nvidia
    ```

## Совместное использование GPU виртуальными машинами

Проброс GPU (passthrough) назначает весь физический GPU одной ВМ. Чтобы разделить один GPU между несколькими ВМ, требуется **NVIDIA vGPU**.

### vGPU (виртуальный GPU)

NVIDIA vGPU использует опосредованные устройства (mdev) для создания виртуальных GPU, назначаемых ВМ. Это единственное готовое к промышленной эксплуатации решение для совместного использования GPU между ВМ.

**Требования:**
- Лицензия NVIDIA vGPU (коммерческая, приобретается у NVIDIA)
- NVIDIA vGPU Manager, установленный на узлах-хостах

{{% alert color="info" %}}
**Почему не MIG?** MIG (Multi-Instance GPU) разделяет GPU на изолированные экземпляры, но это логические разделы внутри одного устройства PCIe. VFIO не может пробросить их в ВМ — MIG работает только с контейнерами. Чтобы использовать MIG с ВМ, нужен vGPU поверх разделов MIG (всё равно требуется лицензия).
{{% /alert %}}

### Open-Source vGPU (экспериментально)

NVIDIA разрабатывает поддержку vGPU с открытым исходным кодом для ядра Linux. После её включения это может обеспечить совместное использование GPU без лицензии.

- Статус: стадия RFC, не включено в основную ветку ядра
- Поддерживает Ada Lovelace и новее (L4, L40 и т. д.)
- Ссылки: [анонс Phoronix](https://www.phoronix.com/news/NVIDIA-Open-GPU-Virtualization), [патчи ядра](https://lore.kernel.org/all/20240922124951.1946072-1-zhiw@nvidia.com/)
