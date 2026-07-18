---
title: "Релиз Cozystack v0.20: Terraform, Keycloak, а также улучшения стабильности и безопасности"
slug: cozystack-v0-20-release-terraform-keycloak-and-stability--security-improvements
date: 2024-12-12
author: "Timur Tukaev"
description: "Этот релиз сосредоточен на повышении стабильности, устранении значительного числа ошибок и добавлении новых возможностей."
images:
  - "https://cdn-images-1.medium.com/max/800/1*26UVJiADy26X-QtmslpZqw.png"
article_types:
  - release
topics:
  - platform
  - security

---

### Релиз Cozystack v0.20: Terraform, Keycloak, а также улучшения стабильности и безопасности

[Этот релиз](https://github.com/aenix-io/cozystack/releases/tag/v0.20.0) сосредоточен на повышении стабильности, устранении значительного числа ошибок и добавлении новых возможностей.

![](https://cdn-images-1.medium.com/max/800/1*26UVJiADy26X-QtmslpZqw.png)

### Что нового

- Kube-OVN обновлён до последнего стабильного релиза.
- Улучшена логика в KubeVirt CCM, что обеспечивает более надёжные балансировщики нагрузки для арендаторских кластеров Kubernetes.
- Устранены проблемы с правами пользователей в OIDC.
- Добавлена отдельная группа администраторов кластера.
- Исправлены оповещения и панели управления в Grafana.
- NATS теперь поддерживает включение JetStream и передачу файлов конфигурации.
- Добавлена поддержка Terraform для взаимодействия с нашим API.

В [v0.19](https://github.com/aenix-io/cozystack/releases/tag/v0.19.0) мы добавили поддержку OIDC вместе с интеграцией Keycloak. Однако из-за необходимости улучшений стабильности мы не анонсировали v0.19 отдельно. В этом релизе Keycloak поставляется в комплекте с Cozystack, обеспечивая бесшовную поддержку OIDC.

### Функциональность OIDC

- Автоматически настраивается с realm «Cozy», что позволяет создавать локальных пользователей и интегрироваться с внешними OIDC-провайдерами.
- Каждый арендатор получает 4 группы по умолчанию, а приложение арендатора предоставляет автоматически сгенерированный файл kubeconfig, заранее настроенный для аутентификации через Keycloak.
- Добавлена поддержка Keycloak as Code с помощью Keycloak Operator.
- Автоматическая интеграция Keycloak с кластерами Kubernetes и Kubernetes Dashboard.
- Talm обновлён до v0.6.6, что добавляет поддержку настройки API Server для OIDC.

Более подробную информацию можно найти в проекте на [GitHub](https://github.com/aenix-io/cozystack/releases/tag/v0.20.0).

### Присоединяйтесь к нашим сообществам:

- [Telegram](https://t.me/cozystack)
- [Slack](https://kubernetes.slack.com/archives/C06L3CPRVN1)
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)