---
title: "Недавние изменения в Open Source платформе Cozystack: OpenCost, система сбора логов, Bridge…"
slug: recent-changes-in-the-cozystack-open-source-platform-opencost-log-collection-system-bridge-
date: 2024-09-26
author: "Andrei Kvapil"
description: "За последние пару месяцев мы активно развивали нашу Open Source платформу Cozystack, и сегодня представляем…"
images:
  - "https://cdn-images-1.medium.com/max/800/1*ZE25TSWfLE46qz7vy5xQGQ.jpeg"
article_types:
  - release
topics:
  - platform

---

### **Недавние изменения в Open Source платформе Cozystack: OpenCost, система сбора логов, привязка bridge в виртуальных машинах**

### За последние пару месяцев мы активно развивали нашу Open Source платформу Cozystack, и сегодня представляем улучшения, появившиеся с v0.12 по v0.15.

![](https://cdn-images-1.medium.com/max/800/1*ZE25TSWfLE46qz7vy5xQGQ.jpeg)

> *Cozystack — это Open Source платформа, которая позволяет строить облако на «голом железе» для быстрого развёртывания управляемого Kubernetes, базы данных как сервиса, приложений как сервиса и виртуальных машин на базе KubeVirt. В рамках платформы вы можете развернуть Kafka, FerretDB, PostgreSQL, Cilium, Grafana, Victoria Metrics и* [другие сервисы](https://cozystack.io/docs/components/) *в один клик.*

### [v0.15](https://github.com/aenix-io/cozystack/releases/tag/v0.15.0)

- **Интеграция OpenCost**: Мы добавили в платформу OpenCost — Open Source проект из экосистемы Cloud Native для мониторинга и распределения затрат на облачную инфраструктуру и контейнеры.
- **Обновление Strimzi Operator**: Обновлён Strimzi Operator, отвечающий за управляемый Kafka, и отключена генерация его сетевых политик (для этого мы используем собственное решение).
- **Профиль Talos Linux**: Добавлен профиль в Talos Linux для установки на архитектурах AMD64.

### [v0.14](https://github.com/aenix-io/cozystack/releases/tag/v0.14.0)

- **Генерация паролей**: Добавлена генерация паролей для FerretDB, PostgreSQL и Clickhouse.
- **Обновления компонентов**: CNPG обновлён до версии 1.24.0, RabbitMQ обновлён до версии 3.13.2.

### [v0.13](https://github.com/aenix-io/cozystack/releases/tag/v0.13.0)

- **Система сбора логов**: Добавлена система сбора логов на базе [VictoriaLogs](https://docs.victoriametrics.com/victorialogs/) и [Fluentbit](https://fluentbit.io/). Вы можете просматривать логи прямо в Grafana с помощью запросов [LogsQL](https://docs.victoriametrics.com/victorialogs/logsql/).
- **Улучшения виртуальных машин**: Виртуальные машины переработаны так, чтобы создаваться с привязкой bridge и на блочных устройствах без дополнительного слоя файловой системы. Это значительно повышает производительность и позволяет выполнять живую миграцию.
- **Новые параметры ВМ**: Добавлена поддержка запуска Talos Linux и Alpine Linux внутри ВМ.
- **Поддержка изменения размера дисков**: Включена поддержка expandDisks для автоматического изменения размера диска виртуальной машины после изменения размера PVC.
- **Обновления**: FerretDB обновлён до версии v1.24, KubeVirt и CDI обновлены до последних версий.

### [v0.12](https://github.com/aenix-io/cozystack/releases/tag/v0.12.0)

- **Улучшения опыта разработки**: Добавлено множество улучшений для повышения удобства работы разработчиков.
- **Обновление Cilium**: Cilium обновлён до версии 1.16.1.

> Присоединяйтесь к нашему [уютному сообществу](https://t.me/cozystack): задавайте вопросы, получайте поддержку от сообщества и мейнтейнеров и участвуйте в развитии Open Source платформы!
