---
linkTitle: Руководство по разработке
title: Cozystack Руководство по разработке
description: Cozystack Руководство по разработке
weight: 100
aliases:
  - /docs/v1.5/development/development
---

## Как это работает

Cozystack — платформа на основе операторов. Начальная загрузка и текущее управление
осуществляются набором контроллеров, работающих внутри кластера. Высокоуровневый поток выглядит так:

1. **Инсталлятор чарта** (`packages/core/installer`) применяется через `helm install`.
   Он разворачивает Deployment `cozystack-operator` в пространстве имён `cozy-system`.

2. **cozystack-operator** запускается и выполняет однократную начальную загрузку:
   - Устанавливает CRD Cozystack (`Package`, `PackageSource`) из встроенных манифестов
     (`internal/crdinstall`).
   - Устанавливает компоненты Flux (source-controller, helm-controller,
     source-watcher) из встроенных манифестов (`internal/fluxinstall`).
   - Создаёт **начальный OCIRepository** (`cozystack-platform`) из значений
     `platformSourceUrl` и `platformSourceRef`, заданных в инсталляторе.
   - Создаёт `PackageSource`, ссылающийся на начальный OCIRepository.

3. **Цикл согласования** берёт управление. Оператор следит за CRD `PackageSource` и
   `Package` и преобразует их в объекты Flux `HelmRelease`. Flux
   затем устанавливает реальные Helm-чарты и управляет ими.

4. **Platform chart** (`packages/core/platform`) разворачивается как обычный
   Package. Он читает конфигурацию кластера из ресурса
   `cozystack.cozystack-platform`
   [Package]({{% ref "/docs/v1.5/operations/configuration/platform-package" %}})
   и создаёт шаблоны манифестов пакетов, определяющих, какие системные компоненты
   должны быть установлены.

   Platform chart также создаёт **вторичный OCIRepository** (`cozystack-packages`),
   копируя спецификацию из начального OCIRepository. Все PackageSource ссылаются
   на этот вторичный репозиторий. При обновлениях platform chart выполняет миграции
   как `pre-upgrade` хуки перед созданием или обновлением HelmRelease компонентов.

5. **FluxCD** — движок выполнения, он согласует объекты `HelmRelease`,
   созданные оператором, загружает артефакты чартов из ресурсов `ExternalArtifact`
   и применяет их к кластеру.

Полную цепочку согласования (PackageSource → ArtifactGenerator → ExternalArtifact → Package → HelmRelease → Pods), разрешение зависимостей, потоки обновления и отката, а также CLI cozypkg см. в разделе [Ключевые концепции]({{% ref "/docs/v1.5/guides/concepts" %}}).

### OCIRepository и поток миграции

Cozystack использует два ресурса OCIRepository для управления обновлениями платформы:

| OCIRepository | Создаётся | Ссылается на |
|---|---|---|
| `cozystack-platform` | cozystack-operator | Настраивается через значения инсталлятора (`platformSourceUrl`, `platformSourceRef`) |
| `cozystack-packages` | Platform chart (`repository.yaml`) | Копирует спецификацию из `cozystack-platform` |

Все PackageSource в `packages/core/platform/sources/` ссылаются на `cozystack-packages`.

#### Выполнение миграций

Миграции выполняются как Helm `pre-upgrade` хуки в platform chart:

```yaml
# packages/core/platform/templates/migration-hook.yaml
metadata:
  name: cozystack-migration-hook
  annotations:
    helm.sh/hook: pre-upgrade,pre-install
    helm.sh/hook-weight: "1"
```

Контейнер миграции считывает текущую версию из ConfigMap `cozystack-version` и выполняет скрипты миграции последовательно от `CURRENT_VERSION` до `TARGET_VERSION - 1`. Каждая миграция обновляет ConfigMap при успехе, обеспечивая идемпотентность миграций и возможность возобновления после сбоев.

#### Зачем два репозитория?

Разделение гарантирует, что:

1. Начальный OCIRepository управляется оператором (через значения инсталлятора).
2. Все PackageSource имеют согласованную ссылку (`cozystack-packages`), а не указывают напрямую на источник, управляемый оператором.
3. Platform chart может выполнять миграции перед созданием вторичного OCIRepository, гарантируя выполнение миграций до обновления компонентов.

