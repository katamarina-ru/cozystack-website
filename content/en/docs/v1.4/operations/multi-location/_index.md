---
title: "Multi-Location кластеры"
linkTitle: "Несколько площадок"
description: "Расширение Cozystack management clusters на несколько locations с помощью Kilo WireGuard mesh, cloud autoscaling и local cloud controller manager."
weight: 40
---

В этом разделе описано расширение Cozystack management cluster на несколько физических locations
(on-premises + cloud, multi-cloud и т. д.) с помощью WireGuard mesh networking.

Настройка состоит из трех компонентов:

- [Networking Mesh]({{% ref "networking-mesh" %}}) -- Kilo WireGuard mesh с Cilium IPIP encapsulation
- [Local CCM]({{% ref "local-ccm" %}}) -- cloud controller manager для определения IP узлов и lifecycle
- [Cluster Autoscaling]({{% ref "autoscaling" %}}) -- автоматическое создание узлов в cloud providers
