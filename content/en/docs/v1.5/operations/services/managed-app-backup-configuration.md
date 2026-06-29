---
title: "Конфигурация backup для managed applications"
linkTitle: "Резервное копирование управляемых приложений"
description: "Настройка strategies и BackupClasses для logical data backups managed databases (Postgres, MariaDB, ClickHouse)."
weight: 31
---

Это руководство предназначено для **cluster administrators**, которые настраивают backup strategies для database applications, управляемых Cozystack: Postgres, MariaDB и ClickHouse. После настройки strategies и ресурсов `BackupClass` tenants запускают backups и restores, создавая ресурсы [BackupJob, Plan и RestoreJob]({{% ref "/docs/v1.5/applications/backup-and-recovery" %}}), без дополнительных действий администратора.

{{% alert color="info" %}}
Эта страница описывает **data-only** backups, выполняемые нативным backup-механизмом каждого оператора (CloudNativePG barman, dumps mariadb-operator, Altinity `clickhouse-backup`). `apps.cozystack.io/*` CR, его `HelmRelease`, chart values и Secrets, управляемые оператором, **не попадают** в эти strategies.

Для backups, которые объединяют Helm release + CRs + PVC snapshots (используются VMInstance / VMDisk), см. [Velero Backup Configuration]({{% ref "/docs/v1.5/operations/services/velero-backup-configuration" %}}).
{{% /alert %}}

## Предварительные требования

- Административный доступ к Cozystack (management) cluster.
- Компоненты `backup-controller` и `backupstrategy-controller` установлены и работают.
- S3-compatible storage доступен из management cluster: либо внутрикластерный SeaweedFS, созданный через приложение `Bucket`, либо любой внешний S3 endpoint.
- Для каждого application Kind, который нужно backup-ить, развернут соответствующий upstream operator: CloudNativePG, mariadb-operator или ClickHouse operator. Они поставляются с Cozystack по умолчанию.

## Как работает strategy для managed application

Последовательность для каждого `BackupJob`:

1. Tenant создает `BackupJob` (или `Plan`, который создает его по cron), ссылающийся на `BackupClass` и приложение `apps.cozystack.io/<Kind>`.
2. Core backup controller разрешает `BackupClass` и сопоставляет application Kind с driver-specific strategy `strategy.backups.cozystack.io/<Kind>`.
3. Driver рендерит template strategy относительно live application object (`.Application`) и параметров BackupClass (`.Parameters`), затем создает operator-native backup CR (`Backup` для mariadb, HTTP-вызов in-pod sidecar для ClickHouse, barman-driven snapshot в `cnpg.io` для Postgres).
4. При успехе driver создает артефакт Cozystack `Backup` в том же namespace; позже ресурсы `RestoreJob` ссылаются на этот артефакт.

`BackupClass` является **cluster-scoped**: один экземпляр покрывает все tenant namespaces.

{{% alert color="info" %}}
Tenant users не могут просматривать ресурсы `BackupClass` через свой kubeconfig (cluster-scoped resources недоступны через tenant `RoleBinding`). После создания `BackupClass` **сообщите его имя tenants вне Kubernetes**: в platform handbook, в ticket на onboarding приложения или во внутреннем Slack-канале. Tenants указывают это имя дословно в `BackupJob.spec.backupClassName`.
{{% /alert %}}

## Настройка по драйверам

Strategies ниже написаны для внутрикластерного приложения SeaweedFS `Bucket`. Если используется external S3 storage, удалите секции `endpointCA` / TLS и укажите endpoint вашего provider.

### Postgres (CNPG strategy)

CNPG driver делегирует работу нативному barman backup CloudNativePG. Каждый `BackupJob` - это barman snapshot, отправляемый в S3; `RestoreJob` пересоздает `cnpg.io/Cluster` из архива.

Создайте strategy:

