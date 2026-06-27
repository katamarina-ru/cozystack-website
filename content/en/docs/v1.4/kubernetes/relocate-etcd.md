---
title: Как перенести реплики etcd в tenant-кластерах
linkTitle: Как перенести реплики etcd
description: "Как перенести реплики tenant-кластеров etcd, которые используются tenant-кластерами Kubernetes."
weight: 100
---

Tenant-кластеры Kubernetes используют собственные кластеры etcd, а не etcd management-кластера.
Такие кластеры etcd разворачиваются внутри tenant и доступны управляемым Kubernetes-кластерам, развернутым в этом tenant и его sub-tenant.

Реплики tenant-кластера etcd можно переносить между нодами, например для обслуживания.
Сейчас операции управления tenant-кластерами etcd не автоматизированы,
но такую задачу можно выполнить вручную.

Сначала установите плагин `kubectl-etcd` для `kubectl`:

```bash
go install github.com/aenix-io/etcd-operator/cmd/kubectl-etcd@latest
```

Теперь можно управлять репликами etcd.
Скрипт ниже удаляет реплику `etcd-2` из кластера etcd, а затем добавляет ее обратно.

```bash
# tenant, которому принадлежит кластер etcd
NAMESPACE=tenant-demo
# реплика etcd
RM=etcd-2
POD=$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=etcd --no-headers | awk '$2 == "1/1" && $1 != "'$RM'" {print $1; exit;}')
RMID=$(kubectl etcd -n $NAMESPACE -p $POD members | awk '$2 == "'$RM'" {print $1}')

# удалить реплику
kubectl delete -n $NAMESPACE pvc/data-$RM pod/$RM
if [ -n $RMID ]; then
  kubectl etcd -n $NAMESPACE -p $POD remove-member "$RMID"
fi

# добавить реплику обратно
kubectl etcd -n $NAMESPACE -p $POD add-member "https://$RM.etcd-headless.$NAMESPACE.svc:2380"

kubectl wait --for=condition=ready pod -n $NAMESPACE $RM --timeout=2m

kubectl etcd -n $NAMESPACE -p $RM members
```

Подробнее о вложенности tenant и общих сервисах см. в [руководстве по tenants]({{% ref "/docs/v1.4/guides/tenants" %}}).
