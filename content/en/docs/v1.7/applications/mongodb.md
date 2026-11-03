---
title: "Управляемый сервис MongoDB"
linkTitle: "MongoDB"
weight: 50
aliases:
  - /docs/reference/applications/mongodb
  - /docs/v1.7/reference/applications/mongodb
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.7/applications/_include/mongodb.md
source: https://github.com/cozystack/cozystack/blob/release-1.7/packages/apps/mongodb/README.md
-->


MongoDB — популярная документоориентированная NoSQL-база данных, известная своей гибкостью и масштабируемостью.
Управляемый сервис MongoDB предоставляет самовосстанавливающийся реплицируемый кластер под управлением Percona Operator for MongoDB.

## Детали развёртывания

Этот управляемый сервис контролируется Percona Operator for MongoDB, обеспечивающим эффективное управление и бесперебойную работу.

- Документация: <https://docs.percona.com/percona-operator-for-mongodb/>
- Github: <https://github.com/percona/percona-server-mongodb-operator>

## Режимы развёртывания

### Режим набора реплик (Replica Set, по умолчанию)

По умолчанию MongoDB разворачивается как набор реплик (replica set) с указанным числом реплик.
Этот режим подходит для большинства сценариев, требующих высокой доступности.

### Режим шардированного кластера

Включите `sharding: true` для горизонтального масштабирования по нескольким шардам.
Каждый шард представляет собой набор реплик, а маршрутизаторы mongos выполняют маршрутизацию запросов.

## Примечания

### TLS Mode

TLS is always enabled and fully managed by the PSMDB operator via its native cert-manager integration. The operator creates the complete certificate chain:

- A self-signed CA Issuer and CA Certificate
- A CA-backed Issuer
- A leaf TLS certificate with SANs covering the replica set service, per-pod DNS names, wildcards, and localhost

The chart does **not** render cert-manager `Issuer` or `Certificate` resources. The operator manages these directly, and chart-rendered cert-manager objects would be orphaned and ignored as trust anchors.

TLS mode is set to `preferTLS`, which means the MongoDB server accepts both TLS and non-TLS connections. This is also the operator's own default, so the chart states it explicitly rather than changing behaviour; `spec.secrets.ssl` is likewise set explicitly to the name the operator would default to.

> **Note:** `preferTLS` accepts plaintext connections, so it authenticates the server to clients that opt in but does not enforce TLS. Moving to `requireTLS` is a breaking change for any existing plaintext client and is out of scope here. To enforce TLS at the network layer in the meantime, restrict client access via NetworkPolicy.
>
> The operator also defaults `tls.allowInvalidCertificates` to `true`, and this chart leaves that default in place, so the server does not reject clients presenting an invalid or mismatched certificate. Combined with `preferTLS`, the guarantee this configuration provides is that a client which opts into TLS can verify the *server*; it is not mutual authentication and it does not keep unverified clients out. Both are inherited operator defaults rather than choices made here, and tightening either is a separate breaking change.

