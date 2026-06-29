---
title: "Обновление с v0.41 до v1.0"
linkTitle: "Обновление до v1.0"
description: "Пошаговое руководство по обновлению Cozystack с v0.41.x до v1.0"
weight: 1
---

## Обзор

Версия 1.0 вносит крупное изменение в control plane Cozystack: теперь он полностью модульный
и состоит из независимых пакетов, которыми управляет новый `cozystack-operator`.

Ключевые изменения:

- Старый installer deployment заменен на `cozystack-operator`.
- Конфигурация больше не хранится в ConfigMap: теперь она задается custom resource `Package`.
- Assets server заменен одним OCI image.
- Добавлены новые CRD: `Package` и `PackageSource`.

Нижележащими сущностями по-прежнему остаются Helm releases, поэтому во время обновления workload не пересоздаются и не затрагиваются.

## Критические изменения совместимости

В этом разделе перечислены все пользовательские breaking changes, появившиеся в v1.0.
Большинство изменений обрабатывается автоматически миграциями платформы, которые запускаются во время обновления.
Перед обновлением просмотрите этот список, чтобы понять влияние на ваши рабочие нагрузки.

{{% alert color="warning" %}}
**Пользователи FerretDB**: приложение FerretDB удалено без автоматической миграции.
Нужно сделать резервную копию данных **до** обновления. См. [FerretDB удален](#ferretdb-removed) ниже.
{{% /alert %}}

### MySQL переименован в MariaDB

Приложение `mysql` переименовано в `mariadb`, чтобы точнее отражать используемый движок базы данных.

Все Kubernetes resources переименовываются автоматически во время обновления:

| Ресурс | До | После |
|----------|--------|-------|
| Application Kind | `MySQL` | `MariaDB` |
| HelmRelease prefix | `mysql-` | `mariadb-` |
| Имена Service | `mysql-<name>-primary` | `mariadb-<name>-primary` |
| Имена Secret | `mysql-<name>-credentials` | `mariadb-<name>-credentials` |
| Имена PVC | `storage-mysql-<name>-*` | `storage-mariadb-<name>-*` |

{{% alert color="info" %}}
Если ваши приложения подключаются к MySQL services по Kubernetes DNS name,
например `mysql-mydb-primary.<namespace>.svc`, после миграции нужно обновить строку подключения и использовать новый префикс `mariadb-`.
{{% /alert %}}

### FerretDB удален

Приложение FerretDB полностью удалено из платформы. Автоматической миграции нет.

Если у вас есть запущенные инстансы FerretDB, необходимо **сделать резервную копию всех данных до обновления**.
После обновления FerretDB больше не будет доступен как managed application.

### Virtual Machine разделен на VM Disk и VM Instance

Монолитное приложение `virtual-machine` заменено двумя отдельными приложениями:

- **vm-disk** управляет образами дисков виртуальных машин.
- **vm-instance** управляет инстансами виртуальных машин и ссылается на диски, созданные `vm-disk`.

Миграция выполняется автоматически и сохраняет:
- Данные дисков: PersistentVolumes сохраняются и перепривязываются.
- IP- и MAC-адреса Kube-OVN.
- LoadBalancer IP для VM, опубликованных наружу.

Кроме того, boolean-поле `running` заменено на `runStrategy`:

| Старое значение | Новое значение |
|-----------|-----------|
| `running: true` | `runStrategy: Always` |
| `running: false` | `runStrategy: Halted` |

Поле `runStrategy` также принимает значения `Manual`, `RerunOnFailure` и `Once`.

### Monitoring переведен на новую схему deployment

Стек мониторинга был реструктурирован. HelmRelease с именем `monitoring` в каждом
tenant namespace мигрируется в новый release с именем `monitoring-system`.

Миграция выполняется автоматически: все компоненты мониторинга (VictoriaMetrics, Grafana, Alerta,
VLogs) получают новые labels и принимаются новым HelmRelease.

### Формат VPC subnets изменен с map на array

Поле `subnets` в конфигурации VPC (VirtualPrivateCloud) изменено с map на array.

**До:**
```yaml
subnets:
  my-subnet:
    cidr: 10.0.0.0/24
```

**После:**
```yaml
subnets:
  - name: my-subnet
    cidr: 10.0.0.0/24
```

Для существующих VPC resources миграция выполняется автоматически.

### Конфигурация MongoDB users и databases унифицирована

Формат конфигурации пользователей MongoDB был реструктурирован. Users и databases
теперь задаются в отдельных секциях.

**До:**
```yaml
users:
  myuser:
    db: mydb
    roles:
      - name: readWrite
        db: mydb
```

**После:**
```yaml
users:
  myuser: {}
databases:
  mydb:
    roles:
      admin:
        - myuser
```

Для существующих инстансов MongoDB миграция выполняется автоматически.

### Флаг tenant `isolated` удален

Поле `isolated` удалено из конфигурации Tenant. Сетевая изоляция теперь всегда
применяется для каждого tenant через Cilium network policies: per-tenant отключения нет.
Если раньше вы полагались на `isolated: false`, чтобы разрешить неограниченный трафик
между tenant, теперь это больше невозможно.

Workload внутри tenant namespace по-прежнему должны обращаться к нескольким control-plane
targets: внутрикластерному Kubernetes API server, собственному `etcd` tenant и т. д.
Tenant chart поставляет набор Cilium network policies, которые открывают эти пути
по принципу **opt-in** через pod labels. Если pod внутри tenant namespace
не может обратиться к одному из этих targets, добавьте соответствующую метку в его pod
template:

| Target | Метка на pod |
| --- | --- |
| Внутрикластерный Kubernetes API server | `policy.cozystack.io/allow-to-apiserver: "true"` |
| Services собственного `etcd` cluster tenant (применимо только если tenant был создан с `etcd: true`) | `policy.cozystack.io/allow-to-etcd: "true"` |

Политика `allow-to-apiserver`, устанавливаемая tenant chart, сопоставляет трафик
со встроенной сущностью Cilium `kube-apiserver`, которую Cilium разрешает в реальные
endpoints API server. Вам не нужно знать Service CIDR или адрес Service `kubernetes`:
метки на pod достаточно.

Пример: разрешить pod из Deployment обращаться к `kube-apiserver`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-operator
spec:
  selector:
    matchLabels:
      app: my-operator
  template:
    metadata:
      labels:
        app: my-operator
        policy.cozystack.io/allow-to-apiserver: "true"
    spec:
      containers:
        - name: my-operator
          image: example.com/my-operator:v1.0.0
```

Без метки трафик к `kube-apiserver` блокируется политикой
`allow-to-apiserver` `CiliumNetworkPolicy`, которую tenant chart устанавливает в
каждый tenant namespace. Тот же шаблон применяется к `allow-to-etcd`.

### Внутренние изменения архитектуры

Следующие внутренние изменения не влияют напрямую на рабочие нагрузки приложений, но важны
для скриптов автоматизации или пользовательских инструментов, которые взаимодействуют с внутренними компонентами Cozystack:

- **Flux AIO** теперь устанавливается и управляется `cozystack-operator`, а не отдельным компонентом.
- CRD **CozystackResourceDefinition** переименован в **ApplicationDefinition**.
- Компоненты **legacy installer** (`cozystack` Deployment и `cozystack-assets` StatefulSet) удалены.
- Namespace и HelmRelease **tenant-root** теперь управляются Helm через release `cozystack-basics`.

## Предварительные требования

### 1. Установите необходимые инструменты

Для миграции нужны следующие инструменты:

- **kubectl** и **jq** - стандартные инструменты администрирования кластера.
- **helm** - нужен для установки нового operator.
- **cozypkg** - новый CLI для управления ресурсами Package и PackageSource.
  Скачайте его со [страницы релизов Cozystack](https://github.com/cozystack/cozystack/releases).
- **cozyhr** - необязательный инструмент для управления значениями HelmRelease.
  Скачайте его из [репозитория cozyhr](https://github.com/cozystack/cozyhr/releases).

### 2. Проверьте kubectl context

Убедитесь, что текущий kubectl context указывает на кластер, который вы обновляете:

```bash
kubectl config current-context
```

### 3. Обновитесь до последней версии v0.41.x

Перед миграцией на v1.0 убедитесь, что используете самый свежий patch release v0.41.

Проверьте текущую версию:

```bash
kubectl get configmap -n cozy-system cozystack -o jsonpath='{.metadata.labels.cozystack\.io/version}'
```

Если используется более старая версия, сначала обновитесь до последней v0.41.x по
[стандартной процедуре обновления]({{% ref "/docs/v0/operations/cluster/upgrade" %}}).

### 4. Проверьте состояние кластера

Перед обновлением убедитесь, что все HelmRelease находятся в healthy-состоянии:

```bash
kubectl get hr -A | grep -v "True"
```

Если какие-либо releases не находятся в состоянии `Ready`, устраните эти проблемы до продолжения.

## Шаги обновления

### Шаг 1. Защитите критичные ресурсы

Добавьте аннотации к namespace `cozy-system` и ConfigMap `cozystack-version`, чтобы
Helm не удалил их при обновлении installer release:

```bash
kubectl annotate namespace cozy-system helm.sh/resource-policy=keep --overwrite
kubectl annotate configmap -n cozy-system cozystack-version helm.sh/resource-policy=keep --overwrite
```

{{% alert color="warning" %}}
**Этот шаг обязателен.** Без этих аннотаций обновление Helm installer release
может удалить namespace `cozy-system` и все ресурсы внутри него.
{{% /alert %}}

### Шаг 2. Установите Cozystack Operator

Установите новый operator с помощью Helm из OCI registry.
Команда развернет `cozystack-operator`, установит две новые CRD (`Package` и `PackageSource`)
и создаст ресурс `PackageSource` для платформы.

```bash
helm upgrade --install cozystack oci://ghcr.io/cozystack/cozystack/cozy-installer \
  --version <TARGET_VERSION> \
  --namespace cozy-system \
  --create-namespace \
  --take-ownership
```

Замените `<TARGET_VERSION>` на нужную версию release, например `1.0.0`.

Проверьте, что operator запущен:

```bash
kubectl get pods -n cozy-system -l app=cozystack-operator
```

### Шаг 3. Сгенерируйте Platform Package

Скрипт миграции читает существующие ConfigMap (`cozystack`, `cozystack-branding`, `cozystack-scheduling`)
из namespace `cozy-system` и преобразует их в ресурс `Package` с новой структурой values.

Скачайте и запустите скрипт миграции из репозитория Cozystack:

```bash
curl -fsSL https://raw.githubusercontent.com/cozystack/cozystack/main/hack/migrate-to-version-1.0.sh | bash
```

Скрипт:

1. Прочитает конфигурацию из существующих ConfigMap.
2. Преобразует старые имена bundle (`paas-*`) в новые имена variant (`isp-*`).
3. Сгенерирует ресурс `Package` и покажет его для проверки.
4. Запросит подтверждение перед применением.

{{% alert color="info" %}}
Также можно скачать скрипт и запустить его локально, чтобы просмотреть перед выполнением:

```bash
curl -fsSL -o migrate-to-version-1.0.sh \
  https://raw.githubusercontent.com/cozystack/cozystack/main/hack/migrate-to-version-1.0.sh
chmod +x migrate-to-version-1.0.sh
./migrate-to-version-1.0.sh
```
{{% /alert %}}

### Шаг 4. Наблюдайте за миграцией

Как только Platform Package применен, operator запускает процесс миграции.
Миграции удаляют старый installer deployment и assets server, преобразуют существующие manifests
в новый формат и выполняют reconcile всех компонентов под новым управлением на основе Package.

Следите за статусами HelmRelease:

```bash
kubectl get hr -A
```

Дождитесь, пока все releases покажут `READY: True`.

### Шаг 5. Удалите старые ConfigMap

После проверки, что все компоненты healthy, удалите старые ConfigMap,
которые больше не используются:

```bash
kubectl delete configmap -n cozy-system cozystack cozystack-branding cozystack-scheduling
```

### Шаг 6. Проверьте миграцию

Проверьте, что Platform Package прошел reconcile:

```bash
kubectl get packages.cozystack.io cozystack.cozystack-platform
```

Запустите полную проверку состояния кластера:

```bash
kubectl get hr -A | grep -v "True"
kubectl get pods -n cozy-system
```

Если какие-либо HelmRelease не находятся в состоянии Ready, проверьте логи operator для подробностей.

## Устранение неполадок

### Operator не запускается

Если pod operator находится в CrashLoopBackOff, проверьте логи:

```bash
kubectl logs -n cozy-system deploy/cozystack-operator --previous
```

### HelmRelease зависли после миграции

Во время миграции некоторые HelmRelease могут временно показывать ошибки, пока operator выполняет reconcile.
Подождите несколько минут и проверьте снова. Если проблемы сохраняются, обратитесь к
[чеклисту диагностики]({{% ref "/docs/v1.5/operations/troubleshooting/#troubleshooting-checklist" %}}).
