---
title: "Управляемый сервис PostgreSQL"
linkTitle: "PostgreSQL"
weight: 50
aliases:
  - /docs/reference/applications/postgres
  - /docs/v1.5/reference/applications/postgres
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.5/applications/_include/postgres.md
source: https://github.com/cozystack/cozystack/blob/release-1.5/packages/apps/postgres/README.md
-->


PostgreSQL в настоящее время является лидирующим выбором среди реляционных баз данных и известен своей надёжной функциональностью и производительностью.
Управляемый сервис PostgreSQL использует реализацию на стороне платформы для предоставления самовосстанавливающегося реплицируемого кластера.
Этот кластер эффективно управляется с помощью широко признанного оператора CloudNativePG, получившего популярность в сообществе.

## Детали развёртывания

Этот управляемый сервис контролируется оператором CloudNativePG, обеспечивающим эффективное управление и бесперебойную работу.

- Документация: <https://cloudnative-pg.io/docs/>
- Github: <https://github.com/cloudnative-pg/cloudnative-pg>

## Операции

Резервное копирование PostgreSQL имеет два уровня, и в рекомендуемой конфигурации используются оба
уровня вместе, а не один из них:

| Уровень | Назначение | Настраивается через |
| --- | --- | --- |
| **Архивная обвязка (archive plumbing)** (чарт, устаревший вариант) | Формирует `spec.backup.barmanObjectStore` в ресурсе Cluster (cnpg.io) начиная с момента установки через helm. CNPG запускает postgres с `archive_command=barman-cloud-wal-archive`, каждое переключение WAL отправляется в объектное хранилище, и любой драйвер резервного копирования получает полную цепочку WAL, с которой можно начать воспроизведение. Формируется только когда `backup.enabled=true`, `useSystemBucket=false`, `destinationPath` не пуст И предоставлены встроенные или внешние учётные данные. **Пропускается в платформенном режиме `useSystemBucket=true`** — драйвер резервного копирования CNPG применяет `barmanObjectStore` к работающему Cluster через SSA-патч в момент запуска первого BackupJob; до запуска этого первого BackupJob `archive_command` неактивен, и WAL накапливается на PVC. Сразу после включения этого флага на существующих релизах запустите разовый BackupJob. | Устаревший вариант: `backup.enabled=true` плюс `backup.destinationPath`, `backup.endpointURL` и либо `backup.s3AccessKey`+`backup.s3SecretKey`, либо `backup.s3CredentialsSecret`. Платформенный вариант: `backup.enabled=true` плюс `backup.useSystemBucket=true` — без полей S3. |
| **Оркестрация резервного копирования** (рекомендуется) | Управляет разовым и плановым резервным копированием, хранением и восстановлением на основе ресурсов `backups.cozystack.io`, которые могут охватывать несколько приложений Postgres в рамках одного тенанта. Драйвер объединяет собственную структуру `barmanObjectStore` поверх структуры чарта через SSA с `ForceOwnership` (благодаря чему настройки сжатия / serverName / target берутся из шаблона стратегии); значения, управляемые чартом, указывают на то же место назначения, поэтому конфликта за владение работающим Cluster не возникает. | `strategy.backups.cozystack.io/CNPG` + `BackupClass` + `Plan` (повторяющееся) или `BackupJob` (разовое), восстановление через `RestoreJob` |
| Устаревшее плановое резервное копирование, формируемое чартом | Чарт также может напрямую формировать `cnpg.io/ScheduledBackup`. Заменён связкой BackupClass + Plan, сохранён для кластеров, которые не были перенесены. **Выключено по умолчанию** — формируется только когда и `backup.enabled`, и `backup.schedule` непусты. При `backup.schedule=""` архивная обвязка всё равно работает; не активно только плановое резервное копирование, формируемое чартом. | `backup.enabled=true` плюс `backup.schedule` (cron CNPG из 6 полей, например `"0 2 * * * *"`) |

**Канонический вариант настройки** зависит от того, поставляется ли в кластере платформенный BackupClass `cozy-default`.

**Платформенный поток (рекомендуется для новых кластеров)** — включается через `backup.useSystemBucket: true` со ссылкой на `cozy-default` из BackupJob/Plan/RestoreJob. Чарт оставляет параметры доступа к S3 пустыми; драйвер CNPG применяет `barmanObjectStore` через SSA-патч, используя параметры платформенного бакета, в момент запуска первого BackupJob.

