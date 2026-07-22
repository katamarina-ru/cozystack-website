---
title: Резервное копирование и восстановление
linkTitle: Резервное копирование и восстановление
description: "Как создавать резервные копии ресурсов VMInstance и VMDisk и управлять ими с помощью BackupJob и Plan."
weight: 40
aliases:
  - /docs/v1.5/guides/backups
  - /docs/v1.5/kubernetes/backup-and-recovery
---


**Стратегии** резервного копирования кластера и **BackupClass** настраиваются администраторами кластера. Если для вашего тенанта ещё нет BackupClass, попросите администратора выполнить руководство [Backup Classes]({{% ref "/docs/v1.5/operations/services/backup-classes" %}}), чтобы настроить хранилище, стратегии и BackupClass.

В этом руководстве описывается резервное копирование и восстановление ресурсов **VMInstance** и **VMDisk** от лица пользователя-тенанта: запуск разовых и плановых резервных копий, проверка их статуса и восстановление из резервной копии с помощью RestoreJob.

Cozystack использует [Velero](https://velero.io/docs/v1.17/) под капотом для хранения резервных копий и снимков (snapshot) томов.

{{% alert color="info" %}}
В этом руководстве рассматривается резервное копирование ВМ (HelmRelease + CR + снимки PVC, упакованные Velero). Резервное копирование только данных управляемых баз данных (Postgres, MariaDB, ClickHouse, FoundationDB) описано в разделе [Application Backup and Recovery]({{% ref "/docs/v1.5/applications/backup-and-recovery" %}}).
{{% /alert %}}

## Предварительные требования

- Дополнение Velero включено для вашего кластера (администратором).
- Для пространства имён вашего тенанта доступен как минимум один **BackupClass** (предоставлен администратором).
- `kubectl` и kubeconfig для кластера, резервную копию которого вы создаёте.

## Список доступных BackupClass

BackupClass определяют, где и как хранятся резервные копии. Вы можете использовать только те, что созданы администраторами.

```bash
kubectl get backupclasses
```

Пример вывода:

```
NAME           AGE
cozy-default   14m
```

Используйте имя BackupClass при создании BackupJob или Plan.

`cozy-default` is the platform-shipped BackupClass; its `strategies[]` array binds the Velero driver for both `VMInstance` and `VMDisk`. Use this name when creating a BackupJob or Plan, or substitute a sibling class name if your administrator has created one.

{{% alert color="info" %}}
**Fresh-cluster bootstrap window.** On a fresh-cluster install, the Velero `BackupStorageLocation` `cozy-default` reports `Unavailable` for tens of seconds after `helm install` returns, until the platform's credentials projector lands `cozy-backups-creds` into `cozy-velero`. Velero rejects new `Backup` and `Restore` requests against `storageLocation: cozy-default` during that window. If a BackupJob you submit fails immediately with a Velero error referencing storage, wait and retry, or ask your administrator to check that `kubectl -n cozy-velero get bsl cozy-default -o jsonpath='{.status.phase}'` returns `Available`. See the [Backup Classes admin guide]({{% ref "/docs/v1.5/operations/services/backup-classes" %}}) for details.
{{% /alert %}}


## Резервное копирование VMInstance

Резервная копия VMInstance захватывает конфигурацию ВМ и все подключённые тома VMDisk.

### Разовая резервная копия

Используйте **BackupJob**, когда нужно выполнить резервное копирование один раз — например, перед рискованным изменением.

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: my-vm-backup
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMInstance
    name: my-vm
  backupClassName: cozy-default
```

Примените его и следите за статусом:

```bash
kubectl apply -f backupjob.yaml
kubectl get backupjobs -n tenant-user
kubectl describe backupjob my-vm-backup -n tenant-user
```

Когда BackupJob завершается успешно, он создаёт объект **Backup** с тем же именем (`my-vm-backup`). Это имя вы будете использовать при восстановлении.

### Плановая резервная копия

Используйте **Plan**, чтобы выполнять резервное копирование по расписанию.

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: Plan
metadata:
  name: my-vm-daily
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMInstance
    name: my-vm
  backupClassName: cozy-default
  schedule:
    cron: "0 2 * * *"   # Каждый день в 02:00
```

Примените его и проверьте:

```bash
kubectl apply -f plan.yaml
kubectl get plans -n tenant-user
kubectl describe plan my-vm-daily -n tenant-user
```

Каждый плановый запуск создаёт BackupJob (а при успехе — объект Backup), названный по имени Plan с суффиксом-временной меткой.

## Резервное копирование VMDisk

Вы можете создать резервную копию VMDisk независимо — например, чтобы захватить конкретный диск без конфигурации ВМ.

{{% alert color="info" %}}
BackupClass должен включать стратегию для `VMDisk`. Попросите администратора добавить её, если она отсутствует (см. [Backup Classes]({{% ref "/docs/v1.5/operations/services/backup-classes" %}})).
{{% /alert %}}

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: my-disk-backup
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMDisk
    name: my-disk
  backupClassName: cozy-default
```

Примените и проверьте статус:

```bash
kubectl apply -f backupjob-disk.yaml
kubectl get backupjobs -n tenant-user
kubectl describe backupjob my-disk-backup -n tenant-user
```

## Проверка статуса резервного копирования

Список всех BackupJob в пространстве имён:

```bash
kubectl get backupjobs -n tenant-user
```

Опишите конкретный BackupJob, чтобы увидеть фазу и любые ошибки:

```bash
kubectl describe backupjob my-vm-backup -n tenant-user
```

Список созданных объектов Backup (по одному на каждый завершённый BackupJob):

```bash
kubectl get backups -n tenant-user
```

Список BackupJob, созданных некоторым Plan:

```bash
kubectl get backupjobs -n tenant-user -l backups.cozystack.io/plan=my-vm-daily
```

## Восстановление VMInstance

Вы можете восстановить VMInstance как **на месте** (откат работающей ВМ), так и **с нуля** (после того как ВМ и её диски были удалены). Резервная копия VMInstance включает все подключённые тома VMDisk и их данные.

Сначала найдите объект Backup, из которого хотите восстановиться:

```bash
kubectl get backups -n tenant-user
```

Пример вывода:

```
NAME            AGE
my-vm-backup    2h
```

Создайте RestoreJob со ссылкой на этот Backup:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: restore-my-vm
  namespace: tenant-user
spec:
  backupRef:
    name: my-vm-backup
```

Примените его и проверьте ход выполнения:

```bash
kubectl apply -f restorejob.yaml
kubectl get restorejobs -n tenant-user
kubectl describe restorejob restore-my-vm -n tenant-user
```

{{% alert color="info" %}}
Контроллер восстановления автоматически подготавливает окружение пошагово:

- **Приостанавливает HelmRelease** для VMInstance и её VMDisk, чтобы Flux не вмешивался.
- **Останавливает ВМ** (устанавливает `runStrategy=Halted`) и ждёт корректного завершения работы VMI.
- **Переименовывает существующие PVC** в `<name>-orig-<hash>`, чтобы Velero мог создать новые из резервной копии. Старые PVC сохраняются на случай, если вам нужно будет их изучить.
- **Удаляет DataVolume**, чтобы CDI не пересоздавал PVC после переименования.
{{% /alert %}}


RestoreJob проходит через `Pending` → `Running` → `Succeeded` (или `Failed`). При успехе VMInstance и её VMDisk восстанавливаются до состояния, захваченного в резервной копии.

### Проверка после восстановления

После успешного завершения RestoreJob убедитесь, что ВМ действительно работает:

```bash
# Проверьте, что VMInstance и VMDisk находятся в состоянии Ready
kubectl get vminstances,vmdisks -n tenant-user

# Проверьте, что VirtualMachineInstance запущен (а не только CR)
kubectl get vmi -n tenant-user

# Проверьте доступ по SSH
virtctl ssh -i ~/.ssh/my-key -l ubuntu vmi/vm-instance-my-vm -n tenant-user -c "ip a"
```

После того как вы убедились, что восстановление прошло успешно и ВМ работает корректно, вы можете удалить PVC `*-orig-*`, содержащие исходные данные, чтобы освободить хранилище:

{{% alert color="warning" %}}
Не удаляйте PVC `*-orig-*`, пока не убедитесь, что восстановленная ВМ полностью работоспособна. Они — ваш последний резерв для ручного восстановления, если во время восстановления что-то пошло не так.
{{% /alert %}}

```bash
# Список PVC -orig
kubectl get pvc -n tenant-user | grep -- '-orig-'

# Удалите их, когда они больше не нужны (замените на фактические имена PVC из списка выше)
kubectl delete pvc -n tenant-user <name>-orig-<hash>
```

## Восстановление VMDisk на месте

Чтобы восстановить только VMDisk, не затрагивая конфигурацию ВМ.

{{% alert color="warning" %}}
Velero пропускает существующий DataVolume во время восстановления. Чтобы восстановить фактическое содержимое диска из резервной копии, сначала удалите DataVolume:

```bash
kubectl delete datavolume vm-disk-my-disk -n tenant-user
```

Затем RestoreJob пересоздаст его и загрузит данные диска из хранилища резервных копий.
{{% /alert %}}

```bash
kubectl get backups -n tenant-user
```

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: restore-my-disk
  namespace: tenant-user
spec:
  backupRef:
    name: my-disk-backup
```

Примените и проверьте:

```bash
kubectl apply -f restorejob-disk.yaml
kubectl get restorejobs -n tenant-user
kubectl describe restorejob restore-my-disk -n tenant-user
```

## Устранение неполадок

Если BackupJob или RestoreJob завершается в фазе `Failed`, проверьте поле `message` в его статусе:

```bash
kubectl get backupjob my-vm-backup -n tenant-user -o jsonpath='{.status.message}'
kubectl get restorejob restore-my-vm -n tenant-user -o jsonpath='{.status.message}'
```

Для получения деталей более низкого уровня проверьте логи Velero в управляющем кластере:

```bash
kubectl logs -n cozy-velero -l app.kubernetes.io/name=velero --tail=100
```

### Исправление доступа по SSH (несоответствие MAC-адреса cloud-init после восстановления)

{{% alert color="info" %}}
Контроллер восстановления автоматически пытается сохранить **OVN IP и MAC-адреса** ВМ на момент резервного копирования, патча восстановленный VirtualMachine исходными аннотациями. Если это не удаётся, вы можете вручную получить исходные IP/MAC из `Backup .status.underlyingResources` и назначить их.
{{% /alert %}}

После восстановления VMInstance гостевая ОС может потерять сетевое соединение. Известно, что это происходит на **Ubuntu Server**, где cloud-init генерирует конфигурацию netplan, привязанную к MAC-адресу старой ВМ. После восстановления ВМ получает новый виртуальный NIC с другим MAC-адресом, но в гостевой ОС всё ещё остаётся старая конфигурация netplan, привязанная к предыдущему MAC — поэтому сетевой интерфейс так и не настраивается. Другие операционные системы, которые не привязывают сетевую конфигурацию к конкретному MAC-адресу, могут не быть подвержены этой проблеме.

Чтобы это исправить, обновите поле `cloudInitSeed` в спецификации VMInstance и перезапустите ВМ. Изменение seed генерирует новый SMBIOS UUID, из-за чего cloud-init воспринимает ВМ как новый экземпляр и заново выполняет сетевую настройку с правильным MAC-адресом.

```bash
# Задайте новое значение cloudInitSeed (любая строка, отличная от текущей)
kubectl patch vminstance my-vm -n tenant-user --type merge \
  -p '{"spec":{"cloudInitSeed":"reseed1"}}'

# Дождитесь согласования (reconcile) VMInstance
kubectl wait vminstance/my-vm -n tenant-user --for=condition=Ready --timeout=180s

# Перезапустите ВМ, чтобы новый seed вступил в силу
virtctl restart vm-instance-my-vm -n tenant-user
```

После перезапуска убедитесь, что у ВМ есть сетевое соединение:

```bash
# Проверьте, что VMI запущен
kubectl get vmi -n tenant-user

# Проверьте доступ по SSH
virtctl ssh -i ~/.ssh/my-key -l ubuntu vmi/vm-instance-my-vm -n tenant-user -c "ip a"
```

{{% alert color="info" %}}
Если в будущем вам понадобится снова изменить seed (например, после очередного восстановления), используйте каждый раз другое значение (например, `reseed2`, `reseed3` и т. д.).
{{% /alert %}}
