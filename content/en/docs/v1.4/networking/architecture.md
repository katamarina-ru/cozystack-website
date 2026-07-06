---
title: "Сетевая архитектура"
linkTitle: "Архитектура"
description: "Обзор сетевой архитектуры кластера Cozystack: балансировка нагрузки MetalLB, сеть Cilium на eBPF и изоляция тенантов с Kube-OVN."
weight: 5
aliases:
  - /docs/v1.4/reference/applications/architecture
  - /docs/reference/applications/architecture
---

## Обзор

Cozystack использует многослойный сетевой стек, разработанный для bare-metal-кластеров Kubernetes. Архитектура объединяет несколько компонентов, каждый из которых отвечает за свой уровень сети:

| Уровень | Компонент | Назначение |
| --- | --- | --- |
| Внешняя балансировка нагрузки | MetalLB | Публикация сервисов во внешние сети |
| Балансировка нагрузки сервисов | Cilium eBPF | Замена kube-proxy, DNAT внутри ядра |
| Сетевые политики | Cilium eBPF | Изоляция тенантов и обеспечение безопасности |
| Сеть подов (CNI) | Kube-OVN | Централизованный IPAM, оверлейная сеть |
| Проброс IP в ВМ | [cozy-proxy](https://github.com/cozystack/cozy-proxy/) | Проброс внешних IP-адресов внутрь виртуальных машин |
| Вторичные интерфейсы ВМ | [Multus CNI](https://github.com/k8snetworkplumbingwg/multus-cni) | Подключение вторичных L2-интерфейсов к виртуальным машинам |
| Наблюдаемость | Hubble (опционально) | Видимость сетевого трафика (по умолчанию отключено) |

```mermaid
flowchart TD
    EXT["External Clients"]
    RTR["Upstream Router / Gateway"]
    MLB["MetalLB<br/>(L2 ARP / BGP)"]
    CIL["Cilium eBPF<br/>(Service Load Balancing + Network Policies)"]
    OVN["Kube-OVN<br/>(Pod Networking + IPAM)"]
    PODS["Pods"]

    EXT --> RTR
    RTR --> MLB
    MLB --> CIL
    CIL --> OVN
    OVN --> PODS
```

## Сетевая конфигурация кластера

| Параметр | Значение по умолчанию |
| --- | --- |
| Pod CIDR | 10.244.0.0/16 |
| Service CIDR | 10.96.0.0/16 |
| Join CIDR | 100.64.0.0/16 |
| Домен кластера | cozy.local |
| Тип оверлея | GENEVE |
| CNI | Kube-OVN |
| Замена kube-proxy | Cilium eBPF |

### Варианты сетевого стека

Cozystack поддерживает несколько вариантов сетевого стека для разных
типов кластеров. Вариант выбирается через `bundles.system.variant` в
конфигурации платформы.

| Вариант | Компоненты | Целевая платформа |
| --- | --- | --- |
| `kubeovn-cilium` | Kube-OVN + Cilium (по умолчанию) | Talos Linux |
| `kubeovn-cilium-generic` | Kube-OVN + Cilium | kubeadm, k3s, RKE2 |
| `cilium` | Только Cilium | Talos Linux |
| `cilium-generic` | Только Cilium | kubeadm, k3s, RKE2 |
| `cilium-kilo` | Cilium + Kilo | Talos Linux |
| `noop` | Нет (используйте собственный CNI) | Любая |

В вариантах с Kube-OVN Cilium работает как цепочечный CNI (режим `generic-veth`):
Kube-OVN отвечает за сеть подов и IPAM, а Cilium обеспечивает балансировку
нагрузки сервисов, применение сетевых политик и опциональную наблюдаемость через Hubble.

В вариантах только с Cilium он выступает одновременно и как CNI, и как балансировщик
нагрузки сервисов.

{{% alert color="info" %}}
Далее в этом документе описывается вариант по умолчанию `kubeovn-cilium`.
{{% /alert %}}

### Выделение Pod CIDR (Kube-OVN)

Kube-OVN использует модель **общего Pod CIDR**:

- Все поды получают адреса из единого общего пула IP-адресов (10.244.0.0/16)
- IP-адреса выделяются централизованно через IPAM Kube-OVN
- Нет разбиения CIDR по узлам (в отличие от Calico или Flannel)
- Поскольку IP-адреса не привязаны к CIDR-блокам конкретных узлов, поды можно переносить на другие узлы с сохранением адресов
- Взаимодействие подов между узлами использует туннели GENEVE (Join CIDR: 100.64.0.0/16)

## Приём внешнего трафика через MetalLB

MetalLB - реализация балансировщика нагрузки для bare-metal-кластеров Kubernetes. Он назначает внешние IP-адреса сервисам типа `LoadBalancer`, позволяя внешнему трафику достигать кластера.

```mermaid
flowchart TD
    CLIENT["External Client"]
    RTR["Upstream Router"]

    subgraph CLUSTER["Kubernetes Cluster"]
        S1["Node 1<br/>MetalLB Speaker"]
        S2["Node 2<br/>MetalLB Speaker"]
        S3["Node 3<br/>MetalLB Speaker"]
        CIL["Cilium (eBPF)<br/>Service Load Balancing<br/>DNAT to Pod IP"]
        POD["Target Pod<br/>(Pod CIDR)"]
    end

    CLIENT -->|"Traffic to external IP<br/>(e.g. 10.x.x.20)"| RTR
    RTR -->|"L2 (ARP) or BGP"| S1
    RTR -->|"L2 (ARP) or BGP"| S2
    RTR -->|"L2 (ARP) or BGP"| S3
    S1 --> CIL
    S2 --> CIL
    S3 --> CIL
    CIL --> POD
```

### Режим Layer 2 (ARP)

В режиме L2 MetalLB отвечает на ARP-запросы для внешнего IP-адреса сервиса. Один узел становится «лидером» для этого IP и принимает весь трафик.

Как это работает:

1. Спикер MetalLB на одном из узлов забирает внешний IP себе
2. Спикер отвечает на ARP-запросы: «IP X находится по MAC-адресу aa:bb:cc:dd:ee:ff»
3. Весь трафик для этого IP идёт на узел-лидер
4. Cilium на узле выполняет DNAT к нужному поду

```mermaid
sequenceDiagram
    participant C as Client
    participant L as Node (MetalLB Leader)
    participant CIL as Cilium (eBPF)
    participant P as Pod

    C->>L: ARP: Who has 10.x.x.20?
    L-->>C: ARP Reply: 10.x.x.20 is at aa:bb:cc:dd:ee:ff
    C->>L: Send traffic to 10.x.x.20
    L->>CIL: Packet enters kernel
    CIL->>P: DNAT → Pod 10.244.x.x:8080
```

{{% alert color="info" %}}
В режиме L2 трафик для конкретного IP сервиса обрабатывает только один узел. При отказе узла-лидера происходит переключение, но настоящей балансировки нагрузки между узлами для одного сервиса нет.
{{% /alert %}}

### Режим BGP

В режиме BGP MetalLB устанавливает BGP-сессии с вышестоящими маршрутизаторами и анонсирует маршруты /32 для IP-адресов сервисов. Это обеспечивает настоящую балансировку нагрузки ECMP между узлами.

Как это работает:

1. Спикеры MetalLB устанавливают BGP-сессии с вышестоящими маршрутизаторами
2. Каждый спикер анонсирует IP сервиса как маршрут /32
3. У маршрутизатора появляется несколько next-hop для одного префикса
4. ECMP распределяет трафик между узлами
5. Cilium на принимающем узле выполняет DNAT к нужному поду

```mermaid
sequenceDiagram
    participant S1 as Node 1 (Speaker)
    participant S2 as Node 2 (Speaker)
    participant S3 as Node 3 (Speaker)
    participant R as Upstream Router
    participant CIL as Cilium (eBPF)
    participant P as Pod

    S1->>R: BGP UPDATE: 10.x.x.20/32 via Node 1
    S2->>R: BGP UPDATE: 10.x.x.20/32 via Node 2
    S3->>R: BGP UPDATE: 10.x.x.20/32 via Node 3
    Note over R: ECMP: 3 next-hops for 10.x.x.20/32
    R->>S1: Traffic (1/3)
    R->>S2: Traffic (1/3)
    R->>S3: Traffic (1/3)
    S1->>CIL: Packet enters kernel
    CIL->>P: DNAT → Pod
```

### Интеграция VLAN для внешнего трафика

Внешний трафик может доставляться в кластер через дополнительные VLAN (клиентские VLAN, DMZ, публичные сети и т.п.), откуда он направляется к сервисам через MetalLB и Cilium.

```mermaid
flowchart TD
    EXT["External Traffic"]

    subgraph VLANs["Additional VLANs<br/>(Client, DMZ, Public, etc.)"]
        V1["VLAN A"]
        V2["VLAN B"]
    end

    subgraph LB["MetalLB"]
        L2["L2 Mode → Service → Pod"]
        BGP["BGP Mode → Service → Pod"]
    end

    EXT --> VLANs
    V1 --> L2
    V2 --> BGP
```

## Cilium как замена kube-proxy

Cilium заменяет kube-proxy, подключая программы eBPF непосредственно в ядре Linux. Это обеспечивает более эффективную обработку пакетов и расширенные возможности.

### Традиционный kube-proxy (iptables) против Cilium eBPF

```mermaid
flowchart LR
    subgraph IPTABLES["kube-proxy (iptables)"]
        direction LR
        P1["Packet"] --> IPT["iptables<br/>PREROUTING"]
        IPT --> NAT["NAT chains<br/>O(n) rule traversal"]
        NAT --> DNAT1["DNAT to Pod"]
        DNAT1 --> POD1["Pod"]
    end

    subgraph EBPF["Cilium (eBPF)"]
        direction LR
        P2["Packet"] --> BPF["eBPF program<br/>(TC/XDP)"]
        BPF --> MAP["eBPF map lookup<br/>O(1) hash"]
        MAP --> DNAT2["DNAT"]
        DNAT2 --> POD2["Pod"]
    end
```

Ключевые отличия:

| Аспект | kube-proxy (iptables) | Cilium (eBPF) |
| --- | --- | --- |
| Сложность поиска | Обход правил за O(n) | Поиск по хешу за O(1) |
| Контекст выполнения | Накладные расходы в пользовательском пространстве | Нативно в ядре |
| Переключения контекста | Требуются | Отсутствуют |
| Масштабируемость | Деградирует с ростом числа сервисов | Постоянная производительность |

### Архитектура eBPF

```mermaid
flowchart TD
    subgraph KERNEL["Kernel Space"]
        subgraph BPF["eBPF Programs"]
            TC["TC<br/>(ingress/egress)"]
            XDP["XDP<br/>(fastest path)"]
            SOCK["Socket-level<br/>(connect, sendmsg)"]
        end

        subgraph MAPS["eBPF Maps"]
            SVC["Service Tables"]
            EP["Endpoint Maps"]
            POL["Policy Maps"]
        end

        TC --> MAPS
        XDP --> MAPS
        SOCK --> MAPS
    end
```

## Изоляция тенантов с Kube-OVN и Cilium

В мультитенантном кластере Cozystack все тенанты используют общий Pod CIDR. Это безопасно, потому что изоляция обеспечивается политиками Cilium eBPF на уровне ядра, а не сегментацией сети. Тенанты не могут взаимодействовать друг с другом, хотя используют общий пул IP-адресов. Kube-OVN выделяет IP-адреса из этого общего пула централизованно, без разбиения CIDR по узлам.

### Архитектура CNI

```mermaid
flowchart TD
    subgraph KO["Kube-OVN"]
        IPAM["Centralized IPAM — Shared pool 10.244.0.0/16"]
        OVN["OVN/OVS Overlay Network (GENEVE)"]
        SUBNET["Subnet management per namespace/tenant"]
    end

    subgraph CIL["Cilium"]
        POLICY["eBPF Network Policies"]
        SVCBAL["Service Load Balancing (kube-proxy replacement)"]
        IDENT["Identity-based Security"]
        HUB["Observability via Hubble"]
    end

    KO --> CIL
```

Kube-OVN является основным CNI-плагином для сети подов и IPAM. Собственный
механизм сетевых политик Kube-OVN отключён (`ENABLE_NP: false`), и всё
применение политик делегировано Cilium. Cilium работает как цепочечный CNI-компонент
(режим `generic-veth`), который применяет сетевые политики через eBPF и заменяет
kube-proxy для балансировки нагрузки сервисов.

### Модель изоляции тенантов

```mermaid
flowchart TD
    TA["Tenant A — Namespace app-a<br/>Pods: 10.244.0.10, 10.244.0.11"]
    TB["Tenant B — Namespace app-b<br/>Pods: 10.244.1.20, 10.244.1.21"]
    TC["Tenant C — Namespace app-c<br/>Pods: 10.244.2.30, 10.244.2.31"]

    ENGINE{"Cilium eBPF Policy Engine"}

    TA --> ENGINE
    TB --> ENGINE
    TC --> ENGINE

    ENGINE -->|"A ↔ A — ALLOWED"| ALLOW["Same-tenant traffic passes"]
    ENGINE -->|"A ↔ B — DENIED"| DENY["Cross-tenant traffic dropped"]
```

### Безопасность на основе идентичностей

Cilium присваивает каждой конечной точке (поду) **идентичность безопасности** на основе её меток. Политики применяются с использованием этих идентичностей, а не IP-адресов.

```mermaid
flowchart LR
    POD["Pod: frontend-abc123<br/>Labels: app=frontend,<br/>tenant=acme, env=prod"]
    AGENT["Cilium Agent<br/>Hash(labels) → Identity: 12345"]
    BPFMAP["eBPF Map<br/>10.244.0.10 → Identity 12345"]

    POD --> AGENT
    AGENT --> BPFMAP
```

### Применение политик в ядре

Когда пакет передаётся между подами, Cilium применяет политики полностью в пространстве ядра:

```mermaid
flowchart TD
    PKT["Packet: 10.244.0.10 → 10.244.1.20"]
    STEP1["1. Lookup source identity:<br/>10.244.0.10 → ID 12345 (tenant-a)"]
    STEP2["2. Lookup destination identity:<br/>10.244.1.20 → ID 67890 (tenant-b)"]
    STEP3["3. Check policy map:<br/>(12345, 67890, TCP, 80) → DENY"]
    DROP["4. DROP packet"]

    PKT --> STEP1 --> STEP2 --> STEP3 --> DROP
```

Всё это происходит в пространстве ядра примерно за 100 наносекунд.

### Почему применение политик через eBPF безопасно

| Свойство | Описание |
| --- | --- |
| **Верификатор** | Программы eBPF проверяются перед загрузкой - без сбоев и бесконечных циклов |
| **Изоляция** | Программы выполняются в ограниченном контексте ядра |
| **Нет обхода из пользовательского пространства** | Весь сетевой трафик обязан проходить через хуки eBPF |
| **Атомарные обновления** | Изменения политик атомарны - без состояний гонки |
| **Внутри ядра** | Не нужны переключения контекста, быстрее, чем в пользовательском пространстве |

### Применение на уровне ядра

```mermaid
flowchart TD
    subgraph US["User Space"]
        PODA["Pod A<br/>(Tenant A)"]
        PODB["Pod B<br/>(Tenant B)"]
        NOTE["Cannot bypass policy —<br/>traffic MUST go through kernel"]
    end

    subgraph KS["Kernel Space"]
        EBPF["eBPF Programs<br/>• Attached to network interfaces<br/>• Run in privileged kernel context<br/>• Verified by kernel<br/>• Cannot be bypassed by userspace<br/>• Atomic policy updates"]
    end

    US -->|"all traffic"| KS
```

### Запрет по умолчанию и изоляция пространств имён

{{% alert color="warning" %}}
По умолчанию Kubernetes разрешает весь трафик между подами. Cozystack автоматически
применяет ресурсы CiliumNetworkPolicy и CiliumClusterwideNetworkPolicy
при создании тенанта. Эти политики обеспечивают изоляцию на уровне пространств имён и
ограничивают доступ к системным портам (etcd, kubelet, контроллеры).
{{% /alert %}}

Для изоляции Cozystack использует иерархические метки тенантов. Политики сопоставляются
по меткам пространств имён `tenant.cozystack.io/*`, что позволяет родительским тенантам
включать пространства имён дочерних тенантов. Пример:

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-internal-communication
  namespace: tenant-example
spec:
  endpointSelector: {}
  ingress:
    - fromEndpoints:
        - matchLabels:
            k8s:io.cilium.k8s.namespace.labels.tenant.cozystack.io/tenant-example: ""
  egress:
    - toEndpoints:
        - matchLabels:
            k8s:io.cilium.k8s.namespace.labels.tenant.cozystack.io/tenant-example: ""
    - toEntities:
        - kube-apiserver
        - cluster
```

## Наблюдаемость с Hubble

Hubble обеспечивает видимость сетевого трафика для плоскости данных Cilium. Он
входит в сетевой стек Cozystack, но **по умолчанию отключён**, чтобы
минимизировать потребление ресурсов.

Во включённом состоянии Hubble предоставляет:

- Журналы потоков в реальном времени для всего трафика между подами и внешнего трафика
- Видимость DNS-запросов
- Метрики уровня запросов HTTP/gRPC
- Интеграцию с метриками Prometheus
- Веб-интерфейс для визуализации трафика

Чтобы включить Hubble, задайте следующее в конфигурации Cilium:

```yaml
cilium:
  hubble:
    enabled: true
    relay:
      enabled: true
    ui:
      enabled: true
```

Полные сведения о настройке см. в разделе [Enabling Hubble](https://docs.cilium.io/en/stable/observability/hubble/).

## Сводка потоков трафика

### Внешний доступ

```mermaid
flowchart LR
    C["Client"] --> R["Router"]
    R --> M["MetalLB<br/>(L2/BGP)"]
    M --> N["Node"]
    N --> E["Cilium eBPF"]
    E --> P["Pod"]
```

### Изоляция тенантов

```mermaid
flowchart LR
    A["Pod A"] --> CHECK{"eBPF<br/>Policy Check"}
    CHECK -->|"Cross-tenant"| DENY["DENY"]
    CHECK -->|"Same tenant"| ALLOW["ALLOW → Pod A'"]
```
