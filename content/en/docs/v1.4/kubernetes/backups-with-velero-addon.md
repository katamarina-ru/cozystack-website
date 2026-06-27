---
title: "Бэкапы с расширением Velero"
linkTitle: "Бэкапы с расширением Velero"
description: "Как включить расширение Velero в tenant-кластере Kubernetes, направить его в bucket SeaweedFS, а затем создавать и восстанавливать бэкапы workload."
weight: 60
---

Расширение `velero` приложения [Managed Kubernetes]({{% ref "/docs/v1.4/kubernetes" %}}) устанавливает [Velero](https://velero.io/) внутри tenant-кластера Kubernetes. В связке с tenant [Bucket]({{% ref "/docs/v1.4/operations/services/object-storage/buckets" %}}) оно позволяет пользователям tenant сохранять бэкапы рабочей нагрузки в S3 и затем восстанавливать их.

{{% alert color="info" %}}
Это руководство относится к расширению Velero на **стороне tenant**: оно работает внутри tenant-кластера Kubernetes и управляется пользователем tenant.

О platform-level Velero, который администраторы кластера используют для для резервного копирования ресурсов ресурсов `VMInstance`/`VMDisk` из management-кластера, см. [Velero Backup Configuration]({{% ref "/docs/v1.4/operations/services/velero-backup-configuration" %}}).
{{% /alert %}}

## Что устанавливает расширение

Когда для ресурса `Kubernetes` задано `spec.addons.velero.enabled: true`, Cozystack разворачивает Velero в namespace `cozy-velero` tenant-кластера. Чарт подключает `vmware-tanzu/velero` как саб чарт  и заранее настраивает AWS S3 plugin, KubeVirt plugin, агент ноды (file-system backup) и поддержку CSI (`features: EnableCSI`). `VolumeSnapshotClass` `kubevirt-snapshots` (driver `csi.kubevirt.io`) поставляется в каждом tenant-кластере и помечен для плагин CSI Velero, поэтому снепшоты разделов  работают из коробки.

Установка по умолчанию не создает `BackupStorageLocation`. Его нужно передать через `valuesOverride` — обычно с указанием на SeaweedFS `Bucket`, расположенный в вашем tenant.

## Требования

- SeaweedFS включен для вашего tenant (`spec.seaweedfs: true`). См. [Object Storage]({{% ref "/docs/v1.4/operations/services/object-storage" %}}).
- [`velero` CLI](https://velero.io/docs/v1.17/basic-install/#install-the-cli) установлен локально.
- У вас есть admin-доступ к namespace tenant в management-кластере, чтобы создавать ресурсы `Bucket` и `Kubernetes`, а также получить итоговый kubeconfig.

## 1. Создайте bucket для бэкапов

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: velero-backups
  namespace: tenant-example
spec:
  users:
    velero: {}
```

Cozystack создает secret с учетными данными с именем `bucket-<bucket-name>-<user>-credentials` и полями `accessKey`, `secretKey`, `endpoint` и `bucketName`. Считайте значения, которые нужно подставить в конфигурацию расширения:

```bash
NS=tenant-example
SECRET=bucket-velero-backups-velero-credentials

BUCKET_NAME=$(kubectl get secret "$SECRET" -n "$NS" -o jsonpath='{.data.bucketName}' | base64 -d)
ACCESS_KEY=$(kubectl get secret "$SECRET" -n "$NS" -o jsonpath='{.data.accessKey}' | base64 -d)
SECRET_KEY=$(kubectl get secret "$SECRET" -n "$NS" -o jsonpath='{.data.secretKey}' | base64 -d)
ENDPOINT=$(kubectl get secret "$SECRET" -n "$NS" -o jsonpath='{.data.endpoint}' | base64 -d)
echo "$BUCKET_NAME / https://$ENDPOINT"
```

`endpoint` содержит только hostname — Velero нужен S3 URL в виде `https://$ENDPOINT`.

## 2. Разверните tenant-кластер с расширением Velero

{{% alert color="warning" %}}
Чарт расширения встраивает чарт Velero **как сабчарт под ключом `velero`**. Переопределение значений **обязательно** должны находиться внутри `velero:` — размещение на верхнем уровне (например, `valuesOverride.configuration.backupStorageLocation`) игнорируется без предупреждений.
{{% /alert %}}

Сформируйте и примените манифест `Kubernetes`, используя значения из предыдущего шага:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: apps.cozystack.io/v1alpha1
kind: Kubernetes
metadata:
  name: my-cluster
  namespace: $NS
spec:
  host: my-cluster.tenant-example.cozystack.example.com
  addons:
    velero:
      enabled: true
      valuesOverride:
        velero:
          credentials:
            useSecret: true
            secretContents:
              cloud: |
                [default]
                aws_access_key_id=$ACCESS_KEY
                aws_secret_access_key=$SECRET_KEY
          configuration:
            backupStorageLocation:
              - name: default
                provider: aws
                bucket: $BUCKET_NAME
                default: true
                config:
                  region: us-east-1
                  s3ForcePathStyle: "true"
                  s3Url: https://$ENDPOINT
            volumeSnapshotLocation:
              - name: default
                provider: aws
                config:
                  region: us-east-1
EOF
```

Когда кластер перейдет в состояние `Ready`, получите его kubeconfig и настройте командную оболочку на работу с ним:

```bash
kubectl get secret -n "$NS" kubernetes-my-cluster-admin-kubeconfig \
  -o go-template='{{ printf "%s\n" (index .data "admin.conf" | base64decode) }}' \
  > my-cluster-kubeconfig
export KUBECONFIG=$PWD/my-cluster-kubeconfig
```

Оставшиеся шаги выполняются в **tenant**-кластера.

## 3. Проверьте, что Velero запущен

```bash
kubectl -n cozy-velero get deploy
velero -n cozy-velero backup-location get
```

Ожидаемый вывод:

```text
NAME      STATUS      PROVIDER   BUCKET                                            ACCESS MODE   DEFAULT
default   Available   aws        bucket-91bbb59f-30ba-46fe-9a44-535d8332a464       ReadWrite     true
```

`STATUS: Available` означает, что Velero успешно подключился к bucket.

## 4. Создайте бэкап namespace

Создайте пример рабочей нагрузки (пропустите этот шаг, если у вас уже есть рабочая нагрузка для бэкапа):

```bash
kubectl create namespace demo
kubectl -n demo create configmap demo-cm \
  --from-literal=marker=backup-restore-validation
```

Создайте бэкап ресурс:

```bash
velero -n cozy-velero backup create demo-1 \
  --include-namespaces demo --snapshot-move-data
velero -n cozy-velero backup describe demo-1 --details
```

`--snapshot-move-data` загружает данные CSI snapshot в bucket, поэтому бэкап становится самодостаточным — при восстановлении больше не нужен доступ к исходным PV.

Дождитесь `Phase: Completed`.

## 5. Восстановите данные из бэкапа

Сымитируйте потерю данных, удалив namespace, затем восстановите его из бэкапа:

```bash
kubectl delete namespace demo
velero -n cozy-velero restore create demo-1-restore \
  --from-backup demo-1
velero -n cozy-velero restore describe demo-1-restore --details
```

Когда restore перейдет в `Phase: Completed`, namespace и его объекты будут созданы заново. Проверьте:

```bash
kubectl -n demo get all,configmaps
```

По той же схеме можно восстановиться и в **другой** tenant-кластер Kubernetes: укажите второму кластеру тот же bucket с идентичным `addons.velero.valuesOverride`, и `velero backup get` во втором кластере увидит `demo-1` после очередной синхронизации bucket (интервал по умолчанию — одна минута). Особенности cross-cluster сценариев см. в [migration scenario](https://velero.io/docs/v1.17/migration-case/).

## См. также

- [Управляемый Kubernetes — параметры `addons.velero`]({{% ref "/docs/v1.4/kubernetes#parameters" %}})
- [Пользователи и бакеты]({{% ref "/docs/v1.4/operations/services/object-storage/buckets" %}})
- [Конфигурация Velero Backup (platform admin)]({{% ref "/docs/v1.4/operations/services/velero-backup-configuration" %}})
