---
title: "Конфигурация Velero Backup"
linkTitle: "Настройка резервного копирования Velero"
description: "Настройка backup storage, strategies и BackupClasses для cluster backups (для cluster administrators)."
weight: 30
---

Это руководство предназначено для **cluster administrators**, которые настраивают backup-инфраструктуру в Cozystack: S3 storage, Velero locations, backup **strategies** и **BackupClasses**. Затем tenant users используют существующие BackupClasses для создания [BackupJobs и Plans]({{% ref "/docs/v1.3/virtualization/backup-and-recovery" %}}).

## Предварительные требования

- Административный доступ к Cozystack (management) cluster.
- S3-compatible storage: если вы хотите хранить backups в Cozy, включите SeaweedFS и создайте Bucket или используйте внешний S3 service.
- Включите отключенный по умолчанию компонент `cozystack.velero` в `bundles.enabledPackages` [Platform Package]({{% ref "/docs/v1.3/operations/configuration/platform-package" %}}). Для **tenant clusters** задайте `spec.addons.velero.enabled` равным `true` в ресурсе `Kubernetes`.

## 1. Настройте storage credentials и конфигурацию

Создайте следующие ресурсы в **management cluster** в namespace `cozy-velero`, чтобы Velero мог хранить backups и volume snapshots.

### 1.1 Создайте secret с S3 credentials

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: s3-credentials
  namespace: cozy-velero
type: Opaque
stringData:
  cloud: |
    [default]
    aws_access_key_id=<KEY>
    aws_secret_access_key=<SECRET KEY>

    services = seaweed-s3
    [services seaweed-s3]
    s3 =
        endpoint_url = https://s3.tenant-name.cozystack.example.com
```

### 1.2 Настройте BackupStorageLocation

Этот ресурс определяет, где Velero хранит backups (S3 bucket).

```yaml
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: default
  namespace: cozy-velero
spec:
  provider: aws
  objectStorage:
    bucket: <BUCKET_NAME>
  config:
    checksumAlgorithm: ''
    profile: "default"
    s3ForcePathStyle: "true"
    s3Url: https://s3.tenant-name.cozystack.example.com
  credential:
    name: s3-credentials
    key: cloud
```

`BUCKET_NAME` можно найти командой:
```bash
kubectl get bucketclaim -A -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,BUCKET_NAME:.status.bucketName,READY:.status.bucketReady
```

См. [BackupStorageLocation](https://velero.io/docs/v1.17/api-types/backupstoragelocation/) в документации Velero.

Проверьте, что ресурс успешно создан:
```bash
k get BackupStorageLocation -n cozy-velero    
```

Вывод должен быть похож на:
```bash
NAME      PHASE       LAST VALIDATED   AGE    DEFAULT
default   Available   5s               3d9h   true
```

### 1.3 Настройте VolumeSnapshotLocation

Этот ресурс определяет конфигурацию volume snapshots.

```yaml
apiVersion: velero.io/v1
kind: VolumeSnapshotLocation
metadata:
  name: default
  namespace: cozy-velero
spec:
  provider: aws
  credential:
    name: s3-credentials
    key: cloud
  config:
    region: "us-west-2"
    profile: "default"
```

См. [VolumeSnapshotLocation](https://velero.io/docs/v1.17/api-types/volumesnapshotlocation/) в документации Velero.

## 2. Определите backup strategy

**Strategy** описывает template [Velero Backup](https://velero.io/docs/v1.17/api-types/backup/). Это переиспользуемый template, на который ссылаются BackupClasses.

В strategy задаются:

- **Scope**: namespaces и resources, например tenant namespace или resources по label.
- **Volume handling**: делать ли snapshot volumes и использовать ли `snapshotMoveData`.
- **Retention**: backup TTL по умолчанию.

Проверьте CRD group, version и kind в вашем кластере:

```bash
kubectl get crd | grep -i backup
kubectl explain <strategy-kind> --recursive
```

Пример strategy для VMInstance (включает все VM resources и подключенные volumes):

```yaml
apiVersion: strategy.backups.cozystack.io/v1alpha1
kind: Velero
metadata:
  name: vminstance-strategy
spec:
  template:
    restoreSpec:
      existingResourcePolicy: update
      includedNamespaces:
        - '{{ .Application.metadata.namespace }}'
      orLabelSelectors:
        - matchLabels:
            app.kubernetes.io/instance: 'vm-instance-{{ .Application.metadata.name }}'
        - matchLabels:
            apps.cozystack.io/application.kind: '{{ .Application.kind }}'
            apps.cozystack.io/application.name: '{{ .Application.metadata.name }}'
      includedResources:
        - helmreleases.helm.toolkit.fluxcd.io
        - virtualmachines.kubevirt.io
        - virtualmachineinstances.kubevirt.io
        - pods
        - persistentvolumeclaims
        - configmaps
        - secrets
        - controllerrevisions.apps
      includeClusterResources: false
      excludedResources:
        - datavolumes.cdi.kubevirt.io

    spec:
      includedNamespaces:
        - '{{ .Application.metadata.namespace }}'
      orLabelSelectors:
        - matchLabels:
            app.kubernetes.io/instance: 'vm-instance-{{ .Application.metadata.name }}'
        - matchLabels:
            apps.cozystack.io/application.kind: '{{ .Application.kind }}'
            apps.cozystack.io/application.name: '{{ .Application.metadata.name }}'
      includedResources:
        - helmreleases.helm.toolkit.fluxcd.io
        - virtualmachines.kubevirt.io
        - virtualmachineinstances.kubevirt.io
        - pods
        - datavolumes.cdi.kubevirt.io
        - persistentvolumeclaims
        - configmaps
        - secrets
        - controllerrevisions.apps
      includeClusterResources: false
      storageLocation: '{{ .Parameters.backupStorageLocationName }}'
      volumeSnapshotLocations:
        - '{{ .Parameters.backupStorageLocationName }}'
      snapshotVolumes: true
      snapshotMoveData: true
      ttl: 720h0m0s
      itemOperationTimeout: 24h0m0s
