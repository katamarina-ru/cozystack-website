---
title: "Управляемый сервис балансировки TCP-нагрузки"
linkTitle: "Балансировщик TCP"
description: "Управляемый сервис балансировки TCP-нагрузки упрощает развёртывание балансировщиков нагрузки и управление ими."
weight: 30
aliases:
  - /docs/reference/applications/tcp-balancer
  - /docs/v1.7/reference/applications/tcp-balancer
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.7/networking/_include/tcp-balancer.md
source: https://github.com/cozystack/cozystack/blob/release-1.7/packages/apps/tcp-balancer/README.md
-->


Управляемый сервис балансировки TCP-нагрузки упрощает развёртывание балансировщиков нагрузки и управление ими. Он эффективно распределяет входящий TCP-трафик между несколькими бэкенд-серверами, обеспечивая высокую доступность и оптимальное использование ресурсов.

## Детали развёртывания

Управляемый сервис балансировки TCP-нагрузки использует для балансировки HAProxy. HAProxy - проверенное и надёжное решение для распределения входящего TCP-трафика между несколькими бэкенд-серверами, обеспечивающее высокую доступность и эффективное использование ресурсов. Такой выбор гарантирует бесперебойную и надёжную работу вашей инфраструктуры балансировки нагрузки.

- Документация: https://www.haproxy.com/documentation/

## Параметры

### Общие параметры

| Имя                | Описание                                                                                                                               | Тип        | Значение  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------- |
| `replicas`         | Количество реплик HAProxy.                                                                                                             | `int`      | `2`       |
| `resources`        | Явная конфигурация CPU и памяти для каждой реплики балансировщика TCP. Если не задана, применяется пресет, указанный в `resourcesPreset`. | `object`   | `{}`      |
| `resources.cpu`    | CPU, доступный каждой реплике.                                                                                                         | `quantity` | `""`      |
| `resources.memory` | Память (RAM), доступная каждой реплике.                                                                                                | `quantity` | `""`      |
| `resourcesPreset`  | Пресет размеров по умолчанию, используемый, когда `resources` не задан.                                                                | `string`   | `t1.nano` |
| `external`         | Разрешить внешний доступ извне кластера.                                                                                               | `bool`     | `false`   |


### Параметры приложения

| Имя                              | Описание                                                      | Тип        | Значение |
| -------------------------------- | ------------------------------------------------------------- | ---------- | ------- |
| `httpAndHttps`                   | Конфигурация HTTP и HTTPS.                                    | `object`   | `{}`    |
| `httpAndHttps.mode`              | Режим работы балансировщика.                                  | `string`   | `tcp`   |
| `httpAndHttps.targetPorts`       | Конфигурация целевых портов.                                  | `object`   | `{}`    |
| `httpAndHttps.targetPorts.http`  | Номер порта HTTP.                                             | `int`      | `80`    |
| `httpAndHttps.targetPorts.https` | Номер порта HTTPS.                                            | `int`      | `443`   |
| `httpAndHttps.endpoints`         | Список адресов конечных точек.                                | `[]string` | `[]`    |
| `whitelistHTTP`                  | Защитить HTTP с помощью списка разрешённых клиентских сетей (по умолчанию: false). | `bool`     | `false` |
| `whitelist`                      | Список разрешённых клиентских сетей.                          | `[]string` | `[]`    |


## Примеры параметров и справка

### resources и resourcesPreset

`resources` sets explicit CPU and memory configurations for each replica.
Every resource it leaves unset is taken from the preset defined in `resourcesPreset`.

```yaml
resources:
  cpu: 4000m
  memory: 4Gi
```

`resourcesPreset` задаёт именованную конфигурацию CPU и памяти для каждой реплики.
Эта настройка игнорируется, если задано соответствующее значение `resources`.

Presets follow a cloud-style `<series>.<size>` naming convention. Five series cover the full CPU-to-memory ratio range (`t1` 1:0.5, `c1` 1:1, `s1` 1:2, `u1` 1:4, `m1` 1:8) and each series ships eight sizes (`nano` through `4xlarge`). The legacy flat names (`nano`, `micro`, `small`, `medium`, `large`, `xlarge`, `2xlarge`) remain accepted as deprecated aliases and keep their original sizes, which do not follow one series: `nano` through `small` equal the `t1` sizes of the same name, while `medium` equals `c1.small` rather than `c1.medium`.

Полная матрица размеров и соответствие старых имён типам приведены в [`docs/operations/resource-presets.md`](../../../docs/operations/resource-presets.md).
