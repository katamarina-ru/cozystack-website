---
title: "Управляемый сервис MongoDB"
linkTitle: "MongoDB"
weight: 50
aliases:
  - /docs/reference/applications/mongodb
  - /docs/v1.6/reference/applications/mongodb
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/applications/_include/mongodb.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/apps/mongodb/README.md
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

### Внешний доступ

Когда включён `external: true`:
- **Режим набора реплик**: Трафик балансируется между всеми участниками набора реплик. Это хорошо работает для операций чтения, но для операций записи требуется подключение к первичному узлу (primary). Драйверы MongoDB автоматически определяют первичный узел, используя строку подключения к набору реплик.
- **Шардированный режим**: Трафик направляется через маршрутизаторы mongos, которые корректно обрабатывают и чтение, и запись.

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

**Не высвобождаются автоматически:**

- TLS-секреты `<release>-ssl` и `<release>-ssl-internal` (выпущенные cert-manager) остаются в пространстве имён после удаления. Удалите их вручную, если они больше не нужны.

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

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `backup` | Конфигурация резервного копирования. | `object` | `{}` |
| `backup.enabled` | Включить регулярное резервное копирование. | `bool` | `false` |
| `backup.schedule` | Расписание cron для автоматического резервного копирования. | `string` | `0 2 * * *` |
| `backup.retentionPolicy` | Политика хранения (например, "30d"). | `string` | `30d` |
| `backup.destinationPath` | Путь назначения для резервных копий (например, s3://bucket/path/). | `string` | `s3://bucket/path/to/folder/` |
| `backup.endpointURL` | URL эндпоинта S3 для загрузки. | `string` | `http://minio-gateway-service:9000` |
| `backup.s3AccessKey` | Ключ доступа для аутентификации в S3. | `string` | `""` |
| `backup.s3SecretKey` | Секретный ключ для аутентификации в S3. | `string` | `""` |


### Параметры начальной загрузки (восстановления)

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `bootstrap` | Конфигурация начальной загрузки. | `object` | `{}` |
| `bootstrap.enabled` | Восстанавливать ли из резервной копии. | `bool` | `false` |
| `bootstrap.recoveryTime` | Метка времени для восстановления на момент времени; пусто означает последнюю. | `string` | `""` |
| `bootstrap.backupName` | Имя резервной копии, из которой восстанавливать. | `string` | `""` |
