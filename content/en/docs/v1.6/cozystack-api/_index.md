---
title: Cozystack API
description: Cozystack API для управления сервисами и ресурсами
weight: 70
aliases:
  - /docs/v1.6/development/cozystack-api
---

## Cozystack API

Cozystack предоставляет мощный API, который позволяет развёртывать сервисы с помощью различных инструментов. Вы можете управлять ресурсами через kubectl, Terraform или программно с помощью Go.

**Оптимальный способ изучения Cozystack API:**

1. Используйте дашборд для развёртывания приложения.
2. Изучите развёрнутый ресурс в Cozystack API и используйте его как пример.
3. Параметризуйте и воспроизведите пример ресурса, чтобы создавать собственные ресурсы через API.

## Обнаружение ресурсов

Вы можете получить список всех доступных ресурсов с помощью `kubectl`:

```bash
# kubectl api-resources | grep apps.cozystack
buckets           apps.cozystack.io/v1alpha1      true      Bucket
clickhouses       apps.cozystack.io/v1alpha1      true      ClickHouse
etcds             apps.cozystack.io/v1alpha1      true      Etcd
foundationdbs     apps.cozystack.io/v1alpha1      true      FoundationDB
harbors           apps.cozystack.io/v1alpha1      true      Harbor
httpcaches        apps.cozystack.io/v1alpha1      true      HTTPCache
infos             apps.cozystack.io/v1alpha1      true      Info
ingresses         apps.cozystack.io/v1alpha1      true      Ingress
kafkas            apps.cozystack.io/v1alpha1      true      Kafka
kuberneteses      apps.cozystack.io/v1alpha1      true      Kubernetes
mariadbs          apps.cozystack.io/v1alpha1      true      MariaDB
mongodbs          apps.cozystack.io/v1alpha1      true      MongoDB
monitorings       apps.cozystack.io/v1alpha1      true      Monitoring
natses            apps.cozystack.io/v1alpha1      true      NATS
openbaos          apps.cozystack.io/v1alpha1      true      OpenBAO
postgreses        apps.cozystack.io/v1alpha1      true      Postgres
qdrants           apps.cozystack.io/v1alpha1      true      Qdrant
rabbitmqs         apps.cozystack.io/v1alpha1      true      RabbitMQ
redises           apps.cozystack.io/v1alpha1      true      Redis
seaweedfses       apps.cozystack.io/v1alpha1      true      SeaweedFS
tcpbalancers      apps.cozystack.io/v1alpha1      true      TCPBalancer
tenants           apps.cozystack.io/v1alpha1      true      Tenant
virtualprivate    apps.cozystack.io/v1alpha1      true      VirtualPrivateCloud
vmdisks           apps.cozystack.io/v1alpha1      true      VMDisk
vminstances       apps.cozystack.io/v1alpha1      true      VMInstance
vpns              apps.cozystack.io/v1alpha1      true      VPN

```

## Использование kubectl

Запросите конкретный тип ресурса в пространстве имён вашего тенанта:

```bash
# kubectl get postgreses -n tenant-test
NAME   READY   AGE   VERSION
test   True    46s   0.7.1
```

Просмотрите вывод в формате YAML:

```yaml
# kubectl get postgreses -n tenant-test test -o yaml
apiVersion: apps.cozystack.io/v1alpha1
appVersion: 0.7.1
kind: Postgres
metadata:
  name: test
  namespace: tenant-test
spec:
  databases: {}
  replicas: 2
  size: 10Gi
  storageClass: ""
  users: {}
status:
  conditions:
  - lastTransitionTime: "2024-12-10T09:53:32Z"
    message: Helm install succeeded for release tenant-test/postgres-test.v1 with chart postgres@0.7.1
    reason: InstallSucceeded
    status: "True"
    type: Ready
  - lastTransitionTime: "2024-12-10T09:53:32Z"
    message: Helm install succeeded for release tenant-test/postgres-test.v1 with chart postgres@0.7.1
    reason: InstallSucceeded
    status: "True"
    type: Released
  version: 0.7.1
```

Вы можете использовать этот ресурс как пример для создания аналогичного сервиса через API. Просто сохраните вывод в файл, обновите `name` и нужные параметры, затем используйте `kubectl` для создания нового экземпляра Postgres:

```bash
kubectl apply -f postgres.yaml
```

## Использование Terraform

Cozystack интегрируется с Terraform. Для создания ресурсов в Cozystack API можно использовать стандартный провайдер `kubernetes`.

**Пример:**

```hcl
provider "kubernetes" {
  config_path = "~/.kube/config"
}

resource "kubernetes_manifest" "vm_disk_iso" {
  manifest = {
    "apiVersion" = "apps.cozystack.io/v1alpha1"
    "appVersion" = "0.7.1"
    "kind"       = "Postgres"
    "metadata" = {
      "name"      = "test2"
      "namespace" = "tenant-test"
    }
    "spec" = {
      "replicas" = 2
      "size"     = "10Gi"
    }
  }
}
```

Затем выполните:

```bash
terraform plan
terraform apply
```

Ваш новый кластер Postgres будет развёрнут.

## Использование кода на Go

Cozystack публикует пользовательские типы ресурсов Kubernetes в виде модуля Go, что позволяет управлять ресурсами Cozystack из любого кода на Go. Подробности и примеры см. на странице [Go Types]({{< relref "go-types.md" >}}).
