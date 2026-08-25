---
title: "NVIDIA vGPU для виртуальных машин"
linkTitle: "vGPU"
description: "Как поделить один физический GPU NVIDIA между несколькими виртуальными машинами с помощью варианта vgpu пакета GPU Operator, включая назначение профилей SR-IOV и лицензирование DLS."
weight: 45
---

На этой странице описано, как настроить пакет GPU Operator с поддержкой NVIDIA vGPU, чтобы один физический GPU можно было разделить между несколькими виртуальными машинами. О передаче GPU целиком одной ВМ см. [проброс GPU (passthrough)](/docs/v1.6/virtualization/gpu/); о GPU в контейнерах, а не в ВМ, — [контейнерные рабочие нагрузки с GPU](/docs/v1.6/operations/gpu-container-workloads/).

Проверено 29.04.2026 на KubeVirt из `main` (nightly-сборка `virt-handler` `20260429_74d7c52588`), варианте `vgpu` пакета `cozystack.gpu-operator`, хостовом драйвере NVIDIA vGPU 20.0 `595.58.02` и гостевом драйвере GRID `595.58.03`.

## Две модели драйвера

Драйвер vGPU от NVIDIA использует две разные модели на стороне хоста в зависимости от поколения GPU:

- **Mediated devices (mdev)** — Pascal / Volta / Turing / Ampere до A100 и A30 включительно. Драйвер создаёт родительские mdev-устройства в `/sys/class/mdev_bus/`; KubeVirt анонсирует их через `permittedHostDevices.mediatedDevices`.
- **SR-IOV с sysfs на каждую VF** — Ada Lovelace (L4, L40, L40S, …) и Blackwell (B100, …) на ветке драйвера vGPU 17/20. Драйвер создаёт виртуальные функции (VF) SR-IOV; профиль выбирается через `/sys/bus/pci/devices/<VF>/nvidia/current_vgpu_type`. KubeVirt анонсирует VF через `permittedHostDevices.pciHostDevices` — после [kubevirt/kubevirt#16890](https://github.com/kubevirt/kubevirt/pull/16890).

Это руководство посвящено **пути SR-IOV** — единственной модели, которую NVIDIA поддерживает для актуальных дата-центровых GPU. Mdev упомянут для полноты картины; для карт от Pascal до Ampere обращайтесь к апстримной документации NVIDIA GPU Operator.

## Предварительные требования

- GPU NVIDIA поколения Ada Lovelace или новее с поддержкой SR-IOV vGPU (L4, L40, L40S и подобные).
- Хостовая ОС Ubuntu 24.04. Более старые выпуски Ubuntu тоже подойдут, если в апстримном репозитории `gpu-driver-container` есть соответствующий Dockerfile в `vgpu-manager/`. **Talos Linux для vGPU не рекомендуется**: NVIDIA не распространяет гостевой драйвер vGPU публично — он требует доступа к NVIDIA Enterprise Portal, — а Sidero [закрыла siderolabs/extensions#461](https://github.com/siderolabs/extensions/issues/461), отметив, что не может поддерживать vGPU, «пока NVIDIA не изменит условия лицензирования или не предоставит нам способ получать, тестировать и распространять это ПО». Поэтому собрать системное расширение Talos с драйвером внутри невозможно без приватного форка, нарушающего EULA.
- KubeVirt с [kubevirt/kubevirt#16890](https://github.com/kubevirt/kubevirt/pull/16890) («vGPU: SRIOV support», смерджен в `main` 10.04.2026). Нацелен на следующий минорный релиз (v1.9.0); фактический тег релиза отслеживайте по самому pull request. В выпущенные теги до v1.8.x включительно патч не входит, бэкпорты не планируются. Если vGPU нужен раньше выхода v1.9.0, придётся запускать nightly-сборку `virt-handler` из `main`; остальная часть оператора может остаться на последнем выпущенном теге.
- Подписка NVIDIA vGPU Software или NVIDIA AI Enterprise (файл `.run` распространять запрещено).
- Доступный экземпляр NVIDIA Delegated License Service (DLS) и соответствующий ему файл `client_configuration_token.tok`.

## Варианты

Пакет `gpu-operator` предоставляет три варианта. Эта страница посвящена vGPU, но перечень вариантов общий для всех.

- **`default`** — режим проброса (passthrough) через `vfio-pci`. GPU целиком отдаётся одной ВМ. Talos здесь поддерживается: модуль ядра — открытый `vfio-pci`, поэтому проприетарный драйвер на хосте не нужен. На хосте, где уже установлен драйвер NVIDIA из пакетного менеджера, этот вариант не заработает — см. [Проброс GPU не работает на хосте с предустановленным драйвером NVIDIA](/docs/v1.6/operations/troubleshooting/gpu-operator-host-driver/).
- **`vgpu`** — режим SR-IOV vGPU. Один физический GPU делится на несколько VF, каждая из которых привязана к профилю vGPU, и гость видит её как собственный GPU.
- **`container`** — контейнерные рабочие нагрузки с GPU (поды с CUDA, обучение ML) через штатный device-плагин NVIDIA, на хостах, где уже есть и драйвер NVIDIA, и `nvidia-container-toolkit`. Этот вариант ортогонален двум предыдущим: GPU в ВМ KubeVirt он не отдаёт. См. [контейнерные рабочие нагрузки с GPU](/docs/v1.6/operations/gpu-container-workloads/).

## Сборка образа vGPU Manager

Проприетарный драйвер vGPU Manager нужно получить у NVIDIA и упаковать в контейнерный образ, который затем скачивает чарт gpu-operator: из «сырого» `.run` он в рантайме не устанавливается. Этот путь сборки принадлежит NVIDIA: в их репозитории [`gpu-driver-container`](https://github.com/NVIDIA/gpu-driver-container) лежат Dockerfile’ы под каждую ОС в `vgpu-manager/<os>/`, и он же является источником истины по аргументам сборки, базовым образам и списку поддерживаемых выпусков ОС. Следуйте README этого репозитория.

Проприетарный `.run` — это вариант **Linux KVM**, а не `.deb` для Ubuntu KVM (в последнем лежат заранее собранные модули только под штатные ядра). Скачать его можно на [портале лицензирования NVIDIA](https://ui.licensing.nvidia.com) при наличии подписки NVIDIA AI Enterprise или vGPU.

{{< warning >}}

**EULA:** никогда не публикуйте полученный образ в реестре с публичным доступом на чтение. Используйте приватный реестр — хорошо подходит Harbor внутри кластера в виде обычного (не proxy) проекта.

{{< /warning >}}

## Развёртывание варианта vgpu

Бандл `iaas` платформы разворачивает Package CR gpu-operator, когда `cozystack.gpu-operator` присутствует в `bundles.enabledPackages` и задано `bundles.iaas.gpuOperatorVariant: vgpu`. Образ vGPU Manager проприетарный и распространению не подлежит, поэтому бандл не поставляет тег по умолчанию: соберите контейнер по апстримному рецепту `gpu-driver-container` и передайте координаты приватного реестра через значения платформы:

```yaml
bundles:
  iaas:
    enabled: true
    gpuOperatorVariant: vgpu
  enabledPackages:
  - cozystack.gpu-operator

gpu:
  vgpuManager:
    repository: registry.example.com/nvidia
    image: vgpu-manager
    version: "595.58.02-ubuntu24.04"
    # imagePullSecrets задаётся отдельно для каждого компонента
    # (vgpuManager, driver, validator, dcgmExporter, …). Значение —
    # список строк, а не [{name: ...}].
    imagePullSecrets:
    - nvidia-registry-secret
```

Платформа передаёт `gpu.vgpuManager` в формируемый Package CR gpu-operator, в `components.gpu-operator.values.gpu-operator.vgpuManager`, поэтому и вариант, и координаты образа задаются в одном месте. Если нужно переопределить что-то ещё в чарте gpu-operator (driver, validator, dcgmExporter, кастомные node selectors), создайте Package CR с именем `cozystack.gpu-operator` вручную, с полным блоком `components.gpu-operator.values` — он имеет приоритет над рендером бандла.

`nvidia-registry-secret` — это Secret типа docker-registry, который нужно заранее создать в `cozy-gpu-operator`.

Убедитесь, что DaemonSet запущен и `nvidia.ko` загружается на каждом узле с GPU:

```bash
kubectl -n cozy-gpu-operator get pods -l app=nvidia-vgpu-manager-daemonset
kubectl -n cozy-gpu-operator exec -it <pod> -- nvidia-smi
```

`nvidia-smi` должен перечислить физические GPU и показать `Host VGPU Mode : SR-IOV`.

## Назначение профилей (путь SR-IOV)

{{< caution >}}

**На Ada и новее вариант `vgpu` экспериментальный и поставляется без механизма назначения профилей.** `vgpu-device-manager` от NVIDIA обходит `/sys/class/mdev_bus/`, которого на Ada и новее не существует: DaemonSet падает с ошибкой «no parent devices found for GPU at index '0'», поэтому в `values-vgpu.yaml` он по умолчанию отключён. Пока не появится контроллер, умеющий работать с SR-IOV, назначение профилей остаётся внешним шагом, который нужно повторять после каждой перезагрузки узла (`current_vgpu_type` сбрасывается в 0 при повторном перечислении устройств PCIe). Без этого шага `permittedHostDevices.pciHostDevices` даёт ноль доступных (allocatable) ресурсов, и ни одна ВМ не может запросить vGPU. **Не разворачивайте вариант `vgpu` в production, пока у вас нет автоматического механизма назначения профилей** — обычно это небольшой DaemonSet, который читает ConfigMap (`<bus-id> = <profile-id>`) и при загрузке пишет соответствующие файлы `current_vgpu_type`.

{{< /caution >}}

После загрузки `nvidia.ko` драйвер включает SR-IOV (по умолчанию 16 VF на каждый L40S). Каждой VF нужно записать в её sysfs профиль vGPU:

```bash
# изнутри пода nvidia-vgpu-manager-daemonset (privileged, hostPID)
echo 1155 > /sys/bus/pci/devices/0000:02:00.5/nvidia/current_vgpu_type
```

Числовой идентификатор профиля можно узнать для каждой VF:

```bash
cat /sys/bus/pci/devices/0000:02:00.5/nvidia/creatable_vgpu_types
```

Для GPU от Pascal до Ampere (V100, T4, A100, A30) по-прежнему действует модель mdev. Переключите `vgpuDeviceManager.enabled: true` в переопределениях своего Package CR — там device manager от NVIDIA работает корректно.

## Настройка KubeVirt

Когда `cozystack.gpu-operator` присутствует в `bundles.enabledPackages` (и не указан заодно в `bundles.disabledPackages`), платформа автоматически зеркалирует выбранный вариант GPU в CR `KubeVirt`. Ручной шаг `kubectl patch` не требуется.

Если вы отказываетесь от управления бандлом и создаёте Package CR `cozystack.gpu-operator` вручную — обычно чтобы применить переопределения, которых бандл не предоставляет, — платформа **не** подключает `HostDevices` и `permittedHostDevices` в CR KubeVirt автоматически. В этом случае вы точно так же вручную создаёте Package CR `cozystack.kubevirt` с `components.kubevirt.values.extraFeatureGates: [HostDevices]` и подходящим блоком `permittedHostDevices`. Описанная ниже форма значений под `.gpu` — это «аварийный клапан», документированный только для сценария с управлением через бандл; путь ручного переопределения Package CR имеет приоритет над рендером бандла всегда, когда существуют оба.

- В `developerConfiguration.featureGates` добавляется `HostDevices` (текущий KubeVirt отделяет это от гейта `GPU`; без него admission webhook отклоняет `spec.template.spec.domain.devices.hostDevices`).
- `permittedHostDevices.pciHostDevices` заполняется из `packages/core/platform/files/gpu-passthrough-defaults.yaml` в [репозитории cozystack](https://github.com/cozystack/cozystack), когда задано `bundles.iaas.gpuOperatorVariant: default` (значение по умолчанию для пакета). Таблица покрывает Hopper (H100/H200), Ada Lovelace (L4/L40/L40S), Ampere (A100 PCIe/SXM, A40, A30, A10), Turing (T4) и Volta (V100/V100S). У всех записей стоит `externalResourceProvider: true`, потому что имена ресурсов приходят от `nvidia-sandbox-device-plugin`, а не от встроенного device-плагина KubeVirt.
- `permittedHostDevices.mediatedDevices` заполняется из `packages/core/platform/files/gpu-vgpu-defaults.yaml`, когда задано `bundles.iaas.gpuOperatorVariant: vgpu`. Этот список только *публикует* — по имени профиля (`mdevNameSelector`) — те mdev, которые vGPU Device Manager из состава GPU Operator *создаёт* на узле; числовых значений `mediatedDevicesConfiguration` платформа по умолчанию не поставляет (идентификаторы типов `nvidia-NNN` — это индексы sysfs, свои для каждой модели GPU и версии драйвера, переносимого значения у них нет; задавайте `.gpu.mediatedDevicesConfiguration` самостоятельно, с проверенными на хосте идентификаторами, и только если хотите, чтобы mdev создавал KubeVirt, а не Device Manager). Стартовый набор покрывает профили mdev от Pascal до Ampere (A100-40C/80C, A40-24Q/48Q, A30-24C, A10-24Q, V100D-32C, T4-16Q) — то же семейство карт, для которого апстримный `vgpu-device-manager` обходит `/sys/class/mdev_bus/`. SR-IOV vGPU на Ada Lovelace и Blackwell в дефолтный список чарта не входит: публикуйте такие VF через пользовательское переопределение, описанное ниже.

### Расширение или замена дефолтной таблицы

Платформа предоставляет три параметра под `.gpu`:

```yaml
gpu:
  # Расширить дефолты платформы записями, специфичными для кластера.
  # Оба ключа-списка читаются в обоих вариантах: pciHostDevices
  # обслуживает и путь проброса (vfio-pci), И путь SR-IOV vGPU для VF
  # на Ada Lovelace / Blackwell (после kubevirt#16890); mediatedDevices
  # обслуживает путь mdev на Pascal–Ampere (до #16890). Оба
  # рендерятся в один и тот же CR KubeVirt.
  permittedHostDevices:
    pciHostDevices:
    - pciVendorSelector: "10DE:26B9"   # L40S, публикуется как VF для SR-IOV vGPU
      resourceName: nvidia.com/L40S-24Q
      # externalResourceProvider здесь опущен намеренно: после
      # kubevirt/kubevirt#16890 ресурс анонсирует напрямую встроенный
      # device-плагин virt-handler, sandbox-плагин в этой схеме не
      # участвует.
    mediatedDevices: []
  # mediatedDevicesConfiguration заставляет KubeVirt самостоятельно
  # создавать mdev (режим vgpu). Значения по умолчанию нет: создание
  # mdev обычно делегируется vGPU Device Manager (по именам), а эти
  # mediatedDeviceTypes — индексы sysfs вида nvidia-NNN, зависящие от
  # хоста и драйвера (свои посмотрите в
  # /sys/bus/pci/devices/<BDF>/mdev_supported_types/*/name). Задавайте
  # это только чтобы явно перейти на создание средствами KubeVirt;
  # mergeOverwrite ЗАМЕНЯЕТ переданный ключ верхнего уровня целиком.
  mediatedDevicesConfiguration: {}
  # Полностью снести дефолты платформы и оставить только собственные
  # выверенные списки кластера. Полезно для кластеров без GPU NVIDIA
  # и там, где требуется строгий allowlist.
  replaceDefaults: false
```

`replaceDefaults: false` (значение по умолчанию) добавляет пользовательские записи к дефолтам NVIDIA. `replaceDefaults: true` убирает таблицу NVIDIA целиком — и если после этого не передать свой список `pciHostDevices` или `mediatedDevices`, в отрендеренном CR KubeVirt не будет блока `permittedHostDevices` вовсе, а admission webhook отклонит каждую ВМ с GPU.

### Имена ресурсов от `nvidia-sandbox-device-plugin`

Строки `resourceName` в `gpu-passthrough-defaults.yaml` — это то, что анонсирует `nvidia-sandbox-device-plugin` (`nvcr.io/nvidia/kubevirt-gpu-device-plugin`): он механически выводит каждый слаг из имени устройства в базе PCI-IDs — переводит его в верхний регистр, заменяет `/`, `.` и пробелы на `_` и убирает остальные не-алфавитно-цифровые символы (`[` и `]`). Так `TU104GL [Tesla T4]` превращается в `nvidia.com/TU104GL_TESLA_T4`, а `GA100GL [A30 PCIe]` — в `nvidia.com/GA100GL_A30_PCIE`: слаг несёт в себе каждый токен строки PCI-IDs (суффикс кристалла `GL`, бренд `Tesla` на Turing и Volta, форм-фактор, объём памяти), а не аккуратный `<arch>_<model>`. Имена следуют за снапшотом pci.ids, вложенным в образ плагина, поэтому другая сборка плагина может выдать другую строку — проверяйте командой `kubectl describe node <node> | grep nvidia.com/` и переопределяйте через `.gpu.permittedHostDevices.pciHostDevices` (либо снесите таблицу через `replaceDefaults: true` и составьте свою). Сами идентификаторы вендора и устройства PCI стабильны между версиями драйвера.

### PF и VF в SR-IOV на Ada Lovelace и новее

На L40S и других картах Ada Lovelace у VF в SR-IOV тот же идентификатор устройства PCI, что и у PF: `lspci -nn -d 10de:` на хосте показывает и то, и другое как `[10de:26b9]`. `virt-handler` различает их по признаку «является VF и имеет профиль vGPU», поэтому один `pciVendorSelector` попадает точно в нужный набор. Проверьте это на своём конкретном GPU, прежде чем на такое поведение рассчитывать: у некоторых других поколений идентификаторы PF и VF различаются.

Флаг `externalResourceProvider: true` **не** нужен, когда ресурс анонсирует встроенный device-плагин `virt-handler` (то есть на пути SR-IOV после kubevirt#16890). В дефолтах платформы для проброса этот флаг стоит потому, что там за анонс отвечает внешний sandbox-плагин.

### Проверка доступной ёмкости (allocatable)

```bash
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.status.allocatable.nvidia\.com/L40S-24Q}{"\n"}{end}'
```

## Лицензирование (DLS)

vGPU 17/20 использует NVIDIA Delegated License Service. Устаревшие строки `ServerAddress=` и `ServerPort=7070` в `gridd.conf` больше не являются определяющими: `nvidia-gridd`, работающий **внутри гостя**, читает эндпоинт DLS напрямую из файла ClientConfigToken.

Хостовый DaemonSet vGPU Manager лицензию не запрашивает — он лишь включает SR-IOV и загружает `nvidia.ko`. Лицензирование целиком потребляется гостем. Параметр `driver.licensingConfig.secretName` чарта gpu-operator смонтировал бы Secret в **под драйвера на хосте**, где для SR-IOV vGPU он не даёт никакого эффекта; не подключайте Secret с лицензией через него.

Вместо этого доставляйте токен и `gridd.conf` в гостя через cloud-init или overlay containerDisk:

```yaml
# внутри userData cloudInitNoCloud у VirtualMachine
write_files:
- path: /etc/nvidia/ClientConfigToken/client_configuration_token.tok
  # Права 0744 соответствуют рекомендации NVIDIA из Virtual GPU
  # Software Licensing User Guide («Configuring a Licensed Client on
  # Linux»): nvidia-gridd не обязательно работает от имени владельца
  # файла.
  # https://docs.nvidia.com/vgpu/latest/grid-licensing-user-guide/
  permissions: '0744'
  encoding: b64
  content: <base64 token>
- path: /etc/nvidia/gridd.conf
  permissions: '0644'
  content: |
    # FeatureType выбирает, какую лицензию vGPU Software запрашивает
    # гость.
    # 0 — нелицензированное состояние (лицензия не запрашивается;
    #     профили Q после окончания grace-периода работают в
    #     урезанном режиме).
    # 1 — NVIDIA vGPU. Драйвер сам подбирает нужный тип лицензии по
    #     настроенному профилю vGPU (Q → vWS, B → vPC,
    #     A → vCS / Compute). Используйте это для профилей SR-IOV vGPU.
    # 2 — явно NVIDIA RTX Virtual Workstation.
    # 4 — явно NVIDIA Virtual Compute Server.
    FeatureType=1
```

Проверьте активацию внутри гостя:

```bash
nvidia-smi -q | grep 'License Status'
# License Status   : Licensed
```

Если гость дольше пары минут сообщает `Unlicensed (Unrestricted)`, поищите в `journalctl _COMM=nvidia-gridd` ошибки рукопожатия с эндпоинтом DLS, зашитым в токен.

### Миграция с чарта v25.x

В апстриме параметр `driver.licensingConfig.configMapName` объявлен устаревшим в пользу `driver.licensingConfig.secretName`. Старый ключ ещё работает, но при рендеринге выдаёт предупреждение об устаревании. Если ваш существующий `Package` CR задавал ссылку на лицензию через `configMapName`, при этом обновлении переключите его на `secretName` — содержимое Secret (`gridd.conf` и ClientConfigToken) менять не нужно. Это касается развёртываний с пробросом, где хостовое лицензирование шло через чарт gpu-operator; SR-IOV vGPU, как описано выше, хостовый параметр лицензирования вообще не использует.

## Пример VirtualMachine

Ресурс принимают и `hostDevices`, и `gpus` (апстримный API KubeVirt разрешает как пулы PCI, так и пулы mediated-устройств), но по соглашению для проброса PCI в виде VF используют `hostDevices`:

```yaml
apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  name: vgpu-smoke
  namespace: tenant-example
spec:
  runStrategy: Always
  template:
    spec:
      domain:
        cpu:
          cores: 4
        memory:
          guest: 8Gi
        devices:
          disks:
          - name: rootdisk
            disk:
              bus: virtio
          interfaces:
          - name: default
            masquerade: {}
          hostDevices:
          - name: gpu0
            deviceName: nvidia.com/L40S-24Q
      networks:
      - name: default
        pod: {}
      volumes:
      - name: rootdisk
        # Overlay containerDisk на 2,4 ГиБ слишком мал, чтобы
        # установить в него гостевой драйвер GRID. В production
        # используйте DataVolume CDI на 20 ГиБ и больше.
        containerDisk:
          image: quay.io/containerdisks/ubuntu:24.04
```

Внутри гостя установите драйвер GRID из `.run` — именно ГОСТЕВОГО `.run`, который отличается от хостового пакета `vgpu-kvm`, — после чего `nvidia-smi` должен показать настроенный профиль:

```text
| 0  NVIDIA L40S-24Q                Off |   00000000:0E:00.0 Off |                    0 |
|        17 MiB / 24576 MiB    P0    Default                                                |
```

## Справочник профилей (L40S)

L40S поддерживает полные семейства профилей Q (RTX vWS), B (vPC) и A (vCS / Compute). Числовые идентификаторы приходят от драйвера и видны в `creatable_vgpu_types`:

| Профиль | Видеопамять | Макс. экземпляров на L40S | Сценарий использования |
| --- | --- | --- | --- |
| L40S-1Q | 1 ГБ | 48 | Лёгкая 3D-графика / VDI |
| L40S-2Q | 2 ГБ | 24 | Средняя 3D-графика / VDI |
| L40S-4Q | 4 ГБ | 12 | Тяжёлая 3D-графика / VDI |
| L40S-6Q | 6 ГБ | 8 | Профессиональная 3D-графика |
| L40S-8Q | 8 ГБ | 6 | Инференс AI / ML |
| L40S-12Q | 12 ГБ | 4 | Обучение AI / ML |
| L40S-24Q | 24 ГБ | 2 | Крупные AI-нагрузки |
| L40S-48Q | 48 ГБ | 1 | Эквивалент целого GPU |

Для других семейств GPU аналогичные таблицы есть в [документации NVIDIA Virtual GPU Software](https://docs.nvidia.com/grid/latest/grid-vgpu-user-guide/).

## Сводка по поддержке ОС

Столбец `container` подразумевает, что на хосте уже установлены драйвер NVIDIA и `nvidia-container-toolkit` из пакетного менеджера дистрибутива, а рантайм `nvidia` зарегистрирован в containerd. При `driver.enabled=false` оператор использует предустановленный хостовый драйвер по его стандартному пути, поэтому обычной установке из пакетов переопределение `hostPaths.driverInstallDir` не требуется. Talos ставит драйвер в нестандартный префикс, поэтому по пути по умолчанию оператор его не находит — путь для Talos, вместе с DaemonSet-ом совместимости и явным переопределением `hostPaths.driverInstallDir`, см. в `packages/system/gpu-operator/examples/` в [репозитории cozystack](https://github.com/cozystack/cozystack).

| Хостовая ОС | проброс (`default`) | vGPU (`vgpu`) | контейнеры (`container`) |
| --- | --- | --- | --- |
| Ubuntu 24.04 | ⚠️ поддерживается в апстриме, но хост должен быть свободен от любого драйвера NVIDIA, установленного из пакетов — см. [восстановление при хостовом драйвере](/docs/v1.6/operations/troubleshooting/gpu-operator-host-driver/) | ✅ поддерживается в апстриме (`vgpu-manager/ubuntu24.04`) | ✅ драйвер из пакетов плюс nvidia-container-toolkit |
| Ubuntu 22.04 | ⚠️ то же требование чистого хоста, что и для 24.04 | ✅ | ✅ |
| Ubuntu 20.04 | ⚠️ то же требование чистого хоста, что и для 24.04 | ✅ | ✅ |
| Ubuntu 26.04 | ⚠️ то же требование чистого хоста, что и для 24.04, плюс патч `nvidia-driver` под usr-merge (детали появятся позже) | ⚠️ тот же патч плюс собственный форк Dockerfile | ✅ |
| Talos Linux | ✅ (открытый `vfio-pci`; образ Talos не содержит хостового стека NVIDIA, поэтому проверка на чистый хост проходит тривиально) | ❌ NVIDIA не даёт прав на распространение проприетарного `.run` | ⚠️ хостовый драйвер попадает в нестандартный префикс — берите за основу `examples/values-native-talos.yaml` |
