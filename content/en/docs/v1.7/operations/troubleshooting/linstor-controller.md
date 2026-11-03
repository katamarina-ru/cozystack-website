---
title: "Устранение crash loop у LINSTOR controller"
linkTitle: "LINSTOR: проблемы контроллера"
description: "Как устранять проблемы LINSTOR controller."
weight: 100
---

## Перезапуск controller

Если controller запущен, но выглядит простаивающим или не отвечает, попробуйте перезапустить его.
Эта операция идемпотентна и безопасна: ожидающая или незавершенная работа продолжится после перезапуска.


## Crash loop LINSTOR controller

Если linstor-controller не может запуститься, а в логах нет полезной информации, можно повысить уровень логирования
(максимальный уровень - `TRACE`).

Пример `LINSTORCluster` CR с повышенным уровнем логирования:

```yaml
apiVersion: piraeus.io/v1
kind: LINSTORCluster
spec:
  controller:
    podTemplate:
      spec:
        containers:
          - name: linstor-controller
            env:
              # обе настройки используются linstor-controller
              - name: LS_LOG_LEVEL
                value: TRACE
              - name: LS_LOG_LEVEL_LINSTOR
                value: TRACE
```

Примечание: если linstor-controller не находится в crash loop, но нужно повысить уровень логирования,
это можно сделать *временно* во время выполнения следующей командой:

```bash
linstor controller set-log-level --global TRACE
```

Эта настройка вернется к исходному значению после перезапуска controller.


## LINSTOR перестает отвечать после истечения срока сертификатов

Если в LINSTOR настроена внутренняя TLS-коммуникация, сертификаты создаются и ротируются автоматически.
Но есть открытая проблема [piraeusdatastore/piraeus-operator#701](https://github.com/piraeusdatastore/piraeus-operator/issues/701):
компоненты не подхватывают новые сертификаты после ротации.
Обходной путь - вручную перезапустить все компоненты LINSTOR.

Выполните шаги по порядку:

1.  Перезапустите `linstor-controller`.
2.  Перезапустите каждый satellite по одному. Не перезапускайте их все одновременно.
    После перезапуска каждого satellite проверьте его логи на ошибки, прежде чем переходить к следующему.
3.  Снова перезапустите `linstor-controller`.
    Это нужно, потому что controller также инициирует подключения к satellites и может не переподключиться автоматически
    к satellite, который был перезапущен.
4.  Перезапустите все оставшиеся компоненты LINSTOR.
