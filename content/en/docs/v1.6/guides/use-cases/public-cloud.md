---
title: Использование Cozystack для построения public cloud
linkTitle: Public Cloud
description: "Как использовать Cozystack для построения public cloud"
weight: 10
aliases:
  - /docs/v1.6/use-cases/public-cloud
---

Cozystack можно использовать как backend для public cloud.

### Обзор

Cozystack позиционируется как framework для построения public cloud. Ключевое слово здесь — framework. В этом сценарии важно понимать, что Cozystack создан для cloud providers, а не для конечных пользователей напрямую.

Несмотря на наличие графического интерфейса, текущая модель безопасности не предполагает публичного пользовательского доступа к вашему management cluster.

Вместо этого конечные пользователи получают доступ к собственным Kubernetes-кластерам, могут заказывать LoadBalancers и дополнительные сервисы из них, но не имеют доступа к management cluster на базе Cozystack и ничего не знают о нем.

Таким образом, для интеграции с billing system достаточно научить вашу систему обращаться в management Kubernetes и размещать YAML-файл, описывающий нужный сервис. Остальную работу Cozystack выполнит за вас.

![Cozystack for public cloud](/img/case-public-cloud.png)
