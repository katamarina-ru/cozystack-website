---
title: "Резервное копирование и восстановление приложений"
linkTitle: "Резервное копирование и восстановление"
description: "Создавайте резервные копии managed databases (Postgres, MariaDB, ClickHouse, Etcd) и восстанавливайте их с помощью BackupJob, Plan и RestoreJob."
weight: 4
---

В этом руководстве для пользователей tenant описано резервное копирование и восстановление **managed databases**: Postgres, MariaDB, ClickHouse и Etcd. Вы узнаете, как выполнять разовое резервное копирование и резервное копирование по расписанию, проверять состояние, а также восстанавливать данные на месте или в отдельный целевой экземпляр.

{{% alert color="info" %}}
**Хранилище и `BackupClass` предоставляет платформа.** Cozystack поставляется с одним `BackupClass` уровня кластера `cozy-default`, который охватывает Postgres, MariaDB, ClickHouse, Etcd, VMInstance и VMDisk с помощью массива `strategies[]` для каждого Kind. Ссылайтесь на него по имени из `BackupJob` / `Plan` / `RestoreJob`: отдельный `BackupClass` для каждого приложения не создается, а учетные данные S3, endpoints и пути указывать не нужно. Платформа автоматически проецирует Secret с учетными данными (`cozy-backups-creds`) в namespace tenant непосредственно перед запуском каждого BackupJob или RestoreJob.

Если администратор создал дополнительные параллельные ресурсы `BackupClass` (с другим хранением, сроком хранения и т. п.), узнайте их имена и подставьте нужное вместо `cozy-default` в примерах ниже. `BackupClass` существует на уровне кластера, поэтому получить его список с помощью kubeconfig tenant нельзя; допустимые имена сообщит администратор.

Инструкции для администраторов приведены в руководстве [Backup Classes]({{% ref "/docs/v1.5/operations/services/backup-classes" %}}).
{{% /alert %}}

{{% alert color="warning" %}}
**Эти резервные копии содержат только данные.** Каждая стратегия создает снимок содержимого базы данных с помощью штатного механизма оператора (Barman в CloudNativePG, дампы mariadb-operator, Altinity `clickhouse-backup`). В резервную копию **не** входят пользовательский ресурс (CR) `apps.cozystack.io/*`, соответствующий `HelmRelease`, значения чарта и ресурсы Secret, которыми управляет оператор.

Для восстановления необходимо выполнить одно из следующих действий:
- оставить исходное приложение работающим и выполнить восстановление на месте (каждый драйвер повторно загружает данные в существующий кластер под управлением оператора), **либо**
- заранее подготовить пустое целевое приложение того же Kind и восстановить в него данные.

Сведения о резервных копиях, включающих Helm-релиз приложения, CR и снимки PVC (для VMInstance / VMDisk), см. в разделе [Резервное копирование и восстановление (ВМ)]({{% ref "/docs/v1.5/virtualization/backup-and-recovery" %}}).
{{% /alert %}}

## Предварительные требования

- Имя `BackupClass`. В стандартной установке это `cozy-default`, который охватывает `Postgres`, `MariaDB`, `ClickHouse` и `Etcd`. Если администратор создал параллельный класс, замените это имя во всех последующих примерах.
- Существующий экземпляр managed-DB application (`Postgres`, `MariaDB`, `ClickHouse` или `Etcd`) в namespace вашего tenant.
- `kubectl` и kubeconfig tenant с ролью `tenant-<ns>-admin`.

В приведенных ниже примерах используется namespace tenant с именем `tenant-user`; подставьте имя namespace своего tenant.

## Резервное копирование

### Разовое резервное копирование

Используйте `BackupJob` для разового резервного копирования (например, перед рискованным изменением):

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: my-postgres-adhoc
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: Postgres
    name: my-postgres
  backupClassName: cozy-default
