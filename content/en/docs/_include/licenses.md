This page lists the licenses for the primary components packaged with Cozystack.
Cozystack-maintained charts, CRDs, controllers, and application APIs are licensed under Apache-2.0.
When a package vendors or deploys an upstream component, the table shows the upstream component license.

{{% alert color="info" %}}
This reference covers top-level Cozystack packages from `packages/core`, `packages/system`, `packages/apps`, and `packages/extra`, plus the primary managed workload runtimes.
Container images can include additional operating-system packages and library dependencies with their own licenses.
{{% /alert %}}

## Core Packages

| Package | Component | License | Source |
|---|---|---|---|
| `core/flux-aio` | Cozystack Flux AIO manifests | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/core/flux-aio) |
| `core/installer` | Cozystack installer chart | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/core/installer) |
| `core/platform` | Cozystack Platform Package chart | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/core/platform) |
| `core/talos` | Cozystack Talos assets | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/core/talos) |
| `core/testing` | Cozystack test chart | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/core/testing) |

## System Packages

| Package | Component | License | Source |
|---|---|---|---|
| `system/application-definition-crd` | Cozystack ApplicationDefinition CRD | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/application-definition-crd) |
| `system/backup-controller` | Cozystack backup controller | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/backup-controller) |
| `system/backupstrategy-controller` | Cozystack backup strategy controller | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/backupstrategy-controller) |
| `system/bootbox` | Tinkerbell Smee | Apache-2.0 | [source](https://github.com/tinkerbell/smee/blob/main/LICENSE) |
| `system/bootbox-rd` | Cozystack Bootbox resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/bootbox-rd) |
| `system/bucket` | S3 Manager | Apache-2.0 | [source](https://github.com/cloudlena/s3manager/blob/main/LICENSE) |
| `system/bucket-rd` | Cozystack Bucket resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/bucket-rd) |
| `system/capi-operator` | Cluster API Operator | Apache-2.0 | [source](https://github.com/kubernetes-sigs/cluster-api-operator/blob/main/LICENSE) |
| `system/capi-providers-bootstrap` | Cluster API kubeadm bootstrap provider | Apache-2.0 | [source](https://github.com/kubernetes-sigs/cluster-api/blob/main/LICENSE) |
| `system/capi-providers-core` | Cluster API core provider | Apache-2.0 | [source](https://github.com/kubernetes-sigs/cluster-api/blob/main/LICENSE) |
| `system/capi-providers-cpprovider` | Kamaji Cluster API control-plane provider | Apache-2.0 | [source](https://github.com/clastix/cluster-api-control-plane-provider-kamaji/blob/master/LICENSE) |
| `system/capi-providers-infraprovider` | KubeVirt Cluster API infrastructure provider | Apache-2.0 | [source](https://github.com/kubevirt/cluster-api-provider-kubevirt/blob/main/LICENSE) |
| `system/cert-manager` | cert-manager | Apache-2.0 | [source](https://github.com/cert-manager/cert-manager/blob/master/LICENSE) |
| `system/cert-manager-crds` | cert-manager CRDs | Apache-2.0 | [source](https://github.com/cert-manager/cert-manager/blob/master/LICENSE) |
| `system/cert-manager-issuers` | Cozystack cert-manager issuers | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/cert-manager-issuers) |
| `system/cilium` | Cilium | Apache-2.0 | [source](https://github.com/cilium/cilium/blob/main/LICENSE) |
| `system/cilium-networkpolicy` | Cozystack Cilium network policies | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/cilium-networkpolicy) |
| `system/clickhouse-operator` | Altinity ClickHouse Operator | Apache-2.0 | [source](https://github.com/Altinity/clickhouse-operator/blob/master/LICENSE) |
| `system/clickhouse-rd` | Cozystack ClickHouse resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/clickhouse-rd) |
| `system/cluster-autoscaler` | Kubernetes Cluster Autoscaler | Apache-2.0 | [source](https://github.com/kubernetes/autoscaler/blob/master/LICENSE) |
| `system/clustersecret-operator` | SAP ClusterSecret Operator | Apache-2.0 | [source](https://github.com/SAP/clustersecret-operator/blob/main/LICENSE) |
| `system/coredns` | CoreDNS | Apache-2.0 | [source](https://github.com/coredns/coredns/blob/master/LICENSE) |
| `system/cozy-proxy` | cozy-proxy | Apache-2.0 | [source](https://github.com/cozystack/cozy-proxy/blob/main/LICENSE) |
| `system/cozystack-api` | Cozystack API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/cozystack-api) |
| `system/cozystack-basics` | Cozystack basics | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/cozystack-basics) |
| `system/cozystack-controller` | Cozystack controller | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/cozystack-controller) |
| `system/cozystack-scheduler` | Cozystack scheduler | Apache-2.0 | [source](https://github.com/cozystack/cozystack-scheduler/blob/main/LICENSE) |
| `system/dashboard` | Cozystack dashboard | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/dashboard) |
| `system/etcd-operator` | Aenix etcd Operator | Apache-2.0 | [source](https://github.com/aenix-io/etcd-operator/blob/main/LICENSE) |
| `system/etcd-rd` | Cozystack etcd resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/etcd-rd) |
| `system/external-dns` | ExternalDNS | Apache-2.0 | [source](https://github.com/kubernetes-sigs/external-dns/blob/master/LICENSE.md) |
| `system/external-dns-rd` | Cozystack ExternalDNS resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/external-dns-rd) |
| `system/external-secrets-operator` | External Secrets Operator | Apache-2.0 | [source](https://github.com/external-secrets/external-secrets/blob/main/LICENSE) |
| `system/flux-plunger` | Cozystack Flux plunger | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/flux-plunger) |
| `system/fluxcd` | ControlPlane Flux instance chart; Flux controllers | AGPL-3.0; Apache-2.0 | [charts](https://github.com/controlplaneio-fluxcd/charts/blob/main/LICENSE), [flux](https://github.com/fluxcd/flux2/blob/main/LICENSE) |
| `system/fluxcd-operator` | ControlPlane Flux Operator | AGPL-3.0 | [source](https://github.com/controlplaneio-fluxcd/flux-operator/blob/main/LICENSE) |
| `system/foundationdb-operator` | FoundationDB Kubernetes Operator | Apache-2.0 | [source](https://github.com/FoundationDB/fdb-kubernetes-operator/blob/main/LICENSE) |
| `system/foundationdb-rd` | Cozystack FoundationDB resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/foundationdb-rd) |
| `system/gateway-api-crds` | Kubernetes Gateway API CRDs | Apache-2.0 | [source](https://github.com/kubernetes-sigs/gateway-api/blob/main/LICENSE) |
| `system/goldpinger` | Goldpinger | Apache-2.0 | [source](https://github.com/bloomberg/goldpinger/blob/master/LICENSE) |
| `system/gpu-operator` | NVIDIA GPU Operator | Apache-2.0 | [source](https://github.com/NVIDIA/gpu-operator/blob/main/LICENSE) |
| `system/grafana-operator` | Grafana Operator | Apache-2.0 | [source](https://github.com/grafana/grafana-operator/blob/master/LICENSE) |
| `system/hami` | HAMi | Apache-2.0 | [source](https://github.com/Project-HAMi/HAMi/blob/master/LICENSE) |
| `system/harbor` | Harbor Helm chart | Apache-2.0 | [source](https://github.com/goharbor/harbor-helm/blob/main/LICENSE) |
| `system/harbor-rd` | Cozystack Harbor resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/harbor-rd) |
| `system/hetzner-robotlb` | RobotLB | MIT | [source](https://github.com/Intreecom/robotlb/blob/master/LICENSE) |
| `system/http-cache-rd` | Cozystack HTTP cache resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/http-cache-rd) |
| `system/info-rd` | Cozystack Info resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/info-rd) |
| `system/ingress-nginx` | ingress-nginx | Apache-2.0 | [source](https://github.com/kubernetes/ingress-nginx/blob/main/LICENSE) |
| `system/ingress-rd` | Cozystack Ingress resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/ingress-rd) |
| `system/kafka-operator` | Strimzi Kafka Operator | Apache-2.0 | [source](https://github.com/strimzi/strimzi-kafka-operator/blob/main/LICENSE) |
| `system/kafka-rd` | Cozystack Kafka resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/kafka-rd) |
| `system/kamaji` | Kamaji | Apache-2.0 | [source](https://github.com/clastix/kamaji/blob/master/LICENSE) |
| `system/keycloak` | Keycloak | Apache-2.0 | [source](https://github.com/keycloak/keycloak/blob/main/LICENSE.txt) |
| `system/keycloak-configure` | Cozystack Keycloak configuration job | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/keycloak-configure) |
| `system/keycloak-operator` | KubeRocketCI Keycloak Operator | Apache-2.0 | [source](https://github.com/epam/edp-keycloak-operator/blob/master/LICENSE-2.0) |
| `system/kilo` | Kilo | Apache-2.0 | [source](https://github.com/squat/kilo/blob/main/LICENSE) |
| `system/kubeovn` | Kube-OVN chart | Apache-2.0 | [source](https://github.com/cozystack/kubeovn-chart/blob/main/LICENSE) |
| `system/kubeovn-plunger` | Cozystack Kube-OVN plunger | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/kubeovn-plunger) |
| `system/kubeovn-webhook` | Cozystack Kube-OVN webhook | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/kubeovn-webhook) |
| `system/kubernetes-rd` | Cozystack Kubernetes resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/kubernetes-rd) |
| `system/kubevirt` | KubeVirt | Apache-2.0 | [source](https://github.com/kubevirt/kubevirt/blob/main/LICENSE) |
| `system/kubevirt-cdi` | KubeVirt Containerized Data Importer | Apache-2.0 | [source](https://github.com/kubevirt/containerized-data-importer/blob/main/LICENSE) |
| `system/kubevirt-cdi-operator` | KubeVirt CDI Operator | Apache-2.0 | [source](https://github.com/kubevirt/containerized-data-importer/blob/main/LICENSE) |
| `system/kubevirt-csi-node` | KubeVirt CSI driver | Apache-2.0 | [source](https://github.com/kubevirt/csi-driver/blob/main/LICENSE) |
| `system/kubevirt-instancetypes` | KubeVirt common instancetypes | Apache-2.0 | [source](https://github.com/kubevirt/common-instancetypes/blob/main/LICENSE) |
| `system/kubevirt-operator` | KubeVirt Operator | Apache-2.0 | [source](https://github.com/kubevirt/kubevirt/blob/main/LICENSE) |
| `system/lineage-controller-webhook` | Cozystack lineage controller webhook | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/lineage-controller-webhook) |
| `system/linstor` | LINSTOR Server; LINSTOR CSI | GPL-3.0; Apache-2.0 | [server](https://github.com/LINBIT/linstor-server/blob/master/LICENSE), [csi](https://github.com/piraeusdatastore/linstor-csi/blob/master/LICENSE) |
| `system/linstor-gui` | LINSTOR GUI | GPL-3.0 | [source](https://github.com/LINBIT/linstor-gui) |
| `system/linstor-scheduler` | LINSTOR scheduler extender | Apache-2.0 | [source](https://github.com/piraeusdatastore/linstor-scheduler-extender/blob/master/LICENSE) |
| `system/local-ccm` | Local Cloud Controller Manager | Apache-2.0 | [source](https://github.com/cozystack/local-ccm/blob/main/LICENSE) |
| `system/mariadb-operator` | mariadb-operator | MIT | [source](https://github.com/mariadb-operator/mariadb-operator/blob/main/LICENSE) |
| `system/mariadb-rd` | Cozystack MariaDB resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/mariadb-rd) |
| `system/metallb` | MetalLB | Apache-2.0 | [source](https://github.com/metallb/metallb/blob/main/LICENSE) |
| `system/metrics-server` | Metrics Server | Apache-2.0 | [source](https://github.com/kubernetes-sigs/metrics-server/blob/master/LICENSE) |
| `system/mongodb-operator` | Percona Operator for MongoDB Helm chart | Apache-2.0 | [source](https://github.com/percona/percona-server-mongodb-operator/blob/main/LICENSE) |
| `system/mongodb-rd` | Cozystack MongoDB resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/mongodb-rd) |
| `system/monitoring` | Cozystack monitoring package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/monitoring) |
| `system/monitoring-agents` | Fluent Bit; kube-state-metrics; node-exporter | Apache-2.0 | [source](https://github.com/fluent/fluent-bit/blob/master/LICENSE) |
| `system/monitoring-rd` | Cozystack Monitoring resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/monitoring-rd) |
| `system/multus` | Multus CNI | Apache-2.0 | [source](https://github.com/k8snetworkplumbingwg/multus-cni/blob/master/LICENSE) |
| `system/nats` | NATS Helm chart | Apache-2.0 | [source](https://github.com/nats-io/k8s/blob/main/LICENSE) |
| `system/nats-rd` | Cozystack NATS resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/nats-rd) |
| `system/nfs-driver` | CSI Driver NFS | Apache-2.0 | [source](https://github.com/kubernetes-csi/csi-driver-nfs/blob/master/LICENSE) |
| `system/objectstorage-controller` | Container Object Storage Interface controller | Apache-2.0 | [source](https://github.com/kubernetes-sigs/container-object-storage-interface/blob/main/LICENSE) |
| `system/openbao` | OpenBao Helm chart | MPL-2.0 | [source](https://github.com/openbao/openbao-helm/blob/main/LICENSE) |
| `system/openbao-rd` | Cozystack OpenBao resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/openbao-rd) |
| `system/opencost` | OpenCost Helm chart | Apache-2.0 | [source](https://github.com/opencost/opencost-helm-chart/blob/main/LICENSE) |
| `system/opensearch-operator` | OpenSearch Operator | Apache-2.0 | [source](https://github.com/opensearch-project/opensearch-k8s-operator/blob/main/LICENSE) |
| `system/opensearch-rd` | Cozystack OpenSearch resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/opensearch-rd) |
| `system/piraeus-operator` | Piraeus Operator | Apache-2.0 | [source](https://github.com/piraeusdatastore/piraeus-operator/blob/v2/LICENSE) |
| `system/piraeus-operator-crds` | Piraeus Operator CRDs | Apache-2.0 | [source](https://github.com/piraeusdatastore/piraeus-operator/blob/v2/LICENSE) |
| `system/postgres-operator` | CloudNativePG operator chart | Apache-2.0 | [source](https://github.com/cloudnative-pg/charts/blob/main/LICENSE) |
| `system/postgres-rd` | Cozystack PostgreSQL resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/postgres-rd) |
| `system/prometheus-operator-crds` | Prometheus Operator CRDs chart | Apache-2.0 | [source](https://github.com/prometheus-community/helm-charts/blob/main/LICENSE) |
| `system/qdrant` | Qdrant Helm chart | Apache-2.0 | [source](https://github.com/qdrant/qdrant-helm/blob/main/LICENSE) |
| `system/qdrant-rd` | Cozystack Qdrant resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/qdrant-rd) |
| `system/rabbitmq-operator` | RabbitMQ cluster and topology operators | MPL-2.0 | [source](https://github.com/rabbitmq/cluster-operator/blob/main/LICENSE.txt) |
| `system/rabbitmq-rd` | Cozystack RabbitMQ resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/rabbitmq-rd) |
| `system/redis-operator` | Spotahome Redis Operator | Apache-2.0 | [source](https://github.com/spotahome/redis-operator/blob/master/LICENSE) |
| `system/redis-rd` | Cozystack Redis resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/redis-rd) |
| `system/reloader` | Stakater Reloader | Apache-2.0 | [source](https://github.com/stakater/Reloader/blob/master/LICENSE) |
| `system/seaweedfs` | SeaweedFS Helm chart | Apache-2.0 | [source](https://github.com/seaweedfs/seaweedfs/blob/master/LICENSE) |
| `system/seaweedfs-rd` | Cozystack SeaweedFS resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/seaweedfs-rd) |
| `system/snapshot-controller` | CSI external snapshotter | Apache-2.0 | [source](https://github.com/kubernetes-csi/external-snapshotter/blob/master/LICENSE) |
| `system/tcp-balancer-rd` | Cozystack TCP balancer resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/tcp-balancer-rd) |
| `system/telepresence` | Telepresence Traffic Manager chart | Apache-2.0 | [source](https://github.com/telepresenceio/telepresence/blob/release/v2/LICENSE) |
| `system/tenant-rd` | Cozystack Tenant resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/tenant-rd) |
| `system/velero` | Velero Helm chart | Apache-2.0 | [source](https://github.com/velero-io/velero/blob/main/LICENSE) |
| `system/vertical-pod-autoscaler` | Vertical Pod Autoscaler chart | MIT; Apache-2.0 | [source](https://github.com/cowboysysop/charts/blob/master/LICENSE) |
| `system/vertical-pod-autoscaler-crds` | Vertical Pod Autoscaler CRDs | Apache-2.0 | [source](https://github.com/kubernetes/autoscaler/blob/master/LICENSE) |
| `system/victoria-metrics-operator` | VictoriaMetrics Operator chart | Apache-2.0 | [source](https://github.com/VictoriaMetrics/operator/blob/master/LICENSE) |
| `system/virtualprivatecloud-rd` | Cozystack VPC resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/virtualprivatecloud-rd) |
| `system/vm-default-images` | Cozystack VM default image catalog | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/vm-default-images) |
| `system/vm-disk-rd` | Cozystack VM disk resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/vm-disk-rd) |
| `system/vm-instance-rd` | Cozystack VM instance resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/vm-instance-rd) |
| `system/vpn-rd` | Cozystack VPN resource definition | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/system/vpn-rd) |
| `system/vsnap-crd` | CSI VolumeSnapshot CRDs | Apache-2.0 | [source](https://github.com/kubernetes-csi/external-snapshotter/blob/master/LICENSE) |

## Application and Extra Packages

The following packages define Cozystack application APIs and tenant-level extras. Their package source is Apache-2.0; runtime software licenses for managed services are listed in the next section.

| Package | Component | License | Source |
|---|---|---|---|
| `apps/bucket` | Cozystack Bucket application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/bucket) |
| `apps/clickhouse` | Cozystack ClickHouse application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/clickhouse) |
| `apps/foundationdb` | Cozystack FoundationDB application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/foundationdb) |
| `apps/harbor` | Cozystack Harbor application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/harbor) |
| `apps/http-cache` | Cozystack HTTP cache application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/http-cache) |
| `apps/kafka` | Cozystack Kafka application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/kafka) |
| `apps/kubernetes` | Cozystack Kubernetes application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/kubernetes) |
| `apps/mariadb` | Cozystack MariaDB application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/mariadb) |
| `apps/mongodb` | Cozystack MongoDB application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/mongodb) |
| `apps/nats` | Cozystack NATS application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/nats) |
| `apps/openbao` | Cozystack OpenBao application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/openbao) |
| `apps/opensearch` | Cozystack OpenSearch application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/opensearch) |
| `apps/postgres` | Cozystack PostgreSQL application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/postgres) |
| `apps/qdrant` | Cozystack Qdrant application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/qdrant) |
| `apps/rabbitmq` | Cozystack RabbitMQ application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/rabbitmq) |
| `apps/redis` | Cozystack Redis application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/redis) |
| `apps/tcp-balancer` | Cozystack TCP balancer application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/tcp-balancer) |
| `apps/tenant` | Cozystack Tenant application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/tenant) |
| `apps/vm-disk` | Cozystack VM disk application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/vm-disk) |
| `apps/vm-instance` | Cozystack VM instance application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/vm-instance) |
| `apps/vpc` | Cozystack VPC application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/vpc) |
| `apps/vpn` | Cozystack VPN application API | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/apps/vpn) |
| `extra/bootbox` | Cozystack Bootbox extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/bootbox) |
| `extra/etcd` | Cozystack etcd extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/etcd) |
| `extra/external-dns` | Cozystack ExternalDNS extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/external-dns) |
| `extra/info` | Cozystack Info extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/info) |
| `extra/ingress` | Cozystack Ingress extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/ingress) |
| `extra/monitoring` | Cozystack Monitoring extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/monitoring) |
| `extra/seaweedfs` | Cozystack SeaweedFS extra package | Apache-2.0 | [source](https://github.com/cozystack/cozystack/tree/main/packages/extra/seaweedfs) |

## Managed Workload Runtimes

| Managed service | Runtime component | License | Source |
|---|---|---|---|
| Bucket/Object Storage | SeaweedFS; S3 Manager | Apache-2.0 | [seaweedfs](https://github.com/seaweedfs/seaweedfs/blob/master/LICENSE), [s3manager](https://github.com/cloudlena/s3manager/blob/main/LICENSE) |
| ClickHouse | ClickHouse Server and ClickHouse Keeper | Apache-2.0 | [source](https://github.com/ClickHouse/ClickHouse/blob/master/LICENSE) |
| FoundationDB | FoundationDB | Apache-2.0 | [source](https://github.com/apple/foundationdb/blob/main/LICENSE) |
| Harbor | Harbor | Apache-2.0 | [source](https://github.com/goharbor/harbor/blob/main/LICENSE) |
| HTTP Cache | NGINX; HAProxy; IP2Location/IP2Proxy modules | BSD-2-Clause; GPL-2.0 with exceptions; MIT | [nginx](https://github.com/nginx/nginx/blob/master/LICENSE), [haproxy](https://github.com/haproxy/haproxy/blob/master/LICENSE), [ip2location](https://github.com/ip2location/ip2location-nginx/blob/master/LICENSE), [ip2proxy](https://github.com/ip2location/ip2proxy-nginx/blob/master/LICENSE) |
| Kafka | Apache Kafka through Strimzi | Apache-2.0 | [source](https://github.com/apache/kafka/blob/trunk/LICENSE) |
| Kubernetes | Kubernetes control plane and add-ons | Apache-2.0 | [source](https://github.com/kubernetes/kubernetes/blob/master/LICENSE) |
| MariaDB | MariaDB Server | GPL-2.0 | [source](https://github.com/MariaDB/server/blob/main/COPYING) |
| MongoDB | Percona Server for MongoDB | SSPL-1.0 | [source](https://github.com/percona/percona-server-mongodb/blob/master/LICENSE-Community.txt) |
| NATS | NATS Server | Apache-2.0 | [source](https://github.com/nats-io/nats-server/blob/main/LICENSE) |
| OpenBao | OpenBao | MPL-2.0 | [source](https://github.com/openbao/openbao/blob/main/LICENSE) |
| OpenSearch | OpenSearch | Apache-2.0 | [source](https://github.com/opensearch-project/OpenSearch/blob/main/LICENSE.txt) |
| PostgreSQL | PostgreSQL | PostgreSQL License | [source](https://www.postgresql.org/about/licence/) |
| Qdrant | Qdrant | Apache-2.0 | [source](https://github.com/qdrant/qdrant/blob/master/LICENSE) |
| RabbitMQ | RabbitMQ Server | MPL-2.0; Apache-2.0 for some files | [source](https://github.com/rabbitmq/rabbitmq-server/blob/main/LICENSE) |
| Redis | Redis 7.4 and Redis 8 | RSALv2 or SSPLv1; Redis 8 also AGPLv3 | [source](https://redis.io/legal/licenses/) |
| TCP Balancer | HAProxy | GPL-2.0 with exceptions | [source](https://github.com/haproxy/haproxy/blob/master/LICENSE) |
| VPN | Outline Shadowsocks server | Apache-2.0 | [source](https://github.com/OutlineFoundation/outline-server/blob/master/LICENSE) |
