---
title: "Запуск ВМ с пробросом GPU (passthrough)"
linkTitle: "Проброс GPU (passthrough)"
description: "Запуск ВМ с пробросом GPU (passthrough)"
weight: 40
aliases:
  - /docs/v1.6/operations/virtualization/gpu
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

## 2. KubeVirt is wired automatically

When `cozystack.gpu-operator` is in `bundles.enabledPackages`, Cozystack mirrors the chosen GPU variant into the `KubeVirt` Custom Resource for you. There is no `kubectl edit kubevirt` step.

Specifically, the platform injects:

- `HostDevices` into `spec.configuration.developerConfiguration.featureGates` (current KubeVirt splits this from the `GPU` gate; the admission webhook rejects `domain.devices.hostDevices` without it).
- A starter `spec.configuration.permittedHostDevices.pciHostDevices` table (rendered in the default `gpuOperatorVariant: default` — vfio-pci passthrough) covering common NVIDIA datacenter GPUs — Hopper (H100, H200), Ada Lovelace (L4, L40, L40S), Ampere (A100 PCIe/SXM, A40, A30, A10), Turing (T4), Volta (V100, V100S). PCI vendor:device pairs are stable; each `resourceName` slug is whatever `nvidia-sandbox-device-plugin` derives mechanically from the card's PCI-IDs database name — uppercase the name, turn `/`, `.` and whitespace into `_`, then strip the surrounding `[` / `]`. The slug therefore carries every token the PCI-IDs string holds (the `GL` die suffix, the `Tesla` brand on Turing/Volta, the form factor, the memory size), not a tidy `<arch>_<model>`: `TU104GL [Tesla T4]` becomes `nvidia.com/TU104GL_TESLA_T4`, `GA100GL [A30 PCIe]` becomes `nvidia.com/GA100GL_A30_PCIE`, and the H200 SXM becomes `nvidia.com/GH100_H200_SXM_141GB`. Confirm the exact strings your nodes advertise with `kubectl describe node <node> | grep nvidia.com/`. `externalResourceProvider: true` is set on every entry because the resources are advertised by the sandbox plugin, not by KubeVirt's in-tree device plugin.

Verify the resulting CR:

```bash
kubectl -n cozy-kubevirt get kubevirt kubevirt -o json \
  | jq '.spec.configuration | {featureGates: .developerConfiguration.featureGates, permittedHostDevices: .permittedHostDevices}'
```

{{% alert color="info" %}}

**My GPU isn't in the default table — where's the old `kubectl edit kubevirt` step?** It is gone on purpose. `permittedHostDevices` is now owned by the chart template and reconciled from platform values, so any hand edit to the live CR is reverted on the next Flux/Helm reconcile. Add your card through `.gpu.permittedHostDevices` instead — see [Extending or replacing the NVIDIA defaults](#extending-or-replacing-the-nvidia-defaults) below. If you are upgrading from a release where you hand-edited the CR, follow [Upgrading from a hand-edited KubeVirt CR](#upgrading-from-a-hand-edited-kubevirt-cr) first.

{{% /alert %}}

### Extending or replacing the NVIDIA defaults

If your cluster ships a GPU not in the default table, or your `nvidia-sandbox-device-plugin` version emits a different `resourceName` (check with `kubectl describe node <node> | grep nvidia.com/`), extend the defaults via platform values:

```yaml
# Platform Package values
gpu:
  # Append (default) — your entries land alongside the NVIDIA table.
  # Set to true to drop the NVIDIA table entirely (useful for non-NVIDIA-only
  # clusters or strict allowlists). With replaceDefaults: true and an empty
  # list below, the rendered CR carries no permittedHostDevices block at all
  # and the admission webhook rejects every GPU VM — supply your own list.
  replaceDefaults: false
  permittedHostDevices:
    pciHostDevices:
    - pciVendorSelector: "10DE:2236"
      resourceName: nvidia.com/GA102GL_A10
      externalResourceProvider: true
```

To **re-point** a card already in the NVIDIA table (for example to give `10DE:1EB8` a different `resourceName`), do not append a second entry for the same `pciVendorSelector` — both entries are rendered and KubeVirt resolves the duplicated selector non-deterministically. Set `replaceDefaults: true` and supply the full list you want instead.

### Upgrading from a hand-edited KubeVirt CR

Earlier Cozystack releases left `spec.configuration.permittedHostDevices` for operators to hand-edit (`kubectl edit kubevirt`). The bundle now **owns** that field: the first reconcile after the upgrade replaces your manual entries with the rendered NVIDIA default table.

Before upgrading:

1. Dump your current entries:

   ```bash
   kubectl -n cozy-kubevirt get kubevirt kubevirt -o json \
     | jq '.spec.configuration.permittedHostDevices'
   ```

2. Move any custom entries into the Platform Package values under `.gpu.permittedHostDevices` (set `.gpu.replaceDefaults: true` if you want only your own list instead of appending to the NVIDIA defaults).

3. Verify every `resourceName` against what your nodes actually advertise. The default table carries the slug `nvidia-sandbox-device-plugin` generates from each card's PCI-IDs name (uppercased, e.g. `nvidia.com/TU104GL_TESLA_T4` for a Tesla T4), but a different plugin build or PCI-IDs snapshot can emit a different string:

   ```bash
   kubectl describe node <node> | grep nvidia.com/
   ```

A `resourceName` mismatch is silent until a GPU VM restarts or migrates, at which point the admission webhook rejects it.

### Manual Package-CR override path

If you opt out of bundle management and hand-craft a `cozystack.gpu-operator` Package CR directly (to apply overrides the bundle does not expose — driver settings, custom node selectors, validator / dcgmExporter tweaks), the platform does NOT auto-wire `HostDevices` or `permittedHostDevices` into the KubeVirt CR. In that flow, mirror the bundle behaviour by also creating a `cozystack.kubevirt` Package CR that carries `extraFeatureGates` and the matching `permittedHostDevices` block under `spec.components.kubevirt.values` (a cozystack `Package` always nests component values under `spec.components.<name>.values`, never a top-level `spec.values`):

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.kubevirt
spec:
  variant: default
  components:
    kubevirt:
      values:
        extraFeatureGates:
        - HostDevices
        permittedHostDevices:
          pciHostDevices:
          - pciVendorSelector: "10DE:2236"
            resourceName: nvidia.com/GA102GL_A10
            externalResourceProvider: true
```

The manual Package-CR override path takes precedence over the bundle render whenever both exist.

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
