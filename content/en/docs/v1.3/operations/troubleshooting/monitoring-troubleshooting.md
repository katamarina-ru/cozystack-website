---
title: "Устранение неполадок мониторинга"
linkTitle: "Устранение неполадок"
description: "Руководство по диагностике и устранению проблем с компонентами мониторинга в Cozystack"
weight: 10
---

В этом руководстве приведены шаги диагностики типичных проблем с компонентами мониторинга в Cozystack, включая сбор метрик, alerting, визуализацию и сбор логов.

## Диагностика отсутствующих метрик

Если метрики не появляются в Grafana или VictoriaMetrics, выполните следующие шаги:

### Проверьте состояние VMAgent

Убедитесь, что VMAgent запущен и собирает метрики:

```bash
kubectl get pods -n cozy-monitoring -l app.kubernetes.io/name=vmagent
kubectl logs -n cozy-monitoring -l app.kubernetes.io/name=vmagent --tail=50
```

### Проверьте targets

Проверьте, может ли VMAgent выполнять scrape targets:

```bash
kubectl exec -n cozy-monitoring -c vmagent deploy/vmagent -- curl -s http://localhost:8429/targets | jq .
```

Найдите targets с `health: "up"`. Если targets недоступны, проверьте сетевую связность и права RBAC.

### Лимиты ресурсов

Если VMAgent ограничен ресурсами, увеличьте лимиты в конфигурации monitoring:

```yaml
vmagent:
  resources:
    limits:
      cpu: 500m
      memory: 1Gi
    requests:
      cpu: 100m
      memory: 256Mi
```

### Требования безопасности

Убедитесь, что TLS включен для безопасного сбора метрик:

- Проверьте сертификаты в конфигурации VMAgent.
- Проверьте, что роли RBAC позволяют VMAgent обращаться к нужным endpoints.

Подробнее см. [Настройка мониторинга]({{% ref "/docs/v1.3/operations/services/monitoring/setup" %}}).

## Alerts не приходят

Если alerts не приходят, проверьте Alertmanager и Alerta.

### Проверьте Alertmanager

Проверьте, что Alertmanager обрабатывает alerts:

```bash
kubectl get pods -n cozy-monitoring -l app.kubernetes.io/name=alertmanager
kubectl logs -n cozy-monitoring -l app.kubernetes.io/name=alertmanager --tail=50
```

Проверьте alert rules:

```bash
kubectl get prometheusrules -n cozy-monitoring
```

### Проверьте конфигурацию Alerta

Убедитесь, что Alerta настроена корректно:

```bash
kubectl get pods -n cozy-monitoring -l app.kubernetes.io/name=alerta
kubectl logs -n cozy-monitoring -l app.kubernetes.io/name=alerta --tail=50
```

Проверьте конфигурацию routing в spec monitoring:

```yaml
alerta:
  alerts:
    telegram:
      token: "your-token"
      chatID: "your-chat-id"
```

### Проблемы масштабируемости

Если alerts задерживаются из-за большого объема, настройте лимиты ресурсов:

```yaml
alerta:
  resources:
    limits:
      cpu: 2
      memory: 2Gi
```

### Безопасность

- Используйте RBAC для ограничения доступа к alerts.
- Включите TLS для alert endpoints.

Подробности конфигурации см. в [Alerting мониторинга]({{% ref "/docs/v1.3/operations/services/monitoring/alerting" %}}).

## Проблемы Grafana

Диагностика проблем доступа и источников данных в Grafana.

### Проблемы доступа

Если Grafana недоступна:

- Проверьте service и ingress:

```bash
kubectl get svc,ingress -n <tenant-namespace> -l app.kubernetes.io/name=grafana
```

- Проверьте права RBAC для вашего пользователя.

### Конфигурация источников данных

Убедитесь, что источники данных подключены:

1. Войдите в Grafana.
2. Перейдите в Configuration > Data Sources.
3. Проверьте, что источник данных VictoriaMetrics находится в healthy-состоянии.

Если это не так, обновите URL и credentials.

### Лимиты ресурсов

При проблемах производительности увеличьте ресурсы Grafana:

```yaml
grafana:
  resources:
    limits:
      cpu: 1
      memory: 1Gi
```

### Безопасность

- Включите authentication и authorization.
- Используйте TLS для доступа к Grafana.

Настройка dashboard описана в [Dashboard мониторинга]({{% ref "/docs/v1.3/operations/services/monitoring/dashboards" %}}).

## Проблемы сбора логов

Диагностика проблем Fluent Bit и VLogs.

### Проверьте Fluent Bit

Проверьте, что Fluent Bit собирает логи:

```bash
kubectl get pods -n cozy-monitoring -l app.kubernetes.io/name=fluent-bit
kubectl logs -n cozy-monitoring -l app.kubernetes.io/name=fluent-bit --tail=50
```

### Проверьте VLogs

Убедитесь, что VLogs сохраняет логи:

```bash
kubectl get pods -n cozy-monitoring -l app.kubernetes.io/name=vlogs
kubectl logs -n cozy-monitoring -l app.kubernetes.io/name=vlogs --tail=50
```

Проверьте прием логов:

```bash
kubectl exec -n cozy-monitoring -c vlogs deploy/vlogs -- curl -s http://localhost:9428/health
```

### Масштабируемость

Если логи не собираются из-за нагрузки, настройте ресурсы:

```yaml
logsStorages:
- name: default
  storage: 50Gi  # Увеличить хранилище
```

### Безопасность

- Используйте RBAC для доступа к логам.
- Включите TLS для передачи логов.

Дополнительная информация приведена в [Логах мониторинга]({{% ref "/docs/v1.3/operations/services/monitoring/logs" %}}).