```

```bash
kubectl apply -f backupjob.yaml
kubectl -n tenant-user get backupjobs
kubectl -n tenant-user describe backupjob my-postgres-adhoc
```

Когда `BackupJob` достигает состояния `phase: Succeeded`, драйвер создает объект `Backup` с тем же именем. При восстановлении необходимо ссылаться именно на это имя.

Для других драйверов замените `Postgres` на `MariaDB`, `ClickHouse` или `Etcd`. `BackupClass` (`cozy-default`) остается тем же: поставляемый платформой класс связывает стратегию с каждым поддерживаемым Kind.

### Резервное копирование по расписанию

Используйте `Plan` для регулярного резервного копирования по расписанию в формате cron:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: Plan
metadata:
  name: my-postgres-daily
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: Postgres
    name: my-postgres
  backupClassName: cozy-default
  schedule:
    type: cron
    cron: "0 */6 * * *"   # каждые 6 часов
```

При каждом запуске по расписанию создается `BackupJob` (и при успешном завершении `Backup`) с именем, состоящим из имени `Plan` и суффикса временной метки.

```bash
kubectl apply -f plan.yaml
kubectl -n tenant-user get plans
kubectl -n tenant-user get backupjobs -l backups.cozystack.io/plan=my-postgres-daily
```

## Проверка состояния резервной копии

Получите список ресурсов `BackupJob` и `Backup` в namespace:

```bash
kubectl -n tenant-user get backupjobs
kubectl -n tenant-user get backups
```

Проверьте сведения о запуске, завершившемся с ошибкой:

```bash
kubectl -n tenant-user get backupjob my-postgres-adhoc -o jsonpath='{.status.message}'
kubectl -n tenant-user describe backupjob my-postgres-adhoc
kubectl -n tenant-user get events --field-selector involvedObject.name=my-postgres-adhoc
```

Если `status.message` не позволяет точно определить причину сбоя, сообщите администратору имя `BackupJob`. Администратор проверит созданный драйвером CR оператора (см. раздел [Backup Classes]({{% ref "/docs/v1.5/operations/services/backup-classes" %}}) в руководстве для администраторов).

## Восстановление на месте

При **восстановлении на месте** данные из резервной копии загружаются в **то же** приложение. Используйте этот вариант, чтобы устранить последствия случайного удаления или повреждения данных в рабочей базе данных, которую вы планируете продолжать использовать под тем же именем.

