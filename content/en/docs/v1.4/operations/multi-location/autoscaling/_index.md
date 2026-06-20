---
title: "Cluster Autoscaling"
linkTitle: "Автомасштабирование"
description: "Автоматическое масштабирование узлов Cozystack management clusters с помощью Kubernetes Cluster Autoscaler."
weight: 20
---

System package `cluster-autoscaler` включает автоматическое масштабирование узлов для Cozystack management clusters.
Он мониторит pending pods и автоматически создает или удаляет cloud nodes в зависимости от нагрузки.

Перед настройкой autoscaling завершите настройку [Networking Mesh]({{% ref "../networking-mesh" %}})
и [Local CCM]({{% ref "../local-ccm" %}}).

Cozystack предоставляет pre-configured variants для разных cloud providers:

- [Hetzner Cloud]({{% ref "hetzner" %}}) -- масштабирование с помощью Hetzner Cloud servers
- [Azure]({{% ref "azure" %}}) -- масштабирование с помощью Azure Virtual Machine Scale Sets

Каждый variant разворачивается как отдельный Cozystack Package с provider-specific configuration.
