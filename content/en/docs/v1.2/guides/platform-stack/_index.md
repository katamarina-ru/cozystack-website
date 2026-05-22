---
title: "Архитектура Cozystack и стек платформы"
linkTitle: "Стек платформы"
description: "Узнайте о ключевых компонентах, которые обеспечивают функциональность и гибкость Cozystack"
weight: 15
---

Эта статья объясняет состав Cozystack через четыре слоя и показывает роль и ценность каждого компонента в platform stack.

## Обзор

Чтобы понять состав Cozystack, удобно рассматривать его как набор подсистем, расположенных слоями от hardware до пользовательских сервисов:

![Cozystack Architecture Layers](cozystack-layers.png)

## Слой 1: ОС и hardware

Это базовый слой, который обеспечивает работу кластера на bare metal.
Он состоит из Talos Linux и Kubernetes-кластера, установленного на Talos.

### Talos Linux

Talos Linux — Linux-дистрибутив, созданный и оптимизированный для одной цели: запускать Kubernetes.
Он обеспечивает основу надежности и безопасности в кластере Cozystack.
Его использование позволяет Cozystack ограничить technology stack, повышая стабильность и безопасность.

Подробнее см. в разделе [Talos Linux]({{% ref "/docs/v1.2/guides/talos" %}}).

### Kubernetes

Kubernetes уже стал своего рода de facto standard для управления server workloads.

Одна из ключевых особенностей Kubernetes — удобный и единый API, понятный всем (все описывается YAML).
Кроме того, Kubernetes использует лучшие software design patterns, обеспечивающие постоянное восстановление в любых ситуациях (reconciliation method) и эффективное масштабирование на большое количество серверов.

Это полностью решает проблему интеграции, так как существующие virtualization platforms обычно имеют устаревшие и довольно сложные APIs, которые нельзя расширять без изменения исходного кода.
В результате часто приходится создавать собственные custom solutions, что требует дополнительных усилий.

## Слой 2: Infrastructure Services

Второй слой содержит ключевые компоненты, отвечающие за storage, networking и virtualization.
Добавление этих компонентов к базовому Kubernetes-кластеру делает его значительно функциональнее.

### Flux CD

FluxCD предоставляет простой и единообразный интерфейс как для установки всех компонентов платформы, так и для управления их lifecycle.
Разработчики Cozystack выбрали FluxCD как core element платформы, считая его новым industry standard для platform engineering.

### KubeVirt

KubeVirt добавляет в Cozystack возможности virtualization.
Он позволяет создавать virtual machines и worker nodes для tenant Kubernetes clusters.

KubeVirt — проект, начатый глобальными industry leaders с общим видением объединить Kubernetes и мир virtualization.
Он расширяет возможности Kubernetes, предоставляя удобные abstractions для запуска и управления virtual machines,
а также связанными сущностями: snapshots, presets, virtual volumes и другими.

Сейчас проект KubeVirt совместно развивают такие известные компании, как RedHat, NVIDIA и ARM.

### DRBD и LINSTOR

DRBD и LINSTOR — основа replicated storage в Cozystack.

DRBD — самый быстрый replication block storage, работающий прямо в Linux kernel.
DRBD отвечает только за репликацию данных, а для надежного хранения используются проверенные временем технологии, такие как LVM или ZFS.
Kernel module DRBD включен в mainline Linux kernel и более десяти лет применяется для построения fault-tolerant systems.

DRBD управляется через LINSTOR — систему, интегрированную с Kubernetes.
LINSTOR является management layer для создания virtual volumes на базе DRBD.
Он позволяет управлять сотнями или тысячами virtual volumes в кластере Cozystack.

### Kube-OVN

Сетевая функциональность Cozystack основана на Kube-OVN и Cilium.

OVN — свободная реализация virtual network fabric для Kubernetes и OpenStack на базе технологии Open vSwitch.
С Kube-OVN вы получаете надежную и функциональную virtual network, которая обеспечивает изоляцию между tenants и предоставляет floating addresses для virtual machines.

В будущем это позволит бесшовно интегрироваться с другими clusters и customer network services.

### Cilium

