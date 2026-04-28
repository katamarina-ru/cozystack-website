---
title: Использование Cozystack для построения private cloud
linkTitle: Private Cloud
description: "Как использовать Cozystack для построения private cloud"
weight: 20
aliases:
  - /docs/v1.2/use-cases/private-cloud
---

Cozystack можно использовать как платформу для построения private cloud на основе Infrastructure-as-Code.

### Обзор

Один из сценариев использования — self-service портал для пользователей внутри компании, где они могут заказывать нужный сервис или managed database.

Вы можете применять лучшие GitOps-практики: пользователи запускают собственные Kubernetes-кластеры и базы данных под свои задачи простым commit'ом конфигурации в ваш infrastructure Git repository.

Благодаря стандартизации подхода к развертыванию приложений вы можете расширять возможности платформы с помощью обычных Helm charts.

![Cozystack for private cloud](/img/case-private-cloud.png)

Пример repository, показывающий настройку сервисов Cozystack через GitOps:

- https://github.com/aenix-io/cozystack-gitops-example
