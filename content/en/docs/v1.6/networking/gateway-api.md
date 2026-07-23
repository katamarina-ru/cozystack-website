---
title: "Gateway API (Cilium)"
linkTitle: "Gateway API"
description: "Ingress на основе Gateway API для отдельных тенантов с использованием Cilium - CRD TenantGateway, наследование через метки пространств имён, интеграция с cert-manager, терминация и сквозная передача TLS, двухуровневая модель безопасности."
weight: 15
---

## Обзор

Cozystack поставляет поддержку Gateway API как включаемую по выбору альтернативу ingress-nginx. При включении тенант, который явно включил опцию через `tenant.spec.gateway: true`, получает собственный `Gateway` (собственный сервис LoadBalancer, собственный IP балансировщика, а в режимах сертификатов ACME - собственные Issuer и Certificate этого тенанта), материализованный в его собственном пространстве имён. Все остальные тенанты дерева публикуются через Gateway ближайшего предка, который им владеет, - та же схема, что и у существующего наследования `_namespace.ingress`.

Чарт не рендерит ресурсы `Gateway`, `Issuer` или `Certificate` напрямую. Вместо этого он рендерит один CR `gateway.cozystack.io/v1alpha1 TenantGateway` на каждый включивший опцию тенант, а `cozystack-controller` согласует из него все нижестоящие объекты Gateway API и cert-manager. Это устраняет гонку между Helm и контроллером за `Gateway.spec.listeners`, которую иначе вызывала бы динамическая материализация слушателей на основе маршрутов.

На этой странице описаны архитектура, модель наследования, выбор режима сертификатов (HTTP-01 по умолчанию, wildcard DNS-01 по выбору или предоставленный оператором wildcard-Secret), двухуровневая модель безопасности и порядок миграции с ingress-nginx.

Gateway API и ingress-nginx сосуществуют в одном кластере - режимы выбираются для каждого сервиса / тенанта, а не глобально. Существующие кластеры обновляются с `gateway.enabled=false` и не видят изменений в поведении.

### Поверхность API для тенантов