### Ключевые бинарные файлы

| Бинарный файл | Источник | Роль |
|---|---|---|
| **cozystack-operator** | `cmd/cozystack-operator` | Начальная загрузка (CRD, Flux, источник платформы), согласование `PackageSource` и `Package`, репликация секрета `cozystack-values`. |
| **cozystack-controller** | `cmd/cozystack-controller` | Согласование рабочих нагрузок и ApplicationDefinition, управление дашбордами. |
| **cozystack-api** | `cmd/cozystack-api` | Уровень агрегации API Kubernetes для групп API `apps.cozystack.io` и `core.cozystack.io`. |
| **cozypkg** | `cmd/cozypkg` | CLI-инструмент для управления пакетами — визуализация зависимостей, интерактивная установка и удаление. |

## Структура репозитория

Основная структура репозитория [cozystack](https://github.com/cozystack/cozystack):

```shell
.
├── api             # Go-типы для CRD Cozystack (Package, PackageSource и т.д.)
├── cmd             # Точки входа для всех бинарных файлов
│   ├── cozystack-operator      # Основной оператор платформы
│   ├── cozystack-controller    # Контроллеры рабочих нагрузок и приложений
│   ├── cozystack-api           # Агрегированный API-сервер
│   └── cozypkg                 # CLI для управления пакетами
├── internal        # Реализации контроллеров и согласователей
│   ├── operator                # Согласователи PackageSource и Package
│   ├── controller              # Контроллеры рабочих нагрузок и ApplicationDefinition
│   ├── fluxinstall             # Встроенные манифесты Flux и инсталлятор
│   ├── crdinstall              # Встроенные манифесты CRD и инсталлятор
│   └── cozyvaluesreplicator    # Логика репликации секретов
├── packages        # Helm-чарты, организованные по слоям
│   ├── core            # Начальная загрузка и конфигурация платформы
│   ├── system          # Инфраструктурные операторы и upstream-чарты
│   ├── apps            # Пользовательские чарты приложений
│   └── extra           # Чарты приложений для конкретных тенантов
├── pkg             # Общие Go-библиотеки
├── dashboards      # Дашборды Grafana
├── hack            # Вспомогательные скрипты для локальной разработки
└── docs            # Журналы изменений и примечания к релизам
```

Разработку можно вести локально, изменяя и обновляя файлы в этом репозитории.

## Пакеты

Cozystack is, at its core, a **provider of managed services**. Much like the managed
offerings of AWS or Google Cloud, a user comes to order a **final entity** — a
PostgreSQL database, a Kafka queue, an S3 bucket, a Kubernetes cluster, a virtual
machine — rather than to assemble the underlying infrastructure themselves. Each of these is a **first-class object** in the Cozystack
API (`apps.cozystack.io`): the user declares *what* they want, and the platform
provisions and operates the implementation underneath. The user gets an endpoint and
credentials and never has to know — or even see — how or where the service actually runs.

The four package categories follow directly from this model:

- **`core`** — how the platform bootstraps and configures itself.
- **`system`** — the operators and upstream charts that actually run workloads.
- **`apps`** — the first-class managed services a user orders directly.
- **`extra`** — enabler modules a tenant switches on, which power those services under
  the hood without being ordered as standalone services.

The split between `apps` and `extra` is the one most often misunderstood, so it is
spelled out in detail below.

### [core](https://github.com/cozystack/cozystack/tree/main/packages/core)

Core-пакеты отвечают за начальную загрузку и конфигурацию на уровне платформы.

#### installer

Helm-чарт, разворачивающий Deployment `cozystack-operator`. Он создаёт
пространство имён `cozy-system`, ServiceAccount с правами cluster-admin и
Deployment оператора с флагами, инициирующими установку CRD и Flux при запуске.
Образ оператора и URL источника платформы задаются во время сборки.

#### platform

Helm-чарт, разворачиваемый как обычный `Package` (не применяется напрямую). Он читает
конфигурацию кластера из ресурса `cozystack.cozystack-platform`
[Package]({{% ref "/docs/v1.5/operations/configuration/platform-package" %}})
и создаёт шаблоны манифестов согласно указанному
[варианту]({{% ref "/docs/v1.5/operations/configuration/variants" %}}) и
настройкам компонентов, определяя, какие системные компоненты должны быть установлены.

#### flux-aio

Компоненты Flux, упакованные для развёртывания оператором.

#### talos

Конфигурационные ресурсы Talos OS.

{{% alert color="info" %}}
Core-пакеты не используют Helm для применения манифестов; они предназначены для использования только как `helm template . | kubectl apply -f -`.
{{% /alert %}}

### [system](https://github.com/cozystack/cozystack/tree/main/packages/system)

System-пакеты настраивают систему для управления и развёртывания пользовательских приложений.
Необходимые системные компоненты указываются в конфигурации пакета.

System-пакеты включают два вида компонентов:

- **Операторы** (например, `postgres-operator`, `kafka-operator`, `redis-operator`): Контроллеры,
  умеющие управлять полным жизненным циклом конкретного приложения, включая операции второго дня.
- **Upstream Helm-чарты** для приложений без выделенного оператора (например, `nats`, `ingress-nginx`):
  Эти чарты размещаются в system, чтобы пакеты apps и extra могли разворачивать их
  через Flux `HelmRelease` CR, фактически используя FluxCD в качестве оператора.

{{% alert color="info" %}}
System-пакеты используют Helm для установки и управляются FluxCD.
{{% /alert %}}

### [apps](https://github.com/cozystack/cozystack/tree/main/packages/apps)

`apps` are the **first-class managed services** a user orders directly. Each one is a
final entity shown in the dashboard catalog and exposed through the `apps.cozystack.io`
API: `apps/postgres` ("Managed PostgreSQL service"), `apps/kubernetes` ("Managed
Kubernetes service"), `apps/kafka`, `apps/bucket` (an S3 bucket), `apps/vm-instance`,
and so on.

An app chart is a **high-level API**, not a deployment recipe. It defines only the
parameters that should be exposed and validated through `values.schema.json`, keeping
the interface minimal and secure — for example, a user selects a Postgres *version* but
cannot override the container image. The chart contains no business logic for running
the application itself; it delegates to an operator or to FluxCD. This thin API layer
over the raw operator exists so the platform keeps full control of every input
(security) and hands the user a final, ready-to-consume service (UX).

В зависимости от наличия выделенного оператора приложения apps следуют одному из двух паттернов:

#### Паттерн на основе оператора

Когда для приложения есть выделенный оператор (например, PostgreSQL, MongoDB, Redis, Kafka),
чарт app создаёт **экземпляры CRD**, которыми управляет оператор:

```
packages/system/postgres-operator/   # Helm-чарт оператора
packages/apps/postgres/              # App-чарт создаёт postgresql.cnpg.io/v1.Cluster CR
```

Оператор обрабатывает все детали развёртывания и операции второго дня (масштабирование, резервное копирование, переключение при сбое).
App-чарт просто создаёт соответствующий CRD со значениями, полученными из пользовательского ввода.

#### Паттерн на основе HelmRelease

Когда для приложения нет выделенного оператора и стандартным методом развёртывания является Helm-чарт,
upstream-чарт размещается в `system/`, а app-чарт создаёт
**Flux `HelmRelease` CR**, указывающий на него:

```
packages/system/nats/                # Upstream Helm-чарт NATS
packages/apps/nats/                  # App-чарт создаёт helm.toolkit.fluxcd.io/v2.HelmRelease
```

В этом случае FluxCD выступает оператором, управляя жизненным циклом Helm-релиза. App-чарт
контролирует, какие upstream-значения открываются пользователю, обеспечивая дополнительный уровень
безопасности — пользователи не могут обойти валидацию для развёртывания чарта с произвольными значениями.

Другие примеры этого паттерна: `extra/ingress`, `extra/seaweedfs`, `extra/monitoring`.

### [extra](https://github.com/cozystack/cozystack/tree/main/packages/extra)

<<<<<<< HEAD
Аналогично `apps`, но не отображается в каталоге приложений. Могут устанавливаться только в составе тенанта.
Разрешены для использования нижележащими тенантами, установленными в пространстве имён текущего тенанта.
=======
`extra` packages are **enabler modules**, not first-class services. A user never orders
them as a final entity; instead they are switched on as **tenant options**, and once
enabled they provide capabilities that the `apps` services build on — working under the
hood. For that reason they are *not* shown in the application catalog (they appear
under **Administration → Modules** instead) and can only be installed as part of a
tenant. Because an `extra` module is enabled at the tenant level,
it is shared by the child (bottom) tenants nested in that tenant's namespace —
provisioned once and reused beneath them (for example, a child tenant without its own
`monitoring` sends its metrics to the parent tenant's monitoring stack instead of
running a second copy).

The clearest example is object storage:

- `extra/seaweedfs` deploys a SeaweedFS cluster and
  registers `BucketClass` resources for the tenant.
- `apps/bucket` ("S3 compatible storage") is what the user actually orders — it creates
  a `BucketClaim` against one of those `BucketClass`es.

So a tenant administrator *enables the SeaweedFS module once*, and from then on users
can order S3 buckets as a first-class service. The user consumes a bucket; they never
see, order, or manage SeaweedFS itself — it is an implementation detail of "S3 bucket".
Other `extra` modules
supply tenant-wide infrastructure rather than orderable services: `extra/ingress`
(NGINX Ingress Controller), `extra/monitoring` (the tenant's monitoring stack), and
`extra/gateway` (per-tenant Gateway API backed by Cilium; toggle-only — it has no
dashboard presence and is enabled automatically for tenants with a derived apex domain).
>>>>>>> pr-24

Подробнее о [Системе тенантов](/docs/guides/concepts/#tenant-system) читайте на странице основных концепций.

В одном пространстве имён тенанта можно использовать только один тип приложения.

Extra-пакеты следуют тем же двум архитектурным паттернам, что и apps (на основе оператора или HelmRelease).

{{% alert color="info" %}}
Пакеты apps и extra используют Helm для установки приложения и управляются FluxCD через дашборд.
{{% /alert %}}

<<<<<<< HEAD
## Структура пакета
=======
### Choosing apps, extra, or a bundled dependency

When adding a new capability, decide where it belongs by asking who consumes it:

1. **Does the user order it directly as a final service?** Then it is a first-class
   managed service → `apps`, shown in the catalog (e.g., `apps/postgres`, `apps/bucket`).
2. **Is it a shared dependency** — used by several apps, or reused across tenants? Then
   it is an enabler the platform/tenant switches on once and many things build on →
   `extra` (e.g., `extra/seaweedfs` backs every `apps/bucket`; `extra/monitoring` collects
   metrics for all apps in a tenant).
3. **Is it a single, private dependency** of one application, shared with no one? Then it
   is *not* a package at all — it is bundled **inside the consuming chart** and deployed
   together with it, invisible to the user. For example, the `monitoring` stack ships its
   own PostgreSQL database for Alerta as part of its release (the former `ferretdb` app
   likewise shipped its own PostgreSQL inside the chart); the user neither sees nor has
   access to these internal databases.

Dependencies also run **between first-class services**. When a dependency is itself
something the user creates, keeps, and manages on its own, it stays an `apps` service
and other apps simply **reference** it instead of bundling it. For example, `apps/vm-disk`
("Virtual Machine Disk") is ordered on its own, and `apps/vm-instance` attaches one or
more existing disks by name (the dashboard lists the available disks to choose from). A
disk has its own lifecycle — it can outlive an instance, be detached and reattached, or
join several disks on one VM — so it is a service in its own right, not something hidden
inside `vm-instance`.

Two questions settle most cases: **who orders it** (the user → `apps`; the platform or a
tenant → `extra`) and **does it have value on its own** (yes → its own `apps` service
that others reference; no → bundled and hidden inside the consuming chart). Sharing tips
the scale toward `extra`: a dependency that must be provisioned once and reused across
apps or tenants becomes a module rather than a per-instance bundle.

## Package Structure
>>>>>>> pr-24

Каждый пакет — это типичный Helm-чарт, содержащий все необходимые образы и манифесты
для платформы. Мы следуем логике umbrella-чарта, размещая upstream-чарты в
директории `./charts` и переопределяя values.yaml в корне приложения.
Такая структура упрощает обновление upstream-чартов.

```shell
.
├── Chart.yaml                           # Определение Helm-чарта и описание параметров
├── Makefile                             # Общие цели для упрощения локальной разработки
├── charts                               # Директория для upstream-чартов
├── images                               # Директория для Docker-образов
├── patches                              # Опциональная директория для патчей upstream-чартов
├── templates                            # Дополнительные манифесты для upstream Helm-чарта
├── templates/dashboard-resourcemap.yaml # Роль для отображения ресурсов k8s в дашборде
├── values.yaml                          # Значения переопределения для upstream Helm-чарта
└── values.schema.json                   # JSON-схема для валидации входных значений и отрисовки элементов UI в дашборде
```

<<<<<<< HEAD
Для генерации файлов `README.md` и `values.schema.json` можно использовать [readme-generator](https://github.com/bitnami/readme-generator-for-helm) от Bitnami.

Просто установите его как бинарный файл `readme-generator` в своей системе и запустите генерацию командой `make generate`.
=======
Use [`cozyvalues-gen`](https://github.com/cozystack/cozyvalues-gen) to generate the `README.md` parameters table and the `values.schema.json` schema from annotations in `values.yaml`.

Install the `cozyvalues-gen` binary from [the releases page](https://github.com/cozystack/cozyvalues-gen/releases) and run `make generate` in the package directory. Besides the schema and the README, it also refreshes the package's `ApplicationDefinition` (`spec.application.openAPISchema` and `spec.dashboard.keysOrder`) via `hack/update-crd.sh`.
>>>>>>> pr-24

## Принципы разработки Helm-чартов

Структура пакетов и рабочий процесс разработки в Cozystack основаны на следующих принципах:

### Простое обновление upstream-чартов

Оригинальный upstream-чарт должен быть легко обновляемым, переопределяемым и изменяемым. Мы используем паттерн umbrella-чарта — upstream-чарты находятся в директории `./charts` и хранятся в оригинальном виде. Кастомизации вносятся через переопределения `values.yaml` и дополнительные `templates/`, а структурные изменения в upstream-чарте применяются через `patches/`. Такое разделение гарантирует простое обновление до новой upstream-версии: выполните `make update`, просмотрите diff и при необходимости повторно примените патчи.

### Локальные артефакты

Патчи и образы контейнеров хранятся локально и являются частью пакета. Директория `patches/` содержит любые изменения upstream-чарта, а директория `images/` — Dockerfile для сборки всех необходимых образов. Это обеспечивает полную воспроизводимость — всё необходимое для сборки и развёртывания пакета самодостаточно внутри репозитория.

{{% alert color="info" %}}
В настоящее время не все пакеты собирают свои образы локально — некоторые всё ещё ссылаются на образы, собранные внешне. Мы активно работаем над переходом к полностью локальной сборке образов для достижения полной самодостаточности и воспроизводимости.
{{% /alert %}}

### Рабочий процесс локальной разработки и тестирования

Каждый пакет должен быть легко обновляемым и тестируемым локально на реальном кластере без использования CI. Стандартные цели `make` (`make image`, `make diff`, `make apply`) обеспечивают быструю обратную связь: сборка образов, сравнение отрендеренных манифестов с живым кластером и применение изменений — всё с рабочей станции разработчика.

### Без внешних зависимостей

Пакеты не должны зависеть от внешних ресурсов во время выполнения. Все чарты, образы и патчи включены в репозиторий. Это гарантирует детерминированность сборок и развёртываний, а также отсутствие сбоев из-за недоступности upstream-реестров, удалённых тегов или проблем с сетью.

{{% alert color="info" %}}
Как отмечалось выше, полная самодостаточность образов находится в процессе реализации. Некоторые пакеты всё ещё загружают образы из внешних реестров — это известный пробел, который мы планируем устранить по мере возможности.
{{% /alert %}}

## Разработка

### Настройка Buildx

Для сборки образов необходимо установить и настроить плагин [`docker buildx`](https://github.com/docker/buildx).

Вместо встроенного сборщика можно [настроить дополнительные](https://docs.docker.com/build/builders/), которые могут быть удалёнными или поддерживать несколько архитектур.
В этом примере показано, как создать сборщик с драйвером `kubernetes`, позволяющим собирать образы непосредственно в кластере Kubernetes:

```bash
docker buildx create \
  --bootstrap \
  --name=buildkit \
  --driver=kubernetes \
  --driver-opt=namespace=tenant-kvaps,replicas=2 \
  --platform=linux/amd64 \
  --platform=linux/arm64 \
  --use
```

Либо опустите параметры --driver*, чтобы настроить среду сборки в локальном Docker-окружении.

### Управление пакетами

Каждое приложение включает Makefile для упрощения процесса разработки. Для каждого пакета мы следуем такой логике:

```shell
make update  # Обновить Helm-чарт и версии из upstream-источника
make image   # Собрать Docker-образы, используемые в пакете
make show    # Показать вывод отрендеренных шаблонов
make diff    # Сравнить Helm-релиз с объектами в кластере Kubernetes
make apply   # Применить Helm-релиз к кластеру Kubernetes
```

Например, для обновления cilium:

```shell
cd packages/system/cilium         # Перейти в директорию приложения
make update                       # Загрузить новую версию из upstream
make image                        # Собрать образ cilium
git diff .                        # Показать diff с изменёнными манифестами
make diff                         # Показать diff с применёнными манифестами кластера
make apply                        # Применить изменённые манифесты к кластеру
kubectl get pod -n cozy-cilium    # Проверить корректность работы
git commit -m "Update cilium"     # Зафиксировать изменения в ветке
```

Для сборки контейнера cozystack с обновлённым чартом:

```shell
cd packages/core/installer        # Перейти в директорию пакета cozystack
make image-packages               # Собрать образ пакетов
make apply                        # Применить к кластеру
kubectl get pod -n cozy-system    # Проверить корректность работы
kubectl get hr -A                 # Проверить объекты HelmRelease
```

{{% alert color="info" %}}
При пересборке образов указывайте переменную окружения `REGISTRY`, указывающую на ваш Docker-реестр.

Не стесняйтесь заглядывать в каждый Makefile, чтобы лучше понять логику.
{{% /alert %}}

### Тестирование

Платформа включает скрипт [`e2e.sh`](https://github.com/cozystack/cozystack/blob/main/hack/e2e.sh), выполняющий следующие задачи:

- Запускает три виртуальные машины QEMU
- Настраивает Talos Linux
- Устанавливает Cozystack
- Ожидает установки всех HelmRelease
- Выполняет дополнительные проверки работоспособности компонентов

Скрипт e2e.sh можно запускать как локально, так и непосредственно в контейнере Kubernetes.

Для запуска тестов в кластере Kubernetes перейдите в директорию `packages/core/testing` и выполните следующие команды:

```shell
make apply    # Создать тестовую песочницу в кластере Kubernetes
make test     # Запустить end-to-end тесты в существующей песочнице
make delete   # Удалить тестовую песочницу из кластера Kubernetes
```

{{% alert color="warning" %}}
:warning: Для запуска e2e-тестов в кластере Kubernetes узлы должны иметь достаточно свободных ресурсов для создания 3 ВМ и хранения данных развёртываемых приложений.

Рекомендуется использовать bare-metal узлы родительского кластера Cozystack.
{{% /alert %}}

### Динамическая среда разработки

Если вы предпочитаете разрабатывать Cozystack в виртуальных машинах вместо изменения существующего кластера, можно использовать ту же песочницу из тестовой среды. Makefile в `packages/core/testing` включает дополнительные опции:

```shell
make exec     # Открывает интерактивную оболочку в контейнере песочницы.
make login    # Загружает kubeconfig во временную директорию и запускает оболочку с окружением песочницы; требуется установленный mirrord.
make proxy    # Включает SOCKS5 прокси-сервер; требуются mirrord и gost.
```

Прокси Socks5 можно настроить в браузере для доступа к сервисам кластера, работающего в песочнице. В Firefox есть удобное расширение для переключения прокси:

- [Proxy Toggle](https://addons.mozilla.org/en-US/firefox/addon/proxy-toggle/)
