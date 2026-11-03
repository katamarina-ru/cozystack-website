---
title: "Backup классы"
linkTitle: "Backup классы"
description: "Управляемый платформой BackupClass с именем cozy-default: что он покрывает, как арендаторы на него ссылаются, и пути административного переопределения."
weight: 31
aliases:
  - /docs/v1.7/operations/services/managed-app-backup-configuration
  - /docs/v1.7/operations/services/velero-backup-configuration
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
| `apps.cozystack.io/MongoDB`      | Percona psmdb operator (pbm) dump    | `strategy.backups.cozystack.io/MongoDB` `cozy-default-mongodb`             |
| `apps.cozystack.io/Kafka`        | Kafka Admin API (topic metadata)     | `strategy.backups.cozystack.io/Kafka` `cozy-default-kafka`                 |
| `apps.cozystack.io/Etcd`         | etcd-operator snapshot               | `strategy.backups.cozystack.io/Etcd` `cozy-default-etcd`                   |
| `apps.cozystack.io/RabbitMQ`     | RabbitMQ definitions (management API) | `strategy.backups.cozystack.io/Rabbitmq` `cozy-default-rabbitmq`          |
| `apps.cozystack.io/Redis`        | RDB dump Job (sentinel-discovered master) | `strategy.backups.cozystack.io/Redis` `cozy-default-redis`            |
| `apps.cozystack.io/Valkey`       | RDB dump Job (sentinel-discovered master) | `strategy.backups.cozystack.io/Redis` `cozy-default-redis`            |
| `apps.cozystack.io/VMInstance`   | Velero + kubevirt-velero-plugin      | `strategy.backups.cozystack.io/Velero` `cozy-default-velero-vminstance`    |
| `apps.cozystack.io/VMDisk`       | Velero                               | `strategy.backups.cozystack.io/Velero` `cozy-default-velero-vmdisk`        |