> **External hostname SANs:** When `external: true` is enabled, the chart advertises per-pod LoadBalancer hostnames to the operator via `splitHorizons`, and the operator folds those hostnames into the leaf certificate SAN list. External clients can then verify the TLS hostname, provided `<release>-rs0-<i>.<host>` resolves to the corresponding per-pod LoadBalancer — DNS is an operational prerequisite you must satisfy.
>
> That fold is gated on two versions, and this chart controls only one of them. It sets `crVersion: 1.22.0` itself, but the PSMDB operator must also be at 1.22.0 or newer, and the operator is a separate platform component (`packages/system/mongodb-operator`, currently 1.22.0) with its own lifecycle. On a platform carrying an older operator the gate is not met and nothing reports it: the chart still renders `splitHorizons`, the CR is still accepted, the cluster still comes up healthy, and the external hostnames simply never enter the SAN list. A client that then enables hostname verification fails the handshake. If external verification does not work, check the operator version before suspecting DNS.
>
> The external hostnames are derived from `_namespace.host`, which the Cozystack controller injects per tenant. Whenever it is empty, TLS stays enabled but `splitHorizons` is omitted, so the certificate does not cover external hostnames and a client connecting to the LoadBalancer with hostname verification on will fail the handshake. Nothing goes red when this happens — the render succeeds and the cluster comes up healthy.
>
> That empty state has two causes and only one of them heals. During the brief window before the controller populates the field (or when the chart is rendered outside Cozystack), it resolves on the next reconcile. But a tenant with no host of its own and no ancestor supplying one resolves to an empty host permanently — `packages/apps/tenant` computes it from `.Values.host` or the parent's, and leaves it empty when neither is set. On such a tenant `external: true` works for IP-based access and external TLS hostname verification is simply unavailable; set a host on the tenant (or an ancestor) if you need it. The chart does not fail the render in this case, because that would break existing hostless tenants already running `external: true`.

### Retrieving the CA bundle

The trust anchor is published as `mongodb-<name>.tenant-ca`: an object holding `ca.crt` and nothing else, created for every release and delivered to tenants through the `core.cozystack.io/tenantsecrets` API that the base tenant roles already grant. Every object below is named after the Helm release rather than the `MongoDB` resource, so a `MongoDB` named `catest` gives `mongodb-catest.tenant-ca`, `mongodb-catest-ssl`, and so on; `<release>` stands for `mongodb-<name>` throughout.

The chart declares where it is lifted from by rendering a `TenantProjection` naming `<release>-ssl`. That is the source rather than the operator's `<release>-ca-cert` because it is the name this chart sets in `spec.secrets.ssl`, the operator writes it on both its cert-manager path and its self-signed fallback, and its `ca.crt` carries the merged old and new CA through a rotation. Only `ca.crt` is ever published; the server private key alongside it stays where it is.

```bash
kubectl --context <ctx> --namespace <tenant> \
  get tenantsecret mongodb-<name>.tenant-ca \
  --output jsonpath='{.data.ca\.crt}' | base64 --decode
```

`<release>.tenant-ca` is the only object that hands over the CA certificate without also handing over a private key, which is why it exists. The PSMDB operator creates its own `<release>-ca-cert` Secret, but that one stores the CA **private key** alongside the certificate — read access would let the holder issue certificates for anything, so it is never granted to a tenant. The same applies to the leaf `<release>-ssl`, which holds the server private key.

It is reached through `tenantsecrets` rather than by reading the Secret directly, and that is deliberate: `tenantsecrets` surfaces only objects the platform has vouched for, whereas a direct grant on the name would convey whatever happens to occupy that name.

> **Warning:** The CA rotates. The operator issues it with a 365-day duration and cert-manager renews it roughly 30 days before expiry, so a bundle copied once will stop verifying within a year. Re-read `<release>.tenant-ca` on a schedule (or mount it and let the kubelet refresh it) instead of baking `ca.crt` into a client image, ConfigMap, or truststore built at release time.

### Verifying a connection

Write the trust anchor to a file, then read the connection string out of `<release>-credentials`:

```bash
kubectl --context <ctx> --namespace <tenant> \
  get tenantsecret mongodb-<name>.tenant-ca \
  --output jsonpath='{.data.ca\.crt}' | base64 --decode > ca.crt

kubectl --context <ctx> --namespace <tenant> \
  get secret mongodb-<name>-credentials \
  --output jsonpath='{.data.uri}' | base64 --decode
```

`mongosh` takes the bundle as a file, and the two TLS inputs are passed as flags rather than folded into the URI:

```bash
mongosh "<uri>" --tls --tlsCAFile ./ca.crt
```

Drivers take the same two inputs under their own names (`tls=true` plus a CA path). Prefer the flag form over appending `tls=true` to the connection string: the replica-set URI already carries a `?replicaSet=rs0` query and the sharded one carries none, so the correct separator differs between the two topologies.