```

Пример strategy для VMDisk (только disk и его volume):

```yaml
apiVersion: strategy.backups.cozystack.io/v1alpha1
kind: Velero
metadata:
  name: vmdisk-strategy
spec:
  template:
    restoreSpec:
      existingResourcePolicy: update
      includedNamespaces:
        - '{{ .Application.metadata.namespace }}'
      orLabelSelectors:
        - matchLabels:
            app.kubernetes.io/instance: 'vm-disk-{{ .Application.metadata.name }}'
        - matchLabels:
            apps.cozystack.io/application.kind: '{{ .Application.kind }}'
            apps.cozystack.io/application.name: '{{ .Application.metadata.name }}'
      includedResources:
        - helmreleases.helm.toolkit.fluxcd.io
        - persistentvolumeclaims
        - configmaps
      includeClusterResources: false

    spec:
      includedNamespaces:
        - '{{ .Application.metadata.namespace }}'
      orLabelSelectors:
        - matchLabels:
            app.kubernetes.io/instance: 'vm-disk-{{ .Application.metadata.name }}'
        - matchLabels:
            apps.cozystack.io/application.kind: '{{ .Application.kind }}'
            apps.cozystack.io/application.name: '{{ .Application.metadata.name }}'
      includedResources:
        - helmreleases.helm.toolkit.fluxcd.io
        - persistentvolumeclaims
        - configmaps
      includeClusterResources: false
      storageLocation: '{{ .Parameters.backupStorageLocationName }}'
      volumeSnapshotLocations:
        - '{{ .Parameters.backupStorageLocationName }}'
      snapshotVolumes: true
      snapshotMoveData: true
      ttl: 720h0m0s
      itemOperationTimeout: 24h0m0s
```

Template variables (`{{ .Application.* }}` и `{{ .Parameters.* }}`) берутся из ApplicationRef в BackupJob/Plan и параметров, заданных в BackupClass.

Не забудьте применить strategy в management cluster:

```bash
kubectl apply -f velero-backup-strategy.yaml
```

## 3. Создайте BackupClass

**BackupClass** связывает strategy с приложениями; в нем можно задать параметры.

Проверьте CRD BackupClass в кластере:

```bash
kubectl get backupclasses
kubectl explain backupclasses.spec --recursive
```

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupClass
metadata:
  name: velero
spec:
  strategies:
  - strategyRef:
      apiGroup: strategy.backups.cozystack.io
      kind: Velero
      name: vminstance-strategy
    application:
      kind: VMInstance
      apiGroup: apps.cozystack.io
    parameters:
      backupStorageLocationName: default
  - strategyRef:
      apiGroup: strategy.backups.cozystack.io
      kind: Velero
      name: vmdisk-strategy
    application:
      kind: VMDisk
      apiGroup: apps.cozystack.io
    parameters:
      backupStorageLocationName: default
```

Примените и выведите список:

```bash
kubectl apply -f backupclass.yaml
kubectl get backupclasses
```

## 4. Как пользователи запускают backups

Когда strategies и BackupClasses настроены, **tenant users** могут запускать backups, не меняя Velero или storage configuration:

- **One-off backup**: создайте [BackupJob]({{% ref "/docs/v1.3/virtualization/backup-and-recovery#one-off-backup" %}}), который ссылается на BackupClass.
- **Scheduled backups**: создайте [Plan]({{% ref "/docs/v1.3/virtualization/backup-and-recovery#scheduled-backup" %}}) с cron schedule и ссылкой на BackupClass.

Прямое использование Velero CRDs (`Backup`, `Schedule`, `Restore`) остается доступным для advanced или recovery scenarios:

```bash
kubectl get backup.velero.io -n cozy-velero
kubectl get schedule.velero.io -n cozy-velero
kubectl get restores.velero.io -n cozy-velero
```

Если установлен [Velero CLI](https://velero.io/docs/v1.17/basic-install/#install-the-cli), можно также выполнить:

```bash
velero -n cozy-velero backup get
velero -n cozy-velero schedule get
velero -n cozy-velero restore get
```

Чтобы посмотреть Velero logs, используйте команду:

```bash
kubectl logs -n cozy-velero -l app.kubernetes.io/name=velero --tail=100
```

## 5. Восстановление из backup

Когда strategies и BackupClasses настроены, tenant users могут восстанавливаться из backup с помощью ресурсов **RestoreJob**. Инструкции по restore для in-place восстановления VMInstance и VMDisk см. в руководстве [Backup and Recovery]({{% ref "/docs/v1.3/virtualization/backup-and-recovery" %}}).