Valkey runs on the same RedisFailover operator as Redis, so `cozy-default-redis` serves both: the driver hands the template `.Release.Prefix` (`redis-` or `valkey-`, after the app's Kind), from which it builds the Sentinel Service and the auth and CA Secret names. A Valkey backup restores only into a Valkey app, a Redis backup only into a Redis app. The Valkey chart has no TLS option, so a Valkey dump always connects in plaintext.

### Поставляются, но НЕ привязаны (требуется опт-ин администратора)

| Тип приложения (Application Kind) | Драйвер                              | Strategy CR                                                                |
|----------------------------------|--------------------------------------|----------------------------------------------------------------------------|
| `apps.cozystack.io/FoundationDB` | FoundationDB operator backup_agent   | `strategy.backups.cozystack.io/FoundationDB` `cozy-default-foundationdb`   |

Strategy CR для FoundationDB рендерится чартом, чтобы администраторы могли ссылаться на него из собственного BackupClass после того, как обвязка на стороне оператора (монтирование `cozy-backups-creds` в Deployment `cozy-foundationdb-operator`) будет настроена вручную. См. [оговорку по FoundationDB](#foundationdb-caveat) ниже.

### Формат эндпоинта для каждого драйвера

Разные операторы ожидают разные форматы эндпоинтов; шаблоны стратегий, рендерящиеся `backupstrategy-controller`, определяют единый S3-эндпоинт (через хелпер `backupstrategy-controller.endpoint`) и адаптируют его под контракт каждого потребителя. Для предоставленного бакета (`provisionBucket: true`, значение по умолчанию) эндпоинт **вычисляется из Secret с системными учётными данными бакета COSI** (`backupStorage.systemSecretName`) и принудительно переводится в `https://` — это внешний S3-ингресс с ACME-сертификатом, единственный эндпоинт, который операторы бэкапа могут верифицировать. Внутрикластерный S3 у SeaweedFS обслуживает TLS на порту `:8333` за самоподписанным "SeaweedFS CA", а схема S3 у Etcd Strategy не имеет поля `caCert`, поэтому внутрикластерный эндпоинт нельзя использовать напрямую. Значение чарта `backupStorage.endpoint` (полный URL, например `http://seaweedfs-s3.tenant-root.svc:8333`) — это **резервный вариант**, используемый для внешнего S3 (`provisionBucket: false`) и для оффлайн-рендеров `helm template`/пре-reconcile, когда поиск Secret не дал результата. Вычисленный эндпоинт адаптируется для каждого потребителя:

| Драйвер | Поле шаблона стратегии | Форма |
|--------|-------------------------|------|
| CNPG (Postgres) | `barmanObjectStore.endpointURL` | full URL (scheme preserved) |
| Etcd            | `destination.s3.endpoint`       | full URL (scheme preserved) |
| MariaDB         | `storage.s3.endpoint`           | bare host:port (scheme stripped); `tls.enabled` derived from the scheme |
| MongoDB         | `s3.endpointUrl`                | full URL (scheme preserved); on the default flow the app's `backup.endpointURL`, on `useSystemBucket` the strategy coordinate injected by the driver |
| FoundationDB    | `blobStoreConfiguration.accountName` + `urlParameters.secure_connection` | bare host:port + derived secure flag |
| Velero          | `BackupStorageLocation.spec.config.s3Url` | full URL (scheme preserved) |
| ClickHouse sidecar | `S3_ENDPOINT` env | bare host:port (from projected Secret) |
| Redis (dump Job)   | `S3_ENDPOINT` env | bare host:port (from projected Secret); `https://` prepended when unscheme'd |
| Kafka           | `S3_ENDPOINT` env on the strategy Job | full URL (scheme preserved); the Job's `curl --aws-sigv4` prepends `https://` if the endpoint carries no scheme, honours `backupStorage.forcePathStyle`, and (for the image's curl 7.76.1) signs a portless URL with `--connect-to` to the real port so a ported endpoint still verifies |

Ключ `cozy-backups-creds.endpoint` в проецированном Secret **очищен от схемы**, поэтому сайдкары, создаваемые чартом (ClickHouse), используют его напрямую. Драйверы, которым нужен полный URL, получают вычисленный эндпоинт, описанный выше — выведенный из системного Secret COSI (принудительно `https://`) для предоставленного бакета, либо резервное значение `backupStorage.endpoint` для внешнего S3.

VM-ориентированные бэкапы (Velero) попадают в тот же бакет `cozy-backups` под префиксом `velero/`. `BackupStorageLocation` с именем `cozy-default` поставляется чартом `backupstrategy-controller` (`packages/system/backupstrategy-controller/templates/velero-bsl.yaml`), поэтому эндпоинт/бакет/регион берутся из того же блока значений `backupStorage`, который используется Strategy CR и проектором.

### Оговорка по FoundationDB

Strategy CR `cozy-default-foundationdb` поставляется, но **пока не** привязан к `cozy-default`. Восстановление запускает `fdbrestore` внутри Deployment `cozy-foundationdb-operator`, который пока не монтирует `cozy-backups-creds`. До тех пор, пока Deployment оператора не будет обновлён для монтирования проецированного Secret, стандартное для платформы восстановление FDB будет молча завершаться неудачей — администраторам, которым это нужно уже сейчас, следует использовать отдельный `Bucket` для приложения плюс собственный `BackupClass`, либо самостоятельно подключить файл с учётными данными в Deployment оператора.

**Ловушка при очистке (зомби backup_agent).** В отличие от CNPG/MariaDB/Altinity (одноразовые Backup CR на стороне оператора), драйвер FoundationDB создаёт CR `apps.foundationdb.org/FoundationDBBackup`, который управляет **долгоживущим** Deployment `backup_agent`, непрерывно передающим данные в S3. Удаление Backup Cozystack (например, при зачистке по retention) НЕ останавливает этот Deployment — агент продолжает писать данные до тех пор, пока вызов `stopOtherFoundationDBBackups` следующего BackupJob не заменит его, пока администратор не вызовет `examples/backups/foundationdb/cleanup.sh`, либо пока CR на стороне оператора не будет удалён вручную. Если арендатор удаляет свой последний Backup Cozystack и больше не отправляет BackupJob, поды агента будут работать бесконечно и накапливать PUT-запросы в S3. Сегодня это ожидаемое поведение (у драйвера нет RBAC-права остановить CR на стороне оператора при удалении Cozystack-Backup), но администраторам следует об этом знать.

## Postgres and MariaDB: a restored copy converges its application passwords shortly after recovery

Managed Postgres no longer accepts a plaintext `users.<name>.password`; every application-user password is chart-generated into `<release>-credentials` and read only from there. The CNPG backup snapshot therefore carries no passwords — deliberate, since a snapshot that did was the one place a tenant password sat in cleartext.

**Residue from before the upgrade — this is forward-looking, not retroactive.** The removal scrubs new renders and new snapshots; it does not rewrite copies made earlier, and upgrading preserves the live password (the chart reads the existing `<release>-credentials` through `lookup`), so those older copies still expose the *current* credential. Two sinks retained it: a Postgres `Backup` object created before this release snapshotted `app.spec.users` while that spec still carried a plaintext `password`, so its `status.underlyingResources` held that password in cleartext — a field any tenant with `get backups` in the namespace can read (see the `underlyingResources` caution below); and every pre-upgrade Helm revision of `<release>-init-script` rendered `ALTER ROLE … WITH PASSWORD '<literal>'` into its manifest, retained for `MaxHistory` revisions. There is no in-band rotation to invalidate the exposed value (chart-based rotation was intentionally not added — a chart-rendered Secret cannot revoke a leaked credential; rotation is being reworked as a controller, [cozystack/community#72](https://github.com/cozystack/community/pull/72)). The backup strategy controller removes `users.*.password` from every CNPG `Backup` snapshot each time its leader starts, so the first sink is cleaned in-cluster after the upgrade, including a `Backup` written by a pre-upgrade replica during the rollout; the start-up log line `legacy snapshot password scrub finished` reports how many it changed. That does not reach copies made outside the cluster — apiserver audit logs, etcd backups, or object-level exports of the `Backup` resources — and the old init-script Secret persists in Helm history until those revisions age out of `MaxHistory`. So after upgrading, treat any password that was ever set through `users.<name>.password` as exposed until it is rotated.

The consequence for a **restore into a copy** (a differently-named target): the recovered database keeps the source roles with their source password hashes, but the target chart generates fresh random passwords into the target's `<release>-credentials`, and the role-reconciling init-job is skipped while `bootstrap.enabled` is set on the restored app. The restore driver clears `bootstrap.enabled` automatically once recovery is healthy, so the next HelmRelease reconcile runs the init-job, which applies `ALTER ROLE … WITH PASSWORD` for every `spec.users` entry and converges the recovered roles onto the target Secret. Convergence is therefore automatic but not instant: between the RestoreJob reaching `Succeeded` and that init-job completing, the passwords advertised in `<target>-credentials` do not yet match the recovered roles, so a client reading that Secret cannot log in as an application user for that brief window. The chart flags the Secret `postgres.cozystack.io/credentials-pending: "true"` and the NOTES print the same caution while bootstrap is still on, so a reader does not treat the advertised password as usable mid-restore; both clear on their own once the driver clears bootstrap. The data is intact and reachable as the CNPG superuser throughout. After a to-copy restore, wait for the application login to succeed rather than assuming the advertised password works the instant the RestoreJob succeeds. The driver clears `bootstrap.enabled` by writing it onto the Postgres app's own spec, so a GitOps source (Argo CD, Flux, Terraform) that pins `bootstrap.enabled: true` for that app will revert the clear on its next apply and the copy's credentials never converge — exclude the restored app from such a source until convergence completes, or clear `bootstrap.enabled` in the source itself. If the driver cannot clear the flag at all (the app was deleted or renamed mid-restore), the RestoreJob fails with reason `BootstrapDisableFailed` once its deadline elapses rather than sitting `Running` forever with no signal. An in-place restore is unaffected: the release keeps its existing `<release>-credentials`, whose passwords already match the roles the recovery brings back. One-time migration: an app restored to a copy under an earlier release — before this auto-clear existed — may still be sitting with `bootstrap.enabled` set and its init-job permanently skipped; the driver clears the flag only for a restore it drives to completion, never retroactively for one that already finished, so such an app keeps advertising unconverged credentials until you clear `bootstrap.enabled` on it once by hand.

Databases and users after a Postgres restore, in place or into a copy: the driver sets the app's `spec.databases` and `spec.users` to the snapshot taken when the Backup was created, while recovery replays WAL past that point (to the end of the archive when no `recoveryTime` is set), so the recovered cluster can hold databases and users the snapshot does not list. On the first init-job run after the restore, a database the chart manages but the restored spec does not declare is released instead of dropped: its data stays, and it and its `<db>_admin` and `<db>_readonly` roles lose the `managed by helm` comment, so the chart no longer grants on it or drops it. Add it to `databases` to manage it again. Users are not released: a recovered user the restored spec does not declare, including a source user the target of a copy does not declare, is dropped on that run, so a client still logging in as that user loses the login. Every object it owned is reassigned to `cozystack:orphaned`, a role that cannot log in and that the chart grants nothing. Functions it owns are switched to `SECURITY INVOKER`, and on PostgreSQL 15 and later its views to `security_invoker`. A materialized view, a rule, and a view on PostgreSQL 13 or 14 have no such switch and keep reading with the rights of `cozystack:orphaned`. The user's grants and memberships do not carry over, so a view or function of that user can lose access it had through them. Declare the user in `users` to keep it; the chart then generates a new password for it into `<release>-credentials`.

**Objects reassigned by earlier releases stay as they were.** Before this change the chart reassigned a dropped user's or role's objects to the `postgres` superuser, and upgrading does not move them. After upgrading, run the query below in each database: it lists the relations and routines `postgres` owns outside the system catalog and extensions, leaving out a sequence that belongs to a column, which moves with its table. Of those, the chart itself owns only its `auto_grant_schema_privileges()` event-trigger function, so anything else came from a tenant role or was created by hand. Hand what a tenant role created to `cozystack:orphaned` with the matching `ALTER TABLE`, `ALTER VIEW`, `ALTER ROUTINE` or other `ALTER … OWNER TO "cozystack:orphaned"`; the next init-job run switches its functions and, on PostgreSQL 15 and later, its views as above. Handle first the rows with `security_definer` set, and views, materialized views and tables with rules, since those run with their owner's rights:

```sql
SELECT c.oid::regclass::text AS object, NULL::boolean AS security_definer FROM pg_class c
WHERE c.relowner = 'postgres'::regrole AND c.relkind NOT IN ('i', 'I', 't')
  AND c.relnamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
  AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
    AND (d.deptype = 'e' OR (c.relkind = 'S' AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i'))))
UNION ALL
SELECT p.oid::regprocedure::text, p.prosecdef FROM pg_proc p
WHERE p.proowner = 'postgres'::regrole
  AND p.pronamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
  AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e');
```

MariaDB avoids the same problem at backup time: the driver sets `ignoreGlobalPriv` on every operator `Backup` it creates, so `mysql.global_priv` — the grant table holding every user's password hash, root included — is excluded from the logical dump and a restore into a copy never overwrites the target's chart-managed users. The same exclusion is also a limitation, and it applies to every restore, not only a to-copy one: because the grant table is never in the dump, only accounts Cozystack declares through `User` CRs (the chart's `users` map) are recreated on restore — an account created out of band, directly in MySQL rather than through `users`, is in no backup, so a restore brings back its data and its `mysql.db` grants but not the account that owns them, and that login fails until the account is recreated. Cozystack treats the `User` CRs as the source of truth for accounts precisely so the grant table need not be, so keep managed accounts in `users` rather than creating them by hand. That matters most for `root`, which the operator only applies at datadir bootstrap via `rootPasswordSecretKeyRef` and could never repair afterwards; keeping the source's grants out of the dump is what lets the target's advertised `root` password stay correct through a restore. This is a **backup-side** fix, so it only protects backups captured from this release onward. A restore from a backup taken **before** this change still replays the source's `mysql.global_priv` and overwrites the target's application users and `root` with the source's hashes; after restoring such an older backup, treat the target's advertised credentials as unreliable and reset them — application users converge on the next reconcile through their `User` CRs, but `root` must be reset out of band (`ALTER USER 'root' … IDENTIFIED BY …` against the restored server) since the operator applies `rootPasswordSecretKeyRef` only at datadir bootstrap. That once-only write is also why the Secret itself now matters: `root` lives solely in `<release>-credentials` with no plaintext escape hatch left in values, so if that Secret is lost after bootstrap — a tenant deletes it, or a partial Velero restore drops it — the advertised `root` password and the live server's diverge with no in-band way to reconcile them; back the Secret up alongside the data, and reset `root` out of band if it is ever lost.

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

## MongoDB: backup storage

MongoDB supports two storage flows. By default the S3 target lives on the app CR and the tenant supplies its own credentials; alternatively the tenant opts into the platform system bucket and the driver injects the storage onto the live cluster at backup time.

### Default: the application owns the backup storage

The Percona psmdb operator runs the percona-backup-mongodb (pbm) agents whenever the `PerconaServerMongoDB` cluster has `spec.backup.enabled: true` (a declared storage is not needed for the agents to start), and services a `PerconaServerMongoDBBackup` only once the storage it references by name is declared on the cluster. On the default flow the MongoDB application **opts into backups** and points at the bucket in its own chart values:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: MongoDB
metadata:
  name: orders-db
spec:
  backup:
    enabled: true
    destinationPath: "s3://<bucket>/orders-db/"
    endpointURL: "https://seaweedfs-s3.tenant-root:8333"
    insecureSkipTLSVerify: true   # self-signed in-cluster seaweedfs; psmdb s3 storage has no CA-bundle field
    s3AccessKey: "<key>"
    s3SecretKey: "<secret>"
```

The chart declares that storage as `s3-storage`, which the `cozy-default-mongodb` strategy names (`storageName: s3-storage`, `type: logical`). The driver then drives on-demand backups and restores through the unified `BackupJob` / `RestoreJob` / `Plan` interface on top of the operator's storage config — adding restore-to-differently-named instances (via `PerconaServerMongoDBRestore.spec.backupSource`) and point-in-time recovery that the raw scheduled-task / `mongodump` paths do not offer. When a target cluster has backups disabled, the driver surfaces a clear `Ready=False` precondition on the BackupJob/RestoreJob rather than hanging until the deadline.

For a to-copy restore the operator reads the dump from the **source** backup's bucket/endpoint. The driver re-points the restore at the **target** cluster's own S3 credentials only when the target declares a storage on that same bucket (the common case where both share one bucket), since the source release's Secret dies with it in a DR scenario; a system-bucket source keeps its projected `cozy-backups-creds` reference, which outlives the source app. A target whose storages are all on a different bucket gets no credential swap: the restore keeps the source's Secret reference and is held at `Ready=False RestoreCredentialsMissing` naming that Secret until it exists in the restore namespace, so a cross-bucket restore never runs with a credential for the wrong bucket. Re-create the source release's `-s3-creds` Secret by name to let it proceed.

A full, scripted example (write a marker document, back up, restore to a copy, assert the round-trip while the source stays untouched) is in the Cozystack repository at [`examples/backups/mongodb/`](https://github.com/cozystack/cozystack/tree/main/examples/backups/mongodb), driven by `run-all.sh`.

### Opt-in to the system bucket

Unlike ClickHouse's sidecar, PBM takes the bucket/endpoint/prefix as static fields on the `PerconaServerMongoDB` CR, and the platform bucket name is only known at BackupJob time — so the chart cannot render them. Instead the `cozy-default-mongodb` driver injects the storage onto the live cluster. To back up to the platform bucket without supplying S3 credentials, set:

```yaml
backup:
  enabled: true
  useSystemBucket: true
```

When `useSystemBucket: true`:

- The chart-emitted `<release>-s3-creds` Secret is no longer rendered, and the chart leaves `spec.backup.storages`, `spec.backup.tasks` and `spec.backup.pitr` unset on the `PerconaServerMongoDB`.
- On every BackupJob the driver SSA-injects the `s3-storage` entry from the strategy coordinates (bucket/endpoint from the platform system bucket, `credentialsSecret: cozy-backups-creds`, prefix `<namespace>/<application>`) under its own field manager, so a Flux re-render never reverts it and a later change to the coordinates is picked up on the next backup rather than frozen at the first. The backup itself is not started until the operator reports that it has pushed that `spec.backup` into pbm's own configuration (`status.observedGeneration` caught up with the cluster's generation and the `PBMReady` condition `True`): pbm writes to whatever its config last said, not to the spec, so a backup started before that push would land at the previous coordinates while its `Backup` recorded the new ones. The job waits at `Ready=False PerconaServerMongoDBPBMConfigPending` meanwhile, and fails at the backup deadline if the operator never gets there.
- The injection waits for the release to actually render the flag. The app's `backup.useSystemBucket` is a desired value (it reads `true` as soon as it is written, before helm-controller renders the revision), while the tenant's own storage, scheduled tasks and PITR stream from the previous render stay on the `PerconaServerMongoDB` until it does. As long as the cluster still carries `spec.backup.tasks` or `spec.backup.pitr`, the driver does not inject and holds the BackupJob at `Ready=False` (`PerconaServerMongoDBLegacyRender`), failing it at the backup deadline; a release wedged on an old revision therefore never has its nightly dump and oplog redirected into the shared bucket. `useSystemBucket: true` together with `enabled: false` is refused by the chart at render time; the schema carries the same rule as an `x-kubernetes-validations` marker, which the aggregated apiserver does not evaluate yet ([#2657](https://github.com/cozystack/cozystack/issues/2657)), so until then the render-time refusal is what stops such a release, and a release wedged on it shows up as a failed HelmRelease rather than a redirected backup.

`destinationPath`, `endpointURL`, `insecureSkipTLSVerify`, `s3AccessKey` and `s3SecretKey` are ignored in this mode.

Because the chart drops `spec.backup.tasks` and `spec.backup.pitr`, the psmdb operator's own scheduled backups and oplog PITR do **not** run on this flow — `backup.schedule` and `backup.retentionPolicy` stay in the schema for the default flow but have no effect here, and the `recoveryTime` PITR restores described below are not available. Migrate scheduled backups to a `backups.cozystack.io/Plan` against `cozy-default` instead. **Flipping this flag on a running app** removes the storage, tasks and pitr the app had, so a release that was taking scheduled backups + PITR before the flip stops until a `Plan` takes over.

Dropping `spec.backup.tasks` also drops the psmdb `keep` retention it carried, so on this flow **the driver owns the archive** the way the Rabbitmq/Redis drivers own theirs (an on-demand `PerconaServerMongoDBBackup` is not covered by psmdb task retention). The driver stamps the operator's `percona.com/delete-backup` finalizer onto each backup it mints against a storage that carries the platform coordinates (the strategy's bucket and `credentialsSecret`, as read back from the live cluster after the injection; a strategy without an `s3` block, or a storage pointing anywhere else, holds the job at `Ready=False` instead of minting an unowned dump), and deleting a Cozystack `Backup` (by hand today; by platform retention once it lands) deletes that `PerconaServerMongoDBBackup` CR — whose finalizer removes the pbm object from the shared bucket before the `Backup` is released, so deleting `Backup` objects is what reclaims `cozy-backups`. A legacy backup writes to the tenant's own bucket and keeps the pre-existing hands-off contract (its lifecycle stays the tenant's / operator's; nothing is deleted on `Backup` removal). Note this prunes only when a `Backup` is deleted: unlike CNPG, whose shipped strategy sets a `retentionPolicy` the engine trims on, MongoDB has no engine-side scheduled trim on this flow, so keeping `cozy-backups` bounded depends on a `Plan`'s retention actually deleting old `Backup` objects. **A `Plan` has no retention field yet** (`PlanSpec` carries only `applicationRef`, `backupClassName` and `schedule`), so today a nightly `useSystemBucket` Plan grows the shared bucket unbounded — `schedule` and `retentionPolicy` on the app are inert here (see [Opt-in to the system bucket](#opt-in-to-the-system-bucket)), and platform-level retention is tracked in the [`BackupRetentionPolicy` design (#4192)](https://github.com/cozystack/cozystack/pull/4192). Teardown GC of orphaned `Backup`s / S3 data is [#3966](https://github.com/cozystack/cozystack/issues/3966). Until those land, bound `cozy-backups` with an S3 lifecycle policy on the object store. Two cases release the `Backup` without waiting for the object to be pruned, so a wedged prune never pins a namespace in `Terminating`: a terminating namespace (where the operator's delete-backup step cannot run) and the `backups.cozystack.io/skip-artifact-cleanup: "true"` annotation. In both the driver strips its own finalizer and leaves the object for a bucket lifecycle policy to reclaim. A down operator or unreachable storage in a live namespace is NOT released automatically — the `Backup` stays `Terminating` as a visible signal until the operator recovers or you set that annotation to force the release.

A dump that has started streaming on this flow is not cancelled on the 30-minute backup deadline (a real dataset routinely outruns it, and deleting the CR mid-stream would prune a partial), but it is not unbounded either: after 24 hours in `running` the `BackupJob` fails with a `BackupAbandoned` warning naming the `PerconaServerMongoDBBackup`, which is left in place. If that dump later completes, its archive is reachable only through that CR; delete the CR to prune it.

**Opting back out** (`useSystemBucket` true→false) is not automatic in reverse: the driver stops injecting, but the `s3-storage` entry it already applied stays on the live `PerconaServerMongoDB` under the driver's own field manager (`cozystack-psmdb-backup-driver`) — the chart does not own it and so never prunes it. It is inert once `backup.enabled=false`; to fully return a release to the legacy flow, delete that storage entry from the `PerconaServerMongoDB` by hand before re-declaring the tenant's own `backup.*` S3 values. Until it is removed, a new `BackupJob` on that release is refused rather than written into the platform bucket unowned: the driver recognises the injected entry by its `credentialsSecret` and holds the job at `Ready=False` (`PerconaServerMongoDBStorageStale`) naming that manual step, failing it at the backup deadline. A backup already streaming when the flag was flipped is unaffected — its flow is fixed by the finalizer on its own operator CR.

### Point-in-time recovery (MongoDB)

psmdb records an oplog stream between logical backups. A MongoDB `RestoreJob` recovers to a timestamp via `spec.options.recoveryTime` — the same option name and RFC3339 format the Postgres/CNPG driver uses, so the two are uniform:

```yaml
spec:
  options:
    recoveryTime: "2026-08-05T12:34:56Z"   # RFC3339 (UTC), same as the CNPG driver
```

The driver converts `recoveryTime` to the psmdb oplog target internally. Unlike CNPG (whose empty `recoveryTime` replays WAL to the latest archived point), an empty `recoveryTime` here restores the backup snapshot as taken — a psmdb logical backup is already a consistent point, so "restore this backup" is the safe default. `spec.options.restoreTimeoutSeconds` caps how long the driver waits for the operator restore before failing (default 30m), matching the CNPG option. Any unrecognised key under `spec.options` (e.g. a `recoverytime` typo) is ignored but surfaced as a `UnknownRestoreOption` Warning event on the RestoreJob rather than silently dropped.

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
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | CNPG, MariaDB, Etcd, RabbitMQ, Redis      |
| `accessKey` / `secretKey` (плюс `bucketName`, `endpoint`, `region`) | Сайдкар ClickHouse  |
| `cloud`                                       | Velero (формат файла учётных данных AWS)      |
| `blob_credentials.json`                       | FoundationDB backup_agent                 |

The Redis dump Job additionally reads the `endpoint`, `bucketName`, and `region` keys (alongside the `AWS_*` pair) via `secretKeyRef`, the same set the ClickHouse sidecar consumes.

The dump Job also speaks to the Redis app's own Sentinel and master, which is a separate TLS axis from the S3 endpoint above. When the `Redis` app has `tls.enabled`, the operator moves both to a TLS-only listener and publishes the CA at `redis-<app>.ca-cert`; the Job mounts that Secret optionally and connects with `--tls --cacert` exactly when its `ca.crt` is present, so a plaintext (non-TLS) app is unaffected. This covers the default `tls.authClients: no`. Mutual TLS (`authClients: yes`) is not supported for backup — it requires a client certificate signed by the release CA, which the platform does not issue.

### Окно загрузки (bootstrap)

При установке на чистый кластер `BackupStorageLocation` `cozy-default` у Velero рендерится до того, как у проектора учётных данных появляется возможность скопировать `cozy-backups-creds` в `cozy-velero`. BSL сообщает статус `Unavailable`, пока не завершится первый синхронный проход проектора (который запускается, как только `backupstrategy-controller` получает лидерство — на практике через считанные моменты после того, как Pod становится Ready, обычно через десятки секунд после завершения `helm install`, а не минут). Velero отклоняет новые запросы `Backup` И `Restore` для `storageLocation: cozy-default` в течение этого окна. Планируйте автоматизацию бэкапа VM соответствующим образом, либо дождитесь готовности BSL перед отправкой бэкапов: `kubectl -n cozy-velero wait backupstoragelocation cozy-default --for=jsonpath='{.status.phase}'=Available --timeout=5m`.

**Заметка о перезапусках контроллера.** BSL "мигает" статусом `Unavailable` при каждом перезапуске пода `backupstrategy-controller`, пока проектор повторяет свой первый синхронный проход. Окно короткое (единицы секунд), но операторы, которые настраивают алерты на доступность BSL, должны подавлять алерты во время событий `kube_pod_container_status_restarts_total{container=backupstrategy-controller}` контроллера или использовать более длинное окно оценки, чем такт проектора (60с).

### Загрузка бакета cozy-default

`cozy-default` ships an `apps.cozystack.io/Bucket cozy-backups` CR in `tenant-root`, which the bucket-application chart turns into a `BucketClaim`; the COSI driver then assigns the real S3 bucket name (`bucket-<claim-UID>`, so it cannot be computed in advance) and writes it to the BucketClaim's `.status.bucketName`. The strategy templates and the Velero BSL all read that real bucket name (Helm `lookup` against the BucketClaim). On a fresh install the BucketClaim takes a reconcile cycle to populate its status — until it does, the strategy templates render empty and only the `Bucket` CR + `BackupClass` are present in the cluster.

**That skip does not repair itself on a reconcile.** helm-controller re-renders a release only when its chart or values change; the interval reconcile is a no-op for a healthy release, and drift detection is off on operator-generated HelmReleases. A cluster that lost the race at install time therefore keeps `BackupClass cozy-default` with **no** `Strategy` CRs and **no** Velero BSL indefinitely — which also fail-closes the pre-adoption snapshot in the v1.6.0 etcd migration.

The same trap sits one release earlier, on the Secret everything else depends on. `bucket-cozy-backups-system-credentials` is rendered by the `bucket-cozy-backups-system` release behind a `lookup` of the COSI Secret, and is skipped just as permanently when that lookup is empty. Without it the credentials projector has no source at all, so no strategy, no Velero and no v1.6.0 etcd migration can resolve — and the gate cannot even determine the bucket name, which it reads from that Secret.

Convergence is driven instead by the controller's default-objects gate (`backupStorage.reconcileDefaultObjects`, on by default), which repairs both, in order. While the credentials Secret is absent or carries no bucket name, the gate stamps `reconcile.fluxcd.io/forceAt` + `requestedAt` on the **bucket's** `bucket-<name>-system` HelmRelease. Once the bucket name resolves it checks that every object `cozy-default` routes to exists and stamps the same pair on the **`backupstrategy-controller`** HelmRelease, forcing the real Helm upgrade that re-runs the lookups. The two are throttled independently (one force per 5 minutes each), so the second is not delayed by the first. Expect the objects within a minute or two of the bucket becoming ready.

Each default `Strategy` CR also waits for its own CRD. The chart ships the `strategy.backups.cozystack.io` CRDs as templates in the same release, and Helm resolves every object's kind before it applies any, so a CR rendered next to a CRD the apiserver does not serve yet would fail the whole release, CRDs included. Each strategy template therefore renders only once its CRD is `Established`. That holds the CRs back on the first render of every install, including an external-S3 one where the bucket name is known up front, and on the upgrade that first ships a new strategy kind: that revision creates the CRDs, and the gate's forced upgrade above renders the CRs.

The gate does not force a suspended HelmRelease — helm-controller ignores both annotations while `spec.suspend` is true, so it logs the skip and leaves the force counter alone. A release left suspended (`cozyhr suspend`) is therefore never repaired until it is resumed.

Watch it with:

```bash
kubectl -n cozy-backup-controller logs deploy/backupstrategy-controller | grep default-objects-gate
```

#### Manual recovery on an affected cluster

Only needed on a cluster running a version without the gate (or with `reconcileDefaultObjects: false`). A plain `flux reconcile helmrelease` does **nothing** here — it does not re-render. You need a forced upgrade, and **both** annotations: `forceAt` is what makes helm-controller run a real Helm upgrade, and it is only honoured together with `requestedAt`.

First confirm the bucket name is actually resolvable — forcing before that just re-runs the same empty lookup:

```bash
kubectl -n tenant-root get bucketclaim bucket-cozy-backups -o jsonpath='{.status.bucketName}'
```

Then force the two releases, **in this order**:

```bash
# 1. The credentials Secret. It is rendered by the -system release, not by
#    bucket-cozy-backups — easy to miss, and the projector (hence every
#    strategy and Velero) has no source without it.
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
kubectl -n tenant-root annotate helmrelease bucket-cozy-backups-system \
  reconcile.fluxcd.io/forceAt="$ts" reconcile.fluxcd.io/requestedAt="$ts" --overwrite
kubectl -n tenant-root get secret bucket-cozy-backups-system-credentials

# 2. The Strategy CRs and the Velero BSL.
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
kubectl -n cozy-backup-controller annotate helmrelease backupstrategy-controller \
  reconcile.fluxcd.io/forceAt="$ts" reconcile.fluxcd.io/requestedAt="$ts" --overwrite
kubectl get $(kubectl get crd -o name | grep strategy.backups.cozystack.io) 2>/dev/null
kubectl -n cozy-velero get backupstoragelocation cozy-default
```

The race is nested: step 2's `lookup` resolves from the BucketClaim status, but the projector — and the v1.6.0 etcd migration — read the Secret from step 1, so a cluster missing both needs both.

### Наблюдаемость (Observability)

Проектор учётных данных выдаёт два счётчика Prometheus с метками по `namespace` (и `reason` для сбоев):

- `cozystack_backup_credentials_projection_successes_total`
- `cozystack_backup_credentials_projection_failures_total`

Настройте алерт на `rate(cozystack_backup_credentials_projection_failures_total[5m]) > 0` или `absent_over_time(cozystack_backup_credentials_projection_successes_total[10m])`, чтобы отслеживать устаревшие учётные данные BSL или некорректный исходный Secret без разбора логов.

The default-objects gate emits three more:

- `cozystack_backup_default_objects_missing{backupclass="cozy-default"}` — how many of the objects the platform default backups depend on are absent: the credentials Secret, the Strategy CRs `cozy-default` routes to, and the Velero BSL. It is non-zero whatever the HelmRelease's `Ready` condition says, so it catches missing Strategy CRs that the release status does not show. Alert on `min_over_time(cozystack_backup_default_objects_missing[15m]) > 0`.
- `cozystack_backup_default_objects_check_errors_total{backupclass="cozy-default"}` — checks that could not reach a conclusion (an API error reading the source Secret, the BackupClass, or one of the routed objects). The gauge above is deliberately **not** written on those ticks, so that it does not flap on a transient API error — which means that while this counter climbs, the gauge is stale and a `0` on it proves nothing. Pair the two: `min_over_time(cozystack_backup_default_objects_missing[15m]) > 0 or rate(cozystack_backup_default_objects_check_errors_total[15m]) > 0`.
- `cozystack_backup_default_objects_force_reconciles_total{namespace,name}` — forced Helm upgrades issued, labelled by the release forced (this chart's own, or the bucket's `-system` release). A counter that keeps climbing means the forced render is not producing the objects (a missing CRD, for instance), which is a different problem from the install-time race. A suspended release is skipped before the patch and is **not** counted here, so a paused release cannot masquerade as a render that keeps failing — look for the `skipped forcing a suspended HelmRelease` log line instead.

## Административные переопределения для `cozy-default`

`cozy-default` is rendered by the `backupstrategy-controller` chart and owned by Flux's helm-controller. **Direct `kubectl edit backupclass cozy-default` is overwritten on the next helm reconcile** — the same applies to its companion `strategy.backups.cozystack.io/*` CRs (`cozy-default-cnpg`, `cozy-default-etcd`, `cozy-default-mariadb`, `cozy-default-altinity`, `cozy-default-mongodb`, `cozy-default-foundationdb`, `cozy-default-rabbitmq`, `cozy-default-redis`, the two `cozy-default-velero-*`). The supported override path is the `backupStorage` block on the **`platform` component** of the `cozystack.cozystack-platform` Package CR:

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

The platform chart forwards this block into the child `Package cozystack.backupstrategy-controller` as `components.backupstrategy-controller.values.backupStorage` (`packages/core/platform/templates/bundles/system.yaml`), from where the cozystack operator merges it into the `backupstrategy-controller` HelmRelease over the chart defaults. Two paths that look plausible do **not** work: `spec.components.backupstrategy-controller` on the `cozystack.cozystack-platform` Package is silently ignored (the only component under that PackageSource is `platform`), and patching the child `Package cozystack.backupstrategy-controller` directly is reverted whenever the platform helm-reconcile re-renders it.

A sibling [`backupStrategyController`]({{% ref "/docs/v1.7/operations/configuration/platform-package" %}}) block on the same `platform` component is forwarded the same way, for the controller's own knobs rather than the bucket. The one an operator reaches for is `redisBackupResources`, which sizes the Redis strategy Pod — restore loads the whole dataset into a throwaway loader, so a large Redis needs more memory / ephemeral-storage than the defaults (the loader-not-ready log line points here):

```yaml
spec:
  components:
    platform:
      values:
        backupStrategyController:
          redisBackupResources:
            limits:
              memory: 8Gi
              ephemeral-storage: 32Gi
```

| Параметр | Эффект |
|---|---|
| `provisionBucket` | Toggle creation of the in-cluster `apps.cozystack.io/Bucket` CR. Set `false` for external S3 (see [Disabling the platform-managed bucket](#disabling-the-platform-managed-bucket)). |
| `bucketName` | Two modes. With `provisionBucket: true` (default): K8s name of the Bucket CR + lookup key for the COSI BucketClaim — the actual S3 bucket name is the COSI-assigned UUID, surfaced through `BucketClaim.status.bucketName`. With `provisionBucket: false`: taken **verbatim as the real S3 bucket name** and baked into every strategy CR + the Velero BSL. |
| `namespace` | Namespace the Bucket CR (and its system-credentials Secret) lives in — `tenant-root` by default. Must be a tenant namespace (`tenant-*`): the Bucket chart's RBAC helper fails the Helm render for any other prefix. |
| `bucketNameOverride` | Escape hatch for offline `helm template` renders — bypasses the live-cluster BucketClaim lookup. Leave empty in production. |
| `endpoint` | **Fallback** S3 endpoint. For a provisioned bucket the strategy CRs + Velero BSL derive the endpoint from the COSI system Secret (external ACME ingress, forced `https://`) instead; this value is used only for external S3 (`provisionBucket: false`) and offline renders. For external S3, switching it to `https://` enables TLS in the MariaDB/FoundationDB strategies, which derive TLS from the scheme. The Redis dump Job is not scheme-driven: the projector delivers a bare host and the script prepends `https://` unconditionally, so the Job always connects over TLS — point `endpointCASecretName` (below) at the private CA rather than relying on the scheme, and ensure that CA is reachable to the relevant Pods. |
| `endpointCASecretName` | Optional Secret (key `ca.crt`) in the app namespace the Redis Job trusts for a self-signed S3 endpoint. Empty by default: the projected endpoint is always `https://` and the platform bucket's ACME cert verifies against the image's system CA store unaided. Set it only for a private CA. The Job mounts it optionally (nothing projects this Secret automatically), so a name typo does not wedge the Pod on `FailedMount`: a missing `ca.crt` falls through to the system CA store and the Job fails fast at the TLS handshake with a legible error — it does not skip verification, which still needs the explicit `insecureSkipTLSVerify` opt-in. |
| `insecureSkipTLSVerify` | Disables S3 certificate verification for the Redis Job (`curl -k`). `false` by default and an explicit opt-in, never a fallback — an untrusted-cert endpoint fails closed unless this is set. Prefer `endpointCASecretName`. |
| `region` | Re-projected into `cozy-backups-creds` on the next reconcile. Pod-restart required for chart-emitted clients consuming the region via env (ClickHouse sidecar today). |
| `forcePathStyle` | Path-style addressing; SeaweedFS S3 requires it, AWS S3 typically doesn't. |
| `systemSecretName` | Name of the human-friendly Secret produced by the Bucket app (or pre-created manually for external S3). The projector also accepts the raw COSI Secret format. |
| `systemNamespaces` | Namespaces where the controller eagerly projects `cozy-backups-creds` (Velero BSL, FDB operator). Tenants are projected lazily during BackupJob reconcile. |

Когда переопределение нужно выйти за рамки координат хранилища — другой retention, другая привязка драйвер→Kind, разделение по нескольким регионам — создайте **соседний BackupClass** с уникальным именем (любым, кроме `cozy-default`). Соседние BackupClass существуют вне чарта, принадлежат администратору, и Flux их не трогает. Арендаторы подключаются, устанавливая `backupClassName: <ваш-класс>` в своих `BackupJob`.

## Настройка через собственный BackupClass

The defaults aim at a reasonable middle (gzip compression where applicable; engine-side retention only where the strategy carries it, which today is the CNPG `retentionPolicy: "30d"` and the two Velero `ttl: 720h`; every other shipped strategy, MongoDB included, sets none, so its archives on the shared bucket are bounded only by an S3 lifecycle policy or a manual `Backup` delete: a `Plan` only creates BackupJobs and never deletes a `Backup`). To override for a specific tenant or workload, create your own `BackupClass` pointing at the same strategy CRs but with tweaked `parameters`, or a fresh strategy CR. Common knobs:

- **CNPG strategy**: `barmanObjectStore.retentionPolicy`, `data.compression`, `wal.compression`.
- **MariaDB strategy**: `compression`, `maxRetention`, `databases[]`.
- **MongoDB strategy**: `storageName` (which `spec.backup.storages` entry on the psmdb cluster to use), `type` (`logical`), `compressionType` / `compressionLevel`, and — for the `useSystemBucket` flow — the `s3` coordinates the driver injects. On the default flow the S3 target is tuned via `backup.*` values on the MongoDB release instead (see [MongoDB: backup storage](#mongodb-backup-storage)).
- **Altinity strategy**: tune the `clickhouse-backup` sidecar via `backup.*` values on the ClickHouse release; the strategy Pod is a thin HTTP client. When the S3 endpoint's certificate is signed by a private CA rather than a publicly-trusted one — SeaweedFS's in-cluster `:8333` being the case in point — point `backup.endpointCA` at a Secret holding that CA bundle; the chart mounts it into the sidecar and adds it to the trust store via `SSL_CERT_DIR`, which supplements the system CA set rather than replacing it.
- **FoundationDB strategy**: `snapshotPeriodSeconds`, `agentCount`, `urlParameters[]`.
- **Rabbitmq strategy**: `artifactURITemplate` (the `<namespace>/<application>/<backup-name>/definitions.json` object-key layout) and the pod `template` (image, resources). The backup is a definitions export over the management API — vhosts, users, permissions, queues, exchanges, bindings, policies, parameters — so message payloads are out of scope and there is no point-in-time recovery; a full message-data backup is a Velero volume snapshot instead. **Restore is a merge, not a reset**: importing definitions (`POST /api/definitions`) creates or updates what the export contains and never deletes, so anything created after the backup survives the restore and the broker is not returned to its exact backup-time state. A to-copy restore imports the source's users (with password hashes) into the target, so those source credentials become valid logins there. Unlike the operator-backed strategies (whose engine owns archive retention), the Rabbitmq driver owns its object outright and deletes it from the bucket when its `Backup` is deleted — via a one-shot Job the Backup's removal waits on — so a retention-pruned `Plan` does not normally accumulate objects. The delete is **best-effort**: when it cannot run from here the Backup is released without deleting the object (with a `Warning` Event naming what was left behind), so the Backup — and any namespace being torn down — never wedges. The named give-up conditions are: the namespace is terminating (`CREATE` is forbidden there), the strategy CR or the projected credentials are unavailable, the rendered Job name is invalid, or the skip annotation below is set. Otherwise a genuinely failing delete (object storage unreachable) keeps the `Backup` in `Terminating` (a visible signal to act on) and retries. To release such a stuck `Backup`, annotate it `backups.cozystack.io/skip-artifact-cleanup: "true"` — cleanup then skips the delete and lets the `Backup` go, leaving the object in the bucket to be reclaimed manually or by a bucket lifecycle policy (`kubectl annotate backup <name> -n <namespace> backups.cozystack.io/skip-artifact-cleanup=true`).
- **Velero strategy (VMInstance / VMDisk)**: `ttl`, `includedResources[]`, `excludedResources[]`.
- **Etcd strategy**: today the strategy is path-only, and a `Plan` carries no retention field yet (see [#4192](https://github.com/cozystack/cozystack/pull/4192)), so nothing trims etcd snapshots on the shared bucket automatically either.

Управляемый системой Secret с учётными данными — **единственный** способ для внутрикластерных стратегий добраться до `cozy-backups`. Не встраивайте ключи доступа в `BackupClass.parameters` — модель безопасности опирается на ссылки на Secret, а `parameters` попадают в `Backup.status.underlyingResources`, который могут читать арендаторы.

## Отключение управляемого платформой бакета

If a deployment runs against an external S3 (no SeaweedFS), set `backupStorage.provisionBucket: false` via the `platform` component override described above and create the source credentials Secret in `tenant-root` manually (flat-key format: `accessKey` / `secretKey` / `endpoint` / `bucketName`; or the raw COSI `BucketInfo` JSON). In the same `backupStorage` block, update `endpoint`, `region`, **and `bucketName`**: with `provisionBucket: false` the strategies and the Velero BSL take `bucketName` verbatim as the real S3 bucket name (no COSI lookup), so it must name the actual bucket on the external S3 — the `bucketName` key inside the Secret alone is not enough. The Velero `BackupStorageLocation` picks the same values up automatically (the chart renders it from the same `backupStorage` block), so no separate BSL configuration is needed. Note that disabling the cluster-default BSL itself (the chart's `velero.bslEnabled` value) is **not** carried by the `backupStorage` override path — the platform Package forwards only the `backupStorage` block.

## Заметки об обновлении с бэкапов, управляемых чартом

> **Postgres backups now use the CloudNativePG Barman Cloud plugin, not native `spec.backup.barmanObjectStore`.**
>
> Postgres backups were migrated off the deprecated native `barmanObjectStore` (removed in CNPG 1.29) onto the [Barman Cloud plugin](https://github.com/cloudnative-pg/plugin-barman-cloud). The `barman-cloud-*` binaries the native path needs are absent from the `standard` image variant `keycloak-db` pins; `apps/postgres` pins bare (system-flavor) tags that still ship them — its breakage was the operator/CRD skew below, not missing binaries — but the system flavor is deprecated upstream, so both move to the plugin. The chart now renders `spec.plugins` on the `cnpg.io/Cluster` plus a `barmancloud.cnpg.io/ObjectStore` CR that carries the S3 configuration, and the CNPG backup driver SSA-applies an `ObjectStore` and patches `spec.plugins` (instead of `spec.backup.barmanObjectStore`) for the platform flow; `Backup`/`ScheduledBackup` use `method: plugin`. On `helm upgrade` a legacy chart-managed Cluster's `spec.backup.barmanObjectStore` is replaced by `spec.plugins` + an `ObjectStore`. This only works once the `plugin-barman-cloud` operator is installed and co-located with the CNPG operator in `cozy-postgres-operator` (shipped by the `postgres-operator` chart) and its cert-manager dependency is present — otherwise the Cluster references a plugin that is not registered and backups / WAL archiving stall.
>
> **Mixed-version window: BackupJobs fail until the app re-renders with the new chart.** A `BackupJob` that fires while a `Cluster` still carries the pre-upgrade chart's native `spec.backup.barmanObjectStore` is rejected by the CNPG admission webhook (`Cannot enable a WAL archiver plugin when barmanObjectStore is configured`) — the driver cannot attach `spec.plugins` alongside the native config. This resolves itself once Flux re-renders the Postgres app with the new chart (which replaces `barmanObjectStore` with `spec.plugins`); re-run the BackupJob afterward. Upgrading only the operators/driver without the app charts leaves every `backup.enabled: true` Postgres in this state permanently.
>
> **Postgres `backup.enabled: true` with placeholder credentials no longer wires backups on upgrade.**
>
> The pre-v1.5 defaults for `backup.s3AccessKey` / `backup.s3SecretKey` in `packages/apps/postgres/values.yaml` were the literal `"<your-access-key>"` / `"<your-secret-key>"` placeholders, so the Postgres chart still rendered a backup block on the `cnpg.io/Cluster` (with junk credentials, WAL archiving failing at runtime). Starting with v1.5 those defaults are empty strings and the chart NO LONGER renders any backup wiring when the placeholders are unmodified. Tenants on the legacy chart-managed flow who relied on those placeholders see `spec.plugins` and the `ObjectStore` disappear from the live `Cluster` on `helm upgrade`. Action — pick one:
>
> - **Move to the platform flow (recommended).** Set `backup.useSystemBucket: true`; the chart leaves `spec.plugins` unset and the CNPG backup driver SSA-applies the `ObjectStore` and patches `spec.plugins` onto the live `Cluster` at first BackupJob time. No tenant-side keys required.
> - **Stay on the legacy chart-managed flow.** Supply real `backup.s3AccessKey` / `backup.s3SecretKey` (or a pre-existing `backup.s3CredentialsSecret.name`); the chart renders `spec.plugins` + the `ObjectStore` from those coordinates.
>
> **Two platform-level changes ride along with this migration (they are required for the plugin to run):**
>
> - **CloudNativePG operator upgraded** (`postgres-operator` chart). A minor operator upgrade for the whole fleet; the CNPG CRDs move with it. This also fixes a latent bug where the operator image was newer than its bundled CRDs (`status.instanceID.sessionID` pruned), which made the operator believe the instance manager restarted and fail **every** backup cluster-wide with `instance manager was restarted during backup`. The vendored chart ships the CNPG CRDs as ordinary release manifests (gated by `crds.create`), so a normal `helm upgrade` updates them together with the operator — the `helm.sh/resource-policy: keep` annotation only prevents their deletion, not updates. The historical skew came from the `image.tag` pin outrunning the vendored chart's CRDs; that pin has since been removed, so no out-of-band CRD apply is needed unless the HelmRelease itself is held back.
> - **LINSTOR scheduler admission webhook must not strip native-sidecar fields.** Older `linstor-scheduler` extender builds (≤ v0.3.5's predecessors) decoded every pod through a stale vendored Kubernetes API and re-encoded it, stripping `initContainers[].restartPolicy` cluster-wide — which breaks the plugin's restartable barman sidecar ("startupProbe forbidden without restartPolicy=Always"). The platform already ships the fixed webhook (`linstor-scheduler` re-vendored to upstream chart 0.3.1 / extender v0.3.6, which stopped stripping unknown pod fields), so no action is needed on an up-to-date platform; just do not hold the `linstor-scheduler` package back on an older version when rolling out the plugin.
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

An application takes one restore at a time. A RestoreJob that targets an application another unfinished RestoreJob is already restoring fails with reason `ConcurrentRestore` before it changes anything, and its message names the job that goes first. It is not queued: once that job has finished, create a new RestoreJob if the restore is still wanted. A restore that has started always goes first. Between two that have not, the older one runs; creation times have one-second precision, so of two created in the same second, the one whose name sorts first runs.

## Восстановление на момент времени (PostgreSQL)

A `RestoreJob` restores a `Postgres` application from a `Backup`. Omit `spec.options.recoveryTime` to recover to the latest point in the WAL archive; set it (RFC3339) to recover the database to an exact instant — a point-in-time recovery (PITR). The CNPG barman-cloud plugin restores a base backup and replays archived WAL from it: up to `recoveryTime` when one is set, so the restored cluster reflects the database as of that instant and later writes are absent, and to the end of the archive otherwise.

The base backup a restore starts from is the one the `Backup` refers to: the driver passes its barman backup ID to CNPG as `bootstrap.recovery.recoveryTarget.backupID`. There are two exceptions, and for both the choice is left to the plugin. The first is a `recoveryTime` earlier than one second after that backup ended, which the backup cannot serve (recovery would have to stop before the backup is consistent); the plugin then takes the newest base backup that ended at or before `recoveryTime`. The second is a `Backup` whose `cnpg.io/Backup` no longer exists: retention (`barmanObjectStore.retentionPolicy`) deletes it together with the base backup it describes, so the archive can no longer start from that backup, and the `RestoreJob` records a `BaseBackupGone` warning event. A base backup removed from the bucket by anything else — a lifecycle rule, a manual delete — is still pinned for as long as its `cnpg.io/Backup` stays. The plugin deletes a `cnpg.io/Backup` whose base backup has left the catalog on its next maintenance pass (every `instanceSidecarConfiguration.retentionPolicyIntervalSeconds` of the `ObjectStore`, 30 minutes by default, retention policy or not), but only from the primary of the cluster that took it, running under the same UID. Until then a restore from it fails after the target has been purged, with `no backup found with ID` in the recovery log, and a retry fails the same way; deleting that `cnpg.io/Backup` by hand, which leaves the object store untouched, lets the next `RestoreJob` go through the plugin's choice. Left to itself for every restore, the plugin would start from the newest base backup in the archive whenever `recoveryTime` is empty, and from the newest one ending by `recoveryTime` otherwise, whichever `Backup` the `RestoreJob` names and on any timeline — see [Archives with several timelines](#archives-with-several-timelines) for why that matters.

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

A full, scripted example (write a marker, capture the timestamp, restore to it, assert what survived) is in the Cozystack repository at [`examples/backups/postgres/`](https://github.com/cozystack/cozystack/tree/main/examples/backups/postgres): `45-restorejob-pitr.yaml`, driven by `run-all.sh`.

### Восстанавливаемое окно

`recoveryTime` должен попадать в окно, которое может восстановить архив:

- **Earliest** — the completion of the oldest base backup still in the archive. You cannot recover to an instant before the first base backup: WAL replay always starts from a base backup, and retention (`barmanObjectStore.retentionPolicy`) eventually trims the oldest ones together with the WAL that predates them. Aim at least one second after a backup's `status.stoppedAt`: `stoppedAt` is truncated to the second, while the plugin compares `recoveryTime` with the end time barman records in `backup.info`, to the microsecond, and keeps only a backup that ended at or before it. A `recoveryTime` equal to `stoppedAt` therefore falls before that backup's actual end: an older backup is used instead, and when there is none the restore fails with `no target backup found`.
- **Latest** — the last transaction, commit or abort, contained in the WAL shipped to object storage. It is not the newest WAL segment: a time-targeted recovery ends just before the first transaction recorded after `recoveryTime`, and a segment switch, a checkpoint or the end of a base backup is not one. A `recoveryTime` at or after the last archived transaction leaves PostgreSQL nothing to stop on. On a busy database the last transaction trails "now" by the archive lag; on a database at rest it is its last write, however recent the WAL archive and however recent the latest base backup. Once the source is deleted, the window is frozen at the last transaction that made it to S3 before it went away.

A `recoveryTime` **at or after the last archived transaction cannot converge**: PostgreSQL replays every available WAL, never finds a transaction after the target, exits with `FATAL: recovery ended before configured recovery target was reached`, and CNPG re-creates the recovery instance in a loop. Such a wedged restore is failed by the restore deadline (`spec.options.restoreTimeoutSeconds`, default 30m) — and the driver reads the recovery pod's log at that point, so instead of a generic timeout the RestoreJob ends `status.phase: Failed` with conditions `RecoveryConverged=False` and `Ready=False`, both reason `RecoveryTargetUnreachable`, and a message naming the target. The driver deliberately does **not** fail earlier off that FATAL: a *reachable* near-now target hits the identical FATAL transiently — often repeatedly, on a slow archiver — before it converges, so an earlier trip would reject a recoverable restore. To reject an unreachable target quickly, set a short `restoreTimeoutSeconds`; otherwise pick a time before the last archived transaction. The state as of the last write needs no `recoveryTime` at all: omitting it replays the whole archive, and that is the state it recovers.

Restoring to a **very recent** instant is safe as long as the database keeps writing and WAL archiving is current: the segment covering the target, or the transaction after it, may not be in object storage yet and the same FATAL fires transiently, but because the driver only fails at the deadline (not on that FATAL), the recovery has the whole window to catch up — the next attempt promotes once the WAL ships and the cluster goes healthy, which completes the restore. Only a target that never becomes reachable within the deadline is failed: on a database that has stopped writing, that is every target after its last transaction. If archiving is badly behind (a stalled `archive_command`, an overloaded cluster) a near-now target can exceed even the default 30m window; restore to a point you can confirm is followed by an archived transaction (see the discovery section below).

A `recoveryTime` **before the earliest base backup** fails differently: PostgreSQL cannot begin replay before the base backup it restored, so recovery never reaches a consistent state and never emits the "recovery ended before …" FATAL the driver classifies on. That case also surfaces at the deadline, but with the generic reason `RestoreFailed` rather than `RecoveryTargetUnreachable`. Choosing a `recoveryTime` at least one second after the oldest base backup's `stoppedAt` (below) avoids it.

### Определение самого раннего / самого позднего восстанавливаемого времени

`Cluster.status.firstRecoverabilityPoint` у CNPG существует в схеме статуса, но не заполняется надёжно под плагином barman-cloud, поэтому читайте окно из каталога бэкапов. Каждый завершённый базовый бэкап записывает свой диапазон WAL и временные метки на соответствующем `cnpg.io/Backup`:

```bash
# Completed base backups, oldest first: STOP plus one second is the earliest
# instant that backup alone can restore to; the oldest one bounds the window.
kubectl -n <ns> get backups.postgresql.cnpg.io \
  --sort-by=.status.stoppedAt \
  -o custom-columns=NAME:.metadata.name,PHASE:.status.phase,ID:.status.backupId,START:.status.startedAt,STOP:.status.stoppedAt,BEGINWAL:.status.beginWal,ENDWAL:.status.endWal

# The cozystack Backup points at its underlying cnpg.io/Backup and S3 prefix.
kubectl -n <ns> get backup.backups.cozystack.io <name> -o jsonpath='{.spec.driverMetadata}'
```

The upper bound is the timestamp of the last `COMMIT` or `ABORT` record in the archived WAL, which nothing in the cluster status reports. `pg_waldump` prints it from the newest segments under `<destinationPath>/<serverName>/wals/`, working back from the newest segment until one holds such a record; on a database at rest that can be several segments back, because every segment switch and every base backup adds one with no transaction in it. Any `recoveryTime` before that timestamp is reachable; for the state as of that last transaction, omit `recoveryTime`.

### Archives with several timelines

A WAL archive can hold several PostgreSQL timelines under one `serverName`. Every failover starts one, and so did every in-place restore made before restored clusters archived to a fresh prefix (`bootstrap.newServerName`): those wrote the new timeline back into the prefix they had recovered from, often without its `.history` file, so the archive ends up with branches that are siblings rather than a single line of descent.

Recovery follows `recovery_target_timeline: latest`, which CNPG leaves as PostgreSQL's default: starting from the base backup's timeline, PostgreSQL looks for the history file of the next timeline number, then the next, stops at the first one missing, and targets the last one it found, replaying only the segments on that line of descent. Without any history file that is the base backup's own timeline alone. When the timeline it targets does not descend from the base backup — a sibling branch whose history file happens to carry the next number — recovery does not fall back to another timeline: it stops with `FATAL: requested timeline N is not a child of this server's history` (or `... is not in this server's history`). Two consequences:

- the last archived transaction that bounds a restore is the last one on the timeline that restore follows, not the newest one in the archive;
- a restore must start from a base backup on the branch it means to bring back. The plugin's own choice ignores timelines — CNPG passes no `targetTLI` — so the newest backup, or the newest one ending by `recoveryTime`, can lie on another branch and restore that branch's data instead. The driver pins the `Backup`'s own base backup with `recoveryTarget.backupID` for that reason; a `recoveryTime` earlier than that backup's end still goes through the plugin's time-based choice, and on such an archive can land on another branch.

### Идемпотентность при GitOps

An in-progress restore is safe to reconcile. The driver purges the target `Cluster` + PVCs exactly once per RestoreJob (guarded by the `TargetPurged` condition and by the `postgres.cozystack.io/restored-server-name` annotation, which identifies the RestoreJob whose purge produced the live recovery `Cluster`), suspends the target's HelmRelease across the purge so Flux cannot race the bootstrap swap, and resumes it once the recovery cluster is rendered. A Flux reconcile (or a controller restart) mid-restore therefore re-attaches to the recovering cluster rather than deleting it and starting over.

## Kafka: topic metadata only

The `cozy-default-kafka` strategy backs up **topic metadata**, not message data. Its Job talks to the Kafka Admin API (`kafka-topics --describe` on backup, `kafka-topics --create` + `kafka-configs --alter` on restore) and stores one small object per run at `s3://<bucket>/<namespace>/<application>/<backup-name>/kafka-metadata.txt`. It captures every non-internal topic's partition count, replication factor and non-default configs; message payloads, consumer-group offsets, ACLs, quotas and `KafkaUser`s are out of scope, and there is no point-in-time recovery. The driver gates each run on the Strimzi `Kafka` cluster reporting `Ready` and never mutates it.

This is the "reconstruct a cluster's topic topology" flow: an in-place restore recreates dropped topics into the source, and a to-copy restore applies the source's topics onto a freshly-bootstrapped empty `Kafka` (partitions and configs preserved). Restore is additive at the topic-set level — it never deletes topics that exist live but not in the backup — but it does not silently accept a divergent existing topic: it grows the partition count when the backup asks for more, and fails loudly (naming the topic and both values) when the backup asks for fewer partitions or a different replication factor, since Kafka cannot shrink partitions or change RF in place and a restore that cannot reach the recorded state must not report `Succeeded`. Restored topics are created directly through the Admin API, so on the target they are **unmanaged** (no `KafkaTopic` CR); that is the accepted tradeoff of an Admin-API-only driver. Restoring a topic whose replication factor exceeds the target cluster's broker count fails at `--create`. Topic configs are restored **additively** (`kafka-configs --add-config`): a config the backup recorded is re-applied, but a config added to a live topic after the backup is not removed, so an in-place restore does not return a topic's config set to its exact backup-time state (partition count and replication factor are the only shape the restore reconciles or fails loudly on).

One consequence of the Admin-API approach: if a topic is declared in the Kafka app's `spec.topics`, the Strimzi Topic Operator owns it and reconciles its config from the `KafkaTopic` CR, reverting any dynamic config an in-place restore sets that the CR does not list. So this strategy is durable for **out-of-band** topics (created directly, no CR); for CR-declared topics the `KafkaTopic` CR / GitOps is the source of truth. A to-copy restore onto a fresh empty cluster is unaffected. For message-data durability, use a volume-snapshot strategy instead. See `examples/backups/kafka-metadata/` for the end-to-end flow.

Restore is not transactional: it applies topics one at a time as it reads the object, so a failure part-way through (an RF mismatch, an unreachable broker) leaves the topics already created behind — re-running the restore is safe (existing topics are reconciled, not recreated). Like the Rabbitmq driver, this one owns its object outright and deletes it from the bucket when its `Backup` is deleted — via a one-shot Job the Backup's removal waits on — so a retention-pruned `Plan` does not accumulate objects; the delete is **best-effort** with the same give-up conditions and `backups.cozystack.io/skip-artifact-cleanup` escape hatch documented for Rabbitmq above. One caveat specific to this driver: its image ships an older `curl` (7.76.1) whose `--aws-sigv4` omits a non-default port from the SigV4 canonical host, which every S3 backend then rejects with `403 SignatureDoesNotMatch` on a ported endpoint (fixed in curl 7.86.0). The strategy script works around it with `--connect-to` — it signs and sends a portless URL and redirects the connection to the real port — so a ported endpoint (the `backupStorage.endpoint` fallback `…:8333`, `provisionBucket: false`, or SeaweedFS with `s3.ingress.enabled: false`) works too; the sibling drivers run curl 8.x and need no such workaround. Export time scales with topic count — the backup spends two Kafka CLI invocations (each a fresh JVM, ~1.5–3s) per topic — so a cluster with many hundreds of topics takes tens of minutes; the run is bounded at the Job layer by `activeDeadlineSeconds` (default 30 minutes, from the same wait the readiness precondition uses), so a wedged or unschedulable run is failed by Kubernetes as `DeadlineExceeded` — the pod is killed before the script's final upload, so no object is left orphaned — rather than requeuing forever. A cluster whose export legitimately runs longer raises the bound with the `backupTimeout` BackupClass parameter (a Go duration, e.g. `2h`), which round-trips through the `Backup` so a restore is bounded by the same value.

## См. также

- [Application Backup and Recovery]({{% ref "/docs/v1.7/applications/backup-and-recovery" %}}) — руководство для арендатора по бэкапам баз данных (BackupJob, Plan, RestoreJob).
- [Backup and Recovery (VMs)]({{% ref "/docs/v1.7/virtualization/backup-and-recovery" %}}) — руководство для арендатора по бэкапам VMInstance / VMDisk.
- [Platform Package Reference]({{% ref "/docs/v1.7/operations/configuration/platform-package" %}}) — где находится переопределение `backupStorage` среди других значений платформы.
