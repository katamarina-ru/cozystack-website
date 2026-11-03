---
title: "Подключение виртуальной машины к внешнему VLAN"
linkTitle: "Внешний VLAN для ВМ"
description: "Как подключить виртуальную машину мостом к физически маршрутизируемому VLAN, чтобы она оказалась в одном широковещательном домене с внешним оборудованием, и почему macvlan для этого не подходит."
weight: 35
---

На этой странице описано, как подключить виртуальную машину Cozystack (приложение [`vm-instance`](/docs/v1.7/virtualization/vm-instance/)) напрямую к внешнему, физически маршрутизируемому VLAN. Такой L2-сегмент нужен ВМ, когда она должна оказаться в том же широковещательном домене, что и внешнее оборудование (сервер лицензирования, СХД, шлюз, управляемый вне кластера), и получить адрес из подсети этого VLAN, а не из оверлея кластера.

Сеть для ВМ в Cozystack по умолчанию работает только через оверлей (сеть подов плюс опциональные [подсети VPC](/docs/v1.7/networking/vpc/) KubeOVN). Подключение ВМ мостом в реальный VLAN — это другой сценарий, и у него есть одно неочевидное ограничение: **он работает с Linux-мостом и CNI-плагином `bridge` и не работает с `macvlan`.** Дальше в этом руководстве объясняется, почему, и приводится работающий рецепт.

## Почему `bridge`, а не `macvlan`

KubeVirt по умолчанию подключает интерфейс ВМ к вторичной сети через **bridge binding** (именно это чарт `vm-instance` формирует для каждой сети в `.spec.networks`). При bridge binding в сеть уходит собственный MAC-адрес гостя — под-лончер не подменяет и не транслирует его.

Подключение через `macvlan` с этой моделью несовместимо. `macvlan` демультиплексирует входящие кадры строго по MAC-адресу дочернего macvlan-интерфейса. А поскольку KubeVirt выпускает в сеть MAC *гостя*, а не MAC дочернего macvlan-интерфейса, ответы от шлюза или других хостов приходят на родительский интерфейс с адресом получателя, равным MAC гостя, не совпадают ни с одним дочерним macvlan-интерфейсом и молча отбрасываются, так и не дойдя до ВМ. Симптом: гость может передавать (ARP-запросы и пинги уходят, это видно в `tcpdump` на родительском интерфейсе), но никогда не получает ответа (запись о шлюзе в его neighbor-таблице остаётся в состоянии `FAILED`). Побочное следствие: хост тоже не может достучаться до дочерних macvlan-интерфейсов через родительский интерфейс, поэтому хостовый сервис на IP-адресе родительского интерфейса недоступен из ВМ.

У **Linux-моста** такого ограничения нет: он пересылает трафик по выученным MAC-адресам на всех подключённых к нему портах, поэтому MAC гостя достижим, а хост может держать адрес на самом мосте, чтобы общаться с ВМ. Подключите VLAN-подынтерфейс к мосту и направьте на этот мост NetworkAttachmentDefinition типа `bridge`.

## Обзор

Совместно работают три части:

1. **Linux-мост на каждом узле**, в который включён тегированный VLAN-подынтерфейс. Это сеть уровня узла — она настраивается вашими средствами провижининга узлов (netplan / machine config Talos / systemd-networkd), а не чартом Cozystack.
2. **`NetworkAttachmentDefinition`** типа `bridge`, ссылающийся на этот мост, созданный в пространстве имён тенанта, где живёт ВМ.
3. Приложение **`vm-instance`**, которое ссылается на NetworkAttachmentDefinition по имени в `.networks`, при этом статический адрес гостя задаётся через cloud-init.

## Предварительные требования

