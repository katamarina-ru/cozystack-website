---
title: "Scheduling Classes"
linkTitle: "Классы планирования"
description: "Ограничение tenant workload конкретными узлами или failure domain с помощью ресурсов SchedulingClass и планировщика Cozystack."
weight: 150
---

SchedulingClass - это cluster-scoped custom resource, который позволяет администраторам задавать
политики размещения для tenant workload. Когда tenant назначен scheduling class,
все его pod автоматически направляются в custom scheduler Cozystack, который
объединяет ограничения, заданные классом, с ограничениями, уже указанными в pod.

Это позволяет операторам платформы закреплять tenant за конкретными дата-центрами, availability
zone или группами узлов без изменения отдельных application charts.

## Как это работает

Функция состоит из двух компонентов:

1. **Lineage-controller webhook** (часть `cozystack`): mutating admission webhook,
   который перехватывает создание pod в tenant namespace. Если у namespace есть метка
   `scheduler.cozystack.io/scheduling-class`, webhook задает `schedulerName: cozystack-scheduler`
   и добавляет аннотацию `scheduler.cozystack.io/scheduling-class` на каждый pod.
   Если указанный SchedulingClass CR не существует, например scheduler не установлен,
   pod остаются без изменений и планируются обычным способом.

2. **Cozystack scheduler** (пакет `cozystack-scheduler`): custom Kubernetes
   scheduler, который работает рядом со стандартным scheduler. Во время планирования он находит
   SchedulingClass, указанный в аннотации pod, и объединяет ограничения CR
   (node affinity, pod affinity/anti-affinity, topology spread) с собственным spec pod
   полностью в памяти, не изменяя pod в API server.

## Предварительные требования

- Cozystack v1.2+
- The `cozystack-scheduler` system package (v0.2.0+)

## Установка scheduler

```bash
cozypkg add cozystack.cozystack-scheduler
```

## Создание SchedulingClass

SchedulingClass CR повторяет привычные примитивы планирования Kubernetes. Все поля
необязательны: указывайте только те ограничения, которые вам нужны.

### Пример: закрепление workload за дата-центром

```yaml
apiVersion: cozystack.io/v1alpha1
kind: SchedulingClass
metadata:
  name: dc-west
spec:
  nodeSelector:
    topology.kubernetes.io/region: us-west-2
```

Pod, назначенные этому классу, будут планироваться только на узлы с меткой
`topology.kubernetes.io/region=us-west-2`.

### Пример: распределение по availability zone

```yaml
apiVersion: cozystack.io/v1alpha1
kind: SchedulingClass
metadata:
  name: zone-spread
spec:
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
```

{{% alert title="Примечание" %}}
Если у `topologySpreadConstraint` или у условия pod affinity/anti-affinity значение
`labelSelector` равно nil, scheduler автоматически заполняет его селектором,
который соответствует identity labels приложения Cozystack (`apps.cozystack.io/application.group`,
`.kind`, `.name`). Это позволяет задавать универсальные политики распределения или anti-affinity
без жестко прописанных значений меток для каждого приложения.
{{% /alert %}}

### Пример: требование выделенных узлов с anti-affinity

```yaml
apiVersion: cozystack.io/v1alpha1
kind: SchedulingClass
metadata:
  name: dedicated-nodes
spec:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: node-pool
              operator: In
              values:
                - dedicated
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - topologyKey: kubernetes.io/hostname
```

Это закрепляет workload за узлами из пула `dedicated` и распределяет pod по
хостам. `labelSelector` для anti-affinity автоматически заполняется для каждого приложения, поэтому
pod из разных приложений одного tenant все еще могут попадать на один узел.

## Полный справочник spec SchedulingClass

| Поле | Тип | Описание |
|-------|------|-------------|
| `spec.nodeSelector` | `map[string]string` | Простые key-value метки узлов, которым должны соответствовать все подходящие узлы. |
| `spec.nodeAffinity` | [`NodeAffinity`](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#nodeaffinity-v1-core) | Обязательные и предпочтительные правила node affinity. |
| `spec.podAffinity` | [`PodAffinity`](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#podaffinity-v1-core) | Обязательные и предпочтительные правила совместного размещения pod. |
| `spec.podAntiAffinity` | [`PodAntiAffinity`](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#podantiaffinity-v1-core) | Обязательные и предпочтительные правила разнесения pod. |
| `spec.topologySpreadConstraints` | [`[]TopologySpreadConstraint`](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#topologyspreadconstraint-v1-core) | Ограничения topology spread для равномерного распределения по failure domain. |

## Назначение SchedulingClass tenant

При создании или редактировании tenant задайте параметр `schedulingClass` равным имени
существующего SchedulingClass CR:

**Через dashboard:**

Выберите scheduling class в выпадающем списке формы создания tenant.

**Через Helm values (`values.yaml`):**

```yaml
schedulingClass: dc-west
```

**Через tenant secret (наследование дочерними tenant):**

Если родительскому tenant назначен scheduling class, все дочерние tenant наследуют его
автоматически. Дочерний tenant не может переопределить scheduling class родителя: он может
задать свой class только если у родителя его нет.

Назначение записывает метку `scheduler.cozystack.io/scheduling-class` в namespace
tenant. Webhook читает эту метку (или определяет ее из owning Application CR), чтобы
вставить имя scheduler и аннотацию в pod.

## Автоматически заполняемые label selectors

Scheduler (v0.2.0+) автоматически заполняет поля `labelSelector` со значением nil
в условиях pod affinity, pod anti-affinity и topology spread constraint. Он использует
identity labels приложения Cozystack у pod:

- `apps.cozystack.io/application.group`
- `apps.cozystack.io/application.kind`
- `apps.cozystack.io/application.name`

Это означает, что универсальный SchedulingClass, например:

```yaml
spec:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - topologyKey: kubernetes.io/hostname
```

автоматически ограничит anti-affinity pod одного приложения: каждое приложение получит
собственное поведение anti-affinity без отдельного SchedulingClass для каждого приложения.

Ключи меток по умолчанию можно переопределить в Helm values scheduler:

```yaml
defaultLabelSelectorKeys:
  - apps.cozystack.io/application.group
  - apps.cozystack.io/application.kind
  - apps.cozystack.io/application.name
```

Если у условия уже есть явный `labelSelector`, он сохраняется без изменений.

## Операторы без встроенной поддержки schedulerName

Некоторые операторы, используемые Cozystack, не предоставляют `schedulerName` в своих CRD.
Подход на основе webhook обрабатывает такие случаи прозрачно, потому что изменяет pod
напрямую во время admission, независимо от того, какой оператор их создал:

- etcd-operator
- redis-operator (spotahome)
- mariadb-operator
- clickhouse-operator (altinity)

Для workload, которыми управляют эти операторы, специальная конфигурация не требуется.

## Проверка настройки

1. Убедитесь, что scheduler запущен:

   ```bash
   kubectl get pods -n cozy-system -l app.kubernetes.io/name=cozystack-scheduler
   ```

2. Убедитесь, что SchedulingClass существует:

   ```bash
   kubectl get schedulingclasses
   ```

3. Проверьте, что namespace tenant содержит метку:

   ```bash
   kubectl get ns tenant-example -o jsonpath='{.metadata.labels.scheduler\.cozystack\.io/scheduling-class}'
   ```

4. Проверьте, что pod в namespace tenant используют custom scheduler:

   ```bash
   kubectl get pods -n tenant-example -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.schedulerName}{"\n"}{end}'
   ```
