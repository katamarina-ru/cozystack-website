---
title: "Создание шифрованного хранилища на LINSTOR"
linkTitle: "Шифрованное хранилище"
description: "Узнайте, как настроить и использовать шифрование постоянных томов at-rest в LINSTOR"
weight: 100
aliases:
  - /docs/v1.5/operations/storage/disk-encryption
---

Администраторы Cozystack могут включить шифрованное хранилище, создав собственный StorageClass.
В этом руководстве описано, как задать парольную фразу шифрования, создать шифрованный класс хранения и использовать его в приложениях.

LINSTOR обеспечивает шифрование постоянных томов at-rest с помощью [LUKS](https://linbit.com/drbd-user-guide/linstor-guide-1_0-en/#s-linstor-encrypted-volumes).
Это гарантирует, что данные на диске хранятся в зашифрованном виде и доступны только тогда, когда том смонтирован и разблокирован.

## Настройка шифрования в LINSTOR

Чтобы начать использовать шифрование, задайте парольную фразу шифрования в LINSTOR.

```bash
kubectl exec -i -t -n cozy-linstor deploy/linstor-controller -- linstor encryption create-passphrase 
```

{{% alert color="warning" %}}
:warning: Сохраните парольную фразу в надёжном месте.<br/>
Если вы потеряете парольную фразу шифрования, все зашифрованные данные будут безвозвратно утеряны.
{{% /alert %}}

Парольную фразу нужно вводить каждый раз после перезапуска контроллера LINSTOR.
Для ввода парольной фразы используйте следующую команду:

```bash
kubectl exec -i -t -n cozy-linstor deploy/linstor-controller -- linstor encryption enter-passphrase
```

## Создание шифрованного класса хранения

Создайте `StorageClass` для шифрованного хранилища:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-encrypted
provisioner: linstor.csi.linbit.com
parameters:
  linstor.csi.linbit.com/storagePool: "data"
  linstor.csi.linbit.com/layerList: "luks storage"
  linstor.csi.linbit.com/encryption: "true"
  linstor.csi.linbit.com/allowRemoteVolumeAccess: "false"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: replicated-encrypted
provisioner: linstor.csi.linbit.com
parameters:
  linstor.csi.linbit.com/storagePool: "data"
  linstor.csi.linbit.com/autoPlace: "3"
  linstor.csi.linbit.com/layerList: "drbd luks storage"
  linstor.csi.linbit.com/encryption: "true"
  linstor.csi.linbit.com/allowRemoteVolumeAccess: "true"
  property.linstor.csi.linbit.com/DrbdOptions/auto-quorum: suspend-io
  property.linstor.csi.linbit.com/DrbdOptions/Resource/on-no-data-accessible: suspend-io
  property.linstor.csi.linbit.com/DrbdOptions/Resource/on-suspended-primary-outdated: force-secondary
  property.linstor.csi.linbit.com/DrbdOptions/Net/rr-conflict: retry-connect
volumeBindingMode: Immediate
allowVolumeExpansion: true
```

Теперь вы можете использовать этот `StorageClass` для создания `PersistentVolumeClaims` (PVC) под шифрованное хранилище.

