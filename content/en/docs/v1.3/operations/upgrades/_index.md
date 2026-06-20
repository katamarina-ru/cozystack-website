---
description: Пошаговое руководство по обновлению Cozystack с v0.41.x до v1.0.
linkTitle: Обновление до v1.0
title: Обновление с v0.41 до v1.0
weight: 1
---

## Обзор

В версии 1.0 существенно изменилась control plane Cozystack: теперь она полностью модульная
и состоит из независимых пакетов, которыми управляет новый `cozystack-operator`.

Ключевые изменения:

- старый installer deployment заменен на `cozystack-operator`;
- конфигурация больше не хранится в ConfigMap — теперь она задается пользовательским ресурсом `Package`;
- assets server заменен единым OCI-образом;
- добавлены новые CRD: `Package` и `PackageSource`.

Базовые сущности по-прежнему остаются Helm release, поэтому во время обновления рабочие нагрузки не пересоздаются и не затрагиваются.

## Breaking changes

В этом разделе перечислены все пользовательски значимые Breaking changes, появившиеся в v1.0.
Большинство изменений обрабатывается автоматически миграциями платформы, которые запускаются во время обновления.
Перед обновлением изучите этот список, чтобы понимать влияние на ваши рабочие нагрузки.

{{% alert color="warning" %}}
**Пользователи FerretDB**: приложение FerretDB удалено без автоматической миграции.
Перед обновлением необходимо сделать резервную копию данных. См. раздел [FerretDB удален](#ferretdb-removed) ниже.
{{% /alert %}}

### MySQL переименован в MariaDB

Приложение `mysql` переименовано в `mariadb`, чтобы точно отражать используемый движок базы данных.

Все Kubernetes-ресурсы переименовываются автоматически во время обновления:

| Ресурс | До | После |
|----------|--------|-------|
| Application Kind | `MySQL` | `MariaDB` |
| Префикс HelmRelease | `mysql-` | `mariadb-` |
| Имена Service | `mysql-<name>-primary` | `mariadb-<name>-primary` |
| Имена Secret | `mysql-<name>-credentials` | `mariadb-<name>-credentials` |
| Имена PVC | `storage-mysql-<name>-*` | `storage-mariadb-<name>-*` |

{{% alert color="info" %}}
Если ваши приложения подключаются к сервисам MySQL по Kubernetes DNS-имени,
например `mysql-mydb-primary.<namespace>.svc`, после миграции нужно обновить строки подключения,
используя новый префикс `mariadb-`.
{{% /alert %}}

### FerretDB удален

Приложение FerretDB полностью удалено из платформы. Автоматической миграции нет.

Если у вас есть запущенные экземпляры FerretDB, необходимо **сделать резервную копию всех данных до обновления**.
После обновления FerretDB больше не будет доступен как управляемое приложение.

### Virtual Machine разделено на VM Disk и VM Instance

Монолитное приложение `virtual-machine` заменено двумя отдельными приложениями:

- **vm-disk** — управляет дисковыми образами виртуальных машин;
- **vm-instance** — управляет экземплярами виртуальных машин и ссылается на диски, созданные через `vm-disk`.

Миграция выполняется автоматически и сохраняет:

- данные дисков: PersistentVolume сохраняются и повторно привязываются;
- IP- и MAC-адреса Kube-OVN;
- LoadBalancer IP для внешне опубликованных VM.

Кроме того, boolean-поле `running` заменено на `runStrategy`:

| Старое значение | Новое значение |
|-----------|-----------|
| `running: true` | `runStrategy: Always` |
| `running: false` | `runStrategy: Halted` |

Поле `runStrategy` также принимает значения `Manual`, `RerunOnFailure` и `Once`.

### Monitoring переведен на новую схему развертывания

Стек мониторинга был реструктурирован. HelmRelease с именем `monitoring` в каждом
tenant namespace мигрируется в новый Helm release с именем `monitoring-system`.

Миграция выполняется автоматически: все ресурсы мониторинга, включая VictoriaMetrics, Grafana, Alerta
и VLogs, получают новые labels и переходят под управление нового HelmRelease.

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

Для существующих VPC-ресурсов миграция выполняется автоматически.

### Конфигурация пользователей и баз данных MongoDB унифицирована

Формат настройки пользователей MongoDB был изменен. Теперь пользователи и базы данных
задаются в отдельных секциях.

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

Для существующих экземпляров MongoDB миграция выполняется автоматически.

### Флаг Tenant `isolated` удален

Поле `isolated` удалено из конфигурации Tenant. Network isolation теперь всегда применяется
для каждого tenant через Cilium network policies, без возможности отключения на уровне отдельного tenant.
Если раньше вы использовали `isolated: false`, чтобы разрешить неограниченный трафик между tenant'ами,
теперь это больше невозможно.

Workloads внутри tenant namespace по-прежнему должны иметь доступ к нескольким таргетам control plane:
внутрикластерному Kubernetes API server, собственному `etcd` tenant'а и так далее.
Tenant chart поставляет набор Cilium network policies, которые открывают эти сетевые пути
по принципу opt-in, на основе labels pod'ов. Если pod внутри tenant namespace
не может подключиться к одной из этих таргетов, добавьте соответствующий label в его pod template:

| Target | Label на pod |
| --- | --- |
| Внутрикластерный Kubernetes API server | `policy.cozystack.io/allow-to-apiserver: "true"` |
| Сервисы `etcd` cluster, принадлежащего tenant'у (применимо только если tenant был создан с `etcd: true`) | `policy.cozystack.io/allow-to-etcd: "true"` |

Policy `allow-to-apiserver`, которую устанавливает tenant chart, сопоставляет трафик
со встроенной сущностью Cilium `kube-apiserver`, которую Cilium разрешает в реальные
endpoints API server. Вам не нужно знать Service CIDR или адрес Service `kubernetes`:
достаточно label на pod.

Пример: разрешить pod'ам Deployment обращаться к `kube-apiserver`:

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

Без этого label трафик к `kube-apiserver` блокируется
`CiliumNetworkPolicy` `allow-to-apiserver`, которую tenant chart устанавливает
в каждом tenant namespace. Тот же шаблон применяется к `allow-to-etcd`.

### Внутренние изменения архитектуры

Следующие внутренние изменения не влияют напрямую на рабочие нагрузки приложений, но важны
для скриптов автоматизации и пользовательских инструментов, которые взаимодействуют с внутренними сущностями Cozystack:

- **Flux AIO** теперь устанавливается и управляется `cozystack-operator`, а не отдельным компонентом.
- CRD **CozystackResourceDefinition** переименован в **ApplicationDefinition**.
- Компоненты **legacy installer**: Deployment `cozystack` и StatefulSet `cozystack-assets` — удалены.
- Namespace и HelmRelease **tenant-root** теперь управляются Helm через release `cozystack-basics`.

## Предварительные требования

### 1. Установите необходимые инструменты

Для миграции нужны следующие инструменты:

- **kubectl** и **jq** — стандартные инструменты администрирования кластера;
- **helm** — нужен для установки нового оператора;
- **cozypkg** — новый CLI для управления ресурсами Package и PackageSource.
   Скачать можно на [странице релизов Cozystack](https://github.com/cozystack/cozystack/releases);
- **cozyhr** — необязательный инструмент для управления значениями HelmRelease.
   Скачать можно из [репозитория cozyhr](https://github.com/cozystack/cozyhr/releases).

### 2. Проверьте kubectl context

Убедитесь, что текущий kubectl context указывает на кластер, который вы обновляете:

```bash
kubectl config current-context
```

### 3. Обновитесь до последней версии v0.41.x

Перед миграцией на v1.0 убедитесь, что у вас установлена последняя patch-версия v0.41.

Проверьте текущую версию:

```bash
kubectl get configmap -n cozy-system cozystack -o jsonpath='{.metadata.labels.cozystack\.io/version}'
```

Если у вас более старая версия, сначала обновитесь до последней v0.41.x,
используя [стандартную процедуру обновления]({{% ref "/docs/v0/operations/cluster/upgrade" %}}).

### 4. Проверьте состояние кластера

Перед обновлением убедитесь, что все HelmRelease находятся в здоровом состоянии:

```bash
kubectl get hr -A | grep -v "True"
```

Если какие-либо HelmRelease не находятся в состоянии `Ready`, устраните проблемы перед продолжением.

## Шаги обновления

### Шаг 1. Защитите критичные ресурсы

Добавьте annotation к namespace `cozy-system` и ConfigMap `cozystack-version`, чтобы Helm
не удалил их при обновлении installer release:

```bash
kubectl annotate namespace cozy-system helm.sh/resource-policy=keep --overwrite
kubectl annotate configmap -n cozy-system cozystack-version helm.sh/resource-policy=keep --overwrite
```

{{% alert color="warning" %}}
**Этот шаг обязателен.** Без этих annotations обновление Helm installer release
может удалить namespace `cozy-system` и все ресурсы внутри него.
{{% /alert %}}

### Шаг 2. Установите Cozystack Operator

Установите новый оператор через Helm из OCI registry.
Это развернет `cozystack-operator`, установит два новых CRD (`Package` и `PackageSource`)
и создаст ресурс `PackageSource` для платформы.

```bash
helm upgrade --install cozystack oci://ghcr.io/cozystack/cozystack/cozy-installer \
  --version <TARGET_VERSION> \
  --namespace cozy-system \
  --create-namespace \
  --take-ownership
```

Замените `<TARGET_VERSION>` на нужную версию релиза, например `1.0.0`.

Проверьте, что оператор запущен:

```bash
kubectl get pods -n cozy-system -l app=cozystack-operator
```

### Шаг 3. Сгенерируйте пакет платформы

Скрипт миграции читает существующие ConfigMap `cozystack`, `cozystack-branding` и `cozystack-scheduling`
из namespace `cozy-system` и преобразует их в ресурс `Package` с новой структурой значений.

Скачайте и запустите скрипт миграции из репозитория Cozystack:

```bash
curl -fsSL https://raw.githubusercontent.com/cozystack/cozystack/main/hack/migrate-to-version-1.0.sh | bash
```

Скрипт:

1. прочитает конфигурацию из существующих ConfigMap;
2. преобразует старые имена bundle (`paas-*`) в новые имена вариантов (`isp-*`);
3. сгенерирует ресурс `Package` и покажет его для проверки;
4. запросит подтверждение перед применением.

{{% alert color="info" %}}
Вы также можете скачать скрипт и запустить его локально, чтобы проверить перед выполнением:

```bash
curl -fsSL -o migrate-to-version-1.0.sh \
  https://raw.githubusercontent.com/cozystack/cozystack/main/hack/migrate-to-version-1.0.sh
chmod +x migrate-to-version-1.0.sh
./migrate-to-version-1.0.sh
```

{{% /alert %}}

### Шаг 4. Следите за миграцией

Как только пакет платформы применен, оператор запускает процесс миграции.
Миграции удаляют старый installer deployment и assets server, преобразуют существующие manifests
в новый формат и переводят все компоненты под управление на основе Package.

Следите за состоянием HelmRelease:

```bash
kubectl get hr -A
```

Дождитесь, пока все HelmRelease покажут `READY: True`.

### Шаг 5. Удалите старые ConfigMap

После проверки, что все компоненты здоровы, удалите старые ConfigMap,
которые больше не используются:

```bash
kubectl delete configmap -n cozy-system cozystack cozystack-branding cozystack-scheduling
```

### Шаг 6. Проверьте миграцию

Проверьте, что пакет платформы успешно синхронизирован:

```bash
kubectl get packages.cozystack.io cozystack.cozystack-platform
```

Выполните полную проверку состояния кластера:

```bash
kubectl get hr -A | grep -v "True"
kubectl get pods -n cozy-system
```

Если какие-либо HelmRelease не находятся в состоянии Ready, проверьте логи оператора.

## Устранение неполадок

### Оператор не запускается

Если pod оператора находится в состоянии CrashLoopBackOff, проверьте логи:

```bash
kubectl logs -n cozy-system deploy/cozystack-operator --previous
```

### HelmRelease зависли после миграции

Во время миграции некоторые HelmRelease могут временно показывать ошибки, пока оператор их синхронизирует.
Подождите несколько минут и проверьте снова. Если проблемы сохраняются, обратитесь к
[чеклисту устранения неполадок]({{% ref "/docs/v1.3/operations/troubleshooting/#troubleshooting-checklist" %}}).
