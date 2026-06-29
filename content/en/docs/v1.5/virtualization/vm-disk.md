---
title: "Диск виртуальной машины"
linkTitle: "Диск виртуальной машины"
weight: 20
aliases:
  - /docs/reference/applications/vm-disk
  - /docs/v1.5/reference/applications/vm-disk
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.5/virtualization/_include/vm-disk.md
source: https://github.com/cozystack/cozystack/blob/release-1.5/packages/apps/vm-disk/README.md
-->


Диск виртуальной машины

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `source`            | Расположение исходного образа, используемого для создания диска. | `object`   | `{}`         |
| `source.image`      | Использовать образ по имени из коллекции по умолчанию.           | `*object`  | `null`       |
| `source.image.name` | Имя используемого образа.                                       | `string`   | `""`         |
| `source.upload`     | Загрузить локальный образ.                                      | `*object`  | `null`       |
| `source.http`       | Скачать образ из источника по HTTP.                            | `*object`  | `null`       |
| `source.http.url`   | URL для скачивания образа.                                      | `string`   | `""`         |
| `source.disk`       | Клонировать существующий vm-disk.                              | `*object`  | `null`       |
| `source.disk.name`  | Имя клонируемого vm-disk.                                       | `string`   | `""`         |
| `optical`           | Определяет, следует ли считать диск оптическим.                | `bool`     | `false`      |
| `storage`           | Размер диска, выделенного для виртуальной машины.              | `quantity` | `5Gi`        |
| `storageClass`      | StorageClass, используемый для хранения данных.                | `string`   | `replicated` |