```yaml
spec:
  backup:
    enabled: true
    useSystemBucket: true        # платформа проецирует cozy-backups-creds + драйвер применяет barmanObjectStore через SSA-патч
```

**Устаревший поток, управляемый чартом** — для кластеров, созданных до появления платформенного BackupClass, или использующих специально настроенный нестандартный бакет. Укажите все параметры доступа к S3 встроенно (или через `s3CredentialsSecret.name`); `barmanObjectStore` формируется начиная с момента установки через helm.

```yaml
spec:
  backup:
    enabled: true                # архивировать WAL в объектное хранилище
    destinationPath: s3://my-bucket/pg-src/
    endpointURL: https://seaweedfs-s3.tenant-foo:8333
    s3CredentialsSecret:
      name: pg-src-cnpg-backup-creds
    endpointCA:
      name: pg-src-cnpg-backup-ca
    # backup.schedule намеренно оставлен пустым — BackupClass / Plan
    # ниже управляют повторяющимся резервным копированием; никакой
    # формируемый чартом ScheduledBackup не должен конкурировать с этим расписанием.
```

в сочетании с `strategy.backups.cozystack.io/CNPG` + `BackupClass` + `Plan`
в том же тенанте. Сквозная (e2e) фикстура в
[`examples/backups/postgres/`](../../../examples/backups/postgres/) является
каноническим примером (`05-postgres-src.yaml` показывает сторону чарта,
`10-cnpg-strategy.yaml` и `15-backupclass.yaml` — сторону оркестрации,
`25-backupjob-adhoc.yaml` и `40-restorejob-to-copy.yaml` — разовое
резервное копирование и восстановление).

> **Почему оба уровня, а не один?** Архивирование WAL — это настройка
> postmaster: CNPG может менять `archive_command` во время работы через
> SIGHUP, но любой WAL, закрытый до такой замены, был «заархивирован»
> командой `archive_command=/bin/true` и потерян безвозвратно. В резервной
> копии, снятой с такого кластера, отсутствует WAL, на который указывает её
> `begin_wal`, и последующее восстановление завершается ошибкой
> `WAL not found`. Если позволить чарту инициализировать `archive_command`
> с момента установки через helm, эта гонка устраняется.

### Как включить резервное копирование (предпочтительно: BackupClass + Plan)

Сквозные манифесты находятся в [`examples/backups/postgres/`](../../../examples/backups/postgres/).
Вкратце, ключевые составные части:

1. `strategy.backups.cozystack.io/CNPG`, описывающий бакет назначения
   и формирующий по шаблону `barmanObjectStore` (включая ссылку на Secret
   с учётными данными S3 — учётные данные никогда не попадают в `.spec`
   ресурса Postgres CR; см. примечание о безопасности ниже).
2. `backups.cozystack.io/BackupClass`, который указывает стратегию и
   выбирается по `applicationRef`, соответствующему `Kind`/`Name` приложения Postgres.
3. `backups.cozystack.io/Plan` (повторяющееся) или `BackupJob` (разовое),
   ссылающийся на BackupClass. Контроллер материализует артефакт
   `Backup` по завершении Backup (cnpg.io); восстановления затем
   ссылаются на этот Backup через `RestoreJob`.

Поддерживаются как восстановление на месте (in-place, перезаписывает данные
исходного приложения), так и восстановление в копию (to-copy, восстановление
в отдельное целевое приложение Postgres в том же пространстве имён) — через
поле `RestoreJob.spec.targetApplicationRef`.

> **Безопасность:** При использовании BackupClass учётные данные S3 хранятся
> в Secret, доступном для чтения в рамках тенанта, на который ссылается
> шаблон стратегии. Драйвер CNPG передаёт эту ссылку на Secret в поле
> `spec.backup.s3CredentialsSecret` приложения Postgres при восстановлении,
> поэтому ключи доступа никогда не попадают в `.spec` ресурса Postgres CR,
> в объектное хранилище etcd или в вывод `kubectl get -o yaml`. По
> возможности предпочитайте этот способ способу, управляемому чартом.

### Как включить плановое резервное копирование, управляемое чартом (устаревший способ)

Чарт также может напрямую формировать `cnpg.io/ScheduledBackup` без
BackupClass. Заменён связкой BackupClass + Plan, описанной выше, и сохранён
для кластеров, которые не были перенесены. По умолчанию не запускается —
`backup.schedule` по умолчанию пуст, что отключает шаблон ScheduledBackup
в чарте. Чтобы включить его, укажите cron-выражение CNPG из 6 полей:

```yaml
## @param backup.enabled Включить archive_command + формировать управляемый чартом ScheduledBackup
## @param backup.schedule Расписание cron (CNPG, 6 полей). Пусто означает отсутствие управляемого чартом ScheduledBackup
## @param backup.retentionPolicy Политика хранения
## @param backup.destinationPath Путь для хранения резервной копии (например, s3://bucket/path/to/folder)
## @param backup.endpointURL Эндпоинт S3, используемый для загрузки данных в облако
## @param backup.s3AccessKey Ключ доступа к S3, используется для аутентификации
## @param backup.s3SecretKey Секретный ключ к S3, используется для аутентификации
backup:
  enabled: true
  retentionPolicy: 30d
  destinationPath: s3://bucket/path/to/folder/
  endpointURL: http://minio-gateway-service:9000
  schedule: "0 2 * * * *"  # включение — пусто (по умолчанию) означает отсутствие управляемого чартом расписания
  s3AccessKey: oobaiRus9pah8PhohL1ThaeTa4UVa7gu
  s3SecretKey: ju3eum4dekeich9ahM1te8waeGai0oog
```

### Как восстановить из резервной копии (предпочтительно: RestoreJob)

Для резервных копий, управляемых через BackupClass, создайте `backups.cozystack.io/RestoreJob`,
ссылающийся на нужный `Backup`. См.
[`examples/backups/postgres/35-restorejob-in-place.yaml`](../../../examples/backups/postgres/35-restorejob-in-place.yaml)
и
[`examples/backups/postgres/40-restorejob-to-copy.yaml`](../../../examples/backups/postgres/40-restorejob-to-copy.yaml).
При восстановлении в копию контроллер заменяет `spec.databases` и `spec.users`
целевого приложения снимком спецификации источника, сохранённым
в `Backup.status.underlyingResources`, поэтому post-install init-job чарта
не удаляет восстановленные роли или базы данных.

> **Покрытие e2e:** CI-тест e2e (`hack/e2e-apps/backup-postgres.bats`)
> проверяет восстановление в копию в пределах одного пространства имён
> (шаги 0–7), при котором источник остаётся работающим и поэтому даёт
> детерминированный сквозной сигнал. Межтенантный вариант (целевой Postgres
> в тенанте, отличном от тенанта seaweedfs источника) остаётся ручным
> сценарием / упражнением на dev-кластере — доступность блокируется
> политикой egress Cilium на уровне тенанта. Код восстановления на месте
> поставляется и покрыт на уровне модульных тестов:
> `TestClusterHasRecoveryBootstrap_TerminatingCluster`,
> `TestCNPGBackupWALArchived`, `TestCNPGPurgeNeeded` и остальной набор
> тестов `internal/backupcontroller/cnpgstrategy_controller_test.go`.

### Как восстановить из резервной копии (загрузка, управляемая чартом)

CloudNativePG поддерживает восстановление на момент времени (point-in-time recovery).
Восстановление резервной копии выполняется путём создания нового экземпляра базы данных и восстановления данных в нём.

Создайте новое приложение PostgreSQL с другим именем, но идентичной конфигурацией.
Установите `bootstrap.enabled` в `true` и укажите имя экземпляра базы данных, из которого восстанавливаться, и время восстановления:

```yaml
## @param bootstrap.enabled Восстановить кластер базы данных из резервной копии
## @param bootstrap.recoveryTime Метка времени (PITR), до которой будет выполнено восстановление, в формате RFC 3339. Если оставить пустым, будет восстановлена последняя
## @param bootstrap.oldName Имя кластера базы данных до удаления
##
bootstrap:
  enabled: false
  recoveryTime: ""  # оставьте пустым для последней или укажите точную метку времени; пример: 2020-11-26 15:22:00.00000+00
  oldName: "<previous-postgres-instance>"
```

### Как переключить первичную/вторичную реплику

См.:

- <https://cloudnative-pg.io/documentation/1.15/rolling_update/#manual-updates-supervised>

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

### TLS для серверных подключений

CNPG управляет цепочкой сертификатов сквозным образом. Оператор автоматически генерирует самоподписанный CA, подписывает им конечные (leaf) сертификаты сервера, клиента и репликации и ротирует их по мере необходимости. Чарт не формирует никаких объектов `Issuer`/`Certificate` cert-manager — этот путь взаимоисключающий с управляемой оператором цепочкой на admission webhook CNPG.