Использование Cilium вместе с OVN обеспечивает максимально эффективные и гибкие network policies,
а также производительную services network в Kubernetes за счет offloaded Linux network stack на базе современной технологии eBPF.

Cilium — очень перспективный проект, широко используемый и поддерживаемый множеством cloud providers по всему миру.

## Слой 3: Platform Services

Это компоненты, которые предоставляют пользовательскую функциональность Cozystack и его managed applications.

### OpenAPI UI

OpenAPI UI предоставляет основной web interface для развертывания и управления приложениями в Cozystack.
Он служит главным dashboard, через который пользователи взаимодействуют с Cozystack API в удобном интерфейсе.

Интерфейс построен поверх OpenAPI specifications Cozystack и автоматически генерирует forms и документацию
для всех доступных managed applications. Пользователи могут разворачивать databases, Kubernetes clusters, virtual machines и другие services
прямо через dashboard без необходимости вручную писать YAML manifests.

Dashboard также интегрируется с OIDC authentication через Keycloak, обеспечивая безопасный single sign-on доступ к платформе.

### Kamaji

Cozystack использует Kamaji Control Plane для развертывания tenant Kubernetes clusters.
Kamaji предоставляет простой и удобный способ запускать все необходимые Kubernetes control-plane components в containers.
Worker nodes затем подключаются к этим control planes и выполняют пользовательские workloads.

Подход, разработанный проектом Kamaji, повторяет дизайн современных clouds и обеспечивает security by design:
у конечных пользователей нет control plane nodes для их clusters.

### Grafana

Grafana вместе с Grafana Loki и расширением OnCall предоставляет единый интерфейс для Observability.
Он позволяет удобно просматривать charts, logs и управлять alerts для инфраструктуры и приложений.

### Victoria Metrics

Victoria Metrics позволяет максимально эффективно собирать, хранить и обрабатывать metrics в формате Open Metrics,
делая это эффективнее Prometheus в той же конфигурации.

### MetalLB

MetalLB — load balancer по умолчанию для Kubernetes.
С его помощью ваши services могут получать public addresses, доступные не только изнутри,
но и снаружи сети вашего кластера.

### HAProxy

HAProxy — продвинутый и широко известный TCP balancer.
Он непрерывно проверяет доступность services и аккуратно балансирует production traffic между ними в real time.

См. справочник приложения: [TCP Balancer]({{% ref "/docs/v1.2/networking/tcp-balancer" %}})

### SeaweedFS

SeaweedFS — простая и хорошо масштабируемая distributed file system, созданная для двух основных целей:
хранить миллиарды файлов и отдавать их быстрее. Она обеспечивает доступ O(1), обычно за одну операцию чтения с диска.

### Kubernetes Operators

Cozystack включает набор Kubernetes operators, используемых для управления system services и managed applications.

## Слой 4: Пользовательские сервисы

Cozystack поставляется с набором пользовательских приложений, заранее настроенных на надежность и resource efficiency,
с включенными monitoring и observability:

-   [Tenant Kubernetes clusters]({{% ref "/docs/v1.2/kubernetes" %}}) — полнофункциональные managed Kubernetes clusters для development и production workloads.
-   [Managed applications]({{% ref "/docs/v1.2/applications" %}}), например databases и queues.
-   [Virtual machines]({{% ref "/docs/v1.2/virtualization" %}}) с поддержкой Linux и Windows OS.
-   [Networking appliances]({{% ref "/docs/v1.2/networking" %}}), включая VPN, HTTP cache, TCP load balancer и virtual routers.

### Managed Kubernetes

Cozystack разворачивает и управляет tenant Kubernetes clusters как самостоятельными приложениями внутри изолированной среды каждого tenant.
Эти clusters полностью отделены от root management cluster и предназначены для развертывания tenant-specific или customer-developed applications.

Развертывание включает следующие компоненты:

