---
title: "Управляемый сервис OpenBAO"
linkTitle: "OpenBAO"
weight: 50
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.5/applications/_include/openbao.md
source: https://github.com/cozystack/cozystack/blob/release-1.5/packages/apps/openbao/README.md
-->


OpenBAO — это решение для управления секретами с открытым исходным кодом, ответвлённое (форк) от HashiCorp Vault.
Оно обеспечивает управление секретами на основе идентичности и шифрованием для облачной инфраструктуры.

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик OpenBAO. Режим высокой доступности (HA) с Raft включается автоматически при replicas > 1. Переключение между режимами standalone (файловое хранилище) и HA (хранилище Raft) требует миграции данных. | `int` | `1` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики OpenBAO. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.small` |
| `size` | Размер Persistent Volume Claim для хранения данных. | `quantity` | `10Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |


### Параметры, специфичные для приложения

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `ui` | Включить веб-интерфейс OpenBAO. | `bool` | `true` |
