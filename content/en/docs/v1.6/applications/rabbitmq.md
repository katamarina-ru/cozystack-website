---
title: "Управляемый сервис RabbitMQ"
linkTitle: "RabbitMQ"
weight: 50
aliases:
  - /docs/reference/applications/rabbitmq
  - /docs/v1.6/reference/applications/rabbitmq
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/applications/_include/rabbitmq.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/apps/rabbitmq/README.md
-->


RabbitMQ — это надёжный брокер сообщений, играющий ключевую роль в современных распределённых системах. Наш управляемый сервис RabbitMQ упрощает развёртывание и управление кластерами RabbitMQ, обеспечивая надёжность и масштабируемость для ваших задач обмена сообщениями.

## Детали развёртывания

Сервис использует официальный оператор RabbitMQ. Это обеспечивает надёжность и бесперебойную работу ваших экземпляров RabbitMQ.

- Github: https://github.com/rabbitmq/cluster-operator/
- Документация: https://www.rabbitmq.com/kubernetes/operator/operator-overview.html

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик RabbitMQ. | `int` | `3` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики RabbitMQ. Every resource left unset here is taken from `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Default sizing preset. It supplies every resource `resources` does not set, not only a `resources` left empty entirely. | `string` | `t1.nano` |
| `size` | Размер Persistent Volume Claim, доступный для данных приложения. | `quantity` | `10Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |
| `version` | Версия RabbitMQ (мажорная.минорная) для развёртывания | `string` | `v4.2` |


### Параметры, специфичные для приложения

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `users` | Карта конфигурации пользователей. | `map[string]object` | `{}` |
| `users[name].password` | Пароль пользователя. | `string` | `""` |
| `vhosts` | Карта конфигурации виртуальных хостов. | `map[string]object` | `{}` |
| `vhosts[name].roles` | Список ролей виртуального хоста. | `object` | `{}` |
| `vhosts[name].roles.admin` | Список пользователей-администраторов. | `[]string` | `[]` |
| `vhosts[name].roles.readonly` | Список пользователей только для чтения. | `[]string` | `[]` |


## Примеры и справочник по параметрам

### resources и resourcesPreset

`resources` задаёт явные конфигурации CPU и памяти для каждой реплики.
Если оставить пустым, применяется пресет, указанный в `resourcesPreset`.

```yaml
resources:
  cpu: 4000m
  memory: 4Gi
```

`resourcesPreset` задаёт именованные конфигурации CPU и памяти для каждой реплики.
Эта настройка игнорируется, если задано соответствующее значение `resources`.

Presets follow a cloud-style `<series>.<size>` naming convention. Five series cover the full CPU-to-memory ratio range (`t1` 1:0.5, `c1` 1:1, `s1` 1:2, `u1` 1:4, `m1` 1:8) and each series ships eight sizes (`nano` through `4xlarge`). The legacy flat names (`nano`, `micro`, `small`, `medium`, `large`, `xlarge`, `2xlarge`) remain accepted as deprecated aliases of their 1:1 instance-type equivalents.

See [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md) for the full size matrix and the legacy-to-instance-type mapping.