> **Omitting the TLS flags does not fail.** Because the server runs in `preferTLS`, a client that leaves them out is accepted on a plaintext connection and nothing reports the downgrade — the session simply is not encrypted. Verification is opt-in on the client side, so treat a working connection as evidence of nothing until the flags are present.

Hostname verification succeeds against the in-cluster names out of the box, since the operator covers them in the leaf SANs. Verifying against an external LoadBalancer endpoint depends on the `splitHorizons` fold described above, and is unavailable in sharded mode — see below.

### Sharding and TLS

In-cluster `mongos` SANs are fully covered: the operator appends the `mongos` and config-replset names (short, namespace, FQDN, and wildcard forms) to every certificate, for sharded and non-sharded clusters alike.

> **Warning:** External TLS hostname verification is not available when `sharding: true`. In sharded mode external access goes through the single `<release>-external` LoadBalancer fronting `mongos`, and no SAN covers that name — `splitHorizons` is replica-set scoped and is only rendered for the non-sharded topology. Clients connecting to a sharded cluster from outside must either verify against an in-cluster `mongos` name that resolves to the same endpoint, or connect without hostname verification. Combining `sharding: true` with `external: true` and full verification is unsupported.

### Внешний доступ

When `external: true` is enabled:
- **Replica Set mode**: The operator exposes each replica set member through its own LoadBalancer via `replsets[].expose` and rewrites the replica set configuration so drivers can discover the primary from outside the cluster. There is no single load-balanced endpoint: the driver connects to the members and routes writes to the primary itself, using the replica set connection string.
- **Sharded mode**: Traffic is routed through mongos routers, which handle both reads and writes correctly.

### Учётные данные

The chart generates the operator's system-user passwords and writes them to `<release>-percona-server-mongodb-users` before the operator starts, so `<release>-credentials` carries a working `password` and `uri` from the first install onwards. An upgrade reuses what the secret already holds and never rotates a live password.

A database created before this behaviour landed keeps the secret the operator generated for it, and its `<release>-credentials` is filled on the next upgrade of the release with the password the operator had already assigned.

### Жизненный цикл данных

При удалении релиза MongoDB финализаторы оператора высвобождают ресурсы, относящиеся к релизу:

**Высвобождаются финализатором `percona.com/delete-psmdb-pvc`:**

- Все PVC, обеспечивающие хранилище набора реплик. Будут ли фактически удалены базовый PersistentVolume и данные на диске, зависит от `reclaimPolicy` у StorageClass (`Delete` удаляет их, `Retain` оставляет для ручной очистки).
- Управляемые оператором Secret'ы:
  - `<release>-percona-server-mongodb-users` — учётные данные пользователей оператора
  - `internal-<release>` — внутреннее состояние оператора
  - `internal-<release>-users` — внутренние данные пользователей оператора
  - `<release>-mongodb-encryption-key` — ключ шифрования данных в состоянии покоя (at-rest)

**Высвобождаются командой `helm uninstall`:**

- `<release>-credentials` — строка подключения для кода приложения
- `<release>-user-<username>` — пароли отдельных пользователей
- `<release>-s3-creds` — учётные данные места назначения резервных копий (если резервное копирование настроено)

**Reclaimed by ownerReference garbage collection:**

