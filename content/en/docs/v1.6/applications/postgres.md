---
title: "Управляемый сервис PostgreSQL"
linkTitle: "PostgreSQL"
weight: 50
aliases:
  - /docs/reference/applications/postgres
  - /docs/v1.6/reference/applications/postgres
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/applications/_include/postgres.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/apps/postgres/README.md
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

| Layer                                    | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Configured via                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Archive plumbing** (chart, legacy)     | Renders `spec.plugins` (referencing a barman-cloud `ObjectStore`) on the cnpg.io Cluster from helm-install onwards. CNPG runs the barman-cloud plugin as a WAL-archiver sidecar, every WAL switch ships to object storage, and any backup driver gets a complete WAL chain to start replay from. Renders only when `backup.enabled=true`, `useSystemBucket=false`, `destinationPath` is non-empty, AND inline-or-external creds are supplied. **Skipped in the platform `useSystemBucket=true` mode** — the CNPG backup driver SSA-applies the `ObjectStore` and patches `spec.plugins` onto the live Cluster at first BackupJob time; until that first BackupJob fires, plugin WAL archiving is not active and WAL accumulates on the PVC. Fire an ad-hoc BackupJob immediately after enabling the flag on existing releases. | Legacy: `backup.enabled=true` plus `backup.destinationPath`, `backup.endpointURL`, and either `backup.s3AccessKey`+`backup.s3SecretKey` or `backup.s3CredentialsSecret`. Platform: `backup.enabled=true` plus `backup.useSystemBucket=true` — no S3 fields. |
| **Backup orchestration** (recommended)   | Drives ad-hoc and scheduled backups, retention, and restores from `backups.cozystack.io` resources that can span multiple Postgres apps in a tenant. The driver SSA-applies its own barman-cloud `ObjectStore` and patches `spec.plugins` with `ForceOwnership` (so compression / target settings flow from the strategy template, while the live Cluster's `serverName` — its WAL-archive S3 prefix — is always preserved); chart-managed values cover the same destination so there is no tug-of-war on the live Cluster.                                                                                                                                       | `strategy.backups.cozystack.io/CNPG` + `BackupClass` + `Plan` (recurring) or `BackupJob` (ad-hoc), restores via `RestoreJob`                  |
| Legacy chart-emitted scheduled backup    | The chart can also emit a `cnpg.io/ScheduledBackup` directly. Superseded by the BackupClass + Plan path, kept around for clusters that did not migrate. **Off by default** - rendered only when both `backup.enabled` and `backup.schedule` are non-empty. With `backup.schedule=""` plugin WAL archiving still runs; only the chart-emitted scheduled backup is silent.                                                                                                                                                                                                  | `backup.enabled=true` plus `backup.schedule` (CNPG 6-field cron, e.g. `"0 2 * * * *"`)                                                        |

**Канонический вариант настройки** зависит от того, поставляется ли в кластере платформенный BackupClass `cozy-default`.

**Platform-managed flow (recommended for new clusters)** — opt in via `backup.useSystemBucket: true` and reference `cozy-default` from BackupJob/Plan/RestoreJob. The chart leaves S3 coordinates blank; the CNPG driver SSA-applies a barman-cloud `ObjectStore` and patches `spec.plugins` from the platform-managed bucket coordinates at first BackupJob time.

```yaml
spec:
  backup:
    enabled: true
    useSystemBucket: true        # platform projects cozy-backups-creds + driver SSA-applies ObjectStore + patches spec.plugins
```

**Legacy chart-managed flow** — for clusters that pre-date the platform BackupClass or use a tuned non-default bucket. Provide all S3 coordinates inline (or via `s3CredentialsSecret.name`); `spec.plugins` and the barman-cloud `ObjectStore` render from helm-install onwards.

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

paired with a `strategy.backups.cozystack.io/CNPG` + `BackupClass` + `Plan`
in the same tenant. The end-to-end e2e fixture under
[`examples/backups/postgres/`](../../../examples/backups/postgres/) is the
canonical reference (`05-postgres-src.yaml` shows the chart side,
`10-cnpg-strategy.yaml` and `15-backupclass.yaml` show the orchestration
side, `25-backupjob-adhoc.yaml` and `40-restorejob-to-copy.yaml` show
ad-hoc backup and restore).

> **Why both layers and not one?** WAL archiving is handled by the barman-cloud plugin's WAL-archiver sidecar - CNPG can attach or detach the plugin at runtime, but any WAL that closed before the plugin began archiving is gone for good. A backup taken from such a cluster is missing the WAL its `begin_wal` points at, and recovery later fails with `WAL not found`. Letting the chart wire the plugin from helm-install removes the race.

### How to enable backups (preferred: BackupClass + Plan)

End-to-end manifests live under [`examples/backups/postgres/`](../../../examples/backups/postgres/).
Briefly, the moving parts are:

1. A `strategy.backups.cozystack.io/CNPG` describing the destination bucket and templating the barman-cloud `ObjectStore` (including a Secret reference to S3 credentials - the credentials never appear on the Postgres CR `.spec`; see Security note below).
2. A `backups.cozystack.io/BackupClass` that names the strategy and is
   selected by an `applicationRef` matching the Postgres app's `Kind`/`Name`.
3. A `backups.cozystack.io/Plan` (recurring) or `BackupJob` (ad-hoc) that
   references the BackupClass. The controller materialises a
   `Backup` artifact when the cnpg.io Backup completes; restores then
   reference that Backup via `RestoreJob`.

Both in-place restores (overwrite the source app's data) and to-copy
restores (restore into a separate target Postgres app in the same
namespace) are supported via the `RestoreJob.spec.targetApplicationRef`
field.

> **Security:** With the BackupClass path, S3 credentials live in a
> tenant-readable Secret referenced from the strategy template. The CNPG
> driver forwards that Secret reference into the Postgres app's
> `spec.backup.s3CredentialsSecret` on restore, so access keys never land in
> the Postgres CR `.spec`, etcd object store, or `kubectl get -o yaml`
> output. Prefer this over the chart-managed path whenever possible.

### How to enable chart-managed scheduled backups (legacy)

The chart can also emit a `cnpg.io/ScheduledBackup` directly, without a
BackupClass. Superseded by the BackupClass + Plan path above and kept
around for clusters that did not migrate. It does not run by default -
`backup.schedule` defaults to an empty string, which gates the chart's
ScheduledBackup template off. To turn it on, fill in a CNPG 6-field cron
expression:

```yaml
## @param backup.enabled Enable plugin WAL archiving + render the chart-managed ScheduledBackup
## @param backup.schedule Cron schedule (CNPG 6-field). Empty means no chart-managed ScheduledBackup
## @param backup.retentionPolicy Retention policy
## @param backup.destinationPath Path to store the backup (i.e. s3://bucket/path/to/folder)
## @param backup.endpointURL S3 Endpoint used to upload data to the cloud
## @param backup.s3AccessKey Access key for S3, used for authentication
## @param backup.s3SecretKey Secret key for S3, used for authentication
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
On a to-copy restore the controller replaces the target app's
`spec.databases` and `spec.users` with the source-spec snapshot persisted
in `Backup.status.underlyingResources`, so the chart's post-install
init-job does not drop the recovered roles or databases.

> **e2e coverage:** the same-namespace to-copy restore (Steps 0-7) leaves
> the source running and is the deterministic end-to-end signal; it stays
> a manual / dev-cluster reference flow, not part of the automated e2e suite.
> The cross-tenant variant (target Postgres in a different tenant from
> the source's seaweedfs) stays a manual / dev-cluster exercise —
> reachability is blocked by the per-tenant Cilium egress policy. The
> in-place restore code path is shipped and is covered at the unit level
> by `TestClusterHasRecoveryBootstrap_TerminatingCluster`,
> `TestCNPGBackupWALArchived`, `TestCNPGPurgeNeeded`, and the rest of the
> `internal/backupcontroller/cnpgstrategy_controller_test.go` suite.

### How to recover a backup (chart-managed bootstrap)

CloudNativePG supports point-in-time-recovery.
Recovering a backup is done by creating a new database instance and restoring the data in it.

Create a new PostgreSQL application with a different name, but identical configuration.
Set `bootstrap.enabled` to `true` and fill in the name of the database instance to recover from and the recovery time:

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

| Name                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Type     | Value                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------- |
| `backup`                                        | Backup configuration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `object` | `{}`                                |
| `backup.enabled`                                | Enable regular backups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `bool`   | `false`                             |
| `backup.useSystemBucket`                        | Opt-in: when true, the chart-emitted `<release>-s3-creds` Secret is skipped AND `spec.plugins` (plus the barman-cloud ObjectStore) is left UNSET in the chart-rendered Cluster — the cozy-default BackupClass driver SSA-applies an ObjectStore (carrying destinationPath/endpointURL/credentials) and patches `spec.plugins` on the live Cluster when the first BackupJob runs. Consequence: plugin WAL archiving is NOT active until that first BackupJob fires; WAL accumulates on the PVC in the meantime, so fire an ad-hoc BackupJob immediately after enabling the flag on existing releases. Use together with the platform `cozy-default` BackupClass — tenants do not need to fill `s3AccessKey`/`s3SecretKey` or `destinationPath`/`endpointURL`. The destination path automatically scopes to `s3://cozy-backups/<namespace>/<release>/`. | `bool`   | `false`                             |
| `backup.schedule`                               | Legacy. Cron schedule (CNPG 6-field format) for the chart-emitted ScheduledBackup. Empty means no chart-managed schedule, which is the recommended setup when a `BackupClass` from `backups.cozystack.io` already drives backup orchestration. In the legacy chart-managed flow `spec.plugins` plus the barman-cloud ObjectStore is rendered when `backup.enabled=true` AND `useSystemBucket=false` AND `destinationPath` is non-empty AND inline-or-external creds are supplied; in the platform `useSystemBucket=true` flow the chart skips emitting `spec.plugins` and the CNPG driver SSA-applies the ObjectStore and patches `spec.plugins` onto the live Cluster at first BackupJob time.                                                                                                                                                           | `string` | `""`                                |
| `backup.retentionPolicy`                        | Retention policy (e.g. "30d").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `string` | `30d`                               |
| `backup.destinationPath`                        | DEPRECATED. Per-tenant S3 configuration is superseded by the platform-managed `cozy-default` BackupClass and the `cozy-backups` system bucket. Leave empty for new installations; the BackupClass driver picks up the system-managed coordinates. Kept for in-place upgrade compatibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `string` | `s3://bucket/path/to/folder/`       |
| `backup.endpointURL`                            | DEPRECATED. See `destinationPath`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `string` | `http://minio-gateway-service:9000` |
| `backup.s3AccessKey`                            | DEPRECATED. Tenants no longer supply S3 keys; the system Bucket Secret is projected into the tenant namespace by the backup controller. Ignored when `s3CredentialsSecret.name` is set or `useSystemBucket` is true. The chart skips materialising `<release>-s3-creds` whenever this field is empty so a default install does not leak placeholder credentials into the tenant namespace.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `string` | `""`                                |
| `backup.s3SecretKey`                            | DEPRECATED. See `s3AccessKey`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `string` | `""`                                |
| `backup.s3CredentialsSecret`                    | DEPRECATED. Pre-existing Secret with S3 credentials. Use the platform-managed `cozy-default` BackupClass instead. When set, the chart references this Secret directly (legacy chart-managed flow). The CNPG backup driver writes this field on restore so credentials never land in the CR `.spec`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `object` | `{}`                                |
| `backup.s3CredentialsSecret.name`               | Name of the Secret in the application namespace. Empty means the chart materialises `<release>-s3-creds` from `s3AccessKey`/`s3SecretKey`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `string` | `""`                                |
| `backup.s3CredentialsSecret.accessKeyIDKey`     | Key in the Secret holding the access key ID. Defaults to `AWS_ACCESS_KEY_ID`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `string` | `""`                                |
| `backup.s3CredentialsSecret.secretAccessKeyKey` | Key in the Secret holding the secret access key. Defaults to `AWS_SECRET_ACCESS_KEY`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `string` | `""`                                |
| `backup.endpointCA`                             | DEPRECATED. Pre-existing Secret with the CA bundle the barman-cloud plugin should trust when reaching a self-signed S3 endpoint. Used for both backup and bootstrap recovery in the legacy chart-managed flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `object` | `{}`                                |
| `backup.endpointCA.name`                        | Name of the Secret in the application namespace. Empty means no endpointCA is emitted (the plugin uses the system trust store).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `string` | `""`                                |
| `backup.endpointCA.key`                         | Key within the Secret containing the CA bundle. Defaults to `ca.crt`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `string` | `""`                                |


### Параметры начальной загрузки (восстановления)

| Name                     | Description                                                                                                                                                                                                                                                                                                                                    | Type     | Value   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `bootstrap`              | Bootstrap configuration.                                                                                                                                                                                                                                                                                                                       | `object` | `{}`    |
| `bootstrap.enabled`      | Whether to restore from a backup.                                                                                                                                                                                                                                                                                                              | `bool`   | `false` |
| `bootstrap.recoveryTime` | Timestamp (RFC3339) for point-in-time recovery; empty means latest.                                                                                                                                                                                                                                                                            | `string` | `""`    |
| `bootstrap.oldName`      | Previous cluster name before deletion.                                                                                                                                                                                                                                                                                                         | `string` | `""`    |
| `bootstrap.serverName`   | Server name (S3 path prefix) used by the original cluster when writing backups; passed to the barman-cloud plugin via `externalClusters[].plugin.parameters.serverName`. Defaults to `bootstrap.oldName`. Set this only when the original cluster wrote backups under an explicit server name that differed from its Kubernetes resource name. | `string` | `""`    |


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
