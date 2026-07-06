---
title: "Публикация конечной точки Kubernetes API через external-dns"
linkTitle: "Публикация Kubernetes API в DNS"
description: "Преобразование EndpointSlice default/kubernetes в аннотированные headless-сервисы, чтобы external-dns мог публиковать конечную точку Kubernetes API в DNS с помощью входящего в состав платформы компонента kuberture."
weight: 26
---

## О чём эта страница

Как опубликовать конечную точку Kubernetes API самого кластера в виде DNS-записи с помощью `external-dns`, почему очевидный подход (направить `external-dns` напрямую на EndpointSlice `default/kubernetes`) не работает, что представляет собой входящий в состав Cozystack мост (`kuberture`, см. [`lexfrei/kuberture`](https://github.com/lexfrei/kuberture)), как одна установка `kuberture` может одновременно обслуживать несколько экземпляров `external-dns`, а также как всё это отключить.

## Почему external-dns не может читать EndpointSlice напрямую

`external-dns` считывает значимое для DNS состояние из источников Kubernetes - `service`, `ingress`, `gateway-httproute` и ряда других. Источник `EndpointSlice` он **не** поддерживает. EndpointSlice управляющего слоя, который Kubernetes поддерживает в `default/kubernetes`, - это канонический, всегда актуальный список адресов узлов, обслуживающих API; кроме того, это единственный полноценный объект, который несёт эту информацию без меток или селекторов, задаваемых оператором. Операторы, которые хотят публиковать конечную точку API своего кластера в публичный DNS через `external-dns` (проверки `dns01` в cert-manager, внутренняя автоматизация, обращающаяся к API по FQDN, обнаружение сервисов между кластерами и т.д.), сразу упираются в этот пробел.

Обычно предлагаемые обходные пути - поддерживаемый вручную `Service` типа `ExternalName`, поддерживаемый вручную headless-`Service` с вручную закреплёнными `Endpoints`, внешний скрипт, опрашивающий API и обновляющий запись, - имеют один и тот же недостаток: они перестают соответствовать действительности, как только узел управляющего слоя добавляется, удаляется или меняет адрес. EndpointSlice уже корректно отслеживает это состояние. `kuberture` соединяет одно с другим.

## Как это решает kuberture

`kuberture` - небольшой контроллер внутри кластера, который следит за `EndpointSlice` и создаёт аннотированные headless-объекты `Service`. Поток данных таков:

```text
EndpointSlice (kubernetes) → kuberture → headless Service(s) with annotations → external-dns → DNS
```

Для каждого настроенного оператором выхода (output) `kuberture` создаёт headless-сервис (`spec.clusterIP: None`) в собственном пространстве имён (`cozy-kuberture`) и проставляет на нём три аннотации. Каждый ключ состоит из заданного оператором `annotationPrefix` и фиксированного суффикса:

| Полный ключ аннотации | Источник |
| --- | --- |
| `<annotationPrefix>hostname` | заданные оператором имена хостов для этого выхода |
| `<annotationPrefix>target` | IP-адреса через запятую, полученные из EndpointSlice или из узлов, на которые он указывает |
| `<annotationPrefix>ttl` | заданный оператором `recordTTL`; если он не указан, используется значение по умолчанию контроллера |

С префиксом по умолчанию это даёт `external-dns.alpha.kubernetes.io/hostname`, `external-dns.alpha.kubernetes.io/target`, `external-dns.alpha.kubernetes.io/ttl` - ключи, которые платформенный `external-dns` читает из коробки. `external-dns` читает сервис, видит аннотации и создаёт DNS-запись. У сервиса нет селектора и вручную управляемых Endpoints - он существует исключительно как носитель аннотаций для `external-dns`.

Контроллер **не** создаёт объекты `EndpointSlice` или `Endpoints` (у него есть только право чтения `EndpointSlice`) и **не** трогает исходный EndpointSlice `default/kubernetes`. Он строго аддитивен: отдельный сервис на каждый выход, в собственном пространстве имён, без побочных эффектов для существующего состояния кластера.

## Включение в управляющем кластере

`kuberture` - опциональный системный пакет, включаемый через `bundles.enabledPackages`. Сам пакет не содержит пригодных значений по умолчанию, кроме включения `ServiceMonitor` для платформенного Prometheus, - развёртывание сразу завершается ошибкой, если `config.outputs` пуст. Оператор обязан объявить хотя бы один выход, потому что единственное, чего `kuberture` не может определить сам, - это DNS-имя, которое оператор действительно хочет опубликовать.

Один выход, потребляемый платформенным `external-dns`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-full
  components:
    platform:
      values:
        bundles:
          enabledPackages:
            - cozystack.external-dns
            - cozystack.kuberture
---
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.kuberture
spec:
  variant: default
  components:
    kuberture:
      values:
        kuberture:
          config:
            outputs:
              - name: api
                hostname:
                  - api.k8s.example.com
                serviceName: kuberture-api
                addressSource: endpointslice
                recordTTL: 60
```

`annotationPrefix` здесь не указан, поэтому контроллер использует значение по умолчанию `external-dns.alpha.kubernetes.io/` - префикс, за которым платформенный `external-dns` следит из коробки. Когда включены оба пакета, HelmRelease `external-dns` подхватывает сервис `kuberture-api` в `cozy-kuberture` и создаёт запись `api.k8s.example.com` у настроенного провайдера.

Пакет `cozystack.external-dns` - это общекластерный системный экземпляр (он работает с `namespaced: false` и наблюдает за сервисами по всему кластеру). `cozystack.external-dns-application` - вариант, ограниченный пространством имён тенанта, и он не подхватит сервисы за пределами своего тенанта. В управляющем кластере используйте `kuberture` в паре с `cozystack.external-dns`, а не с `cozystack.external-dns-application`.

## Маршрутизация на несколько экземпляров external-dns

Одна установка `kuberture` может обслуживать любое количество экземпляров `external-dns`, если задавать разный `annotationPrefix` для каждого выхода. Каждый экземпляр `external-dns` запускается с флагом `--annotation-prefix=<your-prefix>/`, из-за чего он строит все ключи аннотаций `hostname`/`target`/`ttl` под этим префиксом и игнорирует всё остальное; `kuberture` проставляет соответствующий префикс на каждом сервисе. Это описанный в апстриме паттерн [Split Horizon DNS](https://kubernetes-sigs.github.io/external-dns/v0.20.0/docs/advanced/split-horizon/) - в отличие от `--annotation-filter`, который является селектором меток Kubernetes и фильтрует, *какие сервисы* рассматривает экземпляр, а не из какого префикса он читает данные.

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.kuberture
spec:
  variant: default
  components:
    kuberture:
      values:
        kuberture:
          config:
            outputs:
              - name: public
                hostname:
                  - api.k8s.example.com
                serviceName: kuberture-public
                addressSource: endpointslice
              - name: internal
                hostname:
                  - api-internal.k8s.example.internal
                annotationPrefix: internal-dns.example.com/
                serviceName: kuberture-internal
                addressSource: endpointslice
                recordTTL: 300
```

В результате в `cozy-kuberture` появляются два headless-сервиса:

- `kuberture-public` несёт стандартные аннотации `external-dns.alpha.kubernetes.io/*` и потребляется платформенным `external-dns`.
- `kuberture-internal` несёт аннотации `internal-dns.example.com/*` и невидим для платформенного `external-dns` (который читает префикс по умолчанию). Его потребляет второй экземпляр `external-dns`, запущенный с `--annotation-prefix=internal-dns.example.com/`: этот флаг указывает экземпляру искать `hostname`/`target`/`ttl` под `internal-dns.example.com/*`, поэтому он видит `kuberture-internal` и не видит `kuberture-public`.

Каждый сервис несёт **только** аннотации своего префикса - перекрёстного смешивания между выходами нет.

`annotationPrefix` допускает две формы: не указывать поле, чтобы унаследовать значение по умолчанию контроллера `external-dns.alpha.kubernetes.io/`, либо задать непустую строку, оканчивающуюся на `/`. Пустая строка `""` отклоняется схемой значений чарта; единственный способ вернуться к префиксу по умолчанию - не указывать поле.

## Стратегии определения адресов

`addressSource` определяет, откуда каждый выход берёт целевые IP-адреса:

| `addressSource` | Что публикует `kuberture` |
| --- | --- |
| `endpointslice` (по умолчанию) | Адреса из EndpointSlice `default/kubernetes` как есть. Используйте, когда IP-адреса из EndpointSlice - это именно те адреса, которые должны попасть в DNS. |
| `node-internal` | `InternalIP` каждого узла, на котором находится конечная точка EndpointSlice. Используйте, когда EndpointSlice содержит IP-адреса сети подов, а external-dns должен публиковать внутренние адреса узлов. |
| `node-external` | `ExternalIP` каждого узла. Используйте для облачных кластеров, где у узлов публичные адреса на другом интерфейсе, нежели тот, на котором слушает API. |
| `node-public` | Публичный IP узла, полученный через провайдер-зависимый механизм обнаружения публичных IP. |

`addressType` (`IPv4` / `IPv6`) дополнительно фильтрует полученный набор; по умолчанию `IPv4`.

## Отключение

Удаление `cozystack.kuberture` из `bundles.enabledPackages` прекращает генерацию CR `Package` платформенным Helm-чартом. Как и у любого опционального системного пакета, существующий CR `Package` **не** удаляется автоматически: платформенный помощник проставляет `helm.sh/resource-policy: keep` на каждый сгенерированный Package, поэтому Helm/Flux оставляет его на месте, когда тот перестаёт рендериться. Чтобы полностью удалить `kuberture`:

```bash
kubectl delete package.cozystack.io cozystack.kuberture
```

Каскадное удаление убирает HelmRelease в `cozy-kuberture`, что удаляет Deployment, созданные по конфигурации оператора выходные сервисы и (со временем) само пространство имён. Записи `external-dns`, ранее опубликованные из этих сервисов, подчиняются собственной политике удаления `external-dns` (`policy: upsert-only` - значение по умолчанию в Cozystack, при котором записи **не** отзываются при удалении сервиса; заранее переключитесь на `policy: sync`, если записи должны вычищаться автоматически).

## Замечания о цепочке поставки

Чарт загружается из `oci://ghcr.io/lexfrei/kuberture/charts/kuberture`, а образ контроллера - из `ghcr.io/lexfrei/kuberture`. Оба находятся в личном пространстве имён мейнтейнера и намеренно не зеркалируются в `ghcr.io/cozystack/*`. Операторы изолированных (air-gapped) сред должны отзеркалировать и чарт, и образ контроллера в свой внутренний реестр и переопределить `kuberture.image.repository` в значениях Package. Версия чарта и дайджест OCI-манифеста зафиксированы в Makefile пакета cozystack; тег и дайджест образа контроллера зафиксированы в `values.yaml` пакета. Фиксации обновляются синхронно с каждым релизом апстрима.

Полный перечень значений, процедура обновления и причина отключённого по умолчанию `NetworkPolicy` описаны в README пакета: [`packages/system/kuberture/`](https://github.com/cozystack/cozystack/tree/main/packages/system/kuberture).

## См. также

- [Включение и отключение компонентов]({{% ref "/docs/v1.5/operations/configuration/components#enabling-and-disabling-components" %}}) - используемый здесь механизм `bundles.enabledPackages` / `bundles.disabledPackages`.
- [Справочник Platform Package]({{% ref "/docs/v1.5/operations/configuration/platform-package" %}}) - справка по полю `bundles.enabledPackages`.
- [`lexfrei/kuberture`](https://github.com/lexfrei/kuberture) - исходный код контроллера и чарт, справочник по конфигурации и планы развития.
- [`packages/system/kuberture/`](https://github.com/cozystack/cozystack/tree/main/packages/system/kuberture) - пакет cozystack: прослойка значений, фикстуры helm-unittest, сквозной smoke-тест.