-   **Kamaji Control Plane**: [Kamaji](https://kamaji.clastix.io/) — open-source проект, который упрощает развертывание
    Kubernetes control planes как pods внутри root cluster.
    Каждый control plane pod включает основные компоненты: `kube-apiserver`, `controller-manager` и `scheduler`,
    что обеспечивает эффективную multi-tenancy и использование ресурсов.

-   **Etcd Cluster**: dedicated etcd cluster разворачивается с помощью [aenix-io/etcd-operator](https://github.com/aenix-io/etcd-operator) от Ænix.
    Он предоставляет надежное и масштабируемое key-value storage для Kubernetes control plane.

-   **Worker Nodes**: virtual machines создаются как worker nodes.
    Эти узлы настраиваются для подключения к tenant Kubernetes cluster, позволяя разворачивать и управлять workloads.

Такая архитектура обеспечивает изолированные, масштабируемые и эффективные Kubernetes environments для каждого tenant.

<<<<<<< HEAD
-   Поддерживаемая версия: Kubernetes v1.32.4
-   Operator: [aenix-io/etcd-operator](https://github.com/aenix-io/etcd-operator) v0.4.2
-   Справочник managed application: [Kubernetes]({{% ref "/docs/v1.2/kubernetes" %}})
=======
-   Supported version: Kubernetes v1.32.4
-   Kubernetes operator: [aenix-io/etcd-operator](https://github.com/aenix-io/etcd-operator) v0.4.3
-   Managed application reference: [Kubernetes]({{% ref "/docs/v1.2/kubernetes" %}})

>>>>>>> pr/8

### Virtual Machines

В Cozystack virtualization features работают на базе [KubeVirt]({{% ref "/docs/v1.2/guides/platform-stack#kubevirt" %}}).
Cozystack предоставляет несколько applications для virtualization functionality:

-   [Virtual machine instance]({{% ref "/docs/v1.2/virtualization/vm-instance" %}}) с более расширенной конфигурацией.
-   [Virtual machine disk]({{% ref "/docs/v1.2/virtualization/vm-disk" %}}) с выбором image sources.
-   [VM image (Golden Disk)]({{% ref "/docs/v1.2/virtualization/vm-image" %}}), который делает OS images локально доступными, ускоряя создание ВМ и экономя network traffic.

### ClickHouse

ClickHouse — open source высокопроизводительная column-oriented SQL database management system (DBMS).
Он используется для online analytical processing (OLAP).
В платформе Cozystack для предоставления ClickHouse используется Altinity operator.

-   Поддерживаемая версия: 24.9.2.42
-   Kubernetes operator: [Altinity/clickhouse-operator](https://github.com/Altinity/clickhouse-operator) v0.25.0
-   Website: [clickhouse.com](https://clickhouse.com/)
-   Справочник managed application: [ClickHouse]({{% ref "/docs/v1.2/applications/clickhouse" %}})

### Kafka

Apache Kafka — open-source distributed event streaming platform.
Она предоставляет unified, high-throughput, low-latency platform для обработки real-time data feeds.
Cozystack использует [Strimzi](https://github.com/cozystack/cozystack/blob/main/packages/system/kafka-operator/charts/strimzi-kafka-operator/README.md)
для запуска Apache Kafka cluster в Kubernetes в разных deployment configurations.

-   Поддерживаемая версия: Apache Kafka 3.9.0
-   Kubernetes operator: [strimzi/strimzi-kafka-operator](https://github.com/strimzi/strimzi-kafka-operator) v0.45.0
-   Website: [kafka.apache.org](https://kafka.apache.org/)
-   Справочник managed application: [Kafka]({{% ref "/docs/v1.2/applications/kafka" %}})

### MariaDB (MySQL fork)

MySQL — широко используемая и хорошо известная relational database.
Реализация в платформе позволяет создавать replicated MariaDB cluster.
Этим cluster управляет набирающий популярность mariadb-operator.

Для каждой database доступен интерфейс настройки users, их permissions,
а также schedules для создания backups с помощью [Restic](https://restic.net/) — одного из наиболее эффективных доступных инструментов.

-   Поддерживаемая версия: MariaDB 11.4.3
-   Kubernetes operator: [mariadb-operator/mariadb-operator](https://github.com/mariadb-operator/mariadb-operator) v0.18.0
-   Website: [mariadb.com](https://mariadb.com/)
-   Справочник managed application: [MySQL]({{% ref "/docs/v1.2/applications/mariadb" %}})

### NATS Messaging

NATS — open-source, простая, безопасная и высокопроизводительная messaging system.
Она предоставляет data layer для cloud native applications, IoT messaging и microservices architectures.

-   Поддерживаемая версия: NATS 2.10.17
-   Website: [nats.io](https://nats.io/)
-   Справочник managed application: [NATS]({{% ref "/docs/v1.2/applications/nats" %}})

### PostgreSQL

Сегодня PostgreSQL — самая популярная relational database.
Ее platform-side реализация включает self-healing replicated cluster.
Управление выполняется с помощью популярного в сообществе CloudNativePG operator.

-   Поддерживаемая версия: PostgreSQL 17
-   Kubernetes operator: [cloudnative-pg/cloudnative-pg](https://github.com/cloudnative-pg/cloudnative-pg) v1.24.0
-   Website: [cloudnative-pg.io](https://cloudnative-pg.io/)
-   Справочник managed application: [PostgreSQL]({{% ref "/docs/v1.2/applications/postgres" %}})

### RabbitMQ

RabbitMQ — широко известный message broker.
Platform-side реализация позволяет создавать failover clusters под управлением официального RabbitMQ operator.

-   Поддерживаемая версия: RabbitMQ 4.1.0+ (latest stable version)
-   Kubernetes operator: [rabbitmq/cluster-operator](https://github.com/rabbitmq/cluster-operator) v1.10.0
-   Website: [rabbitmq.com](https://www.rabbitmq.com/)
-   Справочник managed application: [RabbitMQ]({{% ref "/docs/v1.2/applications/rabbitmq" %}})

### Redis

Redis — наиболее часто используемое key-value in-memory data store.
Чаще всего он применяется как cache, storage для user sessions или message broker.
Platform-side реализация включает replicated failover Redis cluster с Sentinel.
Им управляет spotahome/redis-operator.

-   Поддерживаемая версия: Redis 6.2.6+ (based on `alpine`)
-   Kubernetes operator: [spotahome/redis-operator](https://github.com/spotahome/redis-operator) v1.3.0-rc1
-   Website: [redis.io](https://redis.io/)
-   Справочник managed application: [Redis]({{% ref "/docs/v1.2/applications/redis" %}})

### VPN Service

VPN Service работает на базе Outline Server — продвинутого и удобного VPN solution.
Внутри он известен как "Shadowbox", что упрощает настройку и предоставление Shadowsocks servers.
Он запускает Shadowsocks instances по запросу.

Протокол Shadowsocks использует symmetric encryption algorithms.
Это обеспечивает быстрый доступ в интернет и затрудняет анализ и блокировку трафика через DPI (Deep Packet Inspection).

-   Поддерживаемая версия: Outline Server, v1.12.3+ (stable)
-   Website: [getoutline.org](https://getoutline.org/)
-   Справочник managed application: [VPN]({{% ref "/docs/v1.2/networking/vpn" %}})

### HTTP Cache

HTTP caching service на базе Nginx помогает защитить приложение от перегрузки с помощью мощного Nginx.
Nginx традиционно используется для построения CDNs и caching servers.

Platform-side реализация обеспечивает эффективное caching без использования clustered file system.
Она также поддерживает horizontal scaling без дублирования данных на нескольких servers.

-   Включенные версии: Nginx 1.25.3, HAProxy latest stable.
-   Website: [nginx.org](https://nginx.org/)
-   Справочник managed application: [HTTP Cache]({{% ref "/docs/v1.2/networking/http-cache" %}})

### TCP Balancer

Managed TCP Load Balancer service обеспечивает развертывание и управление load balancers.
Он эффективно распределяет входящий TCP traffic между несколькими backend servers, обеспечивая high availability и optimal resource utilization.

TCP Load Balancer service работает на базе [HAProxy](https://www.haproxy.org/) — зрелого и надежного TCP load balancer.

-   Справочник managed application: [TCP balancer]({{% ref "/docs/v1.2/networking/tcp-balancer" %}})
-   Docs: [HAProxy Documentation](https://www.haproxy.com/documentation/)

### Tenants

Tenants в Cozystack реализованы как managed applications.
Подробнее о tenants см. в разделе [Tenant System]({{% ref "/docs/v1.2/guides/tenants" %}}).