- Включён пакет `multus` (он предоставляет CRD `NetworkAttachmentDefinition` и всю обвязку вторичных сетей).
- CNI-плагин `bridge` присутствует в `/opt/cni/bin` на каждом узле. Пакет `multus` сам размещает его там на всех платформах; о том, что именно он устанавливает, и о способе отказаться от этого см. [README пакета multus](https://github.com/cozystack/cozystack/blob/main/packages/system/multus/README.md) — прочтите его перед обновлением кластера, если `/opt/cni/bin` вы наполняете самостоятельно. Проверить можно командой `ls /opt/cni/bin/bridge`; при отсутствии бинарника NetworkAttachmentDefinition падает с ошибкой `failed to find plugin "bridge" in path [/opt/cni/bin]`.
- В этой схеме нет IPAM-плагина: адреса назначаются внутри гостя, а не средствами CNI. Планируйте статические адреса для каждой ВМ.

## 1. Linux-мост на узле

Создайте мост, в который включён тегированный VLAN-подынтерфейс. Сам VLAN-подынтерфейс адреса не несёт; присутствие хоста в этом VLAN обеспечивает мост (это необязательно, но полезно для быстрой проверки доступности шлюза и для любого хостового сервиса, к которому должны обращаться ВМ).

В примере используется netplan на узле с Ubuntu/Debian; идентификатор VLAN и подсеть даны для иллюстрации (`203.0.113.0/24`, VLAN 100, шлюз `203.0.113.1`). Адаптируйте пример под свои имена интерфейсов, а также под Talos или `systemd-networkd`, если провижинингом занимаются они:

```yaml
network:
  version: 2
  vlans:
    # Тегированный VLAN-подынтерфейс без собственного адреса —
    # включён в мост.
    uplink.100:
      id: 100
      link: uplink
  bridges:
    br100:
      interfaces:
        - uplink.100
      # Необязательное присутствие хоста в VLAN. Маршрут по умолчанию
      # у узла должен оставаться на management-интерфейсе — не
      # добавляйте здесь второй маршрут по умолчанию.
      addresses:
        - 203.0.113.2/24
```

Замечания:

- **Маршрут по умолчанию узла должен оставаться на management-интерфейсе.** Адрес на мосте (если он есть) нужен только для доступности внутри VLAN, а не как второй шлюз по умолчанию.
- `netplan apply` не может перевести интерфейс в мост, пока интерфейс держит потребитель (например, под `virt-launcher`, использующий прежнее подключение через `macvlan`). Сначала уберите потребителя (удалите VMI, чтобы лончер отпустил интерфейс), и только потом меняйте конфигурацию.
- После перезагрузки `systemd-networkd` может некоторое время сообщать, что мост «routable», хотя линк фактически ещё не поднят. Если вашим ВМ нужен VLAN сразу при загрузке, поставьте их запуск в зависимость от проверки доступности либо повторяйте `netplan apply`, пока шлюз не начнёт отвечать.

## 2. NetworkAttachmentDefinition

Создайте NetworkAttachmentDefinition типа `bridge` в том пространстве имён тенанта, где будет работать ВМ. Чарт `vm-instance` ищет сеть по имени **в собственном пространстве имён ВМ**, поэтому по одной копии должно существовать в каждом пространстве имён тенанта, где запускаются ВМ в этом VLAN.

```yaml
apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: vlan100
  namespace: tenant-example
spec:
  config: |
    {
      "cniVersion": "0.3.1",
      "type": "bridge",
      "bridge": "br100",
      "ipam": {}
    }
```

- Значение `bridge` должно совпадать с именем моста из шага 1 (здесь — `br100`).
- `ipam: {}` — со стороны кластера адреса не назначаются, гость настраивает адрес сам (шаг 3).

## 3. Подключение ВМ и назначение статического адреса

Reference the NetworkAttachmentDefinition by name in the `vm-instance` values. This VLAN has no DHCP server, so the static address goes into cloud-init `userData` (`cloudInit`), written by the guest at first boot, and `netplanDhcp` stays off (see [Gotchas](#gotchas)):

```yaml
# values приложения vm-instance
instanceType: u1.medium
instanceProfile: ubuntu
disks:
  - name: example-system
networks:
  - name: vlan100
cloudInit: |
  #cloud-config
  write_files:
    - path: /etc/netplan/60-vlan100.yaml
      permissions: "0600"
      content: |
        network:
          version: 2
          ethernets:
            # Совпадение по второй сетевой карте (первая — карта в сети
            # подов). Берите интерфейс, который поднимается без аренды
            # DHCP.
            enp2s0:
              addresses:
                - 203.0.113.10/24
  runcmd:
    - netplan apply
```

В итоге у ВМ будет два интерфейса: всегда присутствующая сетевая карта в **сети подов** (`default`, используется для трафика внутри кластера и для механизмов внешнего доступа `vm-instance`) и сетевая карта в **VLAN**. Адрес `/24` из примера поднимает только connected-маршрут в подсеть VLAN и не добавляет маршрут по умолчанию, поэтому исходящий трафик гостя остаётся там, где вам нужно (обычно — на карте в сети подов). Если же VLAN должен стать для гостя шлюзом по умолчанию, добавьте маршрут по умолчанию на карте VLAN и уберите его с карты в сети подов.

## Подводные камни

- **VMs are dual-homed.** The `vm-instance` chart always adds the pod-network NIC in addition to any `networks` you declare; there is no single-homed (VLAN-only) option today. Address the VLAN NIC inside the guest and leave the pod NIC to the cluster.
- **Leave `netplanDhcp` off on a VM with a static NIC.** `netplanDhcp: true` makes the chart supply cloud-init network-data that asks every `en*` and `eth*` interface for DHCP, under the netplan IDs `cozy-en` and `cozy-eth`. Netplan writes one networkd file per ID, and systemd-networkd applies only the first `.network` file in lexical order that matches a link, so `10-netplan-cozy-en.network` shadows the `10-netplan-enp2s0.network` the recipe above produces and the static address is never applied, whatever number the recipe's netplan file carries. The key is off by default and is meant for guests whose every interface takes its address over DHCP, such as a VM on a VPC subnet.
- **MAC changes on VM re-creation.** KubeVirt generates a fresh guest MAC each time the VM object is re-created, and `vm-instance` exposes no way to pin it, so re-creating a VM changes its MAC. The upstream gateway then holds a stale ARP entry for the old MAC for a few minutes, so "gateway unreachable" immediately after re-creating a VM is expected — wait for the ARP entry to age out (roughly five minutes) rather than treating it as a fault.
- **Host-to-VM traffic.** If the host must talk to the VMs (a proxy, a health check), give the bridge a host address on the VLAN (step 1) — traffic through a bare VLAN sub-interface to bridge-attached guests will not work the way `macvlan` users expect.

## См. также

- [Подключение GPU к виртуальным машинам](/docs/v1.7/virtualization/gpu/) — проброс GPU NVIDIA и профилей vGPU в те же самые ВМ.
- [Сетевая архитектура](/docs/v1.7/networking/architecture/) — как устроена плоскость данных оверлея по умолчанию.
- Руководство пользователя KubeVirt, [Interfaces and Networks](https://kubevirt.io/user-guide/network/interfaces_and_networks/) — bridge binding в сравнении с другими способами подключения.
