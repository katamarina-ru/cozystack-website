---
title: "Управляемый сервис Qdrant"
linkTitle: "Qdrant"
weight: 50
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.7/applications/_include/qdrant.md
source: https://github.com/cozystack/cozystack/blob/release-1.7/packages/apps/qdrant/README.md
-->


Qdrant — это высокопроизводительная векторная база данных и движок поиска по сходству, разработанный для приложений искусственного интеллекта и машинного обучения. Он обеспечивает эффективное хранение и извлечение многомерных векторов с продвинутыми возможностями фильтрации, что делает его идеальным для рекомендательных систем, семантического поиска и приложений RAG (Retrieval-Augmented Generation, генерация с дополненной выборкой).

## Детали развёртывания

Сервис разворачивает Qdrant как StatefulSet с автоматическим режимом кластера, когда настроено несколько реплик.

- Документация: https://qdrant.tech/documentation/
- GitHub: https://github.com/qdrant/qdrant

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик Qdrant. Режим кластера включается автоматически при replicas > 1. | `int` | `1` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики Qdrant. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.small` |
| `size` | Размер Persistent Volume Claim, доступный для хранения векторных данных. | `quantity` | `10Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |


### Параметры TLS

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `tls` | Конфигурация TLS. Если не задано, фактическое состояние TLS следует значению `external`. | `object` | `{}` |
| `tls.enabled` | Включить TLS. Если не задано, наследует значение `external` (TLS включён, когда включён внешний доступ). Установите явно в `true` или `false`, чтобы переопределить. | `*bool` | `null` |


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

См. [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md), где приведены полная матрица размеров и сопоставление устаревших имён с типами инстансов.

### tls

With TLS on, the chart issues the server certificate from a self-signed CA it creates per release. The trust anchor for verifying that certificate is published as `qdrant-<name>.tenant-ca`, where `<name>` is the name of the `Qdrant` resource: an object holding `ca.crt` and nothing else, delivered to tenants through the `core.cozystack.io/tenantsecrets` API that the base tenant roles already grant.

```bash
kubectl --context <ctx> --namespace <tenant> \
  get tenantsecret qdrant-<name>.tenant-ca \
  --output jsonpath='{.data.ca\.crt}' | base64 --decode
```

It is the only object that hands over the CA certificate without also handing over a private key, which is why it exists. The `qdrant-<name>-ca` Secret the chart creates stores the CA **private key** alongside the certificate — read access to it would let the holder issue certificates for anything, so it is never granted to a tenant.

It is reached through `tenantsecrets` rather than by reading the Secret directly, and that is deliberate: `tenantsecrets` surfaces only objects the platform has vouched for (those the application's definition selects), whereas a direct grant on the name would convey whatever happens to occupy that name.
