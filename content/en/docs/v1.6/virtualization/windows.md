---
title: "Запуск виртуальных машин Windows в Cozystack"
linkTitle: "Виртуальные машины Windows"
description: "Запуск виртуальных машин Windows в Cozystack"
weight: 50
aliases:
  - /docs/v1.6/operations/virtualization/windows
---

Cozystack может запускать виртуальные машины Windows.
В этом руководстве описаны предварительные требования и шаги, необходимые для загрузки виртуальной машины с ОС Windows.


## Предварительные требования

-   ISO-образ установки Windows.
-   ISO-образ драйверов Virtio.
-   Клиент KubeVirt `virtctl` [установленный в вашем локальном окружении](https://kubevirt.io/user-guide/user_workloads/virtctl_client_tool/)
    и настроенный для пространства имён вашего тенанта.
-   Cozystack версии v0.34.2 или новее.

## Установка 

Создание виртуальной машины с ОС Windows начинается с создания объектов `VMDisk`
и продолжается созданием `VMInstance`.

### 1. Создание объектов VMDisk

Вам понадобится **три диска**:

1.  **Установочный ISO** – оптический.
2.  **ISO с драйверами Virtio** – оптический.
3.  **Системный диск** – не оптический.

В следующем примере используются минимально рекомендованные тома хранилища.

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: win2k25-iso
spec:
  source:
    http:
      url: https://software-static.download.prss.microsoft.com/dbazure/888969d5-f34g-4e03-ac9d-1f9786c66749/26100.1742.240906-0331.ge_release_svc_refresh_SERVER_EVAL_x64FRE_en-us.iso
  optical: true
  storage: 6Gi
  storageClass: replicated
---
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: virtio-drivers
spec:
  source:
    http:
      url: https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso
  optical: true
  storage: 1Gi
  storageClass: replicated
---
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: win2k25-system
spec:
  optical: false
  storage: 50Gi
  storageClass: replicated
```

### 2. Создание VMInstance

Выберите профиль инстанса с **поддержкой Virtio** и подключите пустой системный диск.
Выберите из доступных профилей Virtio:

```text
windows.10.virtio
windows.11.virtio
windows.2k16.virtio
windows.2k19.virtio
windows.2k22.virtio
windows.2k25.virtio
```

Создайте объект `VMInstance`, как показано в этом примере:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMInstance
metadata:
  name: win2k25-demo
spec:
  running: true
  instanceType: "u1.xlarge"
  instanceProfile: windows.2k25.virtio # выбран из списка выше
  disks:
    - name: win2k25-system
    - name: win2k25-iso
    - name: virtio-drivers
```

### 3. Установка Windows

1.  Откройте консоль с помощью клиента `virtctl`:

    ```bash
    virtctl vnc vm-instance-win2k25-demo
    ```

2.  Продолжите стандартную установку Windows.

3.  Когда появится запрос **"Where do you want to install Windows?"** (Куда вы хотите установить Windows?), выберите **Load driver**,
    затем перейдите к CD-ROM с Virtio, например `E:\viostor\amd64\`.

4.  После появления виртуального диска продолжите установку и дайте Windows перезагрузиться.

5.  После первой перезагрузки отключите установочный диск Windows (`win2k25-iso`) и драйверы Virtio (`virtio-drivers`) от VMInstance.


## Преобразование существующего образа Windows

Если у вас уже есть диск Windows, созданный на VMware, Hyper-V или в другом облаке,
вы можете воспользоваться этим путём, чтобы подготовить его к работе с Virtio в Cozystack.


### 1. Создание фиктивного VMDisk для драйвера Virtio

Создайте фиктивный VMDisk, который будет использоваться для установки драйвера Virtio:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: dummy-disk-for-virtio
spec:
  optical: false
  storage: "1Gi"
  storageClass: "replicated"
```

### 2. Запуск с диском и не-Virtio шиной

При создании `VMInstance` подключите системный диск с шиной `sata`, а фиктивный диск — с неуказанной шиной —
тогда для диска по умолчанию будет использована шина Virtio SCSI.
Вы также можете одновременно смонтировать Virtio ISO, чтобы упростить установку драйвера.

```yaml
spec:
  instanceProfile: windows.2k25.virtio
  disks:
    - name: win2k19-system
      bus: sata
    - name: dummy-disk-for-virtio
    - name: virtio-drivers
      bus: sata
```


### 3. Установка драйверов хранилища Virtio

Выполните следующие шаги для установки драйверов Virtio:

1.  Смонтируйте `virtio-win.iso` внутри гостевой системы.
2.  Запустите мастер установки для установки драйверов
3.  Убедитесь, что установка драйвера прошла успешно:
    1.  Откройте Диспетчер устройств (Device Manager)
    2.  Вы должны увидеть устройство SCSI в списке с иконкой восклицательного знака рядом с ним.
    3.  Если драйвер не установлен, щёлкните правой кнопкой мыши по устройству и выберите **Update Driver**.
    4.  Выберите **Install the hardware that I manually select from a list**, затем **Show All Devices**, затем **Next**.
    5.  Нажмите **Have Disk…**, перейдите к файлу `.inf` и завершите работу мастера.

В качестве альтернативы щёлкните правой кнопкой мыши по файлу `.inf` в Проводнике и выберите **Install**.

### 4. Переключение на шину Virtio

После установки драйверов вам нужно переключиться на шину Virtio.
Выполните следующие шаги:

1.  Выключите ВМ.
2.  Отредактируйте `VMInstance` и удалите строку `bus: sata` из системного диска, а также фиктивный диск:

    ```yaml
    spec:
      disks:
        - name: win2k19-system
        #  bus: sata
        #- name: dummy-disk-for-virtio
    ```

3.  Примените манифест и снова включите ВМ. Windows должна нормально загрузиться с использованием Virtio.
4.  Теперь фиктивный диск можно удалить:

    ```bash
    kubectl delete vmdisk dummy-disk-for-virtio
    ```

## Соображения по поводу MTU сети

Cozystack устанавливает размер MTU равным 1400 на каждом vNIC.
Windows корректно определяет это только при использовании VirtioNet.
С устаревшими сетевыми драйверами вы можете столкнуться с потерей пакетов.

Чтобы заставить Windows учитывать MTU 1400, выполните следующие команды в PowerShell:

```powershell
# List interfaces
Get-NetIPInterface

# Set MTU permanently
Set-NetIPInterface -InterfaceAlias "Ethernet Instance 0" -NlMtuBytes 1400
```

Настоятельно рекомендуется использовать профиль Virtio.
