---
title: "Обновления платформы с открытым исходным кодом Cozystack 0.24–0.29:"
slug: updates-to-the-open-source-platform-cozystack-0-24-0-29-
date: 2025-04-10
author: "Timur Tukaev"
description: "Мы давно не рассказывали о новых возможностях Cozystack, хотя за последние полтора месяца выпустили шесть новых версий…"
images:
  - "https://cdn-images-1.medium.com/max/800/0*XPWNsEtGmcIiY6zs"
article_types:
  - release
topics:
  - platform

---

### Обновления платформы с открытым исходным кодом Cozystack 0.24–0.29: PXE-провижининг машин, мониторинг RTT между дата-центрами и выделенные IP-адреса для ВМ

Мы давно не рассказывали о новых возможностях Cozystack, хотя за последние полтора месяца выпустили шесть новых версий: 0.24, 0.25, 0.26, 0.27, 0.28 и 0.29. Давайте подробнее рассмотрим изменения, начиная с последнего релиза и двигаясь назад до версии 0.24.

> Что такое Cozystack?

> Cozystack — это платформа с открытым исходным кодом, которая позволяет строить bare-metal-облако для быстрого развёртывания управляемого Kubernetes, Database as a Service, Applications as a Service и виртуальных машин на базе KubeVirt. Всего одним кликом пользователи могут развернуть такие сервисы, как Kafka, FerretDB, PostgreSQL, Cilium, Grafana, VictoriaMetrics и другие.

### Основные изменения

