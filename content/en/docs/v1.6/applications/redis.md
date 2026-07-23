---
title: "Управляемый сервис Redis"
linkTitle: "Redis"
weight: 50
aliases:
  - /docs/reference/applications/redis
  - /docs/v1.6/reference/applications/redis
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/applications/_include/redis.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/apps/redis/README.md
-->


Redis — это исключительно универсальное и очень быстрое хранилище данных и кэш в оперативной памяти, способное значительно повысить производительность ваших приложений. Управляемый сервис Redis предлагает беспроблемное решение для развёртывания кластеров Redis и управления ими, гарантируя, что ваши данные всегда доступны и отзывчивы.

## Детали развёртывания

Сервис использует Spotahome Redis Operator для эффективного управления и оркестрации кластеров Redis.

- Документация: https://redis.io/docs/
- GitHub: https://github.com/spotahome/redis-operator

> `storageClass` помечен как неизменяемый (immutable) в схеме чарта — см. [`docs/storage-immutability.md`](../../../docs/storage-immutability.md), где описан этот контракт и какие потребители его обеспечивают.

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик Redis. | `int` | `2` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики Redis. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.nano` |
| `size` | Размер Persistent Volume Claim, доступный для данных приложения. | `quantity` | `1Gi` |
| `storageClass` | StorageClass, используемый для хранения данных. | `string` | `""` |
| `external` | Включить внешний доступ извне кластера. | `bool` | `false` |
| `version` | Мажорная версия Redis для развёртывания | `string` | `v8` |


### Параметры, специфичные для приложения

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `authEnabled` | Включить генерацию пароля. | `bool` | `true` |


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

Пресеты следуют облачной схеме именования `<серия>.<размер>`. Пять серий покрывают весь диапазон соотношений CPU к памяти (`t1` 1:0.5, `c1` 1:1, `s1` 1:2, `u1` 1:4, `m1` 1:8), и каждая серия поставляется с восемью размерами (от `nano` до `4xlarge`). Устаревшие плоские имена (`nano`, `micro`, `small`, `medium`, `large`, `xlarge`, `2xlarge`) по-прежнему принимаются как устаревшие псевдонимы соответствующих типов инстансов с соотношением 1:1.

См. [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md), где приведены полная матрица размеров и сопоставление устаревших имён с типами инстансов.
