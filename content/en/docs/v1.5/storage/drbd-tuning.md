---
title: "Настройка контроллера ресинхронизации DRBD в LINSTOR"
linkTitle: "Настройка DRBD"
description: "Узнайте, как настроить параметры контроллера ресинхронизации DRBD в LINSTOR для ускорения синхронизации"
weight: 20
---

Администраторы Cozystack могут регулировать производительность синхронизации DRBD, задавая параметры настройки
для контроллера LINSTOR.

Это позволяет оптимизировать скорость ресинхронизации, не перегружая сеть репликации и систему хранения.

Подробное описание всех доступных параметров и рекомендации по настройке приведены в официальном руководстве LINBIT:
[Tuning the DRBD Resync Controller](https://kb.linbit.com/drbd/tuning-the-drbd-resync-controller/).

Для конфигурации с несколькими дата-центрами также прочитайте руководство [Настройка DRBD для нескольких дата-центров]({{% ref "/docs/v1.5/operations/stretched/drbd-tuning" %}}).

## Рекомендуемые настройки для сетей 10G

Мы считаем следующие значения оптимальными для кластеров, соединённых 10-гигабитной сетью:

```bash
linstor controller set-property DrbdOptions/Net/max-buffers          36864
linstor controller set-property DrbdOptions/Net/rcvbuf-size          10485760
linstor controller set-property DrbdOptions/Net/sndbuf-size          10485760
linstor controller set-property DrbdOptions/PeerDevice/c-fill-target 2048
linstor controller set-property DrbdOptions/PeerDevice/c-max-rate    737280
linstor controller set-property DrbdOptions/PeerDevice/c-min-rate    245760
linstor controller set-property DrbdOptions/PeerDevice/resync-rate   245760
linstor controller set-property DrbdOptions/PeerDevice/c-plan-ahead  10
```

-   `c-max-rate` указывается в КиБ/с и должен соответствовать максимальной устойчивой пропускной способности дисков или сети (в зависимости от того, что меньше).
    Значение `737280` в примере соответствует 720 МиБ/с.  
-   `c-min-rate` и `resync-rate` также указываются в КиБ/с; их следует устанавливать примерно в одну треть от `c-max-rate`.
