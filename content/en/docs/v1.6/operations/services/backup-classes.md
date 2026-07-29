---
title: "Backup классы"
linkTitle: "Backup классы"
description: "Управляемый платформой BackupClass с именем cozy-default: что он покрывает, как арендаторы на него ссылаются, и пути административного переопределения."
weight: 31
aliases:
  - /docs/v1.6/operations/services/managed-app-backup-configuration
  - /docs/v1.6/operations/services/velero-backup-configuration
---

Cozystack поставляет единый управляемый платформой `BackupClass` с именем `cozy-default`. Он автоматически создаётся при установке пакета `backupstrategy-controller` и ссылается на управляемый системой бакет, предоставленный через CR `apps.cozystack.io/Bucket` с именем `cozy-backups` в пространстве имён `tenant-root` (реальное имя S3-бакета — это имя, назначенное COSI, из `BucketClaim.status.bucketName`).

Арендаторы ссылаются на `cozy-default` из ресурсов `BackupJob`, `Plan` и `RestoreJob` — они **не** предоставляют учётные данные S3, эндпоинты или пути. Платформа проецирует управляемый системой Secret с учётными данными в пространство имён арендатора для каждого BackupJob (или, для долгоживущих ссылок, таких как `BackupStorageLocation` у Velero, в фиксированный список системных пространств имён по периодическому таймеру), а стандартные шаблоны стратегий кодируют `<namespace>/<application>` в каждый S3-путь, поэтому два арендатора с одинаковым именем приложения никогда не конфликтуют.

## Поддерживаемые приложения

### Привязанные к `cozy-default` (работают "из коробки")

| Тип приложения (Application Kind) | Драйвер                              | Strategy CR                                                                |
|----------------------------------|--------------------------------------|----------------------------------------------------------------------------|
| `apps.cozystack.io/Postgres`     | CloudNativePG (barman)               | `strategy.backups.cozystack.io/CNPG` `cozy-default-cnpg`                   |
| `apps.cozystack.io/MariaDB`      | mariadb-operator dump                | `strategy.backups.cozystack.io/MariaDB` `cozy-default-mariadb`             |
| `apps.cozystack.io/ClickHouse`   | Altinity `clickhouse-backup` sidecar | `strategy.backups.cozystack.io/Altinity` `cozy-default-altinity`           |
| `apps.cozystack.io/Etcd`         | etcd-operator snapshot               | `strategy.backups.cozystack.io/Etcd` `cozy-default-etcd`                   |
| `apps.cozystack.io/VMInstance`   | Velero + kubevirt-velero-plugin      | `strategy.backups.cozystack.io/Velero` `cozy-default-velero-vminstance`    |
| `apps.cozystack.io/VMDisk`       | Velero                               | `strategy.backups.cozystack.io/Velero` `cozy-default-velero-vmdisk`        |

### Поставляются, но НЕ привязаны (требуется опт-ин администратора)

| Тип приложения (Application Kind) | Драйвер                              | Strategy CR                                                                |
|----------------------------------|--------------------------------------|----------------------------------------------------------------------------|
| `apps.cozystack.io/FoundationDB` | FoundationDB operator backup_agent   | `strategy.backups.cozystack.io/FoundationDB` `cozy-default-foundationdb`   |