{{% alert color="warning" %}}
Восстановление на месте является **разрушительной** операцией. Каждый драйвер очищает или заменяет существующие данные в исходном приложении; все данные, записанные после момента создания резервной копии, будут потеряны. Если потеря последних записей недопустима, используйте вместо этого [восстановление в копию](#восстановление-в-копию).
{{% /alert %}}

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: my-postgres-restore-inplace
  namespace: tenant-user
spec:
  backupRef:
    name: my-postgres-adhoc
  # targetApplicationRef не указан: драйвер восстанавливает данные в приложение из Backup.spec.applicationRef.
  # options:
  #   recoveryTime: "2026-05-01T12:00:00Z"   # только для Postgres; PITR в формате RFC3339
```

```bash
kubectl apply -f restorejob.yaml
kubectl -n tenant-user get restorejobs
kubectl -n tenant-user describe restorejob my-postgres-restore-inplace
```

### Особенности отдельных драйверов

- **Postgres (CNPG):** драйвер удаляет рабочий `cnpg.io/Cluster` и его PVC, затем повторно загружает данные из архива Barman. На время операции подключения прерываются. Для восстановления на определенный момент времени укажите `spec.options.recoveryTime` в формате RFC3339; не указывайте это поле, чтобы восстановить данные до последнего доступного состояния по WAL.
- **MariaDB:** оператор загружает логический дамп в рабочий экземпляр `MariaDB` с помощью `mariadb-import`. Если таблицы уже существуют, возникнет конфликт; если дамп не содержит `DROP TABLE`, предварительно очистите соответствующие схемы.
- **ClickHouse:** стратегия Altinity **не** передает `clickhouse-backup --rm`. Перед созданием `RestoreJob` удалите конфликтующие таблицы в исходном приложении, иначе операция завершится ошибкой из-за дублирующейся таблицы.

## Восстановление в копию

При **восстановлении в копию** данные из резервной копии загружаются в **другое**, только что подготовленное приложение того же Kind. Используйте этот вариант для тренировок по аварийному восстановлению, параллельной проверки, создания баз данных для отдельных веток разработки или миграции на новую версию оператора из upstream-проекта.

Сначала подготовьте пустое целевое приложение того же Kind. Например, пустой экземпляр `Postgres`:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Postgres
metadata:
  name: my-postgres-restored
  namespace: tenant-user
spec:
  # ...та же структура, что и у источника; данные начальной загрузки не требуются...
```

Дождитесь перехода целевого приложения в состояние Ready, затем создайте `RestoreJob` со ссылкой на него:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: my-postgres-restore-to-copy
  namespace: tenant-user
spec:
  backupRef:
    name: my-postgres-adhoc
  targetApplicationRef:
    apiGroup: apps.cozystack.io
    kind: Postgres
    name: my-postgres-restored
```

Исходное приложение останется без изменений. Восстановление между namespaces **не** поддерживается: `targetApplicationRef` является локальной ссылкой, поэтому целевое приложение должно находиться в том же namespace, что и `RestoreJob`.

## Ограничения и жизненный цикл

- **Только данные.** CR приложений, ресурсы HelmRelease, значения чартов и управляемые оператором ресурсы Secret (например, Secret суперпользователя `cnpg.io` и пользователи `clickhouse-installation`) не включаются в резервную копию. Перед восстановлением в копию заранее подготовьте целевое приложение.
- **За хранение архивов отвечает драйвер.** При удалении CR `Backup` из Cozystack удаляется ссылка на артефакт, но сам объект S3 сохраняется. Каждый драйвер применяет собственную политику хранения:
  - CNPG: параметр `retentionPolicy` в стратегии (настраивается администратором; в примере для администраторов значение по умолчанию равно `30d`).
  - MariaDB: параметр `cleanupStrategy` в CR `Backup` на стороне оператора или ротация на уровне бакета (настраивается администратором).
  - ClickHouse: срок хранения определяется конфигурацией sidecar-контейнера внутри пода. Чтобы удалить архив до истечения срока хранения, обратитесь к администратору: запрос отправляется к HTTP API `clickhouse-backup` в sidecar-контейнере.
- **ClickHouse зависит от встроенного в чарт sidecar-контейнера.** Стратегия Altinity представляет собой тонкий HTTP-клиент; само резервное копирование выполняется внутри каждого пода `chi-*` с помощью `clickhouse-backup`. Отключение `backup.enabled` в приложении также отключает механизм резервного копирования через BackupClass.

## Устранение неполадок

Если `BackupJob` или `RestoreJob` переходит в состояние `phase: Failed`, сначала проверьте сведения, доступные в вашем namespace:

```bash
kubectl -n tenant-user get backupjob my-postgres-adhoc -o jsonpath='{.status.message}'
kubectl -n tenant-user get restorejob my-postgres-restore-inplace -o jsonpath='{.status.message}'
kubectl -n tenant-user describe backupjob my-postgres-adhoc
kubectl -n tenant-user get events --field-selector involvedObject.name=my-postgres-adhoc
```

Если это не помогает определить причину сбоя, для дальнейшей диагностики необходимо проверить созданный драйвером CR оператора (`cnpg.io/Backup`, `k8s.mariadb.com/Backup`, `etcd.aenix.io/EtcdBackup`) или журналы `Pod` стратегии ClickHouse. Эти ресурсы и журналы недоступны через kubeconfig tenant; сообщите администратору имя `BackupJob`, чтобы он выполнил действия из раздела [Backup Classes]({{% ref "/docs/v1.5/operations/services/backup-classes" %}}).

## См. также

- [Backup Classes]({{% ref "/docs/v1.5/operations/services/backup-classes" %}}): сведения о том, как администраторы определяют стратегии и ресурсы `BackupClass` для баз данных и ВМ.
- [Резервное копирование и восстановление (ВМ)]({{% ref "/docs/v1.5/virtualization/backup-and-recovery" %}}): аналогичное руководство по резервному копированию VMInstance / VMDisk (HelmRelease + CR + снимки PVC).