```yaml
apiVersion: strategy.backups.cozystack.io/v1alpha1
kind: CNPG
metadata:
  name: postgres-data-cnpg-strategy
spec:
  template:
    serverName: "{{ .Application.metadata.name }}"
    barmanObjectStore:
      destinationPath: "s3://REPLACE_WITH_COSI_BUCKET_NAME/{{ .Application.metadata.name }}/"
      endpointURL: "https://REPLACE_WITH_S3_ENDPOINT"
      retentionPolicy: "30d"
      endpointCA:
        secretRef:
          name: "{{ .Application.metadata.name }}-cnpg-backup-ca"
        key: "ca.crt"
      s3Credentials:
        secretRef:
          name: "{{ .Application.metadata.name }}-cnpg-backup-creds"
      data:
        compression: gzip
      wal:
        compression: gzip
```

Свяжите application Kind:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupClass
metadata:
  name: postgres-data-backup
spec:
  strategies:
    - application:
        apiGroup: apps.cozystack.io
        kind: Postgres
      strategyRef:
        apiGroup: strategy.backups.cozystack.io
        kind: CNPG
        name: postgres-data-cnpg-strategy
```

Per-application Secrets, которые tenant должен создать в application namespace:

| Secret | Keys | Назначение |
|---|---|---|
| `<app>-cnpg-backup-creds` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 credentials, используемые barman |
| `<app>-cnpg-backup-ca` *(только для self-signed endpoints)* | `ca.crt` | CA bundle, которому доверяет barman client |

Удалите блок `endpointCA` из strategy, если S3 endpoint использует publicly-trusted certificate.

### MariaDB

MariaDB driver делегирует работу [mariadb-operator](https://github.com/mariadb-operator/mariadb-operator). Backups создаются как CRs `k8s.mariadb.com/v1alpha1 Backup` (logical `mariadb-dump`); restores создаются как CRs `Restore`, которые через `mariadb-import` возвращают dump в live database.

Создайте strategy:

```yaml
apiVersion: strategy.backups.cozystack.io/v1alpha1
kind: MariaDB
metadata:
  name: mariadb-data-strategy
spec:
  template:
    storage:
      s3:
        bucket: "REPLACE_WITH_COSI_BUCKET_NAME"
        endpoint: "REPLACE_WITH_S3_ENDPOINT"
        prefix: "{{ .Application.metadata.name }}/"
        accessKeyIdSecretKeyRef:
          name: "{{ .Application.metadata.name }}-mariadb-backup-creds"
          key: "AWS_ACCESS_KEY_ID"
        secretAccessKeySecretKeyRef:
          name: "{{ .Application.metadata.name }}-mariadb-backup-creds"
          key: "AWS_SECRET_ACCESS_KEY"
        tls:
          enabled: true
          caSecretKeyRef:
            name: "{{ .Application.metadata.name }}-mariadb-backup-ca"
            key: "ca.crt"
    compression: gzip
```

`endpoint` указывается как **path-style без scheme** (например, `seaweedfs-s3.<seaweedfs-namespace>.svc:8333` для внутрикластерного SeaweedFS по умолчанию; подставьте namespace, где SeaweedFS развернут в вашем окружении). Полностью удалите блок `tls`, если endpoint использует publicly-trusted certificate.

Свяжите application Kind:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupClass
metadata:
  name: mariadb-data-backup
spec:
  strategies:
    - application:
        apiGroup: apps.cozystack.io
        kind: MariaDB
      strategyRef:
        apiGroup: strategy.backups.cozystack.io
        kind: MariaDB
        name: mariadb-data-strategy
```

Per-application Secrets, которые tenant должен создать в application namespace:

| Secret | Keys | Назначение |
|---|---|---|
| `<app>-mariadb-backup-creds` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 credentials, используемые mariadb-operator |
| `<app>-mariadb-backup-ca` *(только для self-signed endpoints)* | `ca.crt` | CA bundle для TLS verification |

{{% alert color="info" %}}
Блок `backup.*` уровня chart в `apps.cozystack.io/MariaDB` (legacy путь `mariadb-dump` + `restic`) **deprecated** в пользу этого BackupClass flow. У существующих tenants с `backup.enabled=true` legacy resources продолжают рендериться без изменений.
{{% /alert %}}

### ClickHouse (Altinity strategy)

