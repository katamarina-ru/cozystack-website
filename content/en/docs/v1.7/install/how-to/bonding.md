---
title: "Как настроить network bonding (LACP)"
linkTitle: "Настройка bonding (LACP)"
description: "Как настроить network bonding LACP (802.3ad) для агрегации каналов и резервирования"
weight: 120
---

Network bonding позволяет объединить несколько физических сетевых интерфейсов в один логический интерфейс.
Это увеличивает пропускную способность и обеспечивает резервирование каналов.

LACP (Link Aggregation Control Protocol, IEEE 802.3ad) — самый распространенный режим bonding,
который динамически согласует агрегацию каналов с сетевым коммутатором.

{{% alert color="warning" %}}
LACP требует настройки и на сервере, и на сетевом коммутаторе.
Убедитесь, что на коммутаторе настроен соответствующий LACP port-channel для портов сервера.
{{% /alert %}}

## Определение сетевых интерфейсов

После выполнения `talm template` сгенерированный конфигурационный файл узла будет содержать
блок комментариев с обнаруженными сетевыми интерфейсами:

```yaml
machine:
  network:
    # -- Discovered interfaces:
    # eno1:
    #   hardwareAddr: aa:bb:cc:dd:ee:f0
    #   busPath: 0000:02:00.0
    #   driver: tg3
    #   vendor: Broadcom Inc. and subsidiaries
    #   product: NetXtreme BCM5719 Gigabit Ethernet PCIe
    # eno2:
    #   hardwareAddr: aa:bb:cc:dd:ee:f1
    #   busPath: 0000:02:00.1
    #   driver: tg3
    #   vendor: Broadcom Inc. and subsidiaries
    #   product: NetXtreme BCM5719 Gigabit Ethernet PCIe
    # eth0:
    #   hardwareAddr: aa:bb:cc:dd:ee:f2
    #   busPath: 0000:04:00.0
    #   driver: bnx2x
    #   vendor: Broadcom Inc. and subsidiaries
    #   product: NetXtreme II BCM57810 10 Gigabit Ethernet
    # eth1:
    #   hardwareAddr: aa:bb:cc:dd:ee:f3
    #   busPath: 0000:04:00.1
    #   driver: bnx2x
    #   vendor: Broadcom Inc. and subsidiaries
    #   product: NetXtreme II BCM57810 10 Gigabit Ethernet
```

Выберите интерфейсы, которые хотите объединить в bond. Обычно это порты одной скорости,
подключенные к одному коммутатору или стеку коммутаторов. Запишите значения `busPath` — они понадобятся далее.

## Two ways to configure it

A bond can be described in `values.yaml`, which applies to every node the template renders,
or written into a single node's file by hand.

Prefer `values.yaml` when the nodes are alike — the description survives re-running
`talm template`, which regenerates node files and drops hand edits.
Reach for the node file when one machine differs from the rest.

The `values.yaml` route needs Talm v0.34+ and `templateOptions.talosVersion` at `v1.12` or later.

## Configure bonding from values.yaml

```yaml
network:
  extraLinks:
    - interface: bond0
      bond:
        interfaces: [eth0, eth1]
        mode: 802.3ad
        xmitHashPolicy: encap3+4
        miimon: 100
        updelay: 200
        downdelay: 200
      addresses:
        - 192.168.100.11/24
      routes:
        - gateway: 192.168.100.1
```

Both member NICs stop getting configuration of their own — a bond slave carries none.
That is also why moving an already-addressed NIC into a bond has to restate its addressing:
a member that currently holds addresses needs them listed on the bond entry,
and one holding the default route needs the `routes` entry as well.
Leave either out and the render stops and names what to move,
instead of applying a config that takes the node off the network.

VLANs hang off the same entry, and each child takes its own addresses, MTU and routes:

```yaml
network:
  extraLinks:
    - interface: bond0
      bond:
        interfaces: [eth0, eth1]
        mode: 802.3ad
      addresses:
        - 192.168.100.11/24
      routes:
        - gateway: 192.168.100.1
      vlans:
        - vlanId: 100
          addresses:
            - 10.0.0.11/24
```

For the floating IP, name the link the VIP belongs on rather than repeating it inside the interface:

```yaml
floatingIP: 192.168.100.10
vipLink: bond0
```

`vipLink` is worth setting on the first apply, while the bond does not exist on the node yet.
Once it does, discovery finds the link whose subnet contains the address on its own.
Several VIPs are listed under `vips`, each with its own link.

{{% alert color="info" %}}
Per-node addresses do not belong in a shared `values.yaml`.
Once a node is configured, discovery reads its addresses back and the rendered config keeps them —
so `extraLinks` is needed for the first apply, and for links the node does not carry yet.
{{% /alert %}}

