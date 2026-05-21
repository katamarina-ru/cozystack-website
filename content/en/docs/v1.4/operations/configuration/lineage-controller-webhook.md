---
title: "Lineage Controller Webhook"
linkTitle: "Вебхук Lineage Controller"
description: "Что делает lineage-controller-webhook, как он развертывается и какой параметр важно знать."
weight: 40
---

**lineage controller webhook** - это mutating admission webhook, поставляемый в составе Package `cozystack.cozystack-engine`.
При каждом CREATE и UPDATE tenant-ресурсов `Pod`, `Secret`, `Service`, `PersistentVolumeClaim`, `Ingress` или `WorkloadMonitor` он поднимается по графу владения и записывает идентичность владеющего Cozystack `Application` в labels ресурса (`apps.cozystack.io/application.{group,kind,name}`).
Dashboard Cozystack, aggregated API server и механизм SchedulingClass опираются на эти labels.

Webhook зарегистрирован с `failurePolicy: Fail`, поэтому kube-apiserver должен иметь доступ к рабочему pod webhook, чтобы tenant CREATE/UPDATE-запросы проходили успешно.

## Схема развертывания по умолчанию

Chart разворачивает один `Deployment`, построенный по образцу `cozystack-api`:

- **2 replicas** (переопределяется через `replicas`).
- **Мягкий `nodeAffinity`** с предпочтением `node-role.kubernetes.io/control-plane` (`Exists` совпадает и с пустым значением Talos, и с `"true"` в k3s/kubeadm). Это именно *мягкое* предпочтение: pods попадают на control-plane-узел, когда он доступен, иначе на любой worker. Для managed Kubernetes (EKS / AKS / GKE), tenant-кластеров Cozy-in-Cozy и любых кластеров, где control-plane-узлы не видны, переопределение не нужно: webhook просто планируется в другом месте.
- **Разрешающие `tolerations`** (`{operator: Exists}`), чтобы control-plane-узел с taint `NoSchedule` принимал pod, когда мягкий affinity может быть выполнен.
- **Мягкий `podAntiAffinity`** по `kubernetes.io/hostname`, чтобы реплики по возможности распределялись по разным узлам.
- **`PodDisruptionBudget`** с `maxUnavailable: 1`. При `replicas: 2+` он ограничивает disruption одним pod; при `replicas: 1` это полезный no-op.
- **Service `spec.trafficDistribution: PreferClose`**, чтобы apiserver предпочитал endpoint webhook на своем узле, если он существует, и прозрачно переключался на удаленный endpoint иначе. Требуется Kubernetes >= 1.31; более старые кластеры незаметно возвращаются к стандартному распределению по всему кластеру, что тоже безопасно, но без предпочтения локальности.

Такая схема работает как есть во всех дистрибутивах Kubernetes, которые поддерживает Cozystack.
В нормальной эксплуатации ничего переопределять не требуется.

## Увеличение числа реплик

Если нужно больше двух реплик, например чтобы держать по одному webhook pod рядом с каждым apiserver на control plane из пяти узлов, переопределите значение `replicas` через Package `cozystack.cozystack-engine` так же, как для любого другого компонента (см. [Компоненты]({{% ref "/docs/v1.4/operations/configuration/components" %}})):

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-engine
  namespace: cozy-system
spec:
  variant: default
  components:
    lineage-controller-webhook:
      values:
        lineageControllerWebhook:
          replicas: 5
```

## `localK8sAPIEndpoint.enabled` deprecated

Chart все еще предоставляет `localK8sAPIEndpoint.enabled`. При значении `true` он добавляет `KUBERNETES_SERVICE_HOST=status.hostIP` и `KUBERNETES_SERVICE_PORT=6443`, чтобы webhook обращался к apiserver на своем узле. Изначально это было добавлено, чтобы избежать задержки на пути webhook-to-apiserver. Сейчас значение по умолчанию - `false`, а сам параметр планируется удалить после того, как причина с задержкой будет устранена внутри webhook.

{{% alert title="Важно" color="warning" %}}
Не включайте `localK8sAPIEndpoint.enabled` со стандартными values chart.
Добавленный `status.hostIP` корректен только когда pod работает на узле с kube-apiserver, а мягкий control-plane affinity в chart этого не гарантирует.
Если флаг включен, а pod запланирован не на control-plane-узел, controller уйдет в crash loop, пытаясь подключиться к IP, где нет apiserver.
В сочетании с `failurePolicy: Fail` это означает отказ tenant CREATE/UPDATE-операций.
{{% /alert %}}

## Проверка развертывания

```bash
kubectl -n cozy-system get deploy lineage-controller-webhook
kubectl -n cozy-system get pods -l app=lineage-controller-webhook
kubectl -n cozy-system get svc lineage-controller-webhook -o yaml | grep trafficDistribution
```

Быстрая end-to-end-проверка, которая вызывает webhook через apiserver:

```bash
kubectl create ns lineage-webhook-test
kubectl -n lineage-webhook-test create service clusterip probe \
  --clusterip=None --dry-run=server
kubectl delete ns lineage-webhook-test
```

Dry-run CREATE проходит через mutating admission webhook; если webhook недоступен, команда завершается ошибкой `failed calling webhook "lineage.cozystack.io"`.
