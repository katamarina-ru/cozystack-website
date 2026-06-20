---
title: "Конфигурация kube-scheduler"
linkTitle: "Конфигурация kube-scheduler"
description: "Конфигурация kube-scheduler"
weight: 20
aliases:
  - /docs/v1.3/stretched/kubeSchedulerConfiguration
---

## Добавьте метки на узлы

```bash
kubectl label node <nodename> topology.kubernetes.io/zone=A
```

## Создайте глобальные topology spread constraints для приложений
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cozystack-scheduling
  namespace: cozy-system
data:
  globalAppTopologySpreadConstraints: |
    topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
```

## Настройте PodTopologySpread

См.: https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/#cluster-level-default-constraints

Для установки через Talm добавьте в `templates/_helpers.tpl`:

```yaml
cluster:
...
  scheduler:
    config:
      apiVersion: kubescheduler.config.k8s.io/v1beta3
      kind: KubeSchedulerConfiguration
      profiles:
        - schedulerName: default-scheduler
          pluginConfig:
            - name: PodTopologySpread
              args:
                defaultConstraints:
                  - maxSkew: 1
                    topologyKey: topology.kubernetes.io/zone
                    whenUnsatisfiable: ScheduleAnyway
                defaultingType: List
```

Примените изменения:

```bash
talm template -f nodes/node1.yaml -I
talm apply -f nodes/node1.yaml
```