- TLS secrets `<release>-ssl`, `<release>-ssl-internal`, and `<release>-ca-cert`, along with the cert-manager `Issuer` and `Certificate` objects the operator creates. The cascade works out either way on the `--enable-certificate-owner-ref` fork: with the flag the Certificate owns the Secret and the CR owns the Certificate; without it (the default Cozystack ships) the operator makes the CR the direct owner of the Secret.

  > **The Secret ownerReference is applied at reconcile time, not at creation.** cert-manager creates these Secrets unowned, and the operator patches the CR reference on afterwards, in `WaitForCerts`. Two paths skip the patch: a dry-run reconcile returns before it, and a Secret already present under the same name whose `cert-manager.io/certificate-name` annotation does not match is counted toward success and returned on without being patched. So a Secret that predates the release at one of these names — from a restore-from-backup, a rename, or a manual recreate — can stay unowned and survive uninstall. The finalizer does not cover the gap: it enumerates only the users, `internal-<release>`, `internal-<release>-users`, and encryption-key Secrets, and no TLS Secret is on that list. After deleting a release, confirm `<release>-ca-cert` is gone rather than assuming it — it holds the CA private key, and an orphan of it is the one leak this chart's TLS posture exists to prevent.
- The `<release>.tenant-ca` projection, where the CA-extraction controller is present to publish it, since it is owner-referenced to the `TenantProjection` the chart renders.

**Не высвобождаются автоматически:**

- `<release>-ssl-old` and `<release>-ssl-internal-old`, only if a rotation was interrupted. These are operator scratch state, not residue: the operator snapshots the previous leaf certificates under these names when it rotates the cert-manager chain, and deletes them itself in the same pass once the merged CA has landed in the live secrets. They are created with no ownerReference, so a rotation interrupted between the snapshot and the merge can leave them behind, and those stragglers do survive uninstall.

  > **Do not delete these while a rotation is in flight.** The operator reads the previous CA back out of exactly these two names to build the merged trust bundle that keeps pods on old and new certificates talking to each other during the rolling restart. Removing them mid-rotation destroys the only copy of the old CA. Sweep them only if they are still present long after the cluster has settled, which indicates an interrupted rotation rather than one in progress.

**Восстановление при зависшем удалении:**

Если `psmdb-operator` удалён до удаления ресурсов MongoDB CR, финализаторы не могут отработать, и ресурс `PerconaServerMongoDB` зависает в состоянии `Terminating`. Для восстановления очистите финализаторы вручную:

```bash
kubectl --namespace <namespace> patch psmdb <release> --type merge --patch '{"metadata":{"finalizers":[]}}'
```

Учтите, что это пропускает очистку, выполняемую оператором — PVC и управляемые оператором Secret'ы останутся неиспользуемыми (orphaned) и должны быть удалены вручную.

