---
title: "Networking Mesh"
linkTitle: "Сетевая связность"
description: "Настройка Kilo WireGuard mesh с Cilium для связности multi-location cluster."
weight: 10
---

Kilo создает WireGuard mesh между locations кластера. При работе с Cilium он использует
IPIP encapsulation, маршрутизируемую через VxLAN overlay Cilium, чтобы traffic между locations
работал даже тогда, когда cloud network блокирует raw IPIP packets (protocol 4).

## Выберите networking variant cilium-kilo

Во время настройки platform выберите networking variant **cilium-kilo**. Он разворачивает Cilium
и Kilo как интегрированный stack с нужной конфигурацией.

## Как это работает

1. Kilo работает в режиме `--local=false` и не управляет routes внутри location (это делает Cilium)
2. Kilo создает WireGuard tunnel (`kilo0`) между location leaders
3. Non-leader nodes в каждой location достигают remote locations через IPIP encapsulation до своего location leader, маршрутизируемую через VxLAN overlay Cilium
4. Leader decapsulates IPIP и пересылает traffic через WireGuard tunnel
5. Опция Cilium `enable-ipip-termination` создает интерфейс `cilium_tunl` (переименованный kernel `tunl0`), который Kilo использует для IPIP TX/RX; без него kernel обнаруживает TX recursion на tunnel device

## Talos machine config для cloud nodes

Cloud worker nodes должны содержать Kilo annotations в Talos machine config:

```yaml
machine:
  nodeAnnotations:
    kilo.squat.ai/location: <cloud-location-name>
    kilo.squat.ai/persistent-keepalive: "20"
  nodeLabels:
    topology.kubernetes.io/zone: <cloud-location-name>
```

{{% alert title="Примечание" color="info" %}}
Kilo читает `kilo.squat.ai/location` из **node annotations**, а не из labels. Annotation
`persistent-keepalive` критична для cloud nodes за NAT: она включает WireGuard NAT traversal,
позволяя Kilo автоматически обнаружить реальный public endpoint.
{{% /alert %}}

## Allowed location IPs

По умолчанию Kilo маршрутизирует через WireGuard mesh только pod CIDRs и individual node internal IPs. Если узлы в
location используют private subnet, к которой должны обращаться другие locations (например, для kubelet communication
или доступа к NodePort), добавьте annotation `kilo.squat.ai/allowed-location-ips` на узлы **в этой location**:

```bash
# На всех on-premise nodes (через label selector) - открыть on-premise subnet для cloud nodes
kubectl annotate nodes -l topology.kubernetes.io/zone=on-prem kilo.squat.ai/allowed-location-ips=192.168.100.0/24
```

Это сообщает Kilo, что указанные CIDRs нужно включить в WireGuard allowed IPs для этой location,
делая эти subnets маршрутизируемыми через tunnel из всех других locations.

{{% alert title="Предупреждение" color="warning" %}}
Добавляйте эту annotation на узлы, **которым принадлежит subnet, которую нужно открыть** (то есть на узлы в
location, где эта сеть существует), **а не** на remote nodes, которым нужно до нее достучаться. Если задать ее
в неправильной location, Kilo создаст route, отправляющий traffic для этого CIDR через WireGuard tunnel
на всех остальных узлах, включая узлы, которые напрямую подключены к этой subnet через L2. Это ломает локальную связность между co-located nodes.

Например, если cloud nodes используют `10.2.0.0/24`, добавьте annotation на **cloud** nodes.
**Не** добавляйте on-premise subnet (например, `192.168.100.0/23`) на cloud nodes: это перехватит
весь локальный traffic между on-premise nodes через WireGuard tunnel.
{{% /alert %}}

## Устранение неполадок

### WireGuard tunnel не установлен
- Проверьте, что у узла есть annotation `kilo.squat.ai/persistent-keepalive: "20"`
- Проверьте, что у узла есть annotation `kilo.squat.ai/location`, а не только label
- Проверьте, что cloud firewall разрешает inbound UDP 51820
- Посмотрите logs kilo: `kubectl logs -n cozy-kilo <kilo-pod>`
- Повторяющиеся каждые 30 секунд сообщения "WireGuard configurations are different" указывают на отсутствие annotation `persistent-keepalive`

### Non-leader nodes недоступны (timeout kubectl logs/exec)
- Проверьте, что IP forwarding включен на cloud network interfaces (это нужно Kilo leader для forward traffic)
- Проверьте logs kilo pod на ошибки `cilium_tunl interface not found`; это означает, что Cilium не запущен с `enable-ipip-termination=true` (variant cilium-kilo настраивает это автоматически)
