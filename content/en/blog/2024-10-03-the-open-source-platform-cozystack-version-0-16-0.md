---
title: "Платформа с открытым исходным кодом Cozystack версии 0.16.0"
slug: the-open-source-platform-cozystack-version-0-16-0
date: 2024-10-03
author: "Timur Tukaev"
description: "Ключевые моменты Cozystack теперь включает систему оповещений на основе инструмента с открытым исходным кодом Alerta с возможностью настройки уведомлений…"
images:
  - "https://cdn-images-1.medium.com/max/800/1*jOAv-G1LLJy84HwQHpI0Pw.png"
article_types:
  - release
topics:
  - platform

---

### Выпущена платформа с открытым исходным кодом Cozystack версии 0.16.0: система оповещений с уведомлениями в Telegram и другие улучшения

Ключевые моменты Cozystack теперь включает систему оповещений на основе инструмента с открытым исходным кодом [Alerta](https://alerta.io/) с возможностью настройки уведомлений прямо в Telegram. Кроме того, вы можете получать оповещения от стека k8s-prometheus, обновлены все панели управления Grafana, а также сама Grafana и grafana-operator.

![](https://cdn-images-1.medium.com/max/800/1*jOAv-G1LLJy84HwQHpI0Pw.png)
Интерфейс Alerta

> Cozystack — это платформа с открытым исходным кодом, предназначенная для построения облачной инфраструктуры на «голом железе», позволяющая быстро развёртывать управляемый Kubernetes, базы данных как сервис, приложения как сервис и виртуальные машины на основе KubeVirt. В рамках платформы вы можете развернуть такие сервисы, как Kafka, FerretDB, PostgreSQL, Cilium, Grafana, Victoria Metrics и другие, всего одним кликом.

Другие изменения:

- Nginx-ingress обновлён до версии v1.11.2, устранена проблема с доступом к nginx-ingress изнутри кластера
- Flux и flux-operator обновлены до последних версий
- Kamaji обновлён до последней версии, исправлена проблема с перезапусками контроллера
- В CCM добавлен контроллер endpointslice; заказанные сервисы теперь направляют трафик только на обслуживающие их узлы
- Talos Linux обновлён до версии v1.8.0
- Cilium обновлён до последней патч-версии (v1.16.2)

![](https://cdn-images-1.medium.com/max/800/1*AfwiLHWi-5tqeanoAfTr0A.jpeg)
Новые панели управления

![](https://cdn-images-1.medium.com/max/800/1*Lop2OD3KPS0Zw21Hn4oaDw.jpeg)
Новые панели управления

![](https://cdn-images-1.medium.com/max/800/1*-iZWlbUb3RZH1wfNxdhRhw.jpeg)
Новые панели управления

*Более подробно смотрите на* [странице GitHub](https://github.com/aenix-io/cozystack/releases/tag/v0.16.0)*.*