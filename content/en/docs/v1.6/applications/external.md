---
title: "Добавление внешних приложений в каталог Cozystack"
linkTitle: "Внешние приложения"
description: "Добавление managed applications из внешних источников"
weight: 5
---

Администраторы Cozystack могут добавлять приложения из внешних источников в дополнение к стандартному каталогу приложений.
Для пользователей платформы такие приложения отображаются в том же каталоге и работают так же, как обычные managed applications.

В этом руководстве описана структура пакета внешнего приложения и порядок его добавления в кластер Cozystack.

Полный рабочий пример см. в репозитории [github.com/cozystack/external-apps-example](https://github.com/cozystack/external-apps-example).

Как и стандартные приложения Cozystack, этот пакет внешнего приложения использует Helm и FluxCD.
Подробнее о разработке пакетов приложений см. в [руководстве Cozystack для разработчиков]({{% ref "/docs/v1.6/development" %}}).

## Структура репозитория

Репозиторий внешнего приложения имеет следующую структуру:

```text
init.yaml                        # Манифест начальной настройки (GitRepository + HelmRelease)
scripts/
  package.mk                     # Общие цели Makefile для чартов приложений
  update-appdef.sh               # Syncs generated chart schemas into the ApplicationDefinitions
packages/
  core/platform/                 # Чарт платформы: namespaces, операторы, ресурсы HelmChart и ApplicationDefinition
  apps/<app-name>/               # Helm-чарт каждого приложения, доступного для установки пользователем
```

- `packages/core/platform` — Helm-чарт, развертываемый FluxCD. Он регистрирует все приложения с помощью ресурсов `ApplicationDefinition`, создает необходимые namespaces, развертывает операторы и определяет ресурсы `HelmChart`, ссылающиеся на чарты приложений в том же Git-репозитории.
- `packages/apps/<app-name>` — стандартные Helm-чарты с шаблонами фактических ресурсов Kubernetes (CRD, ConfigMap, Secret и т. д.).

## Чарт платформы

Чарт платформы (`packages/core/platform/`) — центральный компонент. Он содержит следующие шаблоны:

### Namespaces

Создайте namespaces для операторов и системных компонентов:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  labels:
    cozystack.io/system: "true"
  name: external-<operator-name>
```

### Ресурсы HelmChart

Определите ресурсы `HelmChart`, которые указывают FluxCD путь к чарту каждого приложения в Git-репозитории:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmChart
metadata:
  name: external-apps-<app-name>
  namespace: cozy-public
spec:
  interval: 5m
  chart: ./packages/apps/<app-name>
  sourceRef:
    kind: GitRepository
    name: external-apps
  reconcileStrategy: Revision
```

Используйте `reconcileStrategy: Revision`, чтобы FluxCD повторно приводил чарты со статическим значением `version: 0.0.0` к желаемому состоянию при каждом изменении содержимого Git-репозитория.

### Развертывание оператора

Если приложению требуется оператор, разверните его с помощью `HelmRepository` и `HelmRelease`:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: <operator-name>
  namespace: external-<operator-name>
spec:
  type: oci
  interval: 5m
  url: oci://ghcr.io/<org>/charts
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: <operator-name>
  namespace: external-<operator-name>
spec:
  interval: 5m
  releaseName: <operator-name>
  targetNamespace: external-<operator-name>
  chart:
    spec:
      chart: <operator-chart-name>
      sourceRef:
        kind: HelmRepository
        name: <operator-name>
      version: '1.2.3' # pin an exact operator version to keep installs reproducible
```

### Ресурсы ApplicationDefinition

Зарегистрируйте каждое приложение в панели управления Cozystack с помощью `ApplicationDefinition`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: ApplicationDefinition
metadata:
  name: <app-name>
spec:
  application:
    kind: <AppKind>
    singular: <appkind>
    plural: <appkinds>
    openAPISchema: '{"title":"Chart Values","type":"object","properties":{...}}'
  release:
    chartRef:
      kind: HelmChart
      name: external-apps-<app-name>
      namespace: cozy-public
    labels:
      sharding.fluxcd.io/key: tenants
    prefix: <app-name>-
  dashboard:
    category: <Category>
    singular: <Human-readable Name>
    plural: <Human-readable Names>
    description: <Short description.>
    tags:
      - <tag>
    icon: <base64-encoded SVG>
    keysOrder:
      - - apiVersion
      - - appVersion
      - - kind
      - - metadata
      - - metadata
        - name
      - - spec
        - <field>
```

Соблюдайте следующие правила именования, принятые в основном репозитории Cozystack:

| Поле | Правило | Пример для `my-app` |
| --- | --- | --- |
| `metadata.name` | нижний регистр, дефисы разрешены | `my-app` |
| `application.kind` | PascalCase, без дефисов | `MyApp` |
| `application.singular` | нижний регистр, без дефисов | `myapp` |
| `application.plural` | нижний регистр, без дефисов | `myapps` |
| `release.prefix` | `<metadata.name>-` | `my-app-` |
| заголовок `openAPISchema` | всегда `"Chart Values"` | — |

The `openAPISchema` field contains a single-line JSON string with the schema for the application values — the minified content of the chart's generated `values.schema.json`. Keep the two in sync: in the example repository, `make generate` embeds the schema with `scripts/update-appdef.sh`. Note that Kubernetes `apiextensions/v1` `JSONSchemaProps` does not support `if`/`then`/`else`, so schemas must not rely on conditional validation.

## Чарты приложений

Каждый чарт приложения в `packages/apps/<app-name>/` представляет собой стандартный Helm-чарт:

```text
packages/apps/<app-name>/
  Chart.yaml
  Makefile
  values.yaml
  values.schema.json
  templates/
    <resource>.yaml
```

### Chart.yaml

```yaml
apiVersion: v2
name: <app-name>
description: <Short description>
type: application
version: 0.0.0
appVersion: "1.0.0"
```

Используйте `version: 0.0.0` — фактическую версию FluxCD определяет на основе ревизии Git.

### Makefile

```makefile
export NAME=<app-name>
export NAMESPACE=external-<operator-name>

include ../../../scripts/package.mk

.PHONY: generate
generate:
	cozyvalues-gen -v values.yaml -s values.schema.json -r README.md
	../../../scripts/update-appdef.sh $(NAME)
```

### values.schema.json

Generate the JSON schema from annotations in `values.yaml` with [`cozyvalues-gen`](https://github.com/cozystack/cozyvalues-gen) — the same tool and annotation dialect used for packages in the main Cozystack repository. Helm validates user-supplied values against this schema at install time. Run `make generate` after changing `values.yaml` and commit the regenerated files.

## Манифест начальной настройки

Файл `init.yaml` создает два ресурса FluxCD, которые выполняют начальную настройку всего каталога:

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: external-apps
  namespace: cozy-public
spec:
  interval: 1m0s
  ref:
    branch: main
  timeout: 60s
  url: https://github.com/<org>/<repo>.git
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: external-apps
  namespace: cozy-system
spec:
  interval: 5m
  targetNamespace: cozy-system
  chart:
    spec:
      chart: ./packages/core/platform
      sourceRef:
        kind: GitRepository
        name: external-apps
        namespace: cozy-public
      reconcileStrategy: Revision
```

Примените его в кластере Cozystack:

```bash
kubectl apply -f init.yaml
```

После того как FluxCD приведет ресурсы к желаемому состоянию, приложения появятся в панели управления Cozystack.

## Справочная документация FluxCD

Следующие документы FluxCD помогут разобраться в ресурсах, используемых в этом руководстве:

- [GitRepository](https://fluxcd.io/flux/components/source/gitrepositories/)
- [HelmRelease](https://fluxcd.io/flux/components/helm/helmreleases/)
- [HelmChart](https://fluxcd.io/flux/components/source/helmcharts/)
