---
title: "Устранение неполадок Piraeus custom resources"
linkTitle: "Piraeus: зависшие пользовательские ресурсы"
description: "Как устранять проблемы с зависшими Piraeus custom resources."
weight: 150
---

## Введение

К Piraeus custom resources относятся:

* `LinstorCluster`
* `LinstorSatellite`
* `LinstorSatelliteConfiguration`
* `LinstorNodeConnection`

Piraeus controller защищает эти ресурсы от непреднамеренных изменений и удаления.
При удалении ресурса controller сначала убеждается, что все нижестоящие ресурсы удалены.

Но по умолчанию webhook отклоняет любые изменения, если что-то идет не так с самим webhook.
В нестабильной системе webhook может часто падать без полезных stacktrace.

## Отключение webhook

Если вы исправляете CR, но они "не редактируются", нужно отключить webhook, а возможно и сам operator.

Несколько полезных способов отключить webhook:

-   Если установкой piraeus управляет GitOps-система, можно остановить ее для этого release и просто удалить
    конфигурацию webhook.
    Когда вы снимете GitOps-систему с паузы, она пересоздаст конфигурацию webhook.
-   Если вы не хотите удалять конфигурацию webhook, потому что она была установлена вручную, можно "сломать" ее selector.

Пример:

```bash
kubectl edit validatingwebhookconfigurations/piraeus-operator-validating-webhook-configuration
```

В редакторе замените все `- linstor*` на `- xlinstor`.
Когда закончите, верните конфигурацию тем же способом.
Примеры команд Vim: `%s/- linstor/- xlinstor/g` и `%s/- xlinstor/- linstor/g`.

Примечание: не отключайте webhook навсегда. Он нужен для защиты ресурсов.

## Отключение controller

Piraeus controller не только отслеживает собственные CR, но и обновляет их при необходимости.
В большинстве случаев его тоже следует отключить.
В частности, он постоянно пересоздает `LinstorSatellite` из `LinstorSatelliteConfiguration`.

Чтобы отключить controller, уменьшите его deployment до нуля реплик:

```bash
kubectl -n storage scale deployment piraeus-operator-controller-manager --replicas=0
``` 

После завершения обслуживания верните одну реплику:

```bash
kubectl -n storage scale deployment piraeus-operator-controller-manager --replicas=1
```

## Удаление finalizers

У каждого Piraeus CR есть finalizer, который все равно не работает после отключения controller.
Если вы собираетесь удалить CR, удалите секцию finalizers обычным способом.
