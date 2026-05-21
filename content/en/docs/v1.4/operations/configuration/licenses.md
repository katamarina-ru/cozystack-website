---
title: "Лицензии"
linkTitle: "Лицензии"
description: "Лицензии open-source компонентов, поставляемых с Cozystack."
weight: 35
---

На этой странице перечислены open-source компоненты, поставляемые с Cozystack, сгруппированные по роли в платформе.
Charts, CRDs, controllers и application APIs, поддерживаемые Cozystack, лицензированы под **Apache-2.0** и не перечисляются ниже по отдельности.
Для каждого upstream-компонента карточка содержит ссылку на upstream-файл лицензии.

{{% alert color="info" %}}
Этот справочник вручную сверяется с текущим набором компонентов `next`.
Container images могут включать дополнительные пакеты операционной системы и библиотечные зависимости со своими лицензиями.
Зафиксированные upstream-версии managed runtimes (PostgreSQL, MariaDB, Kafka и другие) могут меняться между minor-релизами Cozystack: проверяйте версию Cozystack, которую вы используете.
{{% /alert %}}

## Операционная система и Kubernetes runtime

{{< oss-cards >}}
{{< oss-card name="Talos Linux" logo="talos" license="MPL-2.0" source="https://github.com/siderolabs/talos/blob/main/LICENSE" description="Immutable Linux-дистрибутив, созданный для узлов Kubernetes." >}}
{{< oss-card name="Kubernetes" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes/kubernetes/blob/master/LICENSE" description="Ядро оркестрации контейнеров, используемое и для management-кластера, и для tenant-кластеров." >}}
{{< oss-card name="Kamaji" logo="kamaji" license="Apache-2.0" source="https://github.com/clastix/kamaji/blob/master/LICENSE" description="Hosted control planes для tenant Kubernetes-кластеров." >}}
{{< oss-card name="Cluster API" logo="clusterapi" license="Apache-2.0" source="https://github.com/kubernetes-sigs/cluster-api/blob/main/LICENSE" description="Декларативное создание tenant Kubernetes-кластеров: core, operator и Kamaji/KubeVirt providers." >}}
{{< oss-card name="KubeVirt" logo="kubevirt" license="Apache-2.0" source="https://github.com/kubevirt/kubevirt/blob/main/LICENSE" description="Виртуальные машины как Kubernetes-native workloads: core, CDI, CSI и instancetypes." >}}
{{< /oss-cards >}}

## Networking

{{< oss-cards >}}
{{< oss-card name="Cilium" logo="cilium" license="Apache-2.0" source="https://github.com/cilium/cilium/blob/main/LICENSE" description="CNI на базе eBPF для pod networking и NetworkPolicy." >}}
{{< oss-card name="Kube-OVN" logo="kubeovn" license="Apache-2.0" source="https://github.com/cozystack/kubeovn-chart/blob/main/LICENSE" description="Виртуальная сеть на базе OVN, используемая для VPC и floating IP." >}}
{{< oss-card name="Multus CNI" logo="multus" license="Apache-2.0" source="https://github.com/k8snetworkplumbingwg/multus-cni/blob/master/LICENSE" description="Несколько сетевых интерфейсов на pod." >}}
{{< oss-card name="MetalLB" logo="metallb" license="Apache-2.0" source="https://github.com/metallb/metallb/blob/main/LICENSE" description="Bare-metal load balancer для Kubernetes Services." >}}
{{< oss-card name="ingress-nginx" logo="nginx" license="Apache-2.0" source="https://github.com/kubernetes/ingress-nginx/blob/main/LICENSE" description="HTTP ingress controller." >}}
{{< oss-card name="Gateway API CRDs" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes-sigs/gateway-api/blob/main/LICENSE" description="Стандартные определения Kubernetes Gateway API." >}}
{{< oss-card name="CoreDNS" logo="coredns" license="Apache-2.0" source="https://github.com/coredns/coredns/blob/master/LICENSE" description="Cluster DNS server." >}}
{{< oss-card name="ExternalDNS" logo="externaldns" license="Apache-2.0" source="https://github.com/kubernetes-sigs/external-dns/blob/master/LICENSE.md" description="Синхронизация Kubernetes-ресурсов с внешними DNS providers." >}}
{{< oss-card name="Kilo" logo="kilo" license="Apache-2.0" source="https://github.com/squat/kilo/blob/main/LICENSE" description="Mesh-сеть между географически распределенными узлами." >}}
{{< oss-card name="Hetzner RobotLB" logo="hetzner" license="MIT" source="https://github.com/Intreecom/robotlb/blob/master/LICENSE" description="Интеграция load balancer для dedicated hardware Hetzner." >}}
{{< /oss-cards >}}

## Хранилище

{{< oss-cards >}}
{{< oss-card name="LINSTOR / Piraeus" logo="linstor" license="GPL-3.0; Apache-2.0" source="https://github.com/piraeusdatastore/piraeus-operator/blob/v2/LICENSE" description="Реплицированное блочное хранилище на базе DRBD: LINSTOR server, CSI, scheduler extender, GUI, Piraeus operator." >}}
{{< oss-card name="SeaweedFS" logo="seaweedfs" license="Apache-2.0" source="https://github.com/seaweedfs/seaweedfs/blob/master/LICENSE" description="Распределенное object storage, лежащее в основе managed Bucket service." >}}
{{< oss-card name="CSI Driver NFS" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes-csi/csi-driver-nfs/blob/master/LICENSE" description="NFS CSI driver." >}}
{{< oss-card name="CSI Snapshot Controller" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes-csi/external-snapshotter/blob/master/LICENSE" description="External snapshotter и VolumeSnapshot CRDs." >}}
{{< oss-card name="Velero" logo="velero" license="Apache-2.0" source="https://github.com/velero-io/velero/blob/main/LICENSE" description="Резервное копирование кластера и persistent volumes." >}}
{{< oss-card name="Container Object Storage Interface" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes-sigs/container-object-storage-interface/blob/main/LICENSE" description="COSI controller для managed object storage." >}}
{{< oss-card name="S3 Manager" license="Apache-2.0" source="https://github.com/cloudlena/s3manager/blob/main/LICENSE" description="Web UI для S3-compatible buckets." >}}
{{< /oss-cards >}}

## Наблюдаемость

{{< oss-cards >}}
{{< oss-card name="VictoriaMetrics Operator" logo="victoriametrics" license="Apache-2.0" source="https://github.com/VictoriaMetrics/operator/blob/master/LICENSE" description="Хранение, прием и Prometheus-compatible query layer для метрик." >}}
{{< oss-card name="Grafana Operator" logo="grafana" license="Apache-2.0" source="https://github.com/grafana/grafana-operator/blob/master/LICENSE" description="Управляет экземплярами Grafana, dashboards и datasources." >}}
{{< oss-card name="Fluent Bit" logo="fluent-bit" license="Apache-2.0" source="https://github.com/fluent/fluent-bit/blob/master/LICENSE" description="Log forwarder, работающий на каждом узле." >}}
{{< oss-card name="kube-state-metrics" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes/kube-state-metrics/blob/main/LICENSE" description="Экспортирует состояние объектов Kubernetes как метрики." >}}
{{< oss-card name="node-exporter" logo="prometheus" license="Apache-2.0" source="https://github.com/prometheus/node_exporter/blob/master/LICENSE" description="Системные и аппаратные метрики с каждого узла." >}}
{{< oss-card name="Prometheus Operator CRDs" logo="prometheus" license="Apache-2.0" source="https://github.com/prometheus-community/helm-charts/blob/main/LICENSE" description="CRDs для Prometheus-style monitoring resources, используемые VictoriaMetrics." >}}
{{< oss-card name="Metrics Server" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes-sigs/metrics-server/blob/master/LICENSE" description="Метрики Kubelet для HPA и `kubectl top`." >}}
{{< oss-card name="Goldpinger" logo="goldpinger" license="Apache-2.0" source="https://github.com/bloomberg/goldpinger/blob/master/LICENSE" description="Проверки pod-to-pod connectivity в кластере." >}}
{{< /oss-cards >}}

## Autoscaling и управление ресурсами

{{< oss-cards >}}
{{< oss-card name="Vertical Pod Autoscaler" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes/autoscaler/blob/master/LICENSE" description="Вертикальный подбор ресурсов для pods (chart: MIT)." >}}
{{< oss-card name="Cluster Autoscaler" logo="kubernetes" license="Apache-2.0" source="https://github.com/kubernetes/autoscaler/blob/master/LICENSE" description="Горизонтальное масштабирование node pools." >}}
{{< oss-card name="Stakater Reloader" logo="reloader" license="Apache-2.0" source="https://github.com/stakater/Reloader/blob/master/LICENSE" description="Перезапускает pods при изменении их ConfigMaps или Secrets." >}}
{{< /oss-cards >}}

## GPU и ускорители

{{< oss-cards >}}
{{< oss-card name="NVIDIA GPU Operator" logo="nvidia" license="Apache-2.0" source="https://github.com/NVIDIA/gpu-operator/blob/main/LICENSE" description="Lifecycle драйвера, container runtime и device-plugin для NVIDIA GPUs." >}}
{{< oss-card name="HAMi" logo="hami" license="Apache-2.0" source="https://github.com/Project-HAMi/HAMi/blob/master/LICENSE" description="GPU sharing и fractional GPU scheduling." >}}
{{< /oss-cards >}}

## GitOps и автоматизация платформы

{{< oss-cards >}}
{{< oss-card name="Flux" logo="fluxcd" license="Apache-2.0; AGPL-3.0" source="https://github.com/fluxcd/flux2/blob/main/LICENSE" description="GitOps engine. ControlPlane Flux Operator и instance chart лицензированы под AGPL-3.0; upstream Flux controllers - под Apache-2.0." >}}
{{< oss-card name="Aenix etcd Operator" logo="etcd" license="Apache-2.0" source="https://github.com/aenix-io/etcd-operator/blob/main/LICENSE" description="Управляет etcd-кластерами, используемыми tenant Kamaji control planes." >}}
{{< oss-card name="cert-manager" logo="cert-manager" license="Apache-2.0" source="https://github.com/cert-manager/cert-manager/blob/master/LICENSE" description="Автоматический выпуск и ротация TLS-сертификатов." >}}
{{< oss-card name="External Secrets Operator" logo="external-secrets" license="Apache-2.0" source="https://github.com/external-secrets/external-secrets/blob/main/LICENSE" description="Синхронизирует secrets из внешнего KMS в Kubernetes." >}}
{{< oss-card name="SAP ClusterSecret Operator" logo="sap" license="Apache-2.0" source="https://github.com/SAP/clustersecret-operator/blob/main/LICENSE" description="Реплицирует secrets между namespaces." >}}
{{< oss-card name="Tinkerbell Smee" logo="tinkerbell" license="Apache-2.0" source="https://github.com/tinkerbell/smee/blob/main/LICENSE" description="iPXE / DHCP boot server для bare-metal provisioning." >}}
{{< oss-card name="Telepresence" logo="telepresence" license="Apache-2.0" source="https://github.com/telepresenceio/telepresence/blob/release/v2/LICENSE" description="Локальная разработка против удаленного кластера (Traffic Manager)." >}}
{{< /oss-cards >}}

## Identity, registry и admin UI

{{< oss-cards >}}
{{< oss-card name="Keycloak" logo="keycloak" license="Apache-2.0" source="https://github.com/keycloak/keycloak/blob/main/LICENSE.txt" description="OIDC provider для platform и tenant SSO; разворачивается через KubeRocketCI Keycloak Operator." >}}
{{< oss-card name="Harbor" logo="harbor" license="Apache-2.0" source="https://github.com/goharbor/harbor/blob/main/LICENSE" description="OCI registry для container images и Helm charts." >}}
{{< /oss-cards >}}

## Managed database runtimes

{{< oss-cards >}}
{{< oss-card name="PostgreSQL" logo="postgresql" license="PostgreSQL License" source="https://www.postgresql.org/about/licence/" description="Управляется через CloudNativePG operator (Apache-2.0)." >}}
{{< oss-card name="MariaDB Server" logo="mariadb" license="GPL-2.0" source="https://github.com/MariaDB/server/blob/main/COPYING" description="Управляется через mariadb-operator (MIT)." >}}
{{< oss-card name="MongoDB (Percona Server)" logo="mongodb" license="SSPL-1.0" source="https://github.com/percona/percona-server-mongodb/blob/master/LICENSE-Community.txt" description="Управляется через Percona Operator for MongoDB (Apache-2.0)." >}}
{{< oss-card name="ClickHouse" logo="clickhouse" license="Apache-2.0" source="https://github.com/ClickHouse/ClickHouse/blob/master/LICENSE" description="Server и Keeper, управляются через Altinity ClickHouse Operator (Apache-2.0)." >}}
{{< oss-card name="OpenSearch" logo="opensearch" license="Apache-2.0" source="https://github.com/opensearch-project/OpenSearch/blob/main/LICENSE.txt" description="Управляется через opensearch-k8s-operator (Apache-2.0)." >}}
{{< oss-card name="Qdrant" logo="qdrant" license="Apache-2.0" source="https://github.com/qdrant/qdrant/blob/master/LICENSE" description="Vector database, разворачивается через upstream Qdrant Helm chart." >}}
{{< oss-card name="FoundationDB" logo="foundationdb" license="Apache-2.0" source="https://github.com/apple/foundationdb/blob/main/LICENSE" description="Управляется через FoundationDB Kubernetes Operator (Apache-2.0)." >}}
{{< oss-card name="Redis" logo="redis" license="RSALv2 or SSPLv1 (7.x) / AGPLv3 (8.x)" source="https://redis.io/legal/licenses/" description="Управляется через Spotahome Redis Operator (Apache-2.0). Cozystack поддерживает Redis 7.4 и Redis 8." >}}
{{< /oss-cards >}}

## Managed messaging и caching runtimes

{{< oss-cards >}}
{{< oss-card name="Apache Kafka" logo="kafka" license="Apache-2.0" source="https://github.com/apache/kafka/blob/trunk/LICENSE" description="Управляется через Strimzi Kafka Operator (Apache-2.0)." >}}
{{< oss-card name="NATS" logo="nats" license="Apache-2.0" source="https://github.com/nats-io/nats-server/blob/main/LICENSE" description="Lightweight messaging server, разворачивается через upstream NATS Helm chart." >}}
{{< oss-card name="RabbitMQ" logo="rabbitmq" license="MPL-2.0; Apache-2.0 for some files" source="https://github.com/rabbitmq/rabbitmq-server/blob/main/LICENSE" description="Управляется через RabbitMQ Cluster Operator (MPL-2.0)." >}}
{{< oss-card name="OpenBao" logo="openbao" license="MPL-2.0" source="https://github.com/openbao/openbao/blob/main/LICENSE" description="Fork HashiCorp Vault для управления secrets, разворачивается через upstream OpenBao Helm chart." >}}
{{< /oss-cards >}}

## Managed networking services

{{< oss-cards >}}
{{< oss-card name="NGINX" logo="nginx" license="BSD-2-Clause" source="https://github.com/nginx/nginx/blob/master/LICENSE" description="Используется managed HTTP Cache service." >}}
{{< oss-card name="HAProxy" logo="haproxy" license="GPL-2.0 with exceptions" source="https://github.com/haproxy/haproxy/blob/master/LICENSE" description="Используется managed TCP Balancer и HTTP Cache services." >}}
{{< oss-card name="IP2Location modules" license="MIT" source="https://github.com/ip2location/ip2location-nginx/blob/master/LICENSE" description="GeoIP modules, включенные в HTTP Cache (IP2Location и IP2Proxy)." >}}
{{< oss-card name="Outline Server (Shadowsocks)" logo="outline" license="Apache-2.0" source="https://github.com/OutlineFoundation/outline-server/blob/master/LICENSE" description="Основа managed VPN service." >}}
{{< /oss-cards >}}