## Configure bonding in a node file

Edit the generated node configuration file (e.g. `nodes/node1.yaml`) and replace the default
`machine.network.interfaces` section with a bond configuration.
Note that re-running `talm template` regenerates these files, so keep such edits to nodes that genuinely differ:

```yaml
machine:
  network:
    interfaces:
      - interface: bond0
        dhcp: false
        bond:
          mode: 802.3ad
          adSelect: bandwidth
          miimon: 100
          updelay: 200
          downdelay: 200
          minLinks: 1
          xmitHashPolicy: encap3+4
          deviceSelectors:
            - busPath: "0000:04:00.0"
            - busPath: "0000:04:00.1"
        addresses:
          - 192.168.100.11/24
        routes:
          - network: 0.0.0.0/0
            gateway: 192.168.100.1
```

### Описание параметров bond

| Параметр | Значение | Описание |
| --- | --- | --- |
| `mode` | `802.3ad` | LACP — динамическая агрегация каналов с согласованием на коммутаторе |
| `adSelect` | `bandwidth` | Выбирает активный агрегатор по наибольшей суммарной пропускной способности |
| `miimon` | `100` | Интервал мониторинга канала в миллисекундах |
| `updelay` | `200` | Задержка (мс) перед переводом восстановленного канала в активное состояние |
| `downdelay` | `200` | Задержка (мс) перед объявлением отказавшего канала отключенным |
| `minLinks` | `1` | Минимальное количество активных каналов, при котором bond остается поднятым |
| `xmitHashPolicy` | `encap3+4` | Хеширование по IP и TCP/UDP-порту для распределения нагрузки между каналами |

### Выбор интерфейсов

Рекомендуемый способ выбора участников bond — по пути PCI-шины с помощью `deviceSelectors`.
Это надежнее, чем имена интерфейсов, которые могут меняться между перезагрузками:

```yaml
bond:
  deviceSelectors:
    - busPath: "0000:04:00.0"
    - busPath: "0000:04:00.1"
```

Также можно выбирать по имени интерфейса:

```yaml
bond:
  interfaces:
    - eth0
    - eth1
```

Или по аппаратному адресу:

```yaml
bond:
  deviceSelectors:
    - hardwareAddr: "aa:bb:cc:dd:ee:f2"
    - hardwareAddr: "aa:bb:cc:dd:ee:f3"
```

## VLAN поверх bond

Поверх bond можно создавать VLAN-интерфейсы.
Это удобно для разделения трафика (например, management, storage, tenant-сетей):

```yaml
machine:
  network:
    interfaces:
      - interface: bond0
        dhcp: false
        bond:
          mode: 802.3ad
          adSelect: bandwidth
          miimon: 100
          updelay: 200
          downdelay: 200
          minLinks: 1
          xmitHashPolicy: encap3+4
          deviceSelectors:
            - busPath: "0000:04:00.0"
            - busPath: "0000:04:00.1"
        addresses:
          - 192.168.100.11/24
        routes:
          - network: 0.0.0.0/0
            gateway: 192.168.100.1
        vlans:
          - vlanId: 100
            addresses:
              - 10.0.0.11/24
```

## Floating IP (VIP) с bonding

Для узлов control plane разместите раздел `vip` на интерфейсе (или VLAN),
который используется для API endpoint кластера:

```yaml
machine:
  network:
    interfaces:
      - interface: bond0
        dhcp: false
        bond:
          mode: 802.3ad
          adSelect: bandwidth
          miimon: 100
          updelay: 200
          downdelay: 200
          minLinks: 1
          xmitHashPolicy: encap3+4
          deviceSelectors:
            - busPath: "0000:04:00.0"
            - busPath: "0000:04:00.1"
        addresses:
          - 192.168.100.11/24
        routes:
          - network: 0.0.0.0/0
            gateway: 192.168.100.1
        vip:
          ip: 192.168.100.10
```

Убедитесь, что floating IP совпадает с адресом, настроенным в `values.yaml`.

## Применение конфигурации

После редактирования всех файлов узлов примените конфигурацию обычным способом:

```bash
talm apply -f nodes/node1.yaml -i
talm apply -f nodes/node2.yaml -i
talm apply -f nodes/node3.yaml -i
```

{{% alert color="info" %}}
Флаг `-i` (`--insecure`) нужен только при первом применении, когда узлы находятся в maintenance mode.
Для уже инициализированных узлов не указывайте этот флаг: `talm apply -f nodes/node1.yaml`.
{{% /alert %}}
