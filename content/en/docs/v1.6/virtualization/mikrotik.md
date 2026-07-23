---
title: "Запуск MikroTik RouterOS в Cozystack"
linkTitle: "MikroTik RouterOS"
description: "Развёртывание MikroTik RouterOS (CHR) как виртуального устройства в Cozystack"
weight: 60
aliases:
  - /docs/v1.6/operations/virtualization/mikrotik
  - /docs/v1.6/networking/mikrotik
---

## Предварительные требования

-   ISO-образ MikroTik RouterOS (установочный образ CHR или NPK), например, `mikrotik-7.19.3.iso`.
-   Свободный статический IP-адрес или DHCP в подключённой сети тенанта.
-   Клиент KubeVirt `virtctl` [, установленный в вашей локальной среде](https://kubevirt.io/user-guide/user_workloads/virtctl_client_tool/)
    и настроенный для пространства имён вашего тенанта.
-   Cozystack версии v0.34.2 или новее.

## Установка

### 1. Подготовка дисков

Вам нужно **два диска**:

1.  **Установочный ISO** – оптический.
2.  **Системный диск** – неоптический.

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: mikrotik-iso
spec:
  source:
    http:
      url: https://download.mikrotik.com/routeros/7.19.3/mikrotik-7.19.3.iso
  optical: true
  storage: 1Gi
  storageClass: replicated
---
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: mikrotik-system
spec:
  optical: false
  storage: 1Gi
  storageClass: replicated
```

### 2. Создание VMInstance

RouterOS не требует специального профиля экземпляра.
Используйте лёгкий профиль Linux, такой как `ubuntu`, с небольшим типом экземпляра, например `u1.medium`:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMInstance
metadata:
  name: mikrotik-demo
spec:
  running: true
  instanceType: "u1.medium"
  instanceProfile: ubuntu
  disks:
    - name: mikrotik-system
      bus: sata
    - name: mikrotik-iso
      bus: sata
```

### 3. Установка RouterOS

1.  Запустите консоль:
    
    ```bash
    virtctl vnc mikrotik-demo -n tenant-test
    ```
    
2.  При запросе выбора пакетов выберите нужный набор (обычно *system*, *routing*, *security*).
    Подтвердите форматирование системного диска.
    
3.  После завершения установки извлеките установочный ISO.

### 4. Настройка MTU (необязательно)

Виртуальные сетевые интерфейсы Cozystack по умолчанию используют **MTU 1400**.
RouterOS учитывает это автоматически на адаптерах Virtio‑Net, но вы можете проверить или изменить значение:

```bash
/interface ethernet print detail
/interface ethernet set [find default-name~"ether1"] mtu=1400
```

Избегайте устаревших драйверов `e1000/vmxnet`, поскольку они игнорируют значения MTU, отличные от 1500, и могут отбрасывать большие пакеты.
