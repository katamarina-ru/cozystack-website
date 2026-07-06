---
title: "Использование NFS-ресурсов в Cozystack"
linkTitle: "Использование NFS"
description: "Настройка дополнительного модуля `nfs-driver` для заказа томов из NFS-ресурсов в Cozystack"
weight: 30
aliases:
  - /docs/v1.5/operations/storage/nfs
---

## Включение драйвера NFS

Добавьте `cozystack.nfs-driver` в `bundles.enabledPackages` в [Platform Package]({{% ref "/docs/v1.5/operations/configuration/platform-package" %}}):

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
  -p '[{"op": "add", "path": "/spec/components/platform/values/bundles/enabledPackages/-", "value": "cozystack.nfs-driver"}]'
```

Подождите около минуты, пока чарт платформы выполнит согласование, затем убедитесь, что HelmRelease создан:

```bash
kubectl get helmrelease --namespace cozy-nfs-driver nfs-driver
```

## Экспорт общего ресурса

```bash
apt install nfs-server
mkdir /data
chmod 777 /data
echo '/data *(rw,sync,no_subtree_check)' >> /etc/exports
exportfs -a
```

## Настройка подключения

```yaml
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs
provisioner: nfs.csi.k8s.io
parameters:
  server: 10.244.57.210
  share: /data
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
mountOptions:
  - nfsvers=4.1
```


## Заказ тома

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: task-pv-claim
spec:
  storageClassName: nfs
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 3Gi
```