Что добавляет чарт: когда TLS включён и `external: true`, чарт устанавливает `spec.certificates.serverAltDNSNames` в ресурсе CNPG Cluster CR, чтобы внедрить внешнее имя хоста `<release>.<_namespace.host>` в список SAN автоматически сгенерированного серверного сертификата. Стандартное покрытие SAN в CNPG уже включает три встроенных сервиса ClusterIP (`-rw`, `-r`, `-ro`) во всех четырёх формах DNS (`<svc>`, `<svc>.<ns>`, `<svc>.<ns>.svc`, `<svc>.<ns>.svc.<cluster-domain>`); требуется добавить только внешнее имя хоста.

Трёхпозиционный параметр `tls.enabled` определяет, внедряет ли чарт `serverAltDNSNames`:

- `tls.enabled: null` (по умолчанию) — режим TLS наследуется от `external`. При `external: true` чарт внедряет внешнее имя хоста в управляемый оператором сертификат.
- `tls.enabled: true` при `external: true` — эффект тот же, что и по умолчанию.
- `tls.enabled: true` при `external: false` — внедрение `serverAltDNSNames` не требуется (внешнего имени хоста для добавления нет); автоматически сгенерированный сертификат CNPG покрывает внутренние сервисы.
- `tls.enabled: false` — чарт пропускает внедрение `serverAltDNSNames`. **Примечание:** CNPG сохраняет встроенный TLS на уровне соединения независимо от этого флага; данный переключатель управляет лишь тем, добавляется ли внешнее имя хоста в сертификат. Чтобы полностью отключить TLS в PostgreSQL, потребовалось бы установить `postgresql.parameters.ssl = "off"` на уровне CNPG, что выходит за рамки этого флага.

**Получение CA-бандла** для проверки на стороне клиента:

CNPG включает сертификат CA в каждый создаваемый им Secret с учётными данными пользователя под ключом `ca.crt`. Получите его из Secret `<release>-credentials`, который уже доступен тенантам через RBAC дашборда:

```bash
kubectl --context <ctx> --namespace <tenant> \
  get secret <release>-credentials \
  --output jsonpath='{.data.ca\.crt}' | base64 --decode
```

**Подключение с полной проверкой** (пример psql):

```bash
psql "host=<host> port=5432 dbname=app user=app \
  sslmode=verify-full sslrootcert=ca.crt"
```

Чтобы `sslmode=verify-full` работал, полученный выше CA-бандл должен быть сохранён в `ca.crt`. Без него используйте `sslmode=require` (шифрует, но не проверяет серверный сертификат).

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик Postgres. | `int` | `2` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики PostgreSQL. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.micro` |
| `size` | Размер Persistent Volume Claim, доступный для данных приложения. | `quantity` | `10Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |
| `version` | Мажорная версия PostgreSQL для развёртывания | `string` | `v18` |


### Конфигурация TLS

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `tls` | Конфигурация TLS для серверных подключений. | `object` | `{}` |
| `tls.enabled` | Трёхпозиционный переключатель, определяющий, внедряет ли чарт внешнее имя хоста в управляемый оператором сертификат CNPG через spec.certificates.serverAltDNSNames. Если не задан, чарт внедряет SAN при `external: true` и пропускает в противном случае. Установите явно в `true`, чтобы внедрять независимо от `external` (не имеет эффекта при `external: false`, так как внешнего имени хоста для добавления нет). Установите в `false`, чтобы пропустить внедрение. Учтите, что CNPG сохраняет встроенный TLS на уровне соединения независимо от этого флага — данный переключатель управляет лишь внедрением SAN на стороне чарта; чтобы полностью отключить TLS в PostgreSQL, установите `postgresql.parameters.ssl = "off"` на уровне CNPG. | `*bool` | `null` |


### Параметры, специфичные для приложения

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `postgresql` | Конфигурация сервера PostgreSQL. | `object` | `{}` |
| `postgresql.parameters` | Параметры сервера PostgreSQL. Значения могут быть строками или целыми числами; целые числа приводятся к строкам шаблоном (например, принимаются и `max_connections: 100`, и `max_connections: "100"`). ЗАБЛОКИРОВАНЫ (позволяют выполнение произвольного кода): archive_command, restore_command, ssl_passphrase_command, archive_cleanup_command, recovery_end_command, dynamic_library_path, local_preload_libraries, session_preload_libraries, shared_preload_libraries. НЕ переопределяйте параметры, управляемые CloudNativePG: archive_mode, primary_conninfo, wal_level, max_replication_slots. | `map[string]intOrString` | `{}` |


