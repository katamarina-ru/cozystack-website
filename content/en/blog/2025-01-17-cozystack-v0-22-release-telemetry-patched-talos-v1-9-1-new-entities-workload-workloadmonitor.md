---
title: "Релиз Cozystack v0.22: телеметрия, пропатченный Talos v1.9.1, новые сущности Workload и WorkloadMonitor"
slug: cozystack-v0-22-release-telemetry-patched-talos-v1-9-1-new-entities-workload-and-workloadmonitor
date: 2025-01-17
author: "Timur Tukaev"
description: "Основные изменения"
images:
  - "https://cdn-images-1.medium.com/max/800/1*EEQEZnOxwexdC6rmGQ6Zcg.png"
article_types:
  - release
topics:
  - platform
  - talos

---

### Релиз Cozystack v0.22: телеметрия, пропатченный Talos v1.9.1, новые сущности Workload и WorkloadMonitor

### Основные изменения

В последнем релизе добавлены cozystack-controller и новые сущности: Workload и WorkloadMonitor, которые позволяют отслеживать состояние подов, управляемых операторами, и оценивать уровень обслуживания сервиса в соответствии с заранее заданными правилами.

Поскольку разными приложениями в Cozystack управляют разные операторы, мы решили создать унифицированный формат отображения статуса каждого сервиса.

#### Это работает следующим образом:

Во время развёртывания приложения вместе с ним разворачивается WorkloadMonitor, который отслеживает состояние подов по селектору. Как только селектор находит под, для него создаётся новая сущность — Workload, которая отображает роль каждого пода и его статус.

В статусе WorkloadMonitor можно увидеть количество существующих реплик и минимальное число, необходимое для обслуживания приложения. Как только количество Workload опускается ниже значения minReplicas для WorkloadMonitor, сервис помечается как неработоспособный.

Для приложений без фиксированного числа реплик — например, worker-узлов Kubernetes, которые могут масштабироваться динамически, — можно вообще не указывать количество реплик в WorkloadMonitor. В этом случае он просто будет подсчитывать общее число запущенных экземпляров.

Этот механизм позволяет использовать любые операторы и способы управления подами в Kubernetes и упрощает расширение платформы, предоставляя унифицированный интерфейс для отображения текущего статуса сервиса.

Для приложений Kubernetes, таких как Postgres, Monitoring, VirtualMachine, VMInstance, Redis, Etcd и SeaweedFS, добавлен WorkloadMonitor, который собирает информацию о репликах и их работоспособности.

Панель управления Cozystack теперь отображает количество реплик приложения и уровень обслуживания для каждой группы рабочих нагрузок.

![](https://cdn-images-1.medium.com/max/800/1*EEQEZnOxwexdC6rmGQ6Zcg.png)

### Телеметрия

Реализована клиентская и серверная телеметрия, [выпущенная](https://github.com/aenix-io/cozystack-telemetry-server) под лицензией Apache License 2.0. Сбор метрик реализован в соответствии с [LF Telemetry Data Collection and Usage Policy](https://www.linuxfoundation.org/legal/telemetry-data-policy) и легко отключается единственной опцией конфигурации `telemetry-enabled:false` в Cozystack. В будущих релизах планируется публичная панель управления с собранной информацией. Подробнее см. [документацию](https://cozystack.io/docs/telemetry/).

### Прочие изменения

- Компонент cluster-autoscaler для Kubernetes и его конфигурация обновлены, что обеспечивает более эффективное масштабирование кластеров как вверх, так и вниз.
- Обновлён файл [MAINTAINERS](https://github.com/aenix-io/cozystack/blob/main/MAINTAINERS.md), в котором перечислены участники проекта и их зоны ответственности.
- В платформу добавлено новое сервисное приложение под названием builder, позволяющее собирать платформу прямо внутри Kubernetes.
- Для VictoriaMetrics увеличены значения запросов и лимитов ресурсов по умолчанию, а также добавлена возможность задавать пользовательские параметры.
- Добавлен сбор метрик из баз данных для Grafana и Alerta.
- Добавлены оповещения о состоянии виртуальных машин.
- Добавлены оповещения о состоянии кластеров Postgres.
- Настроен сбор метрик для KubeVirt и добавлена панель управления Grafana.
- В конфигурацию Cozystack добавлена опция extra-keycloak-redirect-uri-for-dashboard, позволяющая настраивать дополнительные URL перенаправления для Keycloak.
- Исправлена ошибка VMInstance, которая блокировала подключение VMdisk к виртуальным машинам.

![](https://cdn-images-1.medium.com/max/800/1*2QrRVPI2aX1cTINRsKtFzA.png)
Панель управления Grafana для KubeVirt

### Обновления компонентов

- Flux Operator обновлён с v0.10.0 до v0.12.0.
- Чарт Flux Instance обновлён с v0.9.0 до v0.12.0.
- Cilium обновлён до версии v1.16.5.
- Kube-OVN обновлён до версии v1.13.2.
- CNPG PostgreSQL Operator обновлён до версии v1.25.0.
- Talos Linux обновлён. Из-за нескольких ошибок в upstream платформа в настоящее время поставляется с пропатченным образом v1.9.1.

*Подробнее — смотрите проект на* [GitHub](https://github.com/aenix-io/cozystack/releases/tag/v0.22.0)*.*

### Присоединяйтесь к нашему сообществу

- [Telegram](https://t.me/cozystack)
- [Slack](https://kubernetes.slack.com/archives/C06L3CPRVN1)
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)
