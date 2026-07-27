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

## 2. KubeVirt подключается автоматически

Когда `cozystack.gpu-operator` присутствует в `bundles.enabledPackages`, Cozystack автоматически зеркалирует выбранный вариант GPU в Custom Resource `KubeVirt`. Шаг `kubectl edit kubevirt` не требуется.

В частности, платформа внедряет:

- `HostDevices` в `spec.configuration.developerConfiguration.featureGates` (текущий KubeVirt отделяет это от гейта `GPU`; admission webhook отклоняет `domain.devices.hostDevices` без него).
- Начальную таблицу `spec.configuration.permittedHostDevices.pciHostDevices` (рендерится в дефолтном варианте `gpuOperatorVariant: default` - passthrough через vfio-pci), покрывающую распространённые дата-центровые GPU NVIDIA - Hopper (H100, H200), Ada Lovelace (L4, L40, L40S), Ampere (A100 PCIe/SXM, A40, A30, A10), Turing (T4), Volta (V100, V100S). Пары PCI vendor:device стабильны; каждый слаг `resourceName` - это то, что `nvidia-sandbox-device-plugin` механически выводит из имени карты в базе PCI-IDs - переводит имя в верхний регистр, заменяет `/`, `.` и пробелы на `_`, затем убирает окружающие `[` / `]`. Таким образом слаг несёт в себе каждый токен из строки PCI-IDs (суффикс кристалла `GL`, бренд `Tesla` на Turing/Volta, форм-фактор, объём памяти), а не аккуратный `<arch>_<model>`: `TU104GL [Tesla T4]` становится `nvidia.com/TU104GL_TESLA_T4`, `GA100GL [A30 PCIe]` становится `nvidia.com/GA100GL_A30_PCIE`, а H200 SXM становится `nvidia.com/GH100_H200_SXM_141GB`. Уточните точные строки, которые анонсируют ваши узлы, с помощью `kubectl describe node <node> | grep nvidia.com/`. `externalResourceProvider: true` устанавливается для каждой записи, потому что ресурсы анонсируются sandbox-плагином, а не встроенным device-плагином KubeVirt.

Проверьте итоговый CR:

```bash
kubectl -n cozy-kubevirt get kubevirt kubevirt -o json \
  | jq '.spec.configuration | {featureGates: .developerConfiguration.featureGates, permittedHostDevices: .permittedHostDevices}'
```

{{% alert color="info" %}}

**Моего GPU нет в дефолтной таблице - где старый шаг `kubectl edit kubevirt`?** Он убран намеренно. `permittedHostDevices` теперь принадлежит шаблону чарта и реконсилируется из значений платформы, поэтому любое ручное изменение живого CR будет откачено при следующей реконсиляции Flux/Helm. Добавьте свою карту через `.gpu.permittedHostDevices` вместо этого - см. [Расширение или замена дефолтов NVIDIA](#extending-or-replacing-the-nvidia-defaults) ниже. Если вы обновляетесь с релиза, где вы вручную редактировали CR, сначала выполните [Обновление с вручную отредактированного KubeVirt CR](#upgrading-from-a-hand-edited-kubevirt-cr).

{{% /alert %}}

### Расширение или замена дефолтов NVIDIA

Если ваш кластер использует GPU, отсутствующий в дефолтной таблице, или ваша версия `nvidia-sandbox-device-plugin` выдаёт другой `resourceName` (проверьте с помощью `kubectl describe node <node> | grep nvidia.com/`), расширьте дефолты через значения платформы:

```yaml
# Platform Package values
gpu:
  # Append (по умолчанию) - ваши записи добавляются к таблице NVIDIA.
  # Установите true, чтобы полностью убрать таблицу NVIDIA (полезно для
  # кластеров, работающих только с не-NVIDIA GPU, или для строгих
  # allowlist-ов). При replaceDefaults: true и пустом списке ниже
  # итоговый CR не будет содержать блок permittedHostDevices вовсе,
  # и admission webhook отклонит каждую GPU VM - предоставьте свой список.
  replaceDefaults: false
  permittedHostDevices:
    pciHostDevices:
    - pciVendorSelector: "10DE:2236"
      resourceName: nvidia.com/GA102GL_A10
      externalResourceProvider: true
```

Чтобы **перенаправить** карту, уже присутствующую в таблице NVIDIA (например, чтобы дать `10DE:1EB8` другой `resourceName`), не добавляйте вторую запись для того же `pciVendorSelector` - обе записи будут отрендерены, и KubeVirt разрешает дублированный селектор недетерминированно. Установите `replaceDefaults: true` и предоставьте полный список, который вы хотите использовать вместо этого.

### Обновление с вручную отредактированного KubeVirt CR

В более ранних релизах Cozystack `spec.configuration.permittedHostDevices` оставлялся операторам для ручного редактирования (`kubectl edit kubevirt`). Теперь бандл **владеет** этим полем: первая реконсиляция после обновления заменяет ваши ручные записи отрендеренной дефолтной таблицей NVIDIA.

Перед обновлением:

1. Выгрузите текущие записи:

   ```bash
   kubectl -n cozy-kubevirt get kubevirt kubevirt -o json \
     | jq '.spec.configuration.permittedHostDevices'
   ```

2. Перенесите любые кастомные записи в значения Platform Package под `.gpu.permittedHostDevices` (установите `.gpu.replaceDefaults: true`, если хотите только свой список вместо добавления к дефолтам NVIDIA).

3. Проверьте каждый `resourceName` относительно того, что реально анонсируют ваши узлы. Дефолтная таблица содержит слаг, который генерирует `nvidia-sandbox-device-plugin` из имени карты в PCI-IDs (в верхнем регистре, например, `nvidia.com/TU104GL_TESLA_T4` для Tesla T4), но другая сборка плагина или снапшот PCI-IDs может выдать другую строку:

   ```bash
   kubectl describe node <node> | grep nvidia.com/
   ```

Несовпадение `resourceName` остаётся незаметным до тех пор, пока GPU VM не перезапустится или не мигрирует, после чего admission webhook отклоняет её.

### Путь ручного переопределения Package-CR

Если вы отказываетесь от управления бандлом и создаёте Package CR `cozystack.gpu-operator` вручную (чтобы применить переопределения, которые бандл не предоставляет - настройки драйвера, кастомные node selectors, настройки validator / dcgmExporter), платформа НЕ автоматически подключает `HostDevices` или `permittedHostDevices` в CR KubeVirt. В этом случае воспроизведите поведение бандла, также создав Package CR `cozystack.kubevirt`, который несёт `extraFeatureGates` и соответствующий блок `permittedHostDevices` под `spec.components.kubevirt.values` (cozystack `Package` всегда вкладывает значения компонента под `spec.components.<name>.values`, никогда не в верхнеуровневый `spec.values`):

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

Путь ручного переопределения Package-CR имеет приоритет над рендером бандла, когда существуют оба варианта.

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