Altinity driver **не** template-ит backup CR. Он рендерит небольшой `PodTemplateSpec`, который запускает `curl + jq` против in-pod HTTP API [`clickhouse-backup`](https://github.com/Altinity/clickhouse-backup) (port 7171), предоставляемого sidecar внутри каждого Pod `chi-*`.

{{% alert color="warning" %}}
Altinity strategy **требует** `backup.enabled=true` на каждом экземпляре ClickHouse application. Именно этот флаг создает in-pod sidecar и Secret `clickhouse-<release>-backup-api-auth`, через который аутентифицируется strategy. В отличие от MariaDB, блок `backup.*` уровня chart в ClickHouse **не deprecated**; BackupClass flow использует тот же sidecar.
{{% /alert %}}

Создайте strategy. `template` - это `PodTemplateSpec`, который управляет sidecar; полный reference template (с shell script, который делает POST `create_remote` / `restore_remote` и опрашивает action log) см. в [`examples/backups/clickhouse/01-create-strategy.sh`](https://github.com/cozystack/cozystack/blob/main/examples/backups/clickhouse/01-create-strategy.sh) в репозитории cozystack.

```yaml
apiVersion: strategy.backups.cozystack.io/v1alpha1
kind: Altinity
metadata:
  name: clickhouse-data-altinity-strategy
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: ch-backup-client
          image: alpine:3.19
          env:
            - name: API_USERNAME
              valueFrom:
                secretKeyRef:
                  name: clickhouse-{{ .Release.Name }}-backup-api-auth
                  key: username
            - name: API_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: clickhouse-{{ .Release.Name }}-backup-api-auth
                  key: password
          command: ["/bin/sh", "-c"]
          args:
            # Полный script см. в examples/backups/clickhouse/01-create-strategy.sh:
            # ветвится по .Mode (backup|restore), делает POST /backup/create_remote
            # или /backup/restore_remote/<name>, затем опрашивает /backup/actions
            # до terminal status.
            - |
              # ... (truncated; see linked example)
```

Свяжите application Kind. Параметры не требуются: strategy template обращается к sidecar через детерминированный Pod DNS и напрямую читает S3 credentials из Secret `<release>-backup-s3`, созданного chart.

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupClass
metadata:
  name: clickhouse-data-backup
spec:
  strategies:
    - application:
        apiGroup: apps.cozystack.io
        kind: ClickHouse
      strategyRef:
        apiGroup: strategy.backups.cozystack.io
        kind: Altinity
        name: clickhouse-data-altinity-strategy
```

## Применение и проверка

Примените manifests strategy и `BackupClass`:

```bash
kubectl apply -f <strategy>.yaml
kubectl apply -f <backupclass>.yaml
```

Выведите ресурсы:

```bash
kubectl get cnpgs.strategy.backups.cozystack.io
kubectl get mariadbs.strategy.backups.cozystack.io
kubectl get altinities.strategy.backups.cozystack.io
kubectl get backupclasses
```

У каждой strategy не должно быть error conditions; каждый `BackupClass` должен показывать заданные вами strategy entries.

## Onboarding tenant

Tenant users не могут создавать объекты `Secret` в стандартном RBAC Cozystack и не могут читать credential Secrets, созданные `Bucket`. Прежде чем tenant сможет запустить первый `BackupJob`, administrator должен подготовить per-tenant storage и per-application credential Secrets, которые ожидает каждый driver. Выполните эти шаги один раз для каждого managed-DB application, для которого tenant хочет делать backup. В примерах используется `tenant-user` как namespace tenant и `my-postgres` / `my-mariadb` / `my-clickhouse` как имя приложения; замените их на свои значения.

### Подготовьте storage Bucket

Если у tenant нет external S3 coordinates, создайте внутрикластерный `Bucket` в его namespace:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: db-backups
  namespace: tenant-user
spec:
  users:
    backup:
      readonly: false
```

```bash
kubectl apply -f bucket.yaml
kubectl -n tenant-user wait hr/bucket-db-backups --for=condition=ready --timeout=300s
```

`Bucket` controller создает в namespace Secret `bucket-<name>-backup` с JSON blob `BucketInfo`; S3 endpoint, имя bucket и access keys берутся оттуда.

### Прочитайте bucket credentials

Выполните это один раз на shell session. Каждый per-driver блок ниже переиспользует `$ACCESS_KEY`, `$SECRET_KEY` и `/tmp/bucket.json`:

```bash
kubectl -n tenant-user get secret bucket-db-backups-backup \
  -o jsonpath='{.data.BucketInfo}' | base64 -d > /tmp/bucket.json
ACCESS_KEY=$(jq -r .spec.secretS3.accessKeyID /tmp/bucket.json)
SECRET_KEY=$(jq -r .spec.secretS3.accessSecretKey /tmp/bucket.json)
```

### Создайте per-application credential Secrets

Каждый driver ожидает per-application credential Secrets в application namespace; strategy templates ссылаются на них по имени (`{{ .Application.metadata.name }}-...`).

#### Postgres (CNPG)

Запишите credentials в keys, которые ожидает barman client CNPG:

```bash
kubectl -n tenant-user create secret generic my-postgres-cnpg-backup-creds \
  --from-literal=AWS_ACCESS_KEY_ID="$ACCESS_KEY" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$SECRET_KEY"
```

Если S3 endpoint использует self-signed certificate (поведение SeaweedFS по умолчанию), также создайте CA Secret:

```bash
kubectl -n tenant-user create secret generic my-postgres-cnpg-backup-ca \
  --from-file=ca.crt=/path/to/ca.crt
```

#### MariaDB

```bash
kubectl -n tenant-user create secret generic my-mariadb-mariadb-backup-creds \
  --from-literal=AWS_ACCESS_KEY_ID="$ACCESS_KEY" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$SECRET_KEY"
```

Для self-signed endpoints аналогично добавьте `my-mariadb-mariadb-backup-ca` с `ca.crt`.

#### ClickHouse

Для BackupClass flow дополнительный Secret не нужен. Altinity strategy напрямую читает S3 credentials из Secret `<release>-backup-s3`, созданного chart. Убедитесь, что `backup.enabled: true` задан на каждом экземпляре ClickHouse application, который tenant хочет backup-ить, и что блок `backup.*` в application values содержит координаты bucket (см. [справочник приложения ClickHouse]({{% ref "/docs/v1.5/applications/clickhouse" %}})).

## Передача tenants

Tenants запускают backups и restores по именам `BackupClass`, созданным выше, с помощью ресурсов `BackupJob`, `Plan` и `RestoreJob`. Дайте им руководство [Application Backup and Recovery]({{% ref "/docs/v1.5/applications/backup-and-recovery" %}}); для работы с существующим `BackupClass` им не нужны admin permissions. Перед тем как отправить их к руководству:

- Сообщите доступные имена `BackupClass` (tenants не могут вывести их список, потому что cluster-scoped resources недоступны через tenant `RoleBinding`).
- Убедитесь, что для каждого managed application, который tenant хочет backup-ить, в его namespace уже существует per-application credential Secret, описанный в [Tenant onboarding](#tenant-onboarding).

## Tenant escalation: диагностика на стороне drivers

Если `BackupJob` или `RestoreJob` tenant завершается с `phase: Failed`, а `status.message` не указывает точную причину, tenant не может самостоятельно посмотреть operator-native CRs: его RBAC исключает `cnpg.io`, `k8s.mariadb.com` и subresource `pods/log`. Выполните эти команды от его имени, используя имя `BackupJob`, которое он вам передаст:

```bash
# Postgres (CloudNativePG)
kubectl -n tenant-user get backups.cnpg.io
# MariaDB
kubectl -n tenant-user get backups.k8s.mariadb.com,restores.k8s.mariadb.com
# ClickHouse - strategy работает как one-shot Pod, который обращается к in-pod sidecar
kubectl -n tenant-user logs -l backups.cozystack.io/owned-by.BackupJobName=my-clickhouse-adhoc
```

Для удаления архивов ClickHouse tenant не может напрямую обратиться к HTTP API in-pod sidecar `clickhouse-backup`; по его запросу выполните exec в ClickHouse pod и вызовите `DELETE /backup/<name>/remote` на локальном sidecar (credentials находятся в Secret `clickhouse-<release>-backup-api-auth`, созданном chart).