### Синхронная репликация на основе кворума

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `quorum` | Конфигурация кворума для синхронной репликации. | `object` | `{}` |
| `quorum.minSyncReplicas` | Минимальное число синхронных реплик, необходимое для фиксации (commit). | `int` | `0` |
| `quorum.maxSyncReplicas` | Максимально допустимое число синхронных реплик (должно быть меньше общего числа реплик). | `int` | `0` |


### Конфигурация пользователей

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `users` | Карта конфигурации пользователей. | `map[string]object` | `{}` |
| `users[name].password` | Пароль пользователя. | `string` | `""` |
| `users[name].replication` | Имеет ли пользователь привилегии репликации. | `bool` | `false` |


### Конфигурация баз данных

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `databases` | Карта конфигурации баз данных. | `map[string]object` | `{}` |
| `databases[name].roles` | Роли, назначенные пользователям. | `object` | `{}` |
| `databases[name].roles.admin` | Список пользователей с правами администратора. | `[]string` | `[]` |
| `databases[name].roles.readonly` | Список пользователей с правами только на чтение. | `[]string` | `[]` |
| `databases[name].extensions` | Список включённых расширений PostgreSQL. | `[]string` | `[]` |


### Параметры резервного копирования

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `backup` | Конфигурация резервного копирования. | `object` | `{}` |
| `backup.enabled` | Включить регулярное резервное копирование. | `bool` | `false` |
| `backup.useSystemBucket` | Опциональное включение: при значении true формируемый чартом Secret `<release>-s3-creds` пропускается, А `spec.backup.barmanObjectStore` остаётся НЕ заданным в формируемом чартом Cluster — драйвер BackupClass cozy-default применяет destinationPath/endpointURL/учётные данные к работающему Cluster через SSA-патч при запуске первого BackupJob. Следствие: `archive_command` НЕ активен до запуска этого первого BackupJob; в это время WAL накапливается на PVC, поэтому сразу после включения флага на существующих релизах запустите разовый BackupJob. Используйте вместе с платформенным BackupClass `cozy-default` — тенантам не нужно заполнять `s3AccessKey`/`s3SecretKey` или `destinationPath`/`endpointURL`. Путь назначения автоматически ограничивается до `s3://cozy-backups/<namespace>/<release>/`. | `bool` | `false` |
| `backup.schedule` | Устаревший. Расписание cron (формат CNPG из 6 полей) для формируемого чартом ScheduledBackup. Пусто означает отсутствие управляемого чартом расписания — это рекомендуемая конфигурация, когда оркестрацией резервного копирования уже управляет `BackupClass` из `backups.cozystack.io`. В устаревшем потоке, управляемом чартом, `spec.backup.barmanObjectStore` формируется, когда `backup.enabled=true` И `useSystemBucket=false` И `destinationPath` непуст И предоставлены встроенные или внешние учётные данные; в платформенном потоке `useSystemBucket=true` чарт не формирует `barmanObjectStore`, а драйвер CNPG применяет его к работающему Cluster через SSA-патч в момент запуска первого BackupJob. | `string` | `""` |
| `backup.retentionPolicy` | Политика хранения (например, "30d"). | `string` | `30d` |
| `backup.destinationPath` | УСТАРЕЛО. Индивидуальная для тенанта конфигурация S3 заменена управляемым платформой BackupClass `cozy-default` и системным бакетом `cozy-backups`. Для новых установок оставьте пустым; драйвер BackupClass подхватывает управляемые системой параметры. Сохранено для совместимости при обновлении на месте. | `string` | `s3://bucket/path/to/folder/` |
| `backup.endpointURL` | УСТАРЕЛО. См. `destinationPath`. | `string` | `http://minio-gateway-service:9000` |
| `backup.s3AccessKey` | УСТАРЕЛО. Тенанты больше не предоставляют ключи S3; системный Secret бакета проецируется в пространство имён тенанта контроллером резервного копирования. Игнорируется, когда задан `s3CredentialsSecret.name` или `useSystemBucket` равен true. Чарт не создаёт `<release>-s3-creds`, когда это поле пусто, чтобы установка по умолчанию не приводила к попаданию учётных данных-заглушек в пространство имён тенанта. | `string` | `""` |
| `backup.s3SecretKey` | УСТАРЕЛО. См. `s3AccessKey`. | `string` | `""` |
| `backup.s3CredentialsSecret` | УСТАРЕЛО. Существующий Secret с учётными данными S3. Вместо этого используйте управляемый платформой BackupClass `cozy-default`. Если задан, чарт ссылается на этот Secret напрямую (устаревший поток, управляемый чартом). Драйвер резервного копирования CNPG записывает это поле при восстановлении, поэтому учётные данные никогда не попадают в `.spec` ресурса CR. | `object` | `{}` |
| `backup.s3CredentialsSecret.name` | Имя Secret в пространстве имён приложения. Пусто означает, что чарт создаёт `<release>-s3-creds` из `s3AccessKey`/`s3SecretKey`. | `string` | `""` |
| `backup.s3CredentialsSecret.accessKeyIDKey` | Ключ в Secret, содержащий идентификатор ключа доступа (access key ID). По умолчанию `AWS_ACCESS_KEY_ID`. | `string` | `""` |
| `backup.s3CredentialsSecret.secretAccessKeyKey` | Ключ в Secret, содержащий секретный ключ доступа (secret access key). По умолчанию `AWS_SECRET_ACCESS_KEY`. | `string` | `""` |
| `backup.endpointCA` | УСТАРЕЛО. Существующий Secret с CA-бандлом, которому Barman должен доверять при обращении к самоподписанному эндпоинту S3. Используется как для резервного копирования, так и для восстановления (bootstrap) в устаревшем потоке, управляемом чартом. | `object` | `{}` |
| `backup.endpointCA.name` | Имя Secret в пространстве имён приложения. Пусто означает, что endpointCA не формируется (Barman использует системное хранилище доверенных сертификатов). | `string` | `""` |
| `backup.endpointCA.key` | Ключ в Secret, содержащий CA-бандл. По умолчанию `ca.crt`. | `string` | `""` |


