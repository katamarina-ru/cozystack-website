---
title: "Управляемый PostgreSQL с синхронной репликацией — без хлопот с эксплуатацией"
slug: managed-postgresql-synchronous-replication-without-the-ops-headache
date: 2026-04-17
author: "Timur Tukaev"
description: "Разверните PostgreSQL промышленного уровня с автоматическим переключением при сбое и опциональной синхронной репликацией на собственном оборудовании за две минуты с помощью Cozystack."
images:
  - "001_marketplace.png"
article_types:
  - how-to
topics:
  - postgresql

---

Настройка PostgreSQL с синхронной репликацией «трудным путём» — это конфиги Patroni, кластеры etcd, pgBouncer, экспортеры мониторинга, скрипты резервного копирования, тестирование переключения при сбое — легко неделя работы ещё до того, как вы сохраните хотя бы одну строку. А потом всё это ещё нужно поддерживать. AWS RDS решает эту задачу, но привязывает вас к облачному счёту, который растёт быстрее ваших данных.

А что, если бы вы могли получить управляемый PostgreSQL на собственном оборудовании за две минуты?

## Решение: управляемый PostgreSQL от Cozystack

Cozystack использует под капотом оператор [CloudNativePG](https://cloudnative-pg.io/) — один из самых зрелых доступных Kubernetes-нативных операторов Postgres. Вы получаете автоматическое переключение при сбое, потоковую репликацию и опциональную синхронную репликацию на основе кворума — всё это управляется платформой.

## Через панель управления (быстрый способ)

1. Откройте панель управления Cozystack по адресу `https://dashboard.<your-domain>`.
2. Перейдите в **Marketplace** и найдите **Postgres**.

{{< figure src="001_marketplace.png" alt="Marketplace панели управления Cozystack с приложением Postgres" width="720" >}}

3. Нажмите **Deploy** и заполните форму:
   - Введите имя (например, `app-postgres`).
   - Задайте число реплик `2` (primary + standby с асинхронной репликацией) или `3` (для синхронной репликации с кворумом).
   - Выберите `resourcesPreset` (nano, micro, small, medium, large).
   - Задайте размер хранилища (например, `10Gi`).
   - В параметрах PostgreSQL при необходимости настройте `max_connections`.

{{< figure src="002_replicas.png" alt="Форма развёртывания Postgres с настроенными репликами и ресурсами" width="720" >}}

4. Нажмите **Deploy**. За две минуты вы получаете конфигурацию primary + реплика с автоматическим переключением при сбое.

{{< figure src="005_ready.png" alt="Развёрнутое приложение Postgres в состоянии Ready" width="720" >}}

## Через kubectl (способ GitOps)

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: postgres-myapp
  namespace: tenant-team1
spec:
  chart:
    spec:
      chart: postgres
      reconcileStrategy: Revision  # Согласование при изменении версии чарта
      sourceRef:
        kind: HelmRepository
        name: cozystack-apps
        namespace: cozy-public
      version: 0.10.0
  interval: 0s  # Согласование только при изменении spec, а не периодически
  values:
    replicas: 3
    size: 10Gi
    resourcesPreset: small
    databases:
      production:
        roles:
          admin:
            - appuser
    users:
      appuser:
        password: "your-strong-password"  # или удалите эту строку для автогенерации
    external: false
```

```bash
kubectl apply -f postgres.yaml
```

## Получение учётных данных для подключения

```bash
# Primary (чтение-запись)
kubectl get svc -n tenant-team1 | grep postgres-myapp-rw

# Реплика (только чтение)
kubectl get svc -n tenant-team1 | grep postgres-myapp-ro

# Пароль
kubectl get secret -n tenant-team1 postgres-myapp-app \
  -o jsonpath='{.data.password}' | base64 --decode
```

Эти имена сервисов разрешаются из любого вложенного кластера Kubernetes в том же арендаторе — без внешнего DNS или VPN.

## Резервные копии

Включите S3-совместимое хранилище резервных копий, задав `backup.enabled: true` в values. Восстановление — это изменение одной строки конфигурации, указывающей имя исходного кластера и опциональную метку времени в формате RFC 3339.

## Узнать больше

- [Документация по управляемому PostgreSQL](https://cozystack.io/docs/v1/applications/postgres/)
- [Руководство по развёртыванию приложений](https://cozystack.io/docs/v1/getting-started/deploy-app/)
- [Оператор CloudNativePG](https://cloudnative-pg.io/docs/)

## Присоединяйтесь к сообществу

- [GitHub](https://github.com/cozystack/cozystack)
- Telegram [группа](https://t.me/cozystack)
- Slack [группа](https://kubernetes.slack.com/archives/C06L3CPRVN1) (получите приглашение на [https://slack.kubernetes.io](https://slack.kubernetes.io))
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)
