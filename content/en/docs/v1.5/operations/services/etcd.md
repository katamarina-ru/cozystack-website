---
title: "Справочник сервиса Etcd"
linkTitle: "Etcd"
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.5/operations/services/_include/etcd.md
source: https://github.com/cozystack/cozystack/blob/release-1.5/packages/extra/etcd/README.md
-->


## Резервные копии

**DEPRECATED:** блок values `backup.*` (`backup.enabled`,
`backup.schedule`, `backup.destinationPath`, ...) заменён механизмом
Cozystack `BackupClass`, управляемым стратегией `Etcd` в
`strategy.backups.cozystack.io/v1alpha1`. Новым тенантам следует использовать
`BackupJob` / `RestoreJob` со стратегией `Etcd` + `BackupClass` — см.
`examples/backups/etcd/` для сквозного примера и
`internal/backupcontroller/etcdstrategy_controller.go` для драйвера.
Существующие тенанты с `backup.enabled=true` продолжают формировать прежний
`EtcdBackupSchedule` + Secret с S3-учётными данными без изменений — оба
механизма сосуществуют, плановые backups чарта НЕ перестали работать, и
вывод, формируемый по условию `backup.*`, идентичен предыдущим релизам.

### Примечание по обновлению: `serverTrustedCASecret` теперь задаётся безусловно

В этом релизе в формируемый `EtcdCluster` добавляется
`security.tls.serverTrustedCASecret: etcd-ca-tls`. Это поле необходимо, чтобы
`backup_agent` / `restore_agent` etcd-operator (v0.4.4+) доверяли серверному
сертификату при подключении из своего пода через etcdctl — без него агент
откатывается к системному хранилищу доверенных сертификатов, и handshake
backup/restore завершается ошибкой «certificate signed by unknown
authority». Чарт переиспользует существующий Secret `etcd-ca-tls`, который
уже сегодня выпускает все клиентские/серверные сертификаты, поэтому поле
указывает на материал, присутствующий в namespace с момента первого
развёртывания кластера. При Helm-обновлении etcd-operator замечает новое
поле и начинает применять проверку серверного сертификата для собственных
клиентских подключений; он НЕ перекатывает поды-члены etcd (TLS-конфигурация
контейнера etcd уже была авторитетной). Тенантам, которые сегодня полагаются
на backup-agent, это поле по-прежнему будет нужно, поэтому оставление его
включённым по умолчанию сохраняет согласованность чарта с документированным
путём резервного копирования.

Когда `backup.enabled` установлен в `true`, чарт создаёт `EtcdBackupSchedule` (etcd.aenix.io/v1alpha1) и Secret с S3-учётными данными. etcd-operator (v0.4.3+) преобразует расписание в `CronJob`, который периодически создаёт снапшот кластера в S3. В этом релизе встроенный чарт `packages/system/etcd-operator` обновлён с v0.4.3 до v0.4.5 (чтобы новое поле `EtcdBackup.status.snapshot` — добавленное в v0.4.4 — и исправления пути restore-agent — добавленные в v0.4.5 — были доступны драйверу стратегии). Прежний путь `backup.enabled=true` обновление не затрагивает, и он продолжает работать на v0.4.5 ровно так же, как на v0.4.3.

Для включения backup нужно явно задать следующие поля (значения по умолчанию — пустые строки, чтобы отсутствие значений быстро приводило к ошибке при render шаблона): `backup.s3AccessKey`, `backup.s3SecretKey`, `backup.destinationPath` (должен начинаться с `s3://` и не содержать сегментов `//`) и `backup.endpointURL`. S3-учётные данные, переданные через обычные values, попадают в manifest HelmRelease — для production-развёртываний лучше использовать внешний инструмент управления secrets (ESO, Sealed Secrets и т. п.), а не коммитить ключи в Git.

**Restore и разовый backup**: основной поддерживаемый путь — механизм
Cozystack `BackupClass` / `BackupJob` / `RestoreJob`, описанный выше и
продемонстрированный сквозным примером в `examples/backups/etcd/`. Драйвер
приостанавливает `HelmRelease` этого чарта на время восстановления на месте,
удаляет живой `EtcdCluster` и пересоздаёт его с
`spec.bootstrap.restore.source.s3`, заполненным из координат артефакта
`Backup`. Само поле upstream `EtcdCluster.spec.bootstrap` и разовый CR
`EtcdBackup` (v0.4.4) через values этого чарта НЕ доступны; тенанты, которым
нужно обойти механизм BackupClass (например, для внеполосного восстановления
из снапшота без артефакта `Backup`), могут вручную применить соответствующий
манифест Custom Resource как запасной вариант.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `size` | Размер Persistent Volume. | `quantity` | `4Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `replicas` | Количество реплик etcd. | `int` | `3` |
| `resources` | Конфигурация ресурсов для etcd. | `object` | `{}` |
| `resources.cpu` | Количество выделенных CPU cores. | `quantity` | `1000m` |
| `resources.memory` | Объём выделенной memory. | `quantity` | `512Mi` |


### Параметры backup

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `backup` | DEPRECATED: конфигурация backup. Чарт по-прежнему формирует прежний EtcdBackupSchedule при backup.enabled=true, но новым тенантам следует управлять backups через BackupClass, привязанный к стратегии Etcd (strategy.backups.cozystack.io/v1alpha1). | `object` | `{}` |
| `backup.enabled` | DEPRECATED: включить плановые S3 backups. Вместо этого используйте BackupJob со стратегией Etcd. | `bool` | `false` |
| `backup.schedule` | DEPRECATED: cron-расписание для автоматических backups. Вместо этого используйте backups.cozystack.io/Plan. | `string` | `0 2 * * *` |
| `backup.destinationPath` | DEPRECATED: целевой path для backups (например, s3://bucket/path/). | `string` | `""` |
| `backup.endpointURL` | DEPRECATED: URL S3 endpoint для загрузки. | `string` | `""` |
| `backup.region` | DEPRECATED: регион S3. | `string` | `""` |
| `backup.forcePathStyle` | DEPRECATED: использовать path-style S3 URLs (требуется для MinIO и большинства S3-совместимых providers). | `bool` | `true` |
| `backup.s3AccessKey` | DEPRECATED: access key для S3-аутентификации. | `string` | `""` |
| `backup.s3SecretKey` | DEPRECATED: secret key для S3-аутентификации. | `string` | `""` |
| `backup.successfulJobsHistoryLimit` | DEPRECATED: количество успешных backup jobs, которые нужно хранить. | `int` | `3` |
| `backup.failedJobsHistoryLimit` | DEPRECATED: количество проваленных backup jobs, которые нужно хранить. | `int` | `1` |
