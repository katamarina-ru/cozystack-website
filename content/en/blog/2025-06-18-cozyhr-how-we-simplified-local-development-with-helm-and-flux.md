---
title: "Cozyhr: как мы упростили локальную разработку с Helm и Flux"
slug: cozyhr-how-we-simplified-local-development-with-helm-and-flux
date: 2025-06-18
author: "Andrei Kvapil"
description: "Привет! Я Andrei Kvapil, CEO Ænix и разработчик Cozystack — платформы и фреймворка с открытым исходным кодом для построения облачной инфраструктуры. В…"
aliases:
  - /blog/2025/06/cozypkg-how-we-simplified-local-development-with-helm-and-flux/
images:
  - "https://cdn-images-1.medium.com/max/800/1*St3iowqHrppmH_dV7mqDCQ.png"
article_types:
  - case
topics:
  - kubernetes

---

### Cozyhr: как мы упростили локальную разработку с Helm и Flux

Привет! Я Andrei Kvapil, CEO Ænix и разработчик Cozystack — платформы и фреймворка с открытым исходным кодом для построения облачной инфраструктуры. В этой статье я расскажу о том, как мы доставляем приложения в Kubernetes, объясню, почему обычный GitOps может быть неудобен при локальной разработке, и покажу, как новый инструмент [cozyhr](https://github.com/cozystack/cozyhr) устраняет эти болевые точки. Статья рассчитана на инженеров, которые уже знакомы с Helm и Flux.

![](https://cdn-images-1.medium.com/max/800/1*St3iowqHrppmH_dV7mqDCQ.png)

Сначала я представлю Cozystack, поскольку это важно для контекста. Cozystack — это облачная платформа, которая позволяет запускать и предоставлять управляемые сервисы: базы данных, виртуальные машины, кластеры Kubernetes и многое другое. Cozystack берёт на себя весь жизненный цикл каждого сервиса.

Cozystack предоставляет множество инфраструктурных сервисов и интерфейс для их запроса через Kubernetes API. Каждый сервис поставляется с готовыми конфигурациями, встроенным мониторингом и оповещениями. Одни сервисы относятся к IaaS (например, управляемый Kubernetes и виртуальные машины), другие — к PaaS (DBaaS, очереди, S3-бакеты и так далее).

![](https://cdn-images-1.medium.com/max/800/1*InvDol94MrQaW9uQtE8TbA.png)

Сама платформа построена поверх Kubernetes и использует множество бесплатных/открытых cloud-native компонентов. Среди них — операторы Kubernetes, система хранилища, сетевая фабрика, а также собственный образ Talos Linux с зафиксированной версией ядра и предзагруженными модулями, которые гарантируют стабильную работу всех компонентов.

![](https://cdn-images-1.medium.com/max/800/1*TorLYCH01rC0-HiIZbX8pw.png)

Доставку этих компонентов обеспечивает Flux. На практике платформа использует только часть Flux — Helm Controller, который устанавливает Helm-чарты через кастомные ресурсы `HelmRelease`.

Хотя у каждого сервиса есть собственный CRD kind, под капотом каждый из них — это просто изолированный Helm-чарт, который определяет пользовательский интерфейс (как UI, так и API) для создания ресурсов.

Мы делим наши чарты на три категории:

- [основные чарты (core)](https://github.com/cozystack/cozystack/tree/main/packages/core) — это фундаментальные части платформы, которые определяют её логику.  
  Они используются для установки, тестирования и настройки всех остальных чартов.  
  Ключевой чарт, `platform`, содержит настройки Flux и реконсилируется каждую минуту, подстраиваясь под изменения в кластере.
- [системные чарты (system)](https://github.com/cozystack/cozystack/tree/main/packages/system) — это компоненты, устанавливаемые только один раз на кластер: CSI, CNI, KubeVirt, различные операторы, Cluster API и так далее.
- [чарты приложений (apps)](https://github.com/cozystack/cozystack/tree/main/packages/apps) — это чарты уровня арендатора, которые конечные пользователи устанавливают в своих пространствах имён. Они предоставляют лишь минимально необходимые параметры в `values.yaml` и используют [Cozystack API](https://blog.aenix.io/cozystack-v0-18-d724cd6d2fa1) для создания высокоуровневых ресурсов Kubernetes. Те, в свою очередь, порождают низкоуровневые кастомные ресурсы (CR) для операторов Kubernetes, которые уже запускают и управляют самими приложениями.

Благодаря этой схеме мы получили простой и единый способ определять практически любое приложение. Он применим как для конфигурации кластера, так и для сборки собственного дистрибутива Kubernetes.

### Cozy Flow: как организована разработка Cozystack

В Cozystack все компоненты живут в едином репозитории, который хранит их общую конфигурацию и шаблонизацию.  
Чтобы поддержка была безболезненной, мы следуем нескольким принципам. Ключевой принцип: каждый компонент — это Helm-чарт.

Для системных компонентов мы используем паттерн *umbrella chart*: у чарта каждого компонента есть всего одна зависимость — upstream-чарт проекта. Мы включаем этот upstream-чарт прямо в репозиторий Cozystack, а не ссылаемся на внешний репозиторий. Это позволяет нам патчить его на лету, когда нужно, и переопределять значения конфигурации на более высоком уровне.

Типичная структура компонента выглядит так:

``` graf
.
├── Chart.yaml           # Определение чарта и документация параметров
├── Makefile             # Общие цели для локальной разработки
├── charts               # Включённые upstream-чарты
├── images               # Dockerfile'ы / контекст сборки образа
├── patches              # Опциональные патчи для upstream
├── templates            # Дополнительные манифесты поверх
├── values.yaml          # Наши переопределения по умолчанию
└── values.schema.json   # JSON Schema для валидации + подсказки UI
```

Dockerfile'ы могут находиться прямо внутри директории чарта. После сборки образа путь к образу и его digest автоматически добавляются в `values.yaml` компонента.

Также вы заметите `Makefile` с целями по умолчанию, которые ускоряют рабочие процессы разработчиков:

``` graf
make update  # Получить свежий upstream-чарт и версии
make image   # Собрать Docker-образы, используемые пакетом
make show    # helm template (рендеринг манифестов)
make diff    # Сравнить отрендеренный вывод с объектами в кластере
make apply   # Установить/обновить HelmRelease в кластере
```

Таким образом, разработчик за считанные секунды может обновить чарт, собрать его образ, просмотреть diff и развернуть его в кластере для интеграционных тестов.

> *Паттерн show / diff / apply впервые появился в* [Ksonnet](https://github.com/ksonnet/ksonnet/blob/master/docs/concepts.md) *и живёт в Jsonnet-инструментах, таких как Qbec и Grafana Tanka. Мы позаимствовали лучшее, но остались с Helm, который гораздо более распространён в мире Kubernetes.*

После тестирования изменение коммитится, и ревьюер может изучить отрендеренные манифесты в PR.  
При выпуске релиза мы упаковываем все Helm-чарты в контейнерный образ и запускаем тесты. Когда они проходят, публикуется дистрибутив, готовый к установке на других кластерах.

### Техническая реализация

Все эти Makefile'ы довольно просты внутри. Изначально каждая цель `make` была тонким shell-скриптом: она извлекала данные из Flux-ресурсов (CR) в кластере, превращала их в `values.yaml`, а затем вызывала Helm.

Мы использовали плагин [helm-diff](https://github.com/databus23/helm-diff), который показывает аккуратный diff того, что изменится в кластере. Другой скрипт, [fluxcd-kustomize.sh](https://github.com/cozystack/cozystack/blob/release-0.31/scripts/fluxcd-kustomize.sh), пост-обрабатывал вывод, добавляя аннотации Flux, чтобы `helm diff` показывал только реальные изменения.

В какой-то момент нам захотелось получить единый инструмент, который делал бы всё это.  
Встречайте `cozyhr` — крошечный бинарник на Go (в 5 раз меньше, чем `kubectl`!), который объединяет функциональность множества других инструментов: Helm, `helm-diff`, `flux` CLI, `kubectl` и нашего собственного пост-процессора Flux.

![](https://cdn-images-1.medium.com/max/800/1*lhDT9REuXI-MRj0aHYJyIg.png)

`cozyhr` ориентирован на *локальную* разработку чартов и тесно интегрируется с Flux.  
По умолчанию предполагается, что вы запускаете его из директории чарта.

Вот список всех доступных команд `cozyhr`:

``` graf
$ cozyhr --help
Cozy wrapper around Helm and Flux CD for local development
```

``` graf
Usage:
  cozyhr [command]
```

``` graf
Available Commands:
  apply       Upgrade or install the HelmRelease and sync status
  completion  Generate shell‑autocomplete script
  delete      Uninstall the release
  diff        Show live vs desired manifests
  get         Get one or many HelmReleases
  list        List HelmReleases
  reconcile   Trigger Flux reconciliation
  resume      Resume a suspended release
  show        Render manifests (helm template)
  suspend     Suspend a release (Flux stops reconciling)
  version     Print version
```

Когда вы разворачиваете локальные изменения, `cozyhr` автоматически устанавливает `suspend: true` для `HelmRelease`, чтобы избежать гонки с Flux. Чтобы снова включить Flux, выполните `cozyhr resume`.

Мы также хотели улучшить обработку чартов. Для этого мы научили `cozyhr` добавлять корректные `conditions` в статусы ресурсов `HelmRelease`, чтобы другие зависимые релизы больше не ждали Flux и сразу получали правильный статус.

> *Мы используем такие составные чарты для развёртывания ресурсов в кластеры арендаторов. Например, один* *`HelmRelease`* *может породить набор дочерних релизов, которые устанавливают компоненты в кластере пользователя.*

### Взгляд в будущее

Вы можете спросить: «Почему бы не назвать инструмент `cozyctl`?»

Дело в том, что Cozystack позиционирует себя как платформа, которая предоставляет высокоуровневые ресурсы — вида `kind: Kubernetes`, `kind: Postgres` и `kind: VirtualMachine`. Конечные пользователи работают с высокоуровневым API и никогда не соприкасаются с Helm. Поэтому мы решили приберечь `cozyctl для будущего инструмента, нацеленного на эти ресурсы. `cozyhr\`, напротив, остаётся низкоуровневым и предназначен в первую очередь для разработчиков, которые используют Helm и Flux в собственных проектах.

Прямо сейчас мы активно занимаемся модуляризацией Cozystack и планируем расширить фреймворк так, чтобы вы могли подключить собственный репозиторий и предлагать управляемые сервисы на базе Cozystack.  
`cozyhr` — один из шагов к тому, чтобы выпустить пример репозитория и готовый процесс разработки для плагинов Cozystack.

### Заключение

С помощью `cozyhr` мы собираем наш опыт ускорения разработки в едином инструменте и делимся нашим подходом с сообществом.

Мы будем рады отзывам и pull request'ам: [https://github.com/cozystack/cozyhr](https://github.com/cozystack/cozyhr)

*Приятного кодинга и оставайтесь cozy!*

### Присоединяйтесь к сообществу Cozystack

- [Telegram](https://t.me/cozystack)
- [Slack](https://kubernetes.slack.com/archives/C06L3CPRVN1) (в [Kubernetes Slack](https://communityinviter.com/apps/kubernetes/community))
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)

### Смотрите также

- [Как родился Cozystack: философия, лежащая в основе его архитектуры](https://t.me/aenix_io/219)
- [Как мы построили динамический Kubernetes API Server для слоя агрегации API в Cozystack](https://blog.aenix.io/how-we-built-a-dynamic-kubernetes-api-server-for-the-api-aggregation-layer-in-cozystack-15709a183c86?source=collection_home---4------9-----------------------)
- [DIY: создайте собственное облако с Kubernetes (серия из 3 частей)](https://blog.aenix.io/diy-create-your-own-cloud-with-kubernetes-part-1-7a692c37f0a8)
- [Cozystack присоединяется к CNCF Sandbox](https://t.me/aenix_io/192)
- [Cozystack вошёл в CNAI Landscape от CNCF!](https://blog.aenix.io/cozystack-recognized-in-cncfs-cnai-landscape-331f892b9639)
- [Простой способ установить Talos Linux на любую машину с любым провайдером](https://blog.aenix.io/a-simple-way-to-install-talos-linux-on-any-machine-with-any-provider-c652b35b902e)
- [Эволюция платформ виртуализации: рост управляемых сервисов и преимущество локальных провайдеров перед гиперскейлерами](https://blog.aenix.io/the-evolution-of-virtualization-platforms-the-rise-of-managed-services-and-local-providers-edge-0cb5db21a330)

### Записи докладов Andrei Kvapil

- [AI на GPU на виртуальных машинах, Kubernetes &amp; bare metal с Cozystack](https://www.youtube.com/watch?v=slQxsj6Oj4M)
- [Путь к стабильным инфраструктурам с Talos Linux &amp; Cozystack | Andrei Kvapil | SREday London 2024](https://www.youtube.com/watch?v=uhXujtTzG44)
- [Talos Linux: вам не нужна операционная система, вам нужен только Kubernetes / Andrei Kvapil](https://www.youtube.com/watch?v=9CIMTum9bTA)
- [Сравнение GitOps: Argo CD против Flux CD, с Andrei Kvapil | KubeFM](https://www.youtube.com/watch?v=4RVe32xRITo)
- [Cozystack на Talos Linux](https://www.youtube.com/watch?v=s79VqXu-eG4)
- [Kubernetes — это новый Skynet, или расцвет автоматизации Kubernetes: вебинар CNCF](https://www.youtube.com/watch?v=9LSwnr31t7Y)
