---
title: "Включение Hubble для наблюдаемости сети"
linkTitle: "Hubble"
description: "Включите стек наблюдаемости Hubble в Cilium и читайте метрики потоков, DNS и L7 через дашборды Grafana, которые Cozystack для этого поставляет."
weight: 50
---

Hubble — это слой наблюдаемости сети и безопасности, построенный поверх Cilium. Он даёт видимость взаимодействия и поведения сервисов в кластере: журналы потоков, DNS-запросы и метрики запросов уровня L7.

В Cozystack Hubble **по умолчанию отключён**, чтобы снизить потребление ресурсов. На этой странице описано, как его включить и как читать результаты. О том, какое место Hubble занимает в плоскости данных, см. [Сетевую архитектуру](/docs/v1.6/networking/architecture/#наблюдаемость-с-hubble).

## Предварительные требования

- Кластер Cozystack, использующий Cilium в качестве CNI (вариант по умолчанию).
- Развёрнутый [Monitoring Hub](/docs/v1.6/operations/services/monitoring/) — для доступа к Grafana и хранения метрик.

## Включение Hubble

Включите Hubble, Relay и веб-интерфейс в конфигурации Cilium и активируйте те метрики, которые вы хотите экспортировать:

```yaml
cilium:
  hubble:
    enabled: true
    relay:
      enabled: true
    ui:
      enabled: true
    metrics:
      enabled:
        - dns
        - drop
        - tcp
        - flow
        - port-distribution
        - icmp
        - httpV2:exemplars=true;labelsContext=source_ip,source_namespace,source_workload,destination_ip,destination_namespace,destination_workload,traffic_direction
```

Именно список `metrics.enabled` заставляет работать дашборды, описанные ниже: без него Hubble запустится, но не будет экспортировать ничего, что Grafana могла бы отрисовать. У элемента `httpV2` особенно важно сохранить `labelsContext`, поскольку дашборд L7 HTTP группирует данные по рабочим нагрузкам источника и назначения и не сможет этого сделать, если соответствующих меток нет.

### Компоненты

Включение Hubble поднимает:

- **Hubble Relay** — агрегирует данные о потоках со всех агентов Cilium.
- **Hubble UI** — веб-интерфейс для изучения сетевых потоков.
- **Hubble Metrics** — метрики Prometheus для наблюдаемости сети.

## Дашборды Grafana

Cozystack поставляет четыре дашборда Hubble, которые размещаются в папке `hubble` платформенной Grafana:

| Дашборд | Описание |
|-----------|-------------|
| **Overview** | Общие метрики Hubble, включая статистику обработки |
| **DNS Namespace** | Метрики DNS-запросов и ответов по пространствам имён |
| **L7 HTTP Metrics** | Метрики уровня L7 (HTTP) по рабочим нагрузкам |
| **Network Overview** | Обзор сетевых потоков по пространствам имён |

Это инфраструктурные дашборды, поэтому они устанавливаются только для платформенного релиза Monitoring — того, что находится в `tenant-root` или `cozy-monitoring`. В Grafana самого тенанта они не попадают: тенанты видят вместо них дашборды своих приложений.

Чтобы до них добраться, откройте Grafana через Monitoring Hub, перейдите в папку `hubble` в браузере дашбордов и выберите нужный дашборд.

## Метрики

Hubble отдаёт следующие метрики, и все они доступны для запросов напрямую из Grafana:

- `hubble_flows_processed_total` — общее число обработанных потоков
- `hubble_dns_queries_total` — DNS-запросы по типу
- `hubble_dns_responses_total` — DNS-ответы по статусу
- `hubble_drop_total` — отброшенные пакеты по причине
- `hubble_tcp_flags_total` — TCP-соединения по флагу
- `hubble_http_requests_total` — HTTP-запросы по методу и статусу

## Устранение неполадок

Проверьте, что Relay и веб-интерфейс запущены:

```bash
kubectl get pods -n cozy-cilium -l k8s-app=hubble-relay
kubectl get pods -n cozy-cilium -l k8s-app=hubble-ui
```

Убедитесь, что эндпоинт метрик отвечает:

```bash
kubectl port-forward -n cozy-cilium svc/hubble-metrics 9965:9965
curl http://localhost:9965/metrics
```

Проверьте, что цель для сбора метрик существует. Если дашборды пустые, а эндпоинт выше отдаёт данные, то обычно потеряно именно это звено:

```bash
kubectl get servicemonitor -n cozy-cilium
```