Если нужно сохранить данные, создайте резервную копию перед удалением. См. [документацию Percona Operator for MongoDB](https://docs.percona.com/percona-operator-for-mongodb/) по процессам резервного копирования и восстановления.

### Обновление с более ранних версий

Earlier versions of this chart referenced a namespace-shared system users secret (`percona-server-mongodb-users`). A release that scopes this secret per CR (`<release>-percona-server-mongodb-users`) renders the new secret on the next upgrade without rotating anything: while the per-release secret does not exist yet, the chart reads the current system-user passwords back from the operator's own copy, `internal-<release>-users`, and writes those same values into the new users secret and into `<release>-credentials`. The Percona operator sees unchanged values and leaves the running users alone; pods are not restarted and the cluster stays available.

**Carried over on upgrade:**

- The five operator-managed system accounts: `databaseAdmin`, `userAdmin`, `backup`, `clusterAdmin`, `clusterMonitor` keep their passwords.
- Secret `<release>-percona-server-mongodb-users` is created per CR with the values already held by `internal-<release>-users`.
- Secret `<release>-credentials` is filled with the existing `databaseAdmin` password and the matching `uri`. Installs where these keys were empty get them on the next upgrade, because Helm re-renders only when the spec changes.

**Не затрагиваются:**

- Пользовательские учётные записи, определённые в `users:` в values чарта. Их Secret'ы `<release>-user-<name>` не изменяются.
- Ключ шифрования данных в покое (`<release>-mongodb-encryption-key`) и keyfile набора реплик (`<release>-mongodb-keyfile`) не изменяются, поэтому данные на диске остаются читаемыми.

**Требуется действие после обновления:**

Workloads that mounted `<release>-credentials` while its `password` and `uri` were empty see the filled values only after they re-read the secret. Restart those pods, or run a controller such as [Reloader](https://github.com/stakater/Reloader) to roll them automatically.

**Осиротевший устаревший Secret:**

Прежний общий для пространства имён Secret `percona-server-mongodb-users` после обновления больше не используется ни одним MongoDB CR, но оператор не удаляет его автоматически. Если несколько релизов MongoDB в одном пространстве имён ранее использовали его совместно, все они переходят на собственные Secret'ы для каждого CR — пароли больше не являются общими между CR в пространстве имён, что и является ожидаемым результатом. Убедитесь, что на него не ссылаются другие потребители, затем удалите его вручную:

```bash
kubectl --namespace <namespace> delete secret percona-server-mongodb-users
```

**Rolling restart on upgrade, for external replica set releases only:**

A release already running with `external: true` in replica set mode gains `splitHorizons` on upgrade. The per-pod external hostnames become certificate SANs, so cert-manager reissues `<release>-ssl`; the operator hashes that Secret into a pod-template annotation, which rolls the replica set StatefulSet. The restart is ordered, and at `replicas: 3` or more the replica set stays available through it — a member at a time goes down, the majority holds, and an election moves the primary if it was the one restarted. It is still a restart of the database and worth scheduling.

> **Below three replicas the upgrade is an outage, not a rolling restart.** The chart permits `replicas: 1` and `replicas: 2` (rendering `unsafeFlags.replsetSize: true` for both), and neither is excluded from the SAN change — a one-replica external release gets horizons and rolls exactly like a three-replica one. At `replicas: 1` the rollout takes the only mongod down, so the release is fully unavailable, reads included, until the new pod is ready. At `replicas: 2` the write majority is still 2, so restarting either member leaves the remaining one unable to hold a primary and writes fail for the duration; reads continue only if the client tolerates a secondary. `podDisruptionBudget` does not change this in either case — the disruption is the rollout itself, not an eviction. Schedule a window accordingly, or scale to three before upgrading.

The same pass snapshots the superseded certificates as `<release>-ssl-old` and `<release>-ssl-internal-old`, then deletes them once the merged CA has landed. Because this upgrade changes only the SAN list and not the CA itself, the merge is a no-op and both snapshots are removed on the first pass — no cleanup is expected. See the lifecycle section above for the interrupted case, and do not delete them by hand while the rollout is running.

Scaling an external replica set down can also produce transient reconfiguration errors during the upgrade. MongoDB requires horizons on all members or none, and a terminating pod is still a member while the chart advertises horizons only for the remaining ones. The operator retries and the condition clears once the pod is gone.

Releases with `external: false`, and sharded releases in any configuration, are unaffected: neither renders `splitHorizons`, so no SAN changes and nothing restarts.

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик MongoDB в наборе реплик. | `int` | `3` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики MongoDB. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.small` |
| `size` | Размер Persistent Volume Claim, доступный для данных приложения. | `quantity` | `10Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |
| `version` | Мажорная версия MongoDB для развёртывания. | `string` | `v8` |


### Конфигурация шардирования

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `sharding` | Включить режим шардированного кластера. Когда отключено, разворачивается набор реплик. | `bool` | `false` |
| `shardingConfig` | Конфигурация режима шардированного кластера. | `object` | `{}` |
| `shardingConfig.configServers` | Количество реплик серверов конфигурации (config server). | `int` | `3` |
| `shardingConfig.configServerSize` | Размер PVC для серверов конфигурации. | `quantity` | `3Gi` |
| `shardingConfig.mongos` | Количество реплик маршрутизаторов mongos. | `int` | `2` |
| `shardingConfig.shards` | Список конфигураций шардов. | `[]object` | `[...]` |
| `shardingConfig.shards[i].name` | Имя шарда. | `string` | `""` |
| `shardingConfig.shards[i].replicas` | Количество реплик в этом шарде. | `int` | `0` |
| `shardingConfig.shards[i].size` | Размер PVC для этого шарда. | `quantity` | `""` |


### Конфигурация пользователей

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `users` | Карта конфигурации пользователей. | `map[string]object` | `{}` |
| `users[name].password` | Пароль пользователя (генерируется автоматически, если не указан). | `string` | `""` |


### Конфигурация баз данных

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `databases` | Карта конфигурации баз данных. | `map[string]object` | `{}` |
| `databases[name].roles` | Роли, назначенные пользователям. | `object` | `{}` |
| `databases[name].roles.admin` | Список пользователей с правами администратора (readWrite + dbAdmin). | `[]string` | `[]` |
| `databases[name].roles.readonly` | Список пользователей с правами только на чтение. | `[]string` | `[]` |


### Параметры резервного копирования

| Name                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Type     | Value                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------- |
| `backup`                       | Backup configuration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `object` | `{}`                                |
| `backup.enabled`               | Enable regular backups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `bool`   | `false`                             |
| `backup.useSystemBucket`       | Opt-in: back up to the platform system bucket without supplying S3 credentials. The cozy-default MongoDB BackupClass injects the storage at BackupJob time; tenants do not set s3AccessKey/s3SecretKey/destinationPath/endpointURL, and backups scope to `<namespace>/<application>`. Scheduling moves to a BackupClass Plan; `schedule`, `retentionPolicy` and PITR are ignored while this is on, and this flow has no retention yet (see docs/operations/backup-classes.md). Requires `backup.enabled: true` (the pbm agents run on that flag); the chart refuses the combination with `enabled: false` at render time; the schema carries the same rule as a marker for the UI and for the day the apiserver enforces CEL on application schemas (cozystack/cozystack#2657), which it does not yet. A release that has not yet rendered this flag (its cluster still carries the chart's scheduled tasks and PITR) holds a BackupJob until it does, so the tenant's own storage is never injected over. | `bool`   | `false`                             |
| `backup.schedule`              | Cron schedule for automated backups. Ignored when useSystemBucket is true (scheduling moves to the BackupClass Plan).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `string` | `0 2 * * *`                         |
| `backup.retentionPolicy`       | Retention policy (e.g. "30d"). Ignored when useSystemBucket is true (no engine-side retention on that flow).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `string` | `30d`                               |
| `backup.destinationPath`       | Destination path for backups (e.g. s3://bucket/path/). Ignored when useSystemBucket is true (the driver injects the platform bucket).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `string` | `s3://bucket/path/to/folder/`       |
| `backup.endpointURL`           | S3 endpoint URL for uploads. Ignored when useSystemBucket is true (the strategy supplies the platform endpoint).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `string` | `http://minio-gateway-service:9000` |
| `backup.insecureSkipTLSVerify` | Skip TLS verification for the S3 endpoint (self-signed, e.g. in-cluster seaweedfs). Ignored when useSystemBucket is true (the platform backupStorage knob applies instead).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `bool`   | `false`                             |
| `backup.s3AccessKey`           | Access key for S3 authentication. Ignored when useSystemBucket is true (credentials come from the projected cozy-backups-creds).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `string` | `""`                                |
| `backup.s3SecretKey`           | Secret key for S3 authentication. Ignored when useSystemBucket is true (credentials come from the projected cozy-backups-creds).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `string` | `""`                                |


### Параметры начальной загрузки (восстановления)

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `bootstrap` | Конфигурация начальной загрузки. | `object` | `{}` |
| `bootstrap.enabled` | Восстанавливать ли из резервной копии. | `bool` | `false` |
| `bootstrap.recoveryTime` | Метка времени для восстановления на момент времени; пусто означает последнюю. | `string` | `""` |
| `bootstrap.backupName` | Имя резервной копии, из которой восстанавливать. | `string` | `""` |