### Параметры начальной загрузки (восстановления)

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `bootstrap` | Конфигурация начальной загрузки. | `object` | `{}` |
| `bootstrap.enabled` | Восстанавливать ли из резервной копии. | `bool` | `false` |
| `bootstrap.recoveryTime` | Метка времени (RFC3339) для восстановления на момент времени; пусто означает последнюю. | `string` | `""` |
| `bootstrap.oldName` | Предыдущее имя кластера до удаления. | `string` | `""` |
| `bootstrap.serverName` | Имя сервера Barman (префикс пути S3), использовавшееся исходным кластером при записи резервных копий. Задавайте это только если у исходного кластера был явный barmanObjectStore.serverName, отличавшийся от имени его ресурса Kubernetes. | `string` | `""` |


## Примеры и справочник по параметрам

### resources и resourcesPreset

`resources` задаёт явные конфигурации CPU и памяти для каждой реплики.
Если оставить пустым, применяется пресет, указанный в `resourcesPreset`.

```yaml
resources:
  cpu: 4000m
  memory: 4Gi
```

`resourcesPreset` задаёт именованные конфигурации CPU и памяти для каждой реплики.
Эта настройка игнорируется, если задано соответствующее значение `resources`.

Пресеты следуют облачной схеме именования `<серия>.<размер>`. Пять серий покрывают весь диапазон соотношений CPU к памяти (`t1` 1:0.5, `c1` 1:1, `s1` 1:2, `u1` 1:4, `m1` 1:8), и каждая серия поставляется с восемью размерами (от `nano` до `4xlarge`). Устаревшие плоские имена (`nano`, `micro`, `small`, `medium`, `large`, `xlarge`, `2xlarge`) по-прежнему принимаются как устаревшие псевдонимы соответствующих типов инстансов с соотношением 1:1.

См. [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md), где приведены полная матрица размеров и сопоставление устаревших имён с типами инстансов.

### users

```yaml
users:
  user1:
    password: strongpassword
  user2:
    password: hackme
  airflow:
    password: qwerty123
  debezium:
    replication: true
```

### databases

```yaml
databases:
  myapp:
    roles:
      admin:
      - user1
      - debezium
      readonly:
      - user2
  airflow:
    roles:
      admin:
      - airflow
    extensions:
    - hstore
```
