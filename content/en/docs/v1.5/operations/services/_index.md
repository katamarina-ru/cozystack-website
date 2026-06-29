---
title: "Справочник cluster services"
linkTitle: "Сервисы кластера"
description: "Системные middleware packages, которые разворачиваются в tenants и предоставляют основную функциональность пользовательским приложениям."
weight: 35
---

## Мониторинг

Система мониторинга в Cozystack предоставляет полноценную наблюдаемость для ресурсов системного уровня и уровня tenant. Она работает на двух основных уровнях: общекластерный мониторинг инфраструктурных компонентов и tenant-specific мониторинг пользовательских приложений и сервисов.

### Обзор архитектуры

- **Системный уровень**: мониторит основные компоненты Cozystack, Kubernetes-кластеры и базовую инфраструктуру.
- **Уровень tenant**: предоставляет изолированные monitoring stacks для каждого tenant, позволяя им мониторить свои приложения без взаимного влияния.

### Ключевые компоненты

- **VMAgent**: собирает метрики из разных источников и отправляет их в VictoriaMetrics.
- **VMCluster**: кластер VictoriaMetrics для хранения и запросов метрик.
- **Grafana**: инструмент визуализации и dashboards для метрик и логов.
- **Alerta**: система alerting для уведомлений на основе thresholds метрик.

### Потоки данных

Метрики идут от exporters, например node-exporters и kube-state-metrics, в VMAgent, который затем записывает их в VMCluster. Grafana запрашивает данные из VMCluster для визуализации, а Alerta обрабатывает alerts из VMCluster или других источников.

Подробную конфигурацию см. в [справочнике Monitoring Hub]({{% ref "/docs/v1.5/operations/services/monitoring" %}}).

Cozystack включает ряд cluster services.
Они разворачиваются через настройки tenant, а не через каталог приложений.

Каждый tenant может иметь собственную копию cluster service или использовать сервисы родительского tenant.
Подробнее о механизме sharing services см. в [Tenant System]({{% ref "/docs/v1.5/guides/tenants#sharing-cluster-services" %}})