- Стабилизация платформы для конфигураций с несколькими дата-центрами: значительные улучшения внесены в etcd, Cilium, Kube-OVN, Linstor и другие компоненты.
- Улучшенный стек наблюдаемости (observability): добавлены новые панели управления для нескольких компонентов, а настройки Grafana оптимизированы для повышения производительности.
- Выпуск утилиты cozy-proxy: этот инструмент позволяет назначать выделенные IP-адреса виртуальным машинам в Kubernetes (вместо простого открытия отдельных портов).
- Внедрение Vertical Pod Autoscaler (VPA): VPA автоматически устанавливает лимиты ресурсов для приложений на основе исторических метрик.
- Рефакторинг и расширение документации: добавлены новые разделы для повышения ясности и удобства использования.
- Миграция репозитория: платформа и её утилиты были перенесены из организации [aenix-io](https://github.com/aenix-io) в [cozystack](https://github.com/cozystack) после того, как проект был принят в CNCF Sandbox.

### Cozystack v0.29

В v0.29.0 команда разработки сосредоточилась на повышении стабильности и надёжности платформы, в том числе на устранении [CVE-2025–1974](https://github.com/advisories/GHSA-mgvx-rpfc-9mpv) в ingress-nginx. Среди новых возможностей:

- Набор пресетов для ограничения потребления ресурсов приложениями.
- Автоматическое обновление сертификатов.
- Расширенная интеграция VPA с дополнительными компонентами платформы.

Другие изменения:

- Добавлен хостовый файрвол Cilium для повышения безопасности кластера из коробки.
- Реализован процесс запуска e2e-тестов в GitHub CI.
- Опубликована [первая версия](https://github.com/cozystack/cozystack/blob/main/GOVERNANCE.md) структуры управления проектом в рамках перехода в CNCF Sandbox.
- Flux Operator обновлён до v0.18.0, а Talos Linux — до v1.9.5.

Подробности: [v0.29.0](https://github.com/cozystack/cozystack/releases/tag/v0.29.0), [v0.29.1](https://github.com/cozystack/cozystack/releases/tag/v0.29.1).

### Cozystack v0.28

Главным событием этого релиза стало внедрение Vertical Pod Autoscaler (VPA) для автоматической установки лимитов ресурсов приложений. Репозиторий также был перенесён из aenix-io в GitHub-организацию cozystack.

**Другие изменения:**

- Изоляция арендаторов теперь включена по умолчанию.
- Ответственность за проверку source-IP перенесена с Cilium на Kube-OVN.
- Мелкие исправления ошибок в LINSTOR, Kube-OVN и KubeVirt.
- Cilium обновлён до v1.17.1, а Kube-OVN — до v1.13.3.

Подробности: [v0.28.0](https://github.com/cozystack/cozystack/releases/tag/v0.28.0), [v0.28.2](https://github.com/cozystack/cozystack/releases/tag/v0.28.2).

### Cozystack v0.27

Этот релиз был сосредоточен на стабилизации платформы и представил скрипты linstor-plunger для автоматического устранения проблем в LINSTOR (например, потери соединения DRBD, зависших loop-устройств). Также была добавлена поддержка распределения реплик PostgreSQL по разным узлам.

![](https://cdn-images-1.medium.com/max/800/0*XPWNsEtGmcIiY6zs)

**Другие изменения:**

- Добавлены [удобные панели управления](https://github.com/cozystack/cozystack/pull/661) для мониторинга ClickHouse и Piraeus.
- etcd-operator обновлён до v0.4.1.
- Значение maxLabelsTimeseries увеличено с 30 до 60.
- Исправлена панель управления Goldfinger для отслеживания сетевой задержки в кластерах с несколькими дата-центрами.

**Подробности:** [v0.27.0](https://github.com/cozystack/cozystack/releases/tag/v0.27.0).

### Cozystack v0.26

Этот релиз улучшил стабильность конфигураций с несколькими дата-центрами и добавил мониторинг сетевой связности. Эти метрики помогают тонко настраивать компоненты платформы.

**Другие изменения:**

- Добавлены лимиты ресурсов для отдельных арендаторов в пределах кластера.
- Интегрирован Goldpinger для мониторинга задержки между дата-центрами, данные отображаются в Grafana.
- Живая миграция ВМ теперь включена по умолчанию.
- Представлены снимки (snapshot) томов LINSTOR (шаг к полноценной системе резервного копирования).
- Исправлена обработка TLS в helm-чарте etcd для предотвращения проблем с истёкшими корневыми сертификатами (ранее действовавшими 90 дней).

**Подробности:** [v0.26.0](https://github.com/cozystack/cozystack/releases/tag/v0.26.0), [v0.26.1](https://github.com/cozystack/cozystack/releases/tag/v0.26.1).

### Cozystack v0.25

В этом релизе представлен cozy-proxy — автономный инструмент для назначения выделенных IP-адресов виртуальным машинам (вместо простых портов). Это критично для провайдеров, запускающих приложения на базе ВМ, которым нужны уникальные IP.

**Другие изменения:**

- Улучшен мониторинг etcd, Flux и Kafka с помощью новых панелей управления.
- Talos Linux обновлён до v1.9.3.
- Пользователи конкретного арендатора теперь могут скачивать kubeconfig.

**Подробности:** [v0.25.0](https://github.com/cozystack/cozystack/releases/tag/v0.25.0), [v0.25.1](https://github.com/cozystack/cozystack/releases/tag/v0.25.1), [v0.25.2](https://github.com/cozystack/cozystack/releases/tag/v0.25.2), [v0.25.3](https://github.com/cozystack/cozystack/releases/tag/v0.25.3).

![](https://cdn-images-1.medium.com/max/800/0*CIY_xKXLnyUjRk4U)

### Cozystack v0.24

В этом релизе добавлен PXE-провижининг узлов для автоматического развёртывания Talos Linux. Для этого был интегрирован [smee](https://github.com/tinkerbell/smee) (DHCP/PXE-сервер) от [Tinkerbell](https://tinkerbell.org/).

**Другие изменения:**

- cert-manager обновлён до v16.
- darkhttp заменён на собственный cozystack-assets-server.
- Плагины Grafana предустановлены для ускорения запуска.

**Подробности:** [v0.24.0](https://github.com/cozystack/cozystack/releases/tag/v0.24.0), [v0.24.1](https://github.com/cozystack/cozystack/releases/tag/v0.24.1).

![](https://cdn-images-1.medium.com/max/800/0*PNjPPNo9algUKb7J)

### Что дальше

Мы завершаем работу над поддержкой GPU для ВМ, чтобы включить AI/ML-нагрузки на платформе.

### Присоединяйтесь к нашему сообществу

- [Telegram](https://t.me/cozystack)
- [Slack](https://kubernetes.slack.com/archives/C06L3CPRVN1) (в [рабочем пространстве Kubernetes Slack](https://communityinviter.com/apps/kubernetes/community))
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)
