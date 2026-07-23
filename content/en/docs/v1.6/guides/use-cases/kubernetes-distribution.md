---
title: "Build Your Own Platform (BYOP)"
linkTitle: "Build Your Own Platform"
description: "Как собрать собственную платформу с Cozystack, устанавливая только нужные компоненты"
weight: 30
aliases:
  - /docs/v1.6/use-cases/kubernetes-distribution
---

Cozystack можно использовать в режиме BYOP (Build Your Own Platform): устанавливать только нужные вам компоненты из package repository Cozystack,
а не разворачивать всю платформу целиком.

### Обзор

Cozystack предоставляет систему управления packages, вдохновленную пакетными менеджерами Linux-дистрибутивов.
Cozystack Operator управляет ресурсами `PackageSource` и `Package`, а CLI-инструмент `cozypkg`
предоставляет интерактивный интерфейс для просмотра доступных packages, разрешения зависимостей и выборочной установки.

Такой подход полезен, если:

-   У вас уже есть Kubernetes-кластер, и вам нужны только отдельные компоненты.
-   В кластере уже настроены сеть и хранилище.
-   Вы хотите полностью контролировать, какие компоненты устанавливаются.

Variant `default` у `cozystack-platform` не устанавливает компоненты — он только регистрирует PackageSources.
После этого вы используете `cozypkg`, чтобы устанавливать отдельные packages: networking, storage, ingress, database operators и другие.

Пошаговое руководство см. в разделе [установка BYOP]({{% ref "/docs/v1.6/install/cozystack/kubernetes-distribution" %}}).

![Build Your Own Platform with Cozystack](/img/case-distribution.png)
