---
title: "Метки узлов"
linkTitle: "Топологические метки узлов"
description: "Добавьте метки на узлы, чтобы workloads планировались корректно"
weight: 20
aliases:
  - /docs/v1.6/stretched/labels
---

## Как работают топологические метки

При запуске Kubernetes-кластера в нескольких дата-центрах важно понимать, какие workloads нужно размещать рядом друг с другом, например базу данных и backend-приложение, а какие - распределять по разным площадкам, например несколько реплик frontend, реплики базы данных или реплики томов. Первый шаг к этому - добавить метки на узлы Kubernetes. В публичных облаках обычно используются термины `zone` и `region`. В Kubernetes наиболее распространенный способ обозначить географическое расположение - использовать метки `topology.kubernetes.io/zone` и `topology.kubernetes.io/region` или только метку zone.

## Пример для Talos

В других дистрибутивах Kubernetes метки обычно задаются вручную, но в Talos топологию можно описать как код.

Пример конфигурации `talm`:

`values.yaml`:

```yaml
nodes:
  node1:
    labels:
      topology.kubernetes.io/zone: "us-west-1"
      topology.kubernetes.io/region: "us-west"
  node2:
    labels:
      topology.kubernetes.io/zone: "us-east-1"
      topology.kubernetes.io/region: "us-east"
```

`_helpers.tpl`:

```helm
{{- $nodeLabels := .Values.nodes | dig (include "talm.discovered.hostname" .) "labels" nil }}
machine:
  {{- with $nodeLabels }}
  nodeLabels:
    {{- toYaml . | nindent 4 }}
  {{- end }}
```
