---
title: "Справочник сервиса Etcd"
linkTitle: "Etcd"
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/operations/services/_include/etcd.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/extra/etcd/README.md
-->


Этот чарт рендерит `EtcdCluster` (`etcd-operator.cozystack.io/v1alpha2`),
которым управляет etcd-operator cozystack, а также цепочку CA cert-manager и
`DataStore` Kamaji. TLS работает в режиме secretRef: собственные ресурсы
`Certificate` cert-manager этого чарта выпускают серверный, operator-client и
peer-сертификаты от CA Issuer'ов `etcd-issuer` / `etcd-peer-issuer`, а
`EtcdCluster` только *ссылается* на полученные Secret'ы через
`serverSecretRef` / `operatorClientSecretRef` / `peer.secretRef` (сам
оператор ничего не выпускает). Это сделано намеренно: `spec.tls` неизменяем
в v1alpha2, а `etcd-migrate` адаптирует устаревшие кластеры именно в такую
форму secretRef, поэтому чарт должен соответствовать ей, иначе любой
reconcile после адаптации будет отклонён. etcd работает только с
сертификатами (`--client-cert-auth`, без парольной аутентификации);
потребители аутентифицируются, предоставляя клиентский сертификат с
`commonName=root` (`etcd-client-tls`), подписанный тем же CA.

## Резервное копирование

Резервное копирование управляется потоком Cozystack `BackupClass`: `BackupJob` /
`RestoreJob` по стратегии `Etcd` (`strategy.backups.cozystack.io/v1alpha1`).
См. `examples/backups/etcd/` для полного демо-примера и
`internal/backupcontroller/etcdstrategy_controller.go` для драйвера. Драйвер
создаёт один `EtcdSnapshot` (`etcd-operator.cozystack.io/v1alpha2`) на каждый
`BackupJob`; восстановление выполняется на месте (драйвер приостанавливает
`HelmRelease` этого чарта, удаляет живой `EtcdCluster` и пересоздаёт его с
`spec.bootstrap.restore.source.s3`, заполненным координатами артефакта `Backup`).

> Устаревший блок значений `backup.*` и CRD `EtcdBackupSchedule` больше не
> существуют в операторе v1alpha2 — запланированные резервные копии
> задаются через `BackupClass` / `Plan`.

## Параметры

### Общие параметры

| Название           | Описание                                                                                                                   | Тип        | Значение |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| `version`          | Версия etcd (X.Y.Z) для запуска, задаётся в spec.version у EtcdCluster; оператор загружает etcd из своего собственного настроенного образа. | `string`   | `3.6.11` |
| `size`             | Размер Persistent Volume.                                                                                                  | `quantity` | `4Gi`    |
| `storageClass`     | StorageClass, используемый для хранения данных.                                                                           | `string`   | `""`     |
| `replicas`         | Количество реплик etcd.                                                                                                    | `int`      | `3`      |
| `resources`        | Конфигурация ресурсов для etcd.                                                                                           | `object`   | `{}`     |
| `resources.cpu`    | Количество выделенных ядер CPU.                                                                                           | `quantity` | `1000m`  |
| `resources.memory` | Объём выделенной памяти.                                                                                                  | `quantity` | `512Mi`  |