Тенанты в Cozystack взаимодействуют с платформой исключительно через ресурсы `apps.cozystack.io/*`, обслуживаемые `cozystack-api`; RBAC тенанта не даёт права записи в `gateway.networking.k8s.io/*`, базовые `Namespaces` или `cozystack.io/Package`. В разделе [Безопасность](#безопасность) объясняется, как уровни допуска (admission) выстроены с учётом этого ограничения.

## Архитектура

### Поток согласования

```mermaid
flowchart TD
    CHART["extra/gateway chart<br/>(invoked by apps/tenant when<br/>tenant.spec.gateway=true)"]
    CR["TenantGateway CR<br/>(gateway.cozystack.io/v1alpha1)"]
    CTRL["cozystack-controller<br/>(TenantGatewayReconciler)"]
    GW["Gateway<br/>(per-tenant, dynamic listeners)"]
    ISS["Issuer<br/>(per-tenant ACME account,<br/>ACME modes only)"]
    CERT["Certificate(s)<br/>HTTP-01: per-listener<br/>DNS-01: single wildcard + per-child SANs<br/>existingSecret: none minted"]
    REDIR["HTTPRoute<br/>(http→https redirect, owned)"]
    NSLBL["Namespace label patching<br/>(namespace.cozystack.io/gateway on attachedNamespaces)"]
    HTR["HTTPRoute / TLSRoute<br/>(app-owned, watched)"]

    CHART -->|renders| CR
    CR --> CTRL
    CTRL -->|materialises| GW
    CTRL -->|materialises| ISS
    CTRL -->|materialises| CERT
    CTRL -->|materialises| REDIR
    CTRL -->|patches| NSLBL
    HTR -.->|hostnames feed listener set| CTRL
```

Контроллер:

- Материализует `Gateway`, HTTPRoute перенаправления, а в режимах сертификатов ACME - `Issuer` тенанта и Certificate(s) из `TenantGateway.spec`. В режиме `existingSecret` он не выпускает ни то, ни другое, а вместо этого указывает слушателям на Secret, предоставленный оператором.
- Наблюдает за ресурсами `HTTPRoute` и `TLSRoute` в масштабе кластера. Для каждого маршрута, прикреплённого к его Gateway, он подхватывает имена хостов и (в режиме HTTP-01) добавляет HTTPS-слушатель и `Certificate` для каждого приложения.
- В режиме DNS-01 расширяет wildcard-`Certificate` SAN-записями `<child-apex>` + `*.<child-apex>` для каждого тенанта, наследующего через этот Gateway (они обнаруживаются перечислением пространств имён с `namespace.cozystack.io/gateway = <owner>` и чтением их `namespace.cozystack.io/host`), и добавляет по одному HTTPS-слушателю `*.<child-apex>` на каждого наследующего потомка.
- Проставляет `namespace.cozystack.io/gateway = <owner>` на каждое пространство имён из `TenantGateway.spec.attachedNamespaces` (системные пространства имён cozy-*, публикуемые через Gateway). Патч сопровождается аннотацией `cozystack.io/gateway-attached-by`, чтобы контроллер знал, какие метки записал он сам, а какие принадлежат чарту `apps/tenant`, - метки, записанные чартом, никогда не затрагиваются. Метки, записанные контроллером, удаляются при удалении пространства имён из `attachedNamespaces`.
- Разрешает межпространственные конфликты имён хостов: пространства имён `cozy-*` (платформенные сервисы под управлением администратора кластера) выигрывают у пространств имён тенантов; проигравший получает условие `HostnameConflict` под именем контроллера в `Status.Parents`.
- Отказывается молча присваивать уже существующие объекты `Gateway`, `Issuer`, `Certificate` или HTTPRoute перенаправления, которые носят выведенное контроллером имя, но не несут `OwnerReference` на TenantGateway. Операторы видят явное условие `Ready=False/ReconcileError` вместо перезаписи их вручную закреплённой конфигурации.

### Путь трафика

```mermaid
flowchart LR
    CLIENT["External client"]
    LB["Cluster LB allocator<br/>(MetalLB / Cilium LB-IPAM /<br/>robotlb / externalIPs)"]
    ENV["cilium-envoy DaemonSet<br/>(L7 termination / L4 passthrough)"]
    GW["Gateway 'cozystack'<br/>(owning tenant namespace)"]
    HTR["HTTPRoute<br/>dashboard, keycloak, harbor, bucket, ..."]
    TLR["TLSRoute<br/>kubernetes-api, vm-exportproxy,<br/>cdi-uploadproxy"]
    CM["cert-manager<br/>(per-tenant Issuer + Certificate(s),<br/>ACME modes only)"]
    SVC["Service<br/>(backend)"]

    CLIENT -->|DNS → LB IP| LB
    LB --> ENV
    ENV --> GW
    GW --> HTR
    GW --> TLR
    HTR --> SVC
    TLR --> SVC
    CM -.->|"issues Certificate(s)"| GW
```

- **`GatewayClass`** задаётся для каждого TenantGateway через настраиваемое оператором поле `gatewayClassName` в чарте (по умолчанию `cilium`). У тенантов нет RBAC на запись CR `TenantGateway`, поэтому они не могут выбрать класс самостоятельно.
- **Один `Gateway` на тенанта-владельца** в пространстве имён этого тенанта. HTTPRoute / TLSRoute каждого наследующего потомка прикрепляются к тому же Gateway через межпространственный ParentRef; слияния между Gateway нет.
- **Envoy** работает как DaemonSet Cilium (`cilium.envoy.enabled=true`) и обеспечивает и терминацию TLS (HTTPS-слушатели), и сквозную передачу TLS (выделенные слушатели на каждый сервис для kubeapiserver и прокси экспорта ВМ KubeVirt / загрузки CDI). `envoy.enabled=true` - значение по умолчанию для новых установок Cozystack; операторам, обновляющим существующий кластер, где значения Cilium были заданы явно, следует проверить, что флаг включён, прежде чем переключать `gateway.enabled`.
- **IP LoadBalancer** выделяется тем механизмом балансировки, который администратор кластера настроил на уровне платформы, - та же схема, что и у ingress-nginx сегодня. Cozystack поставляется с установленным MetalLB, но не рендерит из чарта тенанта ни `IPAddressPool`, ни `L2Advertisement`, ни `BGPAdvertisement`, ни `CiliumLoadBalancerIPPool`. Администраторы подключают тот аллокатор, который подходит их окружению (пул MetalLB с L2 / BGP, Cilium LB-IPAM с анонсером, [robotlb](https://github.com/aenix-io/robotlb) поверх парка Hetzner Robot либо `Service.spec.externalIPs` как механизм ручного закрепления). API тенанта остаётся независимым от механизма - поля `gatewayIP` в CR Tenant нет. Чтобы закрепить конкретный адрес, оператор заранее создаёт сервис LoadBalancer с заданным `loadBalancerIP` либо передаёт тенанту ссылку на именованный пул под управлением администратора.
- **`externalTrafficPolicy`**: сервис LoadBalancer, стоящий за Gateway, создаётся Cilium и использует значение Kubernetes по умолчанию (`Cluster`). Поэтому исходные IP внешних клиентов транслируются (NAT) в адрес принимающего узла. Прежний путь через ingress-nginx ведёт себя так же всякий раз, когда задан `publishing.externalIPs` - обычная установка на голом железе, - потому что хостовой сервис ingress в этом случае представляет собой `ClusterIP` с `spec.externalIPs` и `externalTrafficPolicy: Cluster`. Исходные IP сохраняются только тогда, когда `publishing.externalIPs` оставлен пустым: сервис становится `LoadBalancer` с `externalTrafficPolicy: Local`, что ограничивает IP балансировщика узлами, где размещены поды ingress. Операторы, которым нужно сохранение исходных IP для трафика Gateway API, должны пропатчить сервис самостоятельно либо поставить перед ним вышестоящий балансировщик с поддержкой протокола PROXY.

### Раскладка слушателей на Gateway тенанта

Gateway тенанта всегда материализует HTTP-слушатель:

| # | Имя | Протокол | Порт | Имя хоста | Назначение |
| --- | --- | --- | --- | --- | --- |
| 1 | `http` | `HTTP` | 80 | нет (wildcard) | ACME `/.well-known/acme-challenge/*` + HTTPRoute перенаправления HTTP→HTTPS - перенаправление HTTP→HTTPS рендерится в любом режиме сертификатов; путь проверки ACME используется только в режимах ACME |

Плюс HTTPS-слушатели, зависящие от режима сертификатов:

- **Режим HTTP-01 (по умолчанию):** по одному HTTPS-слушателю на каждое имя хоста прикреплённого HTTPRoute, с именем `https-<first-label>-<8-hex>`. Шестнадцатеричный суффикс - первые 32 бита `sha256(hostname)`, поэтому два разных имени хоста с одинаковой первой меткой (`harbor.foo.example.com` и `harbor.alice.example.com`) получают разные имена слушателей. `tls.certificateRefs` каждого слушателя указывает на `Certificate` этого слушателя с именем `<tgw>-<first-label>-<8-hex>-tls`, также выпускаемый автоматически.
- **Режим DNS-01 (по выбору):** слушатели `https` (`*.<owner apex>`) и `https-apex` (`<owner apex>`), использующие единственный wildcard-Certificate, плюс по одному слушателю `https-child-<first-label>-<8-hex>` на apex каждого наследующего потомка (со ссылкой на тот же wildcard-сертификат, чьи dnsNames расширены SAN-записями `<child-apex>` + `*.<child-apex>`).
- **Режим existingSecret (wildcard, предоставленный оператором):** тот же набор слушателей, что и в DNS-01, - `https` (`*.<owner apex>`), `https-apex` (`<owner apex>`) и по одному `https-child-<first-label>-<8-hex>` на apex каждого наследующего потомка, - за исключением того, что каждый `tls.certificateRefs` указывает на предоставленный оператором Secret с именем из `publishing.certificates.wildcardSecretName`, и ни для одного из них `Certificate` не выпускается.

Плюс по одному дополнительному слушателю на каждый сервис со сквозной передачей TLS (см. [TLSRoute (TLS passthrough)](#tlsroute-tls-passthrough)).

`allowedRoutes.namespaces` слушателей использует два разных селектора в зависимости от роли слушателя:

- **HTTPS-слушатели и слушатели сквозного TLS** сопоставляются по метке `namespace.cozystack.io/gateway` и допускают маршруты из любого пространства имён, чья метка равна имени пространства имён тенанта-владельца (например, `tenant-root`, `tenant-alice` - имя пространства имён, а не «голое» имя тенанта). Это точка опоры наследования - пространство имён каждого наследующего потомка несёт то же значение метки (записанное чартом `apps/tenant`), а системные пространства имён cozy-* из `attachedNamespaces` получают ту же метку от контроллера.
- **Простой HTTP-слушатель (порт 80)** использует строго более узкий белый список по встроенной метке `kubernetes.io/metadata.name` - только само пространство имён тенанта-владельца (где живёт принадлежащий контроллеру HTTPRoute перенаправления) и `cozy-cert-manager` (HTTPRoute для проверок ACME HTTP-01). Поэтому HTTPRoute приложений, прикрепляющиеся к Gateway по имени хоста, не могут привязаться к порту 80 и отдавать незашифрованный трафик.

Port-443 listeners pin `allowedRoutes.kinds` to `HTTPRoute` and `TLSRoute` (the pair is listed on each of them so that Cilium keeps the listeners apart), preventing GRPCRoute / TCPRoute / UDPRoute from attaching outside the route-hostname VAP's coverage.

## Включение Gateway API

Gateway API включается на двух уровнях. Оба значения по умолчанию остаются `false`; обновления не переключают тенантов незаметно.

### 1. Флаг на уровне платформы

Установите `gateway.enabled: true` в Package `cozystack.cozystack-platform`. Полные таблицы значений `gateway.*` и `publishing.certificates.dns01.*` см. в [справочнике Platform Package]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}).

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
        publishing:
          host: example.org
        gateway:
          enabled: true
          attachedNamespaces:
            - cozy-cert-manager
            - cozy-dashboard
            - cozy-keycloak
            - cozy-system
            - cozy-harbor
            - cozy-bucket
            - cozy-kubevirt
            - cozy-kubevirt-cdi
            - cozy-monitoring
            - cozy-linstor-gui
            - default
```

Пространство имён `default` включено потому, что `TLSRoute` Kubernetes API (поставляемый пакетом cozystack-api) живёт рядом с сервисом `kubernetes`, на который он указывает, а тот всегда находится в `default`.

Включение `gateway.enabled=true` задействует три вещи:

- `ClusterIssuer.spec.acme.solvers` в cert-manager переключается с `http01.ingress.ingressClassName` на `http01.gatewayHTTPRoute`, прикрепляющийся к Gateway публикующего тенанта.
- Шаблоны публикуемых сервисов (dashboard, keycloak, grafana, alerta) перестают рендерить свой `Ingress` и начинают рендерить свой `HTTPRoute`.
- Сервисы со сквозной передачей TLS (cozystack-api, vm-exportproxy, cdi-uploadproxy) перестают рендерить свой `Ingress` и начинают рендерить `TLSRoute`, прикреплённый к выделенному слушателю Passthrough.

Список `attachedNamespaces` перечисляет системные пространства имён `cozy-*`, маршруты которых должны публиковаться через Gateway тенанта-владельца. Контроллер проставляет `namespace.cozystack.io/gateway = <owner>` на каждую запись, чтобы её маршруты проходили селектор `allowedRoutes` слушателя. Пространства имён тенантов (`tenant-*`) тоже могут быть в списке - они просто получают ту же метку наряду с записями `cozy-*`. Статический список не является вектором межтенантного перехвата; эту роль закрывают уровни 1, 2, 4 и 5 в разделе [Безопасность](#безопасность).

### 2. Gateway для отдельного тенанта

Тенант получает собственный CR `TenantGateway` (а через контроллер - собственные `Gateway`, сервис `LoadBalancer`, а в режимах ACME - собственные `Issuer` и `Certificate`(s)) только тогда, когда явно запрашивает это через `tenant.spec.gateway: true`. Все остальные тенанты дерева публикуются через Gateway ближайшего предка, который им владеет, - та же схема, что и у наследования `_namespace.ingress` сегодня. По умолчанию `gateway` не задан, что разрешается в `false` (наследовать).

Отдельный Gateway имеет смысл, когда:

- тенанту нужен собственный IP балансировщика (DNS уже закреплён за конкретным адресом, правило межсетевого экрана на этот адрес);
- apex тенанта не выводится из родительского (оператор задал собственный `tenant.spec.host`, например `customer1.example`, а не поддомен - wildcard-сертификат / Issuer предка не может его покрыть);
- тенант хочет собственную учётную запись ACME / Issuer (отдельный бюджет ограничений частоты, отдельный удостоверяющий центр).

В остальных случаях оставьте `gateway` незаданным и наследуйте.

```yaml
# Тенант 'alice' под tenant-root: apex выводится как alice.<parent apex>,
# наследует Gateway родителя. Отдельного IP балансировщика и Issuer нет.
apiVersion: apps.cozystack.io/v1alpha1
kind: Tenant
metadata:
  name: alice
  namespace: tenant-root
spec: {}
```

```yaml
# Тенант 'acme' с полностью независимым apex: должен включить опцию, чтобы
# владеть Gateway, ведь сертификат/Issuer родителя не покроет customer1.example.
apiVersion: apps.cozystack.io/v1alpha1
kind: Tenant
metadata:
  name: acme
  namespace: tenant-root
spec:
  host: customer1.example
  gateway: true
```

```yaml
# Тенант 'bob' под tenant-root: выведенный apex, но хочет собственные
# IP балансировщика и учётную запись ACME (DNS закреплён за конкретным адресом).
apiVersion: apps.cozystack.io/v1alpha1
kind: Tenant
metadata:
  name: bob
  namespace: tenant-root
spec:
  gateway: true
```

Установка собственного значения `tenant.spec.host` зарезервирована за администраторами кластера и сервисными учётными записями cozystack/Flux (обеспечивается во время выполнения политикой `cozystack-tenant-host-policy`, см. [Безопасность](#безопасность)).

### Наследование

Чарт `apps/tenant` записывает `namespace.cozystack.io/gateway: <owner-namespace>` на каждое пространство имён тенанта, где значение - либо имя собственного пространства имён этого тенанта (когда `gatewayEffective` разрешается в `true`), либо имя пространства имён наследуемого предка (при наследовании). То же значение попадает в `_namespace.gateway` внутри секрета `cozystack-values` тенанта, поэтому вендоренные приложения (harbor, bucket, …) рендерят свои HTTPRoute с `parentRefs.namespace`, указывающим на пространство имён владельца.

Чтобы проверить, через какой Gateway сейчас наследуется данное пространство имён тенанта:

```bash
kubectl get namespace <tenant-ns> \
  -o jsonpath='{.metadata.labels.namespace\.cozystack\.io/gateway}{"\n"}'
```

Пустое значение означает, что ни у одного предка в цепочке нет `tenant.spec.gateway: true`, и маршруты в этом пространстве имён не прикрепятся ни к какому Gateway.

Селектор `allowedRoutes.namespaces.selector` слушателя Gateway-владельца сопоставляется ровно с этой меткой, поэтому один и тот же селектор допускает маршруты из каждого пространства имён дерева владельца - как потомков, так и записей cozy-* из `attachedNamespaces`. Отдельного ReferenceGrant на каждого потомка нет: селектор по метке и есть межпространственный шлюз.

В режиме DNS-01 контроллер расширяет wildcard-`Certificate` Gateway-владельца SAN-записями `<child-apex>` + `*.<child-apex>` для каждого наследующего потомка (они обнаруживаются перечислением пространств имён с тем же значением `namespace.cozystack.io/gateway` и чтением их `namespace.cozystack.io/host`) и добавляет HTTPS-слушатель `*.<child-apex>` на каждый apex потомка. Без этого расширения одноуровневый wildcard родителя не может покрыть имя хоста маршрута потомка (`harbor.alice.example.org` на две метки глубже родительского `*.example.org`).

Проверка ACME DNS-01 должна пройти для каждой SAN-записи, а значит, настроенная учётная запись DNS-провайдера должна уметь записывать TXT-записи под каждым уровнем apex, который обслуживает родитель. Для глубоко вложенных наследующих потомков это требует либо делегирования зоны, либо учётных данных провайдера с правами на все уровни apex. Режим HTTP-01 не затронут - каждая проверка на отдельный слушатель выполняется для конкретного имени хоста.

Тенант, включивший опцию собственного Gateway, становится отдельной границей: отдельный `Gateway`, а в режимах сертификатов ACME - отдельные `Issuer`, учётная запись ACME и `Certificate`(s), собственное подмножество наследующих потомков. Дочерние тенанты под ним не разделяют состояние проверок HTTP-01 с прародителем.

## Режим сертификатов: HTTP-01 (по умолчанию), DNS-01 (по выбору) или существующий Secret

`publishing.certificates.solver` управляет тем, откуда Issuer тенанта берёт сертификаты TLS, - но только на двух путях ACME. Установка `publishing.certificates.wildcardSecretName` выбирает третий режим, `existingSecret`, в котором тенант отдаёт предоставленный оператором wildcard-Secret, а контроллер вообще не выпускает Issuer; настройки солвера, провайдера DNS-01 и издателя при этом пропускаются. См. [Сертификаты](#сертификаты) ниже и [справочник Platform Package]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}) для полного набора ключей провайдеров `publishing.certificates.dns01.*`.

### HTTP-01 (по умолчанию)

Работает из коробки, дополнительная настройка не требуется. Контроллер:

- Рендерит ACME `Issuer` в пространстве имён тенанта с солвером `http01.gatewayHTTPRoute`, указывающим на собственный Gateway тенанта / слушатель `http`.
- Наблюдает за HTTPRoute / TLSRoute, прикреплёнными к Gateway (с parentRefs на него). Для каждого нового имени хоста он добавляет HTTPS-слушатель и `Certificate` этого приложения (dnsNames содержит ровно это имя хоста).
- Именование слушателей приложений: `https-<first-label>-<8-hex>` (например, `https-harbor-deadbeef`).
- Именование сертификатов приложений: `<tgw>-<first-label>-<8-hex>-tls`.

Добавление приложения тенанта - будь то под тенантом-владельцем или под любым наследующим потомком - сводится к развёртыванию его HTTPRoute. Правки платформенного Package не нужны. Платформенные сервисы cozy-* (dashboard, keycloak, grafana, alerta, cozystack-api, vm-exportproxy, cdi-uploadproxy) по-прежнему управляются `publishing.exposedServices`, как и в схеме с ingress, - при `gateway.enabled=true` свой HTTPRoute / TLSRoute рендерят только сервисы из этого списка.

### DNS-01 (по выбору)

Установите `publishing.certificates.solver: dns01` и выберите провайдера:

| `publishing.certificates.dns01.provider` | Чарт проверяет заранее | Оператор должен предоставить |
| --- | --- | --- |
| `cloudflare` (по умолчанию) | (ничего - чарт никогда не падает) | Secret с именем из `cloudflare.secretName` (по умолчанию `cloudflare-api-token-secret`), содержащий API-токен Cloudflare под ключом из `cloudflare.secretKey` (по умолчанию `api-token`) |
| `route53` | `route53.region` (чарт падает на рендере, если пусто) | Либо IRSA / instance profile, либо `route53.secretName`, указывающий на Secret с секретным ключом доступа IAM под `route53.secretKey` (по умолчанию `secret-access-key`); опционально `route53.accessKeyID` |
| `digitalocean` | (ничего) | Secret с именем из `digitalocean.secretName` (по умолчанию `digitalocean-api-token-secret`), содержащий API-токен DigitalOcean под `digitalocean.secretKey` (по умолчанию `access-token`) |
| `rfc2136` | `rfc2136.nameserver` (чарт падает на рендере, если пусто) | `rfc2136.tsigKeyName` и `rfc2136.secretName`; Secret содержит материал ключа TSIG под `rfc2136.secretKey` (по умолчанию `tsig-secret-key`); `rfc2136.tsigAlgorithm` по умолчанию `HMACSHA256` |

Чарт вызывает `fail()` на этапе рендера только для ключей из второго столбца; остальное проверяется cert-manager во время проверки ACME, поэтому неправильно настроенный провайдер даёт `Challenge`, застрявший в `Pending`, а не ошибку рендера чарта.

Режим DNS-01 рендерит один wildcard-`Certificate`, покрывающий `<owner apex>` и `*.<owner apex>`, плюс соответствующие слушатели `https` (`*.<owner apex>`) и `https-apex` (`<owner apex>`). Новые приложения, публикуемые под apex, используют существующий wildcard-сертификат без выпуска отдельного сертификата на слушатель. Для каждого наследующего дочернего тенанта контроллер расширяет dnsNames wildcard-сертификата SAN-записями `<child-apex>` + `*.<child-apex>` и добавляет слушатель `*.<child-apex>`.

Платформенный чарт записывает конфигурацию провайдера в ключи `_cluster.dns01-*`, которые используются и чартом gateway отдельного тенанта (рендерящим CR TenantGateway), и общекластерными ClusterIssuer `letsencrypt-prod` / `letsencrypt-stage`, применяемыми в прежней схеме с ingress. Оба пути согласованы в том, какой провайдер активен.

Выбирайте DNS-01, когда вам нужен именно wildcard-сертификат - долгоживущий кластер со множеством приложений под одним apex, глубокие деревья наследования или жёсткие ограничения частоты Let's Encrypt. Gateway API ограничивает `Gateway.spec.listeners` 64 записями; HTTP-01 добавляет по одному HTTPS-слушателю на каждое публикуемое имя хоста (плюс обязательный слушатель `http` и слушатели сквозного TLS), поэтому развёртывание с одним тенантом, приближающееся к 60+ опубликованным приложениям на HTTP-01, упрётся в лимит, и отрендеренный `Gateway` не пройдёт допуск. DNS-01 сворачивает все имена хостов под apex в небольшое фиксированное число слушателей.

### existingSecret (wildcard, предоставленный оператором)

Установите [`publishing.certificates.wildcardSecretName`]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}) - и тенант полностью уходит от ACME: `TenantGateway` указывает своим слушателям на этот заранее созданный Secret, а контроллер не выпускает ни `Issuer`, ни `Certificate`. Настройки солвера, провайдера DNS-01 и издателя на этом пути игнорируются. Раскладка слушателей совпадает с DNS-01, поэтому лимит в 64 слушателя обходится тем же способом.

Выбирайте его, когда сертификаты выпускаются вне кластера, - корпоративный УЦ, уже имеющийся wildcard или терминирующий балансировщик, который уже им располагает. Прочитайте [Сертификаты](#сертификаты) перед включением: имя Secret доходит до каждого тенанта, а на пути ingress по умолчанию дочерний тенант с собственным контроллером ingress остаётся с самоподписанным сертификатом ([cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296)).

## Маршрутизация по сервисам

При `gateway.enabled=true` следующие сервисы переключаются с `Ingress` на ресурсы Gateway API. Столбец **Условие рендера** отличает сервисы, которые всегда рендерят свой маршрут при включённом флаге платформы, от тех, которым дополнительно нужна запись в `publishing.exposedServices` (и от приложений тенантов, зависящих от заполненности `_namespace.gateway`).

### HTTPRoute (терминация TLS на Gateway)

| Сервис | Пространство имён | Имя `HTTPRoute` | Бэкенд | Слушатель | Условие рендера |
| --- | --- | --- | --- | --- | --- |
| dashboard | `cozy-dashboard` | `dashboard` | `incloud-web-gatekeeper:8000` | свой `https-dashboard-...` (HTTP-01) или `https` (DNS-01) | `gateway.enabled` И `dashboard` в `publishing.exposedServices` |
| keycloak | `cozy-keycloak` | `keycloak` | `keycloak-http:80` | так же | `gateway.enabled` |
| grafana | `cozy-monitoring` | `grafana` | `grafana-service:3000` | так же | `gateway.enabled` |
| alerta | `cozy-monitoring` | `alerta` | `alerta:80` | так же | `gateway.enabled` |
| harbor | пространство имён тенанта | `<release-name>` | `<release-name>:80` | Gateway тенанта-владельца | задан `_namespace.gateway` (любой предок включил опцию) |
| bucket | пространство имён тенанта | `<bucket-name>-ui` | `<bucket-name>-ui:8080` | Gateway тенанта-владельца | задан `_namespace.gateway` |

Солвер HTTP-01 cert-manager размещает свой короткоживущий `HTTPRoute` на слушателе `http` того же Gateway с сопоставлением по пути `/.well-known/acme-challenge/`. Более специфичное сопоставление пути выигрывает у общего HTTPRoute перенаправления HTTP→HTTPS.

### TLSRoute (TLS passthrough)

Сервисы, которым нужна сквозная передача на основе SNI (клиенты предъявляют сертификаты, TLS терминируется на бэкенде), используют `TLSRoute` на выделенном слушателе Passthrough. По одному слушателю на сервис, имя хоста ограничено FQDN этого сервиса:

| Сервис | Пространство имён | Имя `TLSRoute` | Бэкенд | Слушатель | Условие рендера |
| --- | --- | --- | --- | --- | --- |
| Kubernetes API | `default` | `kubernetes-api` | `kubernetes:443` | `tls-api` | `gateway.enabled` И `api` в `publishing.exposedServices` |
| Экспорт ВМ KubeVirt | `cozy-kubevirt` | `vm-exportproxy` | `vm-exportproxy:443` | `tls-vm-exportproxy` | `gateway.enabled` И `vm-exportproxy` в `publishing.exposedServices` |
| Загрузка CDI KubeVirt | `cozy-kubevirt-cdi` | `cdi-uploadproxy` | `cdi-uploadproxy:443` | `tls-cdi-uploadproxy` | `gateway.enabled` И `cdi-uploadproxy` в `publishing.exposedServices` |

Все три слушателя Passthrough (`tls-api`, `tls-vm-exportproxy`, `tls-cdi-uploadproxy`) рендерятся на Gateway всегда - контроллер материализует по одному на каждую запись в значении чарта `tlsPassthroughServices` (по умолчанию: `[api, vm-exportproxy, cdi-uploadproxy]`). `publishing.exposedServices` на самом деле управляет соответствующим шаблоном `TLSRoute` в каждом вышестоящем чарте: если сервис удалён из `publishing.exposedServices`, его слушатель по-прежнему существует, но к нему ничего не прикрепляется, и трафик не допускается.

`TLSRoute` is shipped from the Gateway API experimental channel (CRD `gateway.networking.k8s.io/v1alpha2`) in v1.5.x. It graduates to `v1` upstream; Cozystack will follow the rename when it lands.

## Безопасность

Тенанты в Cozystack взаимодействуют с платформой исключительно через ресурсы `apps.cozystack.io/*` (Tenant, Bucket, Kubernetes, …), обслуживаемые `cozystack-api`. RBAC тенанта (`cozy:tenant:*`, агрегируемый в RoleBinding в собственном пространстве имён тенанта) не даёт права записи в `gateway.networking.k8s.io/*`, базовые `Namespaces` или `cozystack.io/Package`. Описанные ниже защиты делятся на две группы по тому, от кого они защищают: большинство из пяти уровней не защищают от ввода пользователя-тенанта (соответствующий RBAC ему изначально не выдан); они защищают от ошибок в cozystack-controller / Flux, компрометации цепочки поставки чарта приложения и ошибок типа «сбитый с толку помощник» со стороны администратора кластера. Все проверки на этапе допуска работают по принципу fail-closed (`failurePolicy: Fail`, `validationActions: [Deny]`).

**Шлюз для ввода пользователя-тенанта** - уровень 3 (`cozystack-tenant-host-policy`). `Tenant.spec.host` - то самое задаваемое пользователем поле, которое проявляется как граница безопасности на уровне имён хостов; оно проверяется при каждом Create / Update через цепочку допуска `cozystack-api`.

**Эшелонированная защита** - уровни 1, 2, 4, 5. Сегодняшняя модель угроз - ошибки чартов, ошибки контроллера, компрометация цепочки поставки чарта приложения и ошибки администратора кластера; у тенантов нет RBAC для прямой записи Gateway или HTTPRoute. Если этот RBAC когда-нибудь расширится (будущий RoleBinding, агрегированная через CRD роль, включающая `gateway.networking.k8s.io/*`, чарт приложения, выдающий своей ServiceAccount права записи маршрутов), эти уровни продолжат применять те же ограничения имён хостов к новому вызывающему - они не обходятся вводом тенанта, просто сейчас им не задействуются.

Записи `tenant-*` в `gateway.attachedNamespaces` разрешены намеренно: вектор межтенантного перехвата - это селектор меток слушателя (закрытый уровнями 1, 2, 4 и 5), а не статический список прикрепления, поэтому пространства имён `tenant-*` в списке просто получают метку прикрепления к gateway наряду с записями cozy-*.

```mermaid
flowchart TD
    USER["Tenant user<br/>(apps.cozystack.io/* via cozystack-api)"]
    CHART["App chart bug /<br/>supply-chain compromise"]

    L3["L3 VAP: Tenant spec.host writes<br/>restricted to trusted callers"]

    L1["L1: Listener allowedRoutes selector<br/>(HTTPS: namespace.cozystack.io/gateway;<br/>HTTP-80: kubernetes.io/metadata.name)"]
    L2["L2 VAP: Gateway listener hostname<br/>matches namespace.cozystack.io/host"]
    L4["L4 VAP: namespace.cozystack.io/host label<br/>writes restricted to trusted callers"]
    L5["L5 VAP: HTTPRoute/TLSRoute hostnames<br/>match namespace label (tenant-* only)"]

    GW["Cross-tenant hostname hijack<br/>BLOCKED"]

    USER -->|Tenant spec.host| L3
    L3 --> GW

    CHART -->|emits Gateway/HTTPRoute| L1
    CHART --> L2
    CHART --> L4
    CHART --> L5
    L1 --> GW
    L2 --> GW
    L4 --> GW
    L5 --> GW
```

### Уровень 1 - селектор пространств имён `allowedRoutes` слушателя

Каждый слушатель на Gateway тенанта закрепляет `allowedRoutes.namespaces.from: Selector`. Механика селектора различается по роли слушателя:

- **HTTPS-слушатели и слушатели сквозного TLS** используют `matchLabels: { namespace.cozystack.io/gateway: <owner-namespace> }`. Значение метки - пространство имён TenantGateway: для `tenant-root` это `tenant-root`, для `tenant-alice` - `tenant-alice` (то есть имя пространства имён, а не «голое» имя тенанта). Метку записывает чарт `apps/tenant` на каждое пространство имён тенанта (имя собственного пространства имён при владении Gateway, имя пространства имён наследуемого предка в остальных случаях) и проставляет контроллер на каждое пространство имён из `attachedNamespaces`. Пространства имён без совпадающего значения не могут прикрепить к этим слушателям ни один HTTPRoute / TLSRoute.
- **Простой HTTP-слушатель (порт 80)** использует строго более узкий белый список `matchExpressions` по встроенной метке `kubernetes.io/metadata.name` - только собственное пространство имён тенанта-владельца (где живёт принадлежащий контроллеру HTTPRoute перенаправления) и `cozy-cert-manager` (HTTPRoute проверок ACME HTTP-01). Поэтому HTTPRoute приложений, прикрепляющиеся по имени хоста, не могут привязаться к порту 80 и незаметно отдавать незашифрованный трафик.

Port-443 listeners pin `allowedRoutes.kinds` to `HTTPRoute` and `TLSRoute` — the pair is listed on each so Cilium keeps them apart — preventing `GRPCRoute` / `TCPRoute` / `UDPRoute` from attaching outside the Layer 5 VAP's coverage.

### Уровень 2 - `cozystack-gateway-hostname-policy`

`ValidatingAdmissionPolicy`, ограниченная операциями CREATE/UPDATE `Gateway` группы `gateway.networking.k8s.io` в версиях `v1` и `v1beta1` (так что кластер, всё ещё обслуживающий Gateway `v1beta1`, тоже покрыт). CEL читает `namespaceObject.metadata.labels["namespace.cozystack.io/host"]` и отклоняет любой слушатель, чьё имя хоста не равно этому значению и не является его поддоменом. `matchConditions` ограничивают VAP только пространствами имён `tenant-*` - Gateway в посторонних пространствах имён (например, `kube-system`) не затрагиваются.

Поскольку VAP читает метку пространства имён (а не общекластерный ConfigMap), тенант с полностью независимым apex-доменом (например, `customer1.example`, не поддомен apex платформы) валидируется корректно - VAP не предполагает иерархию поддоменов.

### Уровень 3 - `cozystack-tenant-host-policy`

`ValidatingAdmissionPolicy`, ограниченная операциями CREATE/UPDATE `apps.cozystack.io/v1alpha1 Tenant`. Отклоняет установку или изменение `spec.host`, если вызывающий не входит в группу `system:masters` и не является одним из `system:serviceaccounts:cozy-system`, `system:serviceaccounts:cozy-cert-manager`, `system:serviceaccounts:cozy-fluxcd`, `system:serviceaccounts:kube-system`. Тенанты по-прежнему могут создавать тенантов с пустым `spec.host` (обычный поток наследования).

Это закрывает путь, при котором пользователь-тенант создаёт Tenant с `spec.host=dashboard.example.org`, чтобы чарт тенанта записал перехваченную метку в его пространство имён.

`cozystack-api` - это агрегированный APIServer с собственной реализацией. REST-обработчик CR Tenant в `pkg/registry/apps/application/rest.go` явно вызывает колбэки `createValidation` / `updateValidation` / `deleteValidation` в Create / Update / Delete - в отличие от `genericregistry.Store`, пользовательские REST-обработчики должны подключать эти хуки сами. С подключёнными хуками каждая ValidatingAdmissionPolicy и ValidatingWebhook, ограниченная `apps.cozystack.io/*`, срабатывает на всех трёх операциях, как того требует контракт apiserver.

### Уровень 4 - `cozystack-namespace-host-label-policy`

`ValidatingAdmissionPolicy`, ограниченная операциями CREATE/UPDATE базового `v1 Namespace`. Считает `namespace.cozystack.io/host` фактически неизменяемой: отклоняет любое **изменение** значения (включая переход от пустого к заданному, что покрывает первые записи и на CREATE, и на UPDATE), если вызывающий не входит в тот же белый список доверенных вызывающих, что и на уровне 3. Идемпотентные повторные применения **того же** значения разрешены любому вызывающему - фактическое сообщение об ошибке CEL («namespace label namespace.cozystack.io/host is immutable once set») это отражает. Устанавливать или менять значение метки могут только сервисные учётные записи cozystack/Flux (которые применяют чарт тенанта).

В сочетании с уровнем 3 пользователь-тенант не может установить или изменить свой хост ни через CR Tenant, ни через метку пространства имён.

### Уровень 5 - `cozystack-route-hostname-policy` (HTTPRoute) и `cozystack-route-hostname-policy-tls` (TLSRoute)

Пара объектов `ValidatingAdmissionPolicy` с одинаковым CEL-выражением. `cozystack-route-hostname-policy` нацелена на CREATE/UPDATE `HTTPRoute` группы `gateway.networking.k8s.io` (`v1` и `v1beta1`); `cozystack-route-hostname-policy-tls` - на `TLSRoute` в `v1alpha2`. Обе ограничены пространствами имён `tenant-*` (cozy-* управляются администратором кластера, и им доверено публиковаться под любым apex) и отклоняют любую запись `spec.hostnames`, которая не равна метке `namespace.cozystack.io/host` пространства имён и не является её поддоменом. **Fail-closed при отсутствии метки** - пространство имён `tenant-*` без `namespace.cozystack.io/host` отклоняется, а не молча пропускается. Операторы, выполняющие `kubectl get validatingadmissionpolicy`, увидят оба объекта.

Это эшелонированная защита от ошибки чарта приложения или компрометации цепочки поставки, генерирующей ресурсы Gateway API вне apex тенанта, - тенанты в Cozystack по замыслу не имеют RBAC `gateway.networking.k8s.io/*`, так что это не защита от пользователя-тенанта. Внутриapex-ный межпространственный случай (чарт тенанта, претендующий на имя хоста, принадлежащее приложению `cozy-*`) обрабатывается контроллером на этапе согласования - см. [Разрешение HostnameConflict](#разрешение-hostnameconflict) ниже.

Допустимый суффикс хоста - всегда значение метки `namespace.cozystack.io/host` самого пространства имён: у уровня 5 нет особого случая для `tenant-root` и нет жёстко заданного правила выведения. Что бы чарт apps/tenant ни записал в эту метку (выведенное `<name>.<parent apex>` для наследующих потомков, `publishing.host` кластера для `tenant-root`, заданный оператором `tenant.spec.host` для тенантов с собственным apex), - именно этим должен оканчиваться каждый маршрут в этом пространстве имён. Тенант с независимым apex (`customer1.example` вместо поддомена) обрабатывается корректно, потому что VAP читает метку, а не предполагает иерархию поддоменов.

### Разрешение HostnameConflict

Когда два маршрута из разных пространств имён претендуют на одно имя хоста, контроллер выбирает победителя детерминированно:

- Маршрут из пространства имён `cozy-*` (платформенный сервис под управлением администратора кластера) выигрывает у маршрута из любого другого пространства имён.
- В пределах одного приоритетного уровня выигрывает маршрут с лексикографически наименьшей парой `<namespace>/<name>`.

Проигравший маршрут получает `Accepted=False` с `Reason=HostnameConflict` в `Status.Parents` под именем контроллера (`gateway.cozystack.io/tenantgateway-controller`). Записи статуса других контроллеров (Cilium и т.д.) не затрагиваются.

### Защита от захвата чужих объектов

Шесть путей согласования отказываются молча перезаписывать или присваивать уже существующее состояние, которое носит выведенное контроллером имя / аннотацию, но не происходит от этого `TenantGateway`:

- `Gateway` (названный по имени TenantGateway)
- `HTTPRoute` перенаправления (`<tgw>-http-redirect`)
- `Issuer` тенанта (`<tgw>-gateway`, только режимы сертификатов ACME)
- wildcard-`Certificate` (`<tgw>-gateway-tls`, режим DNS-01)
- `Certificate` на слушатель (`<tgw>-<first-label>-<8-hex>-tls`, режим HTTP-01)
- Метка пространства имён `namespace.cozystack.io/gateway` - контроллер записывает или снимает эту метку только на тех пространствах имён, которым он проставляет аннотацию `cozystack.io/gateway-attached-by`. Метки, записанные чартом `apps/tenant` (без аннотации), никогда не затрагиваются, поэтому наследование для пространств имён тенантов переживает любое согласование.

Для путей с именованными объектами оператор, вручную закрепивший Certificate или Issuer под выведенным контроллером именем (частный УЦ, ручное закрепление сертификата, внутренний ACME), получает явное условие `Ready=False/ReconcileError` на TenantGateway вместо молчаливого уничтожения его конфигурации и перевыпуска ресурса из другой учётной записи ACME. Сообщение об ошибке указывает на конфликтующий объект, чтобы оператор мог либо удалить его (передав владение контроллеру), либо переименовать.

### От чего это НЕ защищает

Эти остаточные риски - осознанные проектные решения, а не пробелы в реализации:

- **Учётные данные администратора кластера.** Любой, кто входит в `system:masters` или располагает подходящей ServiceAccount cozystack/Flux, может задать любой хост. Изоляция Gateway API - не самое слабое звено на этом уровне доверия.
- **Контроль над DNS.** Тенант, чьё разрешённое VAP имя хоста не резолвится в IP балансировщика кластера, не сможет пройти ACME HTTP-01. Certificate не выпускается; перехвата не происходит, даже если допуск каким-то образом пропустил Gateway. Основанное на DNS доказательство владения в ACME - последний рубеж. В режиме `existingSecret` этого уровня нет: ничего не выпускается, а значит, ничто не доказывает контроль над доменом; Secret оператора принимается на доверии в том виде, в каком предоставлен.
- **Общий аллокатор балансировщика.** Несколько тенантов-владельцев, берущих адреса из одного пула под управлением администратора (MetalLB, Cilium LB-IPAM и т.д.), конкурируют за адреса по правилам этого аллокатора. Уникальность IP на сервис - ответственность аллокатора, как и для любого другого сервиса LoadBalancer в кластере.

## Сертификаты

В двух режимах ACME каждый тенант с `spec.gateway: true` получает собственный `Issuer` cert-manager (ограниченный пространством имён, а не `ClusterIssuer`) с именем `<tgw>-gateway`. Issuer несёт собственную учётную запись ACME через `privateKeySecretRef: <tgw>-acme-account`. Certificate ссылаются на `issuerRef.kind: Issuer, name: <tgw>-gateway`.

В **режиме HTTP-01** - по одному Certificate на имя хоста опубликованного приложения (с именем `<tgw>-<first-label>-<8-hex>-tls`). В **режиме DNS-01** один wildcard-Certificate (с именем `<tgw>-gateway-tls`) покрывает `<owner apex>` и `*.<owner apex>`, плюс SAN-записи на apex каждого потомка (`<child-apex>` и `*.<child-apex>`) для каждого наследующего тенанта.

Both of the above are ACME modes. Setting [`publishing.certificates.wildcardSecretName`]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}) selects a third mode, **existingSecret**: the `TenantGateway` references the operator-provided Secret directly, and the controller mints no per-tenant `Issuer` and no `Certificate` — the solver, DNS-01 provider, and issuer settings are skipped on this path, and any `Issuer` or `Certificate` it previously owned is garbage-collected. The ACME account private key (`<tgw>-acme-account`) is NOT removed on a mode switch — only the `Issuer` referencing it is. It is cleaned up by a post-delete hook when the tenant's gateway release is removed, not when the mode changes. The cluster-wide `letsencrypt-prod` / `letsencrypt-stage` `ClusterIssuer`s are unaffected: they are rendered from `publishing.certificates.solver` regardless, and still validate their DNS-01 provider settings at render time. The listener shape matches DNS-01: one `*.<apex>` listener, one `<apex>` listener, and one `*.<child-apex>` listener per inheriting child, all pointing at that one Secret.

Покрытие сертификатами для потомков далее распадается на три случая с разными режимами отказа и разными способами устранения. Первые два относятся к пути Gateway; третий относится к пути ingress-nginx по умолчанию и является открытым багом, а не ограничением, которое можно обойти настройками:

- **Наследующие потомки** (по умолчанию, без `spec.gateway`) не имеют собственного Gateway. Их слушатель `*.<child-apex>` рендерится на Gateway владельца и привязывается к Secret в пространстве имён *владельца*, поэтому покрытие целиком зависит от списка SAN этого Secret: голый `*.<apex>` не соответствует `*.<child-apex>`, и клиентам поддомена потомка отдаётся сертификат владельца, а они видят несовпадение имени хоста. Реплицирование Secret в пространство имён потомка здесь ничего не исправит, потому что его никакой слушатель не читает; SAN-записи должны покрывать apex каждого потомка.
- **Потомки, владеющие Gateway** (`spec.gateway: true`), рендерят собственный `TenantGateway`, наследуют *имя* Secret через канал значений кластера и разрешают его в **своём собственном** пространстве имён. Gateway API действительно позволяет слушателю ссылаться на Secret в другом пространстве имён через `ReferenceGrant`, но контроллер этим путём не пользуется: он рендерит `certificateRefs` без пространства имён и не выпускает `ReferenceGrant`, поэтому ссылка всегда локальна. Здесь Secret действительно необходимо реплицировать, иначе тенант останется без сертификата.
- **Потомки на пути ingress-nginx** (`gateway.enabled=false`, по умолчанию) страдают сильнее всего. Имя Secret доходит до каждого тенанта, и шаблоны ingress приложений и системных сервисов убирают свою аннотацию ACME на каждый хост, как только оно непусто, - но чарт ingress передаёт `default-ssl-certificate` только *публикующему* контроллеру. Поэтому потомок, запускающий собственный контроллер ingress (`ingress: true`), остаётся без того и без другого: у его приложений нет собственного сертификата, а у его контроллера нет сертификата по умолчанию, так что ingress-nginx отдаёт встроенный самоподписанный сертификат для каждого хоста этого тенанта. Реплицирование Secret не помогает - флаг привязан к пространству имён, а не к Secret. Это отслеживается как [cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296); пока баг не исправлен, не устанавливайте `wildcardSecretName` в кластере, дочерние тенанты которого запускают собственные контроллеры ingress.

Именно поэтому режим *поддерживается* только для корневого тенанта. Ничто не обеспечивает эту границу: имя Secret доходит до каждого тенанта по тому же каналу значений, поэтому включение режима в кластере, где уже есть потомки, владеющие Gateway, переводит на `existingSecret` и их.

Из коробки поддерживаются два сервера ACME:

- `publishing.certificates.issuerName: letsencrypt-prod` → `https://acme-v02.api.letsencrypt.org/directory`
- `publishing.certificates.issuerName: letsencrypt-stage` → `https://acme-staging-v02.api.letsencrypt.org/directory`

Любое другое значение приводит к ошибке рендера чарта. Чтобы поддержать нового провайдера ACME: добавьте константу `letsencrypt*Server` (или аналогичную) рядом с существующими в `internal/controller/tenantgateway/reconciler.go`, затем добавьте ветку в `acmeServerForIssuer` в `internal/controller/tenantgateway/renderers.go`, сопоставляющую имя издателя с этой константой.

### Ограничения частоты

Let's Encrypt применяет квоты на учётную запись и на зарегистрированный домен:

- 50 новых сертификатов на зарегистрированный домен в неделю
- 5 дублирующих сертификатов в неделю для одного и того же набора имён хостов
- 300 новых заказов на учётную запись за 3 часа

Установка `publishing.certificates.wildcardSecretName` полностью обходит квоты - этот режим вообще не выпускает сертификаты ACME - ценой оговорок из раздела [Сертификаты](#сертификаты). Кластер, где множество тенантов делят один apex-домен, может исчерпать их быстро, особенно в режиме HTTP-01, где каждое опубликованное приложение добавляет по одному сертификату. Меры смягчения:

- `publishing.certificates.issuerName: letsencrypt-stage` для непроизводственных кластеров (квоты staging не влияют на prod).
- `tenant.spec.resourceQuotas.count/certificates.cert-manager.io`, чтобы ограничить создание сертификатов на тенанта.
- Переход на DNS-01, чтобы объединить приложения каждого тенанта под одним wildcard-сертификатом (сокращает количество сертификатов с N приложений до 1 на тенанта-владельца; наследующие потомки сворачиваются в wildcard родителя через расширение SAN).
- Для изолированных развёртываний используйте поставляемый `selfsigned-cluster-issuer` или внутренний сервер ACME.

Рекомендуемая квота на уровне тенанта, сдерживающая тенанта, ведущего себя некорректно:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Tenant
spec:
  gateway: true
  resourceQuotas:
    count/certificates.cert-manager.io: "10"
```

## Миграция с ingress-nginx

Два режима сосуществуют. Переключение выполняется на уровне кластера (`gateway.enabled`) и на уровне тенанта (`tenant.spec.gateway`), а не глобально.

### Для нового кластера

Установите `gateway.enabled: true` при установке. Ingress-nginx можно полностью отключить, когда каждый тенант-владелец получит `spec.gateway: true` и каждое опубликованное приложение под этими тенантами мигрирует.

Тенанты-владельцы затем объявляют `spec.gateway: true` при создании. Их потомки наследуют через метку пространства имён без явного включения.

### Для существующего кластера

Порядок важен - переключение `gateway.enabled: true` до того, как появился хоть один Gateway, вызывает реальный простой публикуемых сервисов под управлением платформы. HTTPRoute для cozy-* начинают рендериться, а соответствующие Ingress удаляются, но Gateway, на который они ссылаются через ParentRef, ещё не существует, поэтому внешний трафик к dashboard / keycloak / Kubernetes API / экспорту ВМ / загрузке CDI отбрасывается до тех пор, пока Gateway не станет `Programmed`, а в режимах сертификатов ACME - пока его Certificate не станут `Ready`. Сначала выполните включение опции на уровне тенантов, **потом** переключайте платформу.

Каждый TenantGateway тенанта, отрендеренный из него Gateway, а также (в режимах сертификатов ACME) его Issuer и - в режиме DNS-01 - его wildcard-Certificate выводятся из фиксированного имени: чарт жёстко задаёт `TenantGateway` как `cozystack`, а контроллер выводит из него `cozystack-gateway` (Issuer), `cozystack-gateway-tls` (wildcard-сертификат DNS-01) и `cozystack-http-redirect` (маршрут перенаправления HTTP→HTTPS). Все команды kubectl ниже используют эти буквальные имена независимо от того, какой тенант владеет Gateway.

1. Для каждого тенанта, который должен владеть Gateway (обычно как минимум `tenant-root`), установите `tenant.spec.gateway: true`. Чарт тенанта материализует CR `TenantGateway`, а контроллер согласует Gateway и, в режимах сертификатов ACME, Issuer и Certificate(s). Потомки тенанта-владельца подхватывают Gateway родителя автоматически через метку пространства имён.
2. Дождитесь Gateway, а в режимах сертификатов ACME - и Certificate. Gateway всегда носит имя `cozystack`:

   ```bash
   kubectl -n <owner-tenant-ns> wait gateway/cozystack --for=condition=Programmed --timeout=5m
   ```

   `Programmed` доказывает меньше, чем кажется. Cilium выставляет его, как только Gateway назначен адрес **и** принят хотя бы один слушатель, - это не проверка на каждый слушатель. Слушатель, который не может разрешить свой сертификат, помечается `ResolvedRefs=False`, выпадает из набора принятых, а Gateway остаётся `Programmed`, пока остаётся хоть один слушатель, - а простой слушатель `http` на порту 80 остаётся всегда. Поэтому `Programmed=True` говорит вам, что балансировщик выдал Gateway адрес; о том, нашёл ли хоть один HTTPS-слушатель свой Secret, он не говорит ничего.

   Собственное условие `Ready` у `TenantGateway` - агрегирующее: оно вычисляется по всем слушателям и сообщает `ListenersNotReady`, когда цель `certificateRefs` отсутствует.

   ```bash
   kubectl -n <owner-tenant-ns> get tenantgateway cozystack -o jsonpath='{.status.conditions[?(@.type=="Ready")]}'
   ```

   Чтобы увидеть, какой слушатель неисправен, прочитайте собственный статус `TenantGateway` по каждому слушателю. Контроллер выводит его из условий `Accepted` и `Programmed` каждого слушателя и записывает причину, поэтому это единственное место, где ответ на вопрос уже есть:

   ```bash
   kubectl -n <owner-tenant-ns> get tenantgateway cozystack \
     -o jsonpath='{range .status.listeners[*]}{.name}{"\t"}{.ready}{"\t"}{.reason}{"\n"}{end}'
   ```

   Do not go by `ResolvedRefs` on the raw `Gateway`. On this platform `cozystack-controller` lists both `HTTPRoute` and `TLSRoute` in `allowedRoutes.kinds` on every port-443 listener — a workaround that stops Cilium collapsing them together — and Cilium answers with a permanent `ResolvedRefs=False/InvalidRouteKinds` on each of them. It is cosmetic and affects neither traffic nor readiness, but it means `ResolvedRefs` reads `False` on a perfectly healthy cluster.

   В **режиме existingSecret** никакого `Certificate` нет вовсе, поэтому пропустите ожидание сертификата ниже: `kubectl wait` не блокируется на отсутствующем объекте, а сразу падает с `NotFound`, и это довольно запутанный способ узнать, что в этом режиме сертификат никогда не создаётся. Вместо этого проверьте Secret, предоставленный оператором. Cilium не смотрит на `type` у Secret; он требует лишь, чтобы `tls.crt` и `tls.key` разбирались как PEM, поэтому проверяйте содержимое, а не метку:

   ```bash
   kubectl -n <owner-tenant-ns> get secret <wildcardSecretName> \
     -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -subject -dates
   ```

   В **режиме DNS-01** есть один wildcard-сертификат с именем `cozystack-gateway-tls`:

   ```bash
   kubectl -n <owner-tenant-ns> wait certificate/cozystack-gateway-tls --for=condition=Ready --timeout=10m
   ```

   В **режиме HTTP-01** каждый Certificate на слушатель несёт метку `cozystack.io/per-listener-cert=true` (проставляется контроллером), поэтому их можно ждать как набор:

   ```bash
   kubectl -n <owner-tenant-ns> wait certificate \
     --selector cozystack.io/per-listener-cert=true \
     --for=condition=Ready --timeout=10m
   ```

3. Включите `gateway.enabled: true` в Package платформы. Это перерендеривает ClusterIssuer cert-manager и шаблоны публикуемых сервисов. Существующие объекты `Ingress` для dashboard / keycloak / grafana / alerta / cozystack-api (Kubernetes API) / vm-exportproxy / cdi-uploadproxy удаляются Flux по мере замены на `HTTPRoute` / `TLSRoute`, которые теперь прикрепляются к уже готовому (`Programmed`) Gateway без окна простоя.
4. Когда все деревья тенантов мигрируют, ingress-nginx больше не нужен для сервисов, встроенных в Cozystack. Механизм отключения источника пакета `cozystack.ingress-application` на уровне платформы отслеживается отдельно; сегодня бандл всё ещё рендерит его, и контроллер может оставаться установленным вхолостую для тенантов, которые ещё не мигрировали.

Приложения из вендоренных вышестоящих чартов (harbor, bucket) прикрепляются к Gateway своего тенанта-владельца через `_namespace.gateway`, который чарт тенанта заполняет автоматически, как только владелец устанавливает `spec.gateway: true` (и распространяет на наследующих потомков).

#### Откат

Чтобы откатиться в течение окна миграции, верните `gateway.enabled` в `false` в Package платформы. HTTPRoute / TLSRoute для cozy-* перестают рендериться, и Flux удаляет их; исходные объекты `Ingress` для dashboard / keycloak / grafana / alerta / cozystack-api / vm-exportproxy / cdi-uploadproxy заново рендерятся теми же чартами при следующем согласовании, и ingress-nginx их подхватывает. Окно простоя такое же, как и на прямом пути для сервисов cozy-*, - HTTPRoute исчезает раньше, чем возвращается Ingress, - так что ожидайте короткого перерыва плюс времени, которое Flux потратит на согласование. TenantGateway и Gateway тенанта, оставшиеся после `tenant.spec.gateway: true`, - а в режимах сертификатов ACME также Issuer и Certificate - не мешают пути ingress-nginx и могут быть оставлены на месте; чтобы полностью откатить тенанта, установите ещё и `tenant.spec.gateway: false`, и чарт удалит HelmRelease gateway (контроллер уберёт Gateway, а также Issuer там, где он им владеет).

## Известные ограничения

- **`existingSecret` cert mode is root-tenant only, and nothing enforces it.** The Secret name rides the cluster values channel to every tenant, so enabling it also switches gateway-owning children onto the mode (they need the Secret replicated into their own namespace) and, on the default ingress path, leaves a child running its own ingress controller with no certificate at all — ingress-nginx serves its built-in self-signed one. That last case is an open bug, [cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296).
- **Multi-tenant shared LB IP.** Multiple owning tenants cannot share a single LB IP on current Cilium: each owning tenant Gateway claims `443/TCP` and `lbipam.cilium.io/sharing-key` is inactive on port collision ([cilium#21270](https://github.com/cilium/cilium/issues/21270), [cilium#42756](https://github.com/cilium/cilium/issues/42756)). Each owning Gateway therefore needs its own LB IP from the admin-managed allocator until Cilium ships ListenerSet. Within a single Gateway, inheritance (parent + all inheriting children sharing one IP) works today.
- **TLSRoute v1alpha2.** Gateway API v1.5 ships TLSRoute at `v1alpha2`. It graduates to `v1` upstream; Cozystack will follow the rename when it lands.
- **DNS-01 wildcards require DNS provider access for every apex level.** When a deeply nested tenant tree (e.g. `tenant-root` → `alice` → `alice-bob`) inherits DNS-01 mode through the root, the parent's `*.alice.example.org` SAN requires the parent's ACME challenge to write a TXT record under `_acme-challenge.alice.example.org`. If the operator hasn't delegated that subzone to the parent's DNS provider account, cert issuance for the grandchild apex stalls. HTTP-01 mode is unaffected.
- **Supported ACME issuers.** `publishing.certificates.issuerName` must be `letsencrypt-prod` or `letsencrypt-stage` (the controller maps those to ACME server URLs). To support another ACME provider, extend the controller's renderer with an additional branch.
- **`tenant.spec.host` enforcement.** A tenant cannot set their own host (runtime-blocked), but a cluster-admin who misconfigures it produces a tenant publishing a hostname they do not own. On the ACME cert modes ACME will fail (no DNS control), so no cert is issued and no hijack materialises — though the diagnostics stop at "Certificate stuck in Pending". In `existingSecret` mode that safety net is absent: nothing is issued, so nothing proves domain control, the Gateway goes `Programmed`, and the operator Secret is served with whatever SANs it happens to carry.
- **Upstream application features.** Some chart-level features in harbor / bucket still rely on ingress-nginx annotations upstream. Cozystack tracks those as upstream PRs; they remain the reason some ops teams will keep ingress-nginx alongside Gateway API for a while.
- **cert-manager namespace is hardcoded** for ACME HTTP-01. The port-80 listener's `allowedRoutes` whitelist names `cozy-cert-manager` explicitly. Operators running cert-manager in a non-default namespace cannot use HTTP-01 with Gateway API today — the ACME challenge HTTPRoute will be rejected with no obvious diagnostic. DNS-01 mode is unaffected (no in-cluster challenge HTTPRoute is involved).

## Устранение неполадок

### Начните отсюда: выведите список TenantGateway

```bash
kubectl get tenantgateway --all-namespaces
# или, используя короткое имя
kubectl get tgw --all-namespaces
```

TenantGateway тенанта-владельца появляется здесь после согласования `tenant.spec.gateway: true`. Отсутствие строки означает, что чарт apps/tenant ещё не отрендерил CR (проверьте `tenant.spec.gateway` и что HelmRelease gateway в пространстве имён тенанта в состоянии Ready); существующая строка с `Ready=False` - отправная точка для рецептов ниже.

### TenantGateway застрял в `Ready=False` с `ReconcileError`

```bash
kubectl -n <tenant-ns> describe tenantgateway cozystack
```

Сообщение условия статуса называет неудавшийся шаг. Типичные случаи:

- `gateway <ns>/cozystack exists but is not owned by TenantGateway ...` - найден уже существующий Gateway с выведенным контроллером именем, и он был отвергнут. Переименуйте или удалите чужой Gateway либо вручную установите его `OwnerReference` на TenantGateway, если намерены передать владение.
- `issuer <ns>/<tgw>-gateway exists but is not owned ...` - то же самое для чужого Issuer.
- `certificate <ns>/... exists but is not owned ...` - то же для чужого Certificate.

### Gateway застрял в `Programmed=False`

```bash
kubectl -n cozy-cilium logs deploy/cilium-operator --tail=100 | grep -i gateway
```

Отсутствующий Secret сертификата сюда **не** приводит - Gateway сохраняет свой адрес и слушатель `http`, поэтому остаётся `Programmed`. Для этого отказа читайте статус `TenantGateway` по каждому слушателю (`.status.listeners[*].ready` / `.reason`) либо его агрегирующее условие `Ready`. Настоящие причины `Programmed=False`: у сервиса LoadBalancer ещё нет адреса (`AddressNotAssigned` - безусловно самая частая), опечатка в `gatewayClassName` (должно быть ровно `cilium`), слушатель, конфликтующий с другим (тот же порт + протокол + имя хоста), или отказ всех слушателей разом.

### HTTPS не работает или отдаёт не тот сертификат в режиме `existingSecret`

В этом режиме объекта `Certificate` не существует, поэтому и `describe` делать нечего. Типичные отказы:

- **Secret отсутствует или назван неверно.** Каждый HTTPS-слушатель не проходит валидацию (`InvalidCertificateRef`) и перестаёт быть `Accepted`. Порт остаётся открытым - Cilium транслирует конфигурацию Envoy из *спецификации* Gateway, а не из принятого подмножества, и сертификат отдаётся через ссылку SDS, - поэтому клиенты по-прежнему подключаются на 443, а затем не проходят рукопожатие TLS (сброс или пустой ответ), вместо того чтобы получить отказ в соединении. Сам Gateway остаётся `Programmed`; `TenantGateway` сообщает `ListenersNotReady`.
- **Secret есть, содержимое непригодно.** Secret без `tls.crt` или `tls.key` либо содержащий под ними что-то, что не является PEM, не проходит валидацию: `PEM format error in TLS Certificate` для сертификата, `PEM format error in TLS Key` для ключа. Обратите внимание, что Cilium проверяет содержимое, а не метку: он никогда не читает `type` у Secret. Всё равно создавайте Secret с типом `kubernetes.io/tls` - именно этого ожидает платформа, - но при диагностике не смотрите на `type`, потому что никто в цепочке его не читает.
- **Secret в порядке, SAN-записи слишком узкие.** TLS завершается успешно, а клиент видит несовпадение имени хоста. Голый `*.<apex>` не покрывает `*.<child-apex>`.

`TenantGateway` сообщает, КАКОЙ слушатель не готов (`reason: NotAccepted`); сообщения Cilium он не несёт. За приведёнными выше строками причин обращайтесь к условиям слушателей на самом `Gateway` (`.status.listeners[*].conditions[*].message`) либо к логу `cilium-operator`.

```bash
kubectl -n <owner-tenant-ns> get tenantgateway cozystack \
  -o jsonpath='{range .status.listeners[*]}{.name}{"\t"}{.ready}{"\t"}{.reason}{"\n"}{end}'
kubectl -n <owner-tenant-ns> get secret <wildcardSecretName> \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -text | grep -A1 'Subject Alternative Name'
```

### Certificate застрял в `Ready=False`

```bash
kubectl -n <tenant-ns> describe certificate <cert-name>
kubectl -n <tenant-ns> describe challenge
```

Если у `HTTPRoute` проверки `Accepted=False`, белый список `allowedRoutes` HTTP-слушателя не включает пространство имён проверки - ожидается `cozy-cert-manager`, всегда неявно входящий в список. Если проверка сообщает об ошибках сервера ACME, проверьте DNS: `<host>` (HTTP-01) либо `<apex>`, `*.<apex>` и SAN-записи потомков (DNS-01) должны резолвиться в IP балансировщика Gateway / обслуживаться настроенным провайдером DNS-01.

### HTTPRoute отклонён с `HostnameConflict`

```bash
kubectl -n <tenant-ns> describe httproute <route-name>
```

Найдите в `Status.Parents` запись с `controllerName: gateway.cozystack.io/tenantgateway-controller` и `Reason: HostnameConflict`. Сообщение называет конфликтующие имена хостов и маршрут, который ими владеет. Конфликты внутри одного apex разрешаются с приоритетом `cozy-*`; проигравший должен использовать другое имя хоста.

### Отказ допуска: «Gateway listener hostname must equal...»

Уровень 2 (`cozystack-gateway-hostname-policy`) отклонил Gateway, потому что имя хоста слушателя не соответствует `namespace.cozystack.io/host` пространства имён Gateway. Исправьте имя хоста слушателя или (если метка пространства имён неверна) обновите `spec.host` тенанта через доверенного вызывающего.

### Отказ допуска: «HTTPRoute hostnames must equal...»

Уровень 5 (`cozystack-route-hostname-policy`) отклонил HTTPRoute или TLSRoute, потому что имя хоста выходит за пределы apex метки `namespace.cozystack.io/host` пространства имён. Либо измените имя хоста так, чтобы оно находилось под apex, либо перенесите маршрут в пространство имён, чья метка покрывает нужное имя хоста.

### Отказ допуска: «tenant.spec.host can only be set...»

Недоверенный вызывающий попытался задать `tenant.spec.host`. Используйте пустой `spec.host` (наследование от родителя) или попросите администратора кластера применить Tenant.

### HTTPRoute наследующего потомка не принят на Gateway родителя

```bash
kubectl get namespace <child-tenant-ns> -o jsonpath='{.metadata.labels.namespace\.cozystack\.io/gateway}{"\n"}'
kubectl -n <owner-tenant-ns> describe gateway cozystack
```

Если метка `namespace.cozystack.io/gateway` пространства имён потомка пуста или не совпадает с именем пространства имён тенанта-владельца (например, `tenant-root`, `tenant-alice` - пространство имён, а не «голое» имя тенанта), селектор `allowedRoutes` слушателя не допустит маршрут. Метку записывает чарт `apps/tenant`; убедитесь, что ресурс тенанта существует, чарт согласован и у родителя (или любого предка выше) задан `spec.gateway: true`.

### У сервиса Gateway IP LoadBalancer в состоянии `<pending>`

Автоматически создаваемый сервис LoadBalancer Gateway тенанта получает IP из того аллокатора, который настроил администратор кластера. Состояние `<pending>` означает, что аллокатор не назначил адрес. Типичные причины:

- В кластере не подключён аллокатор (нет пула MetalLB, нет пула Cilium LB-IPAM, нет предварительного закрепления externalIP). Cozystack не рендерит манифесты аллокатора автоматически - ожидается, что оператор настроит его на уровне платформы.
- Аллокатор подключён, но исчерпан (все адреса пула уже заняты).
- Сервис запросил конкретный адрес (`loadBalancerIP`, заданный оператором), которым аллокатор не управляет.

`kubectl -n <tenant-ns> describe svc cilium-gateway-cozystack` показывает события; используемый аллокатор записывает туда свои решения.

## См. также

- Спецификация Gateway API: [gateway-api.sigs.k8s.io](https://gateway-api.sigs.k8s.io/)
- Документация Cilium по Gateway API: [docs.cilium.io/.../gateway-api](https://docs.cilium.io/en/stable/network/servicemesh/gateway-api/gateway-api/)
- Ключи совместного использования Cilium LB-IPAM: [docs.cilium.io/.../lb-ipam](https://docs.cilium.io/en/stable/network/lb-ipam/#sharing-keys)
- KEP-5707 (устаревание `Service.spec.externalIPs`): [kubernetes/enhancements#5707](https://github.com/kubernetes/enhancements/issues/5707)
- Ограничения частоты Let's Encrypt: [letsencrypt.org/docs/rate-limits](https://letsencrypt.org/docs/rate-limits/)