Strategy CR для FoundationDB рендерится чартом, чтобы администраторы могли ссылаться на него из собственного BackupClass после того, как обвязка на стороне оператора (монтирование `cozy-backups-creds` в Deployment `cozy-foundationdb-operator`) будет настроена вручную. См. [оговорку по FoundationDB](#foundationdb-caveat) ниже.

### Формат эндпоинта для каждого драйвера

Разные операторы ожидают разные форматы эндпоинтов; шаблоны стратегий, рендерящиеся `backupstrategy-controller`, определяют единый S3-эндпоинт (через хелпер `backupstrategy-controller.endpoint`) и адаптируют его под контракт каждого потребителя. Для предоставленного бакета (`provisionBucket: true`, значение по умолчанию) эндпоинт **вычисляется из Secret с системными учётными данными бакета COSI** (`backupStorage.systemSecretName`) и принудительно переводится в `https://` — это внешний S3-ингресс с ACME-сертификатом, единственный эндпоинт, который операторы бэкапа могут верифицировать. Внутрикластерный S3 у SeaweedFS обслуживает TLS на порту `:8333` за самоподписанным "SeaweedFS CA", а схема S3 у Etcd Strategy не имеет поля `caCert`, поэтому внутрикластерный эндпоинт нельзя использовать напрямую. Значение чарта `backupStorage.endpoint` (полный URL, например `http://seaweedfs-s3.tenant-root.svc:8333`) — это **резервный вариант**, используемый для внешнего S3 (`provisionBucket: false`) и для оффлайн-рендеров `helm template`/пре-reconcile, когда поиск Secret не дал результата. Вычисленный эндпоинт адаптируется для каждого потребителя:

| Драйвер | Поле шаблона стратегии | Форма |
|--------|-------------------------|------|
| CNPG (Postgres) | `barmanObjectStore.endpointURL` | полный URL (схема сохраняется) |
| Etcd            | `destination.s3.endpoint`       | полный URL (схема сохраняется) |
| MariaDB         | `storage.s3.endpoint`           | голый host:port (схема убирается); `tls.enabled` выводится из схемы |
| FoundationDB    | `blobStoreConfiguration.accountName` + `urlParameters.secure_connection` | голый host:port + выведенный флаг secure |
| Velero          | `BackupStorageLocation.spec.config.s3Url` | полный URL (схема сохраняется) |
| ClickHouse sidecar | переменная `S3_ENDPOINT` | голый host:port (из проецированного Secret) |

Ключ `cozy-backups-creds.endpoint` в проецированном Secret **очищен от схемы**, поэтому сайдкары, создаваемые чартом (ClickHouse), используют его напрямую. Драйверы, которым нужен полный URL, получают вычисленный эндпоинт, описанный выше — выведенный из системного Secret COSI (принудительно `https://`) для предоставленного бакета, либо резервное значение `backupStorage.endpoint` для внешнего S3.

VM-ориентированные бэкапы (Velero) попадают в тот же бакет `cozy-backups` под префиксом `velero/`. `BackupStorageLocation` с именем `cozy-default` поставляется чартом `backupstrategy-controller` (`packages/system/backupstrategy-controller/templates/velero-bsl.yaml`), поэтому эндпоинт/бакет/регион берутся из того же блока значений `backupStorage`, который используется Strategy CR и проектором.

### Оговорка по FoundationDB

Strategy CR `cozy-default-foundationdb` поставляется, но **пока не** привязан к `cozy-default`. Восстановление запускает `fdbrestore` внутри Deployment `cozy-foundationdb-operator`, который пока не монтирует `cozy-backups-creds`. До тех пор, пока Deployment оператора не будет обновлён для монтирования проецированного Secret, стандартное для платформы восстановление FDB будет молча завершаться неудачей — администраторам, которым это нужно уже сейчас, следует использовать отдельный `Bucket` для приложения плюс собственный `BackupClass`, либо самостоятельно подключить файл с учётными данными в Deployment оператора.

**Ловушка при очистке (зомби backup_agent).** В отличие от CNPG/MariaDB/Altinity (одноразовые Backup CR на стороне оператора), драйвер FoundationDB создаёт CR `apps.foundationdb.org/FoundationDBBackup`, который управляет **долгоживущим** Deployment `backup_agent`, непрерывно передающим данные в S3. Удаление Backup Cozystack (например, при зачистке по retention) НЕ останавливает этот Deployment — агент продолжает писать данные до тех пор, пока вызов `stopOtherFoundationDBBackups` следующего BackupJob не заменит его, пока администратор не вызовет `examples/backups/foundationdb/cleanup.sh`, либо пока CR на стороне оператора не будет удалён вручную. Если арендатор удаляет свой последний Backup Cozystack и больше не отправляет BackupJob, поды агента будут работать бесконечно и накапливать PUT-запросы в S3. Сегодня это ожидаемое поведение (у драйвера нет RBAC-права остановить CR на стороне оператора при удалении Cozystack-Backup), но администраторам следует об этом знать.

## ClickHouse: опт-ин на системный бакет

Сайдкар `clickhouse-backup` работает внутри самого Pod'а ClickHouse, поэтому именно Helm-чарт настраивает его учётные данные S3. Существующие арендаторы на устаревших значениях `backup.s3*` продолжают работать без изменений. Чтобы переключить релиз на платформенный бакет, установите:

```yaml
backup:
  enabled: true
  useSystemBucket: true
```

Когда установлено `useSystemBucket: true`:

- Secret `<release>-backup-s3`, создаваемый чартом, больше не рендерится.
- Сайдкар использует `cozy-backups-creds` (проецируемый платформой).
- `S3_PATH` устанавливается в `<namespace>/<release>`, поэтому два арендатора с одинаковым именем релиза ClickHouse никогда не делят один префикс.

Значения `s3Region`, `s3Bucket`, `endpoint`, `s3AccessKey`, `s3SecretKey` и `s3CredentialsSecret` в этом режиме игнорируются.

## Проверка значений по умолчанию

```bash
kubectl get backupclasses
kubectl get backupclass cozy-default -o yaml
kubectl -n tenant-root get bucket cozy-backups
kubectl -n tenant-root get secret bucket-cozy-backups-system-credentials
kubectl -n cozy-velero get backupstoragelocation cozy-default
```

Бакет находится в `tenant-root` и создаётся через CR `apps.cozystack.io/Bucket`. Управляемый системой Secret с учётными данными никогда не покидает это пространство имён. Backupstrategy-controller проецирует его копию под именем `cozy-backups-creds` в пространство имён арендатора непосредственно перед запуском каждого BackupJob или RestoreJob, а также обновляет тот же Secret в `cozy-velero` (и в любом другом пространстве имён из списка `backupStorage.systemNamespaces`) по таймеру раз в минуту. Проецированный Secret содержит несколько форматов ключей, чтобы каждый драйвер находил нужное в одном месте:

| Ключ                                           | Потребитель                                  |
|-----------------------------------------------|-------------------------------------------|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | CNPG, MariaDB, Etcd                       |
| `accessKey` / `secretKey` (плюс `bucketName`, `endpoint`, `region`) | Сайдкар ClickHouse  |
| `cloud`                                       | Velero (формат файла учётных данных AWS)      |
| `blob_credentials.json`                       | FoundationDB backup_agent                 |

### Окно загрузки (bootstrap)

При установке на чистый кластер `BackupStorageLocation` `cozy-default` у Velero рендерится до того, как у проектора учётных данных появляется возможность скопировать `cozy-backups-creds` в `cozy-velero`. BSL сообщает статус `Unavailable`, пока не завершится первый синхронный проход проектора (который запускается, как только `backupstrategy-controller` получает лидерство — на практике через считанные моменты после того, как Pod становится Ready, обычно через десятки секунд после завершения `helm install`, а не минут). Velero отклоняет новые запросы `Backup` И `Restore` для `storageLocation: cozy-default` в течение этого окна. Планируйте автоматизацию бэкапа VM соответствующим образом, либо дождитесь готовности BSL перед отправкой бэкапов: `kubectl -n cozy-velero wait backupstoragelocation cozy-default --for=jsonpath='{.status.phase}'=Available --timeout=5m`.

**Заметка о перезапусках контроллера.** BSL "мигает" статусом `Unavailable` при каждом перезапуске пода `backupstrategy-controller`, пока проектор повторяет свой первый синхронный проход. Окно короткое (единицы секунд), но операторы, которые настраивают алерты на доступность BSL, должны подавлять алерты во время событий `kube_pod_container_status_restarts_total{container=backupstrategy-controller}` контроллера или использовать более длинное окно оценки, чем такт проектора (60с).

### Загрузка бакета cozy-default

`cozy-default` поставляет CR `apps.cozystack.io/Bucket cozy-backups` в `tenant-root`, который чарт приложения bucket превращает в `BucketClaim`; затем драйвер COSI назначает реальное имя S3-бакета и записывает его в `.status.bucketName` BucketClaim. Шаблоны стратегий и Velero BSL считывают это реальное имя бакета (через Helm `lookup` к BucketClaim). При свежей установке заполнение статуса BucketClaim занимает небольшой цикл reconcile — до тех пор шаблоны стратегий рендерятся пустыми, и в кластере присутствуют только CR `Bucket` и `BackupClass`. HelmRelease повторно выполняет reconcile по своему интервалу (по умолчанию 5 минут — задаётся флагом `helmrelease-interval` оператора cozystack, а не значением по умолчанию Flux), после чего заполненный статус BucketClaim приводит к появлению отсутствовавших шаблонов стратегий.

Если вам нужен работающий BackupClass немедленно (например, для e2e-теста), запустите reconcile Flux (`flux reconcile helmrelease backupstrategy-controller -n cozy-backup-controller`), как только увидите непустое значение `kubectl get bucketclaim -n tenant-root bucket-cozy-backups -o jsonpath='{.status.bucketName}'`.

### Наблюдаемость (Observability)

Проектор учётных данных выдаёт два счётчика Prometheus с метками по `namespace` (и `reason` для сбоев):

- `cozystack_backup_credentials_projection_successes_total`
- `cozystack_backup_credentials_projection_failures_total`

Настройте алерт на `rate(cozystack_backup_credentials_projection_failures_total[5m]) > 0` или `absent_over_time(cozystack_backup_credentials_projection_successes_total[10m])`, чтобы отслеживать устаревшие учётные данные BSL или некорректный исходный Secret без разбора логов.

## Административные переопределения для `cozy-default`

`cozy-default` рендерится чартом `backupstrategy-controller` и принадлежит helm-controller'у Flux. **Прямое `kubectl edit backupclass cozy-default` будет перезаписано при следующем helm reconcile** — то же самое относится к сопутствующим CR `strategy.backups.cozystack.io/*` (`cozy-default-cnpg`, `cozy-default-etcd`, `cozy-default-mariadb`, `cozy-default-altinity`, `cozy-default-foundationdb`, два `cozy-default-velero-*`). Поддерживаемый путь переопределения — блок `backupStorage` на **компоненте `platform`** CR Package `cozystack.cozystack-platform`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  components:
    platform:
      values:
        backupStorage:
          provisionBucket: true                    # по умолчанию; установите false для внешнего S3
          bucketName: cozy-backups                  # имя релиза apps.cozystack.io/Bucket
          endpoint: http://seaweedfs-s3.tenant-root.svc.cozy.local:8333
          region: us-east-1
          forcePathStyle: true
          systemSecretName: bucket-cozy-backups-system-credentials
          systemNamespaces:
            - cozy-velero
```

Чарт платформы передаёт этот блок в дочерний `Package cozystack.backupstrategy-controller` как значения компонента, откуда оператор cozystack сливает их в HelmRelease `backupstrategy-controller` поверх значений чарта по умолчанию. Два пути, которые выглядят правдоподобными, **не** работают: `spec.components.backupstrategy-controller` в `cozystack.cozystack-platform` Package молча игнорируется (единственный компонент под этим PackageSource — `platform`), а патч дочернего `Package cozystack.backupstrategy-controller` напрямую откатывается при каждом повторном рендере platform helm-reconcile.

| Параметр | Эффект |
|---|---|
| `provisionBucket` | Включает/выключает создание внутрикластерного CR `apps.cozystack.io/Bucket`. Установите `false` для внешнего S3 (см. [Отключение управляемого платформой бакета](#disabling-the-platform-managed-bucket)). |
| `bucketName` | Два режима. С `provisionBucket: true` (по умолчанию): имя K8s-объекта Bucket CR + ключ поиска для COSI BucketClaim — фактическое имя S3-бакета — это UUID, назначенный COSI, отражённый в `BucketClaim.status.bucketName`. С `provisionBucket: false`: берётся **буквально как реальное имя S3-бакета** и встраивается во все Strategy CR + Velero BSL. |
| `namespace` | Пространство имён, в котором находится Bucket CR (и его Secret с системными учётными данными) — по умолчанию `tenant-root`. Должно быть пространством имён арендатора (`tenant-*`): вспомогательный RBAC-хелпер чарта Bucket завершает Helm-рендер ошибкой для любого другого префикса. |
| `bucketNameOverride` | Лаз для оффлайн-рендеров `helm template` — обходит поиск BucketClaim в живом кластере. В продакшене оставьте пустым. |
| `endpoint` | **Резервный** эндпоинт S3. Для предоставленного бакета Strategy CR + Velero BSL вместо этого вычисляют эндпоинт из системного Secret COSI (внешний ингресс ACME, принудительно `https://`); это значение используется только для внешнего S3 (`provisionBucket: false`) и оффлайн-рендеров. Для внешнего S3 переключение на `https://` включает TLS в стратегиях MariaDB/FoundationDB — убедитесь, что бандл CA доступен соответствующим Pod'ам оператора/драйвера. |
| `region` | Повторно проецируется в `cozy-backups-creds` при следующем reconcile. Требуется перезапуск Pod'а для клиентов, создаваемых чартом, которые используют регион через переменную окружения (сайдкар ClickHouse сегодня). |
| `forcePathStyle` | Адресация в стиле пути (path-style); требуется для SeaweedFS S3, обычно не требуется для AWS S3. |
| `systemSecretName` | Имя удобочитаемого Secret'а, создаваемого приложением Bucket (либо созданного вручную заранее для внешнего S3). Проектор также принимает "сырой" формат Secret'а COSI. |
| `systemNamespaces` | Пространства имён, в которые контроллер заранее проецирует `cozy-backups-creds` (Velero BSL, оператор FDB). Арендаторы проецируются "лениво" во время reconcile BackupJob. |

Когда переопределение нужно выйти за рамки координат хранилища — другой retention, другая привязка драйвер→Kind, разделение по нескольким регионам — создайте **соседний BackupClass** с уникальным именем (любым, кроме `cozy-default`). Соседние BackupClass существуют вне чарта, принадлежат администратору, и Flux их не трогает. Арендаторы подключаются, устанавливая `backupClassName: <ваш-класс>` в своих `BackupJob`.

## Настройка через собственный BackupClass

Значения по умолчанию рассчитаны на разумную середину (30-дневное хранение, gzip-сжатие там, где применимо). Чтобы переопределить их для конкретного арендатора или нагрузки, создайте собственный `BackupClass`, ссылающийся на те же Strategy CR, но с изменёнными `parameters`, либо новый Strategy CR. Распространённые настройки:

- **Стратегия CNPG**: `barmanObjectStore.retentionPolicy`, `data.compression`, `wal.compression`.
- **Стратегия MariaDB**: `compression`, `maxRetention`, `databases[]`.
- **Стратегия Altinity**: настраивайте сайдкар `clickhouse-backup` через значения `backup.*` в релизе ClickHouse; Pod стратегии — это тонкий HTTP-клиент.
- **Стратегия FoundationDB**: `snapshotPeriodSeconds`, `agentCount`, `urlParameters[]`.
- **Стратегия Velero (VMInstance / VMDisk)**: `ttl`, `includedResources[]`, `excludedResources[]`.
- **Стратегия Etcd**: сегодня стратегия задаёт только путь; сочетайте с `Plan.spec.retentionPolicy` для частоты подрезки.

Управляемый системой Secret с учётными данными — **единственный** способ для внутрикластерных стратегий добраться до `cozy-backups`. Не встраивайте ключи доступа в `BackupClass.parameters` — модель безопасности опирается на ссылки на Secret, а `parameters` попадают в `Backup.status.underlyingResources`, который могут читать арендаторы.

## Отключение управляемого платформой бакета

Если развёртывание работает с внешним S3 (без SeaweedFS), установите `backupStorage.provisionBucket: false` через тот же путь Package платформы, что и выше (`spec.components.platform.values.backupStorage`), и создайте исходный Secret с учётными данными в `tenant-root` вручную (плоский формат ключей: `accessKey` / `secretKey` / `endpoint` / `bucketName`; либо "сырой" JSON `BucketInfo` от COSI). В том же блоке `backupStorage` обновите `endpoint`, `region` **и `bucketName`**: при `provisionBucket: false` стратегии и Velero BSL берут `bucketName` буквально как реальное имя S3-бакета (без поиска через COSI), поэтому оно должно называть реальный бакет во внешнем S3 — одного ключа `bucketName` внутри Secret'а недостаточно. `BackupStorageLocation` у Velero подхватывает те же значения автоматически (чарт рендерит его из того же блока `backupStorage`), поэтому отдельная настройка BSL не требуется. Обратите внимание, что отключение самого кластерного BSL по умолчанию (значение чарта `velero.bslEnabled`) **не** переносится через путь переопределения `backupStorage` — Package платформы передаёт только блок `backupStorage`.

## Заметки об обновлении с бэкапов, управляемых чартом

> **`backup.enabled: true` у Postgres с плейсхолдерными учётными данными больше не рендерит `barmanObjectStore` при обновлении.**
>
> Значения по умолчанию для `backup.s3AccessKey` / `backup.s3SecretKey` в `packages/apps/postgres/values.yaml` до v1.5 были буквальными плейсхолдерами `"<your-access-key>"` / `"<your-secret-key>"`, поэтому чарт Postgres всё же рендерил `spec.backup.barmanObjectStore` на `cnpg.io/Cluster` (с мусорными учётными данными, `archive_command` завершался с ошибкой во время выполнения). Начиная с v1.5 эти значения по умолчанию — пустые строки, и чарт БОЛЬШЕ НЕ рендерит блок backup вовсе, если плейсхолдеры не изменены. Арендаторы на устаревшем потоке управления бэкапами через чарт, которые полагались на эти плейсхолдеры, увидят, что их `barmanObjectStore` исчезнет из живого `Cluster` при `helm upgrade`. Действие — выберите один вариант:
>
> - **Перейти на платформенный поток (рекомендуется).** Установите `backup.useSystemBucket: true`; чарт оставляет `barmanObjectStore` неустановленным, и драйвер бэкапа CNPG применяет SSA-патч к живому `Cluster` при первом запуске BackupJob. Ключи на стороне арендатора не требуются.
> - **Остаться на устаревшем потоке управления бэкапами через чарт.** Укажите реальные `backup.s3AccessKey` / `backup.s3SecretKey` (или уже существующий `backup.s3CredentialsSecret.name`); чарт рендерит `barmanObjectStore` точно так же, как и раньше.
>
> Тот же опт-ин `useSystemBucket` применяется к ClickHouse — см. [ClickHouse: опт-ин на системный бакет](#clickhouse-опт-ин-на-системный-бакет). Когда для ClickHouse установлено `useSystemBucket: true`, устаревший CronJob `<release>-backup`, Secret с учётными данными и скрипт бэкапа больше не рендерятся (они взаимоисключающие с платформенным потоком); перенесите запланированные бэкапы на `backups.cozystack.io/Plan`, ссылающийся на `cozy-default`.

## Рабочий процесс арендатора

Арендаторы видят только имя BackupClass. Типичное применение:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: ad-hoc
  namespace: tenant-acme
spec:
  backupClassName: cozy-default
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: Postgres
    name: orders-db
```

## Восстановление на момент времени (PostgreSQL)

`RestoreJob` восстанавливает приложение `Postgres` из `Backup`. Опустите `spec.options.recoveryTime`, чтобы восстановить до последней точки в архиве WAL; установите его (в формате RFC3339), чтобы восстановить базу данных на точный момент времени — восстановление на момент времени (point-in-time recovery, PITR). Под капотом плагин barman-cloud CNPG восстанавливает самый новый базовый бэкап, сделанный в/до этого момента, и воспроизводит архивные WAL-записи до него, так что восстановленный кластер отражает базу данных именно на момент `recoveryTime`; более поздние записи отсутствуют.

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: orders-db-pitr
  namespace: tenant-acme
spec:
  backupRef:
    name: orders-db-adhoc            # завершённый Backup исходного приложения
  targetApplicationRef:              # опустите для деструктивного восстановления "на месте"
    apiGroup: apps.cozystack.io
    kind: Postgres
    name: orders-db-copy             # заранее развёрнутое, пустое приложение Postgres
  options:
    recoveryTime: "2026-07-21T09:30:00Z"
```

Полный, скриптованный пример (запись метки, фиксация временной метки, восстановление на неё, проверка того, что сохранилось) находится в монорепозитории по адресу [`examples/backups/postgres/`](https://github.com/cozystack/cozystack/tree/main/examples/backups/postgres) — `45-restorejob-pitr.yaml`, запускается через `run-all.sh`.

### Восстанавливаемое окно

`recoveryTime` должен попадать в окно, которое может восстановить архив:

- **Самая ранняя точка** — момент завершения самого старого базового бэкапа, всё ещё находящегося в архиве. Нельзя восстановиться на момент до первого базового бэкапа: воспроизведение WAL всегда начинается с базового бэкапа, а retention (`barmanObjectStore.retentionPolicy`) со временем подрезает самые старые бэкапы вместе с WAL, который им предшествует.
- **Самая поздняя точка** — временная метка самого недавнего WAL-сегмента, отправленного в объектное хранилище. Пока исходное приложение работает с `backup.enabled: true`, оно непрерывно архивирует данные, поэтому самое позднее восстанавливаемое время отстаёт от "сейчас" лишь на задержку архивации (секунды для здорового кластера). После удаления исходного приложения самое позднее восстанавливаемое время фиксируется на том, какой WAL успел попасть в S3 до его удаления.

`recoveryTime`, находящийся **позже самого последнего заархивированного WAL, не может сойтись**: PostgreSQL воспроизводит все доступные WAL, никогда не достигает цели, завершается с `FATAL: recovery ended before configured recovery target was reached`, и CNPG пересоздаёт экземпляр восстановления в цикле. Такое "застрявшее" восстановление завершается по истечении дедлайна восстановления (`spec.options.restoreTimeoutSeconds`, по умолчанию 30 минут) — и драйвер считывает лог pod'а восстановления в этот момент, поэтому вместо обычного таймаута RestoreJob завершается со `status.phase: Failed` с условиями `RecoveryConverged=False` и `Ready=False`, причина у обоих — `RecoveryTargetUnreachable`, и сообщение называет цель. Драйвер намеренно **не** завершается с ошибкой раньше при появлении этого FATAL: *достижимая* цель, близкая к "сейчас", временно вызывает идентичный FATAL — часто повторно, при медленном архиваторе — прежде чем сойтись, поэтому более раннее срабатывание отклонило бы восстановимое восстановление. Чтобы быстро отклонить недостижимую цель, установите короткий `restoreTimeoutSeconds`; в противном случае расширьте окно (сделайте свежий бэкап или восстановитесь ближе к текущему моменту) либо выберите время внутри окна.

Восстановление на **очень недавний** момент безопасно, если архивация WAL актуальна: сегмент, покрывающий цель, может ещё не быть в объектном хранилище, и тот же FATAL временно срабатывает, но поскольку драйвер завершается с ошибкой только по дедлайну (а не при этом FATAL), у восстановления есть всё окно, чтобы догнать — следующая попытка продвигается вперёд, как только WAL отправляется, и кластер становится здоровым, что завершает восстановление. Только цель, которая никогда не становится достижимой в пределах дедлайна, приводит к ошибке. Если архивация сильно отстаёт (застопорившийся `archive_command`, перегруженный кластер), цель, близкая к "сейчас", может превысить даже стандартное окно 30 минут; восстанавливайтесь на момент, который вы можете подтвердить как заархивированный (например, на момент/до самого последнего завершённого бэкапа, согласно запросу для обнаружения ниже).

`recoveryTime` **раньше самого раннего базового бэкапа** приводит к ошибке иначе: PostgreSQL не может начать воспроизведение раньше базового бэкапа, из которого он восстанавливался, поэтому восстановление никогда не достигает согласованного состояния и никогда не выдаёт FATAL "recovery ended before …", по которому драйвер классифицирует ошибки. Этот случай также проявляется по дедлайну, но с общей причиной `RestoreFailed`, а не `RecoveryTargetUnreachable`. Выбор `recoveryTime` на момент/после завершения самого старого базового бэкапа (см. ниже) избегает этой ситуации.

### Определение самого раннего / самого позднего восстанавливаемого времени

`Cluster.status.firstRecoverabilityPoint` у CNPG существует в схеме статуса, но не заполняется надёжно под плагином barman-cloud, поэтому читайте окно из каталога бэкапов. Каждый завершённый базовый бэкап записывает свой диапазон WAL и временные метки на соответствующем `cnpg.io/Backup`:

```bash
# Завершённые базовые бэкапы, сначала самые старые: STOP — это самый ранний момент,
# на который может восстановить сам этот бэкап; самый старый STOP — нижняя граница окна.
kubectl -n <ns> get backups.postgresql.cnpg.io \
  --sort-by=.status.stoppedAt \
  -o custom-columns=NAME:.metadata.name,PHASE:.status.phase,START:.status.startedAt,STOP:.status.stoppedAt,BEGINWAL:.status.beginWal,ENDWAL:.status.endWal

# Backup Cozystack ссылается на свой соответствующий cnpg.io/Backup и префикс S3.
kubectl -n <ns> get backup.backups.cozystack.io <name> -o jsonpath='{.spec.driverMetadata}'
```

Верхняя граница — самый последний заархивированный WAL — это то, что исходное приложение успело отправить на данный момент; при здоровой архивации любое время до нескольких секунд назад безопасно. Чтобы подтвердить актуальность архива, проверьте, что WAL исходного кластера поступает в S3 (сайдкар `barman-cloud` логирует каждую загрузку сегмента) перед восстановлением на цель, близкую к текущему моменту.

### Идемпотентность при GitOps

Восстановление в процессе безопасно для повторного reconcile. Драйвер очищает целевой `Cluster` + PVC ровно один раз на каждый RestoreJob (защищено условием `TargetPurged` и проверкой на свежее восстановление), приостанавливает HelmRelease цели на время очистки, чтобы Flux не мог конкурировать с подменой при загрузке, и возобновляет его после того, как кластер восстановления отрендерен. Поэтому reconcile Flux (или перезапуск контроллера) в середине восстановления повторно подключается к восстанавливающемуся кластеру, а не удаляет его и начинает заново.

## См. также

- [Application Backup and Recovery]({{% ref "/docs/v1.6/applications/backup-and-recovery" %}}) — руководство для арендатора по бэкапам баз данных (BackupJob, Plan, RestoreJob).
- [Backup and Recovery (VMs)]({{% ref "/docs/v1.6/virtualization/backup-and-recovery" %}}) — руководство для арендатора по бэкапам VMInstance / VMDisk.
- [Platform Package Reference]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}) — где находится переопределение `backupStorage` среди других значений платформы.
