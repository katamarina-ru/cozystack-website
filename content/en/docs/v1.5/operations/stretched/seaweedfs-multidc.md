---
title: "Конфигурация SeaweedFS Multi-DC"
linkTitle: "SeaweedFS в нескольких ЦОД"
description: "Как развернуть SeaweedFS в нескольких дата-центрах"
weight: 175
---

В этом руководстве описано, как развернуть SeaweedFS в нескольких дата-центрах ("multi-DC").
Multi-zone конфигурация SeaweedFS доступна начиная с Cozystack v0.34.0.

## Конфигурация SeaweedFS Multi-DC

Чтобы растянуть SeaweedFS на несколько DC, создайте новый кластер в режиме multi-DC.

По умолчанию SeaweedFS работает в одном дата-центре (DC), и уже запущенное single-DC-развертывание нельзя переключить в multi-DC-режим.
Если нужно изменить топологию, удалите текущий экземпляр SeaweedFS и создайте новый с нужным режимом.

Удобный порядок действий:

1. Разверните tenant с `seaweedfs: false`.
2. Создайте новый экземпляр SeaweedFS в namespace tenant, используя нужную топологию.
3. Обновите tenant, установив `seaweedfs: true`.

### 1. Создайте tenant без SeaweedFS

Поле `isolated`, которое в ранних релизах Cozystack было доступно в объекте Tenant, удалено в v1.0.
Текущая модель сетевой изоляции описана в upgrade notes: [флаг `isolated` у Tenant удален]({{% ref "/docs/v1.5/operations/upgrades#tenant-isolated-flag-removed" %}}).

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Tenant
metadata:
  name: dev
  namespace: tenant-root
spec:
  etcd: false
  host: ""
  ingress: false
  monitoring: false
  seaweedfs: false
```

### 2. Разверните SeaweedFS в режиме Multi-Zone

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: SeaweedFS
metadata:
  name: seaweedfs
  namespace: tenant-dev
spec:
  host: dev.s3.example.org
  replicas: 4
  size: 100Gi
  topology: MultiZone
  zones:
    dc1: {}
    dc2: {}
    dc3: {}
```

В этом примере SeaweedFS запускает 12 volume server: 4 реплики на 3 зоны.

Параметр `zones` перечисляет каждый дата-центр.
Любая настройка, пропущенная внутри зоны, наследует значения верхнего уровня: replicas, size и другие.

### 3. Включите SeaweedFS в tenant

Когда экземпляр SeaweedFS будет готов, включите его в tenant.
Примените следующее обновленное описание ресурса:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Tenant
metadata:
  name: dev
  namespace: tenant-root
spec:
  etcd: false
  host: ""
  ingress: false
  monitoring: false
  seaweedfs: true
```

Теперь создание Bucket доступно для всего дерева этого tenant.

## Использование удаленного экземпляра SeaweedFS

Можно опубликовать одно развертывание SeaweedFS для других кластеров Cozystack и разрешить им подключаться в режиме Client.

### 1. Экспортируйте SeaweedFS

Задайте gRPC endpoint filer и список сетей, которым разрешено подключение:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: SeaweedFS
metadata:
  name: seaweedfs
  namespace: tenant-dev
spec:
  host: dev.s3.example.org
  replicas: 4
  size: 100Gi
  topology: MultiZone
  zones:
    dc1: {}
    dc2: {}
    dc3: {}
  filer:
    grpcHost: filer-dev.s3.example.org
    whitelist:
      - 0.0.0.0/0   # открыть для всех сетей (настройте для production)
```

### 2. Настройте удаленный SeaweedFS

Подключите удаленный экземпляр SeaweedFS из другого кластера:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: SeaweedFS
metadata:
  name: seaweedfs
spec:
  host: dev.s3.example.org
  topology: Client
  filer:
    grpcHost: filer-dev.s3.example.org
```

### 3. Включите доступ к удаленному SeaweedFS

Чтобы локальный кластер мог аутентифицироваться в удаленном SeaweedFS filer, экспортируйте secret `seaweedfs-client-cert` из удаленного кластера:

```bash
kubectl get secret seaweedfs-client-cert -n tenant-dev -o yaml \
  > seaweedfs-client-cert.yaml
```

Откройте `seaweedfs-client-cert.yaml` и удалите поля `namespace`, `labels` и `annotations`.
Они относятся к удаленному кластеру и не должны применяться локально.
После очистки manifest должен выглядеть примерно так:

```yaml
apiVersion: v1
kind: Secret
type: kubernetes.io/tls
metadata:
  name: seaweedfs-client-cert
data:
  tls.crt: ...
  tls.key: ...
```

Примените secret в целевой namespace локального кластера:

```bash
kubectl apply -f seaweedfs-client-cert.yaml -n tenant-root
```

> **Примечание:**
> В режиме Client кластер не создает volume server, а просто переиспользует удаленный экземпляр SeaweedFS для всех операций с bucket.
