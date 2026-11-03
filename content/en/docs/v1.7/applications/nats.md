---
title: "Управляемый сервис NATS"
linkTitle: "NATS"
weight: 50
aliases:
  - /docs/reference/applications/nats
  - /docs/v1.7/reference/applications/nats
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.7/applications/_include/nats.md
source: https://github.com/cozystack/cozystack/blob/release-1.7/packages/apps/nats/README.md
-->


NATS — это простая, безопасная и высокопроизводительная система обмена сообщениями с открытым исходным кодом.
Она предоставляет уровень данных для облачных (cloud native) приложений, обмена сообщениями IoT и микросервисных архитектур.

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик. | `int` | `2` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики NATS. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.nano` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |
| `tls` | Конфигурация TLS. Если не задано, TLS следует значению флага `external`. | `object` | `{}` |
| `tls.enabled` | Включить TLS. Если не задано, TLS включается автоматически, когда `external` равен true. | `*bool` | `null` |


### Параметры, специфичные для приложения

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `users` | Карта конфигурации пользователей. | `map[string]object` | `{}` |
| `users[name].password` | Пароль пользователя. | `string` | `""` |
| `jetstream` | Конфигурация Jetstream. | `object` | `{}` |
| `jetstream.enabled` | Включить или отключить Jetstream для постоянного обмена сообщениями в NATS. | `bool` | `true` |
| `jetstream.size` | Размер постоянного хранилища Jetstream. | `quantity` | `10Gi` |
| `config` | Конфигурация NATS. | `object` | `{}` |
| `config.merge` | Дополнительная конфигурация для слияния с конфигурацией NATS. | `*object` | `{}` |
| `config.resolver` | Дополнительная конфигурация resolver для слияния с конфигурацией NATS. | `*object` | `{}` |


## Примеры и справочник по параметрам

### resources и resourcesPreset

`resources` sets explicit CPU and memory configurations for each replica.
Every resource it leaves unset is taken from the preset defined in `resourcesPreset`.

```yaml
resources:
  cpu: 4000m
  memory: 4Gi
```

`resourcesPreset` задаёт именованные конфигурации CPU и памяти для каждой реплики.
Эта настройка игнорируется, если задано соответствующее значение `resources`.

Presets follow a cloud-style `<series>.<size>` naming convention. Five series cover the full CPU-to-memory ratio range (`t1` 1:0.5, `c1` 1:1, `s1` 1:2, `u1` 1:4, `m1` 1:8) and each series ships eight sizes (`nano` through `4xlarge`). The legacy flat names (`nano`, `micro`, `small`, `medium`, `large`, `xlarge`, `2xlarge`) remain accepted as deprecated aliases and keep their original sizes, which do not follow one series: `nano` through `small` equal the `t1` sizes of the same name, while `medium` equals `c1.small` rather than `c1.medium`.

See [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md) for the full size matrix and the legacy-to-instance-type mapping.

См. [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md), где приведены полная матрица размеров и сопоставление устаревших имён с типами инстансов.
### tls

`tls.enabled` is tri-state. Left unset it follows `external`, so TLS is enabled automatically for a NATS instance exposed outside the cluster and disabled for one that is not. Setting it explicitly overrides that in either direction.

When TLS is on, the chart issues a self-signed CA and a server certificate from it, and NATS serves the client port on `:4222` with the server certificate.

**Retrieving the CA certificate** for client verification:

The trust anchor is published as `nats-<name>.tenant-ca`: an object holding `ca.crt` and nothing else, delivered to tenants through the `core.cozystack.io/tenantsecrets` API that the base tenant roles already grant. It exists only while TLS is on, because that is the only state in which the chart issues a CA to publish.

```bash
kubectl --context <ctx> --namespace <tenant> \
  get tenantsecret nats-<name>.tenant-ca \
  --output jsonpath='{.data.ca\.crt}' | base64 --decode
```

`nats-<name>.tenant-ca` is the only object that hands over the CA certificate without also handing over a private key, which is why it exists. The chart's own `nats-<name>-ca` Secret stores the CA **private key** under `tls.key` alongside the certificate — read access to it would let the holder issue certificates for anything, so it is never granted to a tenant. The same applies to `nats-<name>-tls`, which holds the server's private key.

It is reached through `tenantsecrets` rather than by reading the Secret directly, and that is deliberate: `tenantsecrets` surfaces only objects the platform has vouched for, whereas a direct grant on the name would convey whatever happens to occupy that name.
