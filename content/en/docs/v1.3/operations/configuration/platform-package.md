---
title: "Справочник пакета платформы"
linkTitle: "Пакет платформы"
description: "Справочник по пакету платформы Cozystack, который определяет ключевые значения конфигурации для установки и эксплуатации Cozystack."
weight: 10
aliases:
  - /docs/v1.3/install/cozystack/configmap
  - /docs/v1.3/operations/configuration/configmap
---

Эта страница объясняет назначение пакета платформы Cozystack и содержит полный справочник по его значениям.

Основная конфигурация Cozystack задается пользовательским ресурсом `Package`.
Этот пакет включает [вариант Cozystack]({{% ref "/docs/v1.3/operations/configuration/variants" %}}), [настройки компонентов]({{% ref "/docs/v1.3/operations/configuration/components" %}}),
ключевые сетевые параметры, публикуемые сервисы и другие опции.


## Пример

Ниже приведен пример конфигурации для установки Cozystack с вариантом `isp-full` и корневым хостом `example.org`,
в которой Cozystack Dashboard и API опубликованы и доступны пользователям:

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
          host: "example.org"
          apiServerEndpoint: "https://api.example.org:443"
          exposedServices:
            - dashboard
            - api
        networking:
          podCIDR: "10.244.0.0/16"
          podGateway: "10.244.0.1"
          serviceCIDR: "10.96.0.0/16"
          joinCIDR: "100.64.0.0/16"
```


## Справочник

### Основные поля пакета

| Поле | Описание |
| --- | --- |
| `spec.variant` | Вариант, используемый для установки, например `isp-full`, `isp-full-generic`, `isp-hosted`, `distro-full`. |

### Значения платформы (`spec.components.platform.values.*`)

#### Публикация

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `publishing.host` | `"example.org"` | Основной домен для всех сервисов, создаваемых в Cozystack, например dashboard, Grafana, Keycloak и других. |
| `publishing.apiServerEndpoint` | `""` | Используется для генерации файлов kubeconfig для пользователей. Рекомендуется использовать маршрутизируемый FQDN или IP-адрес вместо адресов, доступных только локально. Пример: `"https://api.example.org"`. |
| `publishing.exposedServices` | `[api, dashboard, vm-exportproxy, cdi-uploadproxy]` | Список сервисов для публикации. Возможные значения: `api`, `dashboard`, `cdi-uploadproxy`, `vm-exportproxy`. |
| `publishing.ingressName` | `"tenant-root"` | Ingress-контроллер, используемый для публикации сервисов. |
| `publishing.externalIPs` | `[]` | Список внешних IP-адресов, используемых для указанного Ingress-контроллера. Если не задан, по умолчанию используется сервис LoadBalancer. |
| `publishing.certificates.solver` | `"http01"` | Тип обработчика ACME challenge для стандартного издателя Let's Encrypt. Возможные значения: `http01`, `dns01`. |
| `publishing.certificates.issuerName` | `"letsencrypt-prod"` | Имя `ClusterIssuer` для TLS-сертификатов, используемых в системных Helm-релизах. |

#### Сеть

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `networking.clusterDomain` | `"cozy.local"` | Внутреннее доменное имя кластера. |
| `networking.podCIDR` | `"10.244.0.0/16"` | Подсеть подов, из которой подам назначаются IP-адреса. |
| `networking.podGateway` | `"10.244.0.1"` | Адрес шлюза для подсети подов. |
| `networking.serviceCIDR` | `"10.96.0.0/16"` | Сервисная подсеть, из которой сервисам Kubernetes назначаются IP-адреса. |
| `networking.joinCIDR` | `"100.64.0.0/16"` | Join-subnet для сетевого взаимодействия между Node и Pod. Подробнее см. в документации [kube-ovn]. |
| `networking.kubeovn.MASTER_NODES` | `""` | Список IP-адресов master-узлов KubeOVN, разделенных запятыми. По умолчанию KubeOVN использует `lookup`, чтобы найти узлы control plane по метке `node-role.kubernetes.io/control-plane`. В новых кластерах `lookup` может вернуть пустой результат. Задайте это значение, чтобы переопределить поведение по умолчанию. |

#### Пакеты bundle

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `bundles.system.enabled` | `false` | Включает системный bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.system.variant` | `"isp-full"` | Вариант системного bundle. Возможные значения: `isp-full`, `isp-full-generic`, `isp-hosted`. Управляется оператором на основе `spec.variant`. |
| `bundles.iaas.enabled` | `false` | Включает IaaS bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.paas.enabled` | `false` | Включает PaaS bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.naas.enabled` | `false` | Включает NaaS bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.enabledPackages` | `[]` | Список дополнительных компонентов bundle, которые нужно включить в установку. Подробнее см. в разделе [«Как включать и отключать компоненты bundle»][enable-disable]. |
| `bundles.disabledPackages` | `[]` | Список компонентов bundle, которые нужно исключить из установки. Подробнее см. в разделе [«Как включать и отключать компоненты bundle»][enable-disable]. |

#### Аутентификация

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `authentication.oidc.enabled` | `false` | Включает функцию [OIDC][oidc] в Cozystack. |
| `authentication.oidc.insecureSkipVerify` | `false` | Пропускает проверку TLS-сертификата для OIDC-провайдера. |
| `authentication.oidc.keycloakExtraRedirectUri` | `""` | Дополнительный redirect URI для OIDC-клиента Keycloak. |
| `authentication.oidc.keycloakInternalUrl` | `""` | Внутренний URL для backend-to-backend запросов к Keycloak. Если значение задано, oauth2-proxy панели управления пропускает OIDC discovery и направляет запросы token, JWKS, userinfo и logout через этот URL, при этом браузерные редиректы остаются на внешнем URL. Пример: `http://keycloak-http.cozy-keycloak.svc:8080/realms/cozy`. |

#### Планирование

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `scheduling.globalAppTopologySpreadConstraints` | `""` | Глобальные topology spread constraints для подов, применяемые ко всем управляемым приложениям. |

#### Брендинг

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `branding` | `{}` | Объект конфигурации UI-брендинга. Доступные поля и примеры использования описаны в руководстве [настройка брендинга]({{% ref "/docs/v1.3/operations/configuration/white-labeling" %}}). У отдельных полей, например `titleText` и `logoSvg`, есть собственные значения по умолчанию, если они не заданы явно. |

#### Registry

Конфигурация зеркал registry контейнерных образов. Позволяет направлять загрузку образов через локальные зеркала.

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `registries.mirrors` | `{}` | Отображение имен хостов registry в конечные точки зеркал. Каждая запись сопоставляет registry, например `docker.io`, со списком конечных точек зеркал. |
| `registries.config` | `{}` | Конфигурация для отдельных конечных точек, например настройки TLS. |

Пример:

```yaml
registries:
  mirrors:
    docker.io:
      endpoints:
        - http://10.0.0.1:8082
    ghcr.io:
      endpoints:
        - http://10.0.0.1:8083
  config:
    "10.0.0.1:8082":
      tls:
        insecureSkipVerify: true
```

#### Ресурсы

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `resources.cpuAllocationRatio` | `10` | Коэффициент распределения CPU: на 1 vCPU запрашивается `1/cpuAllocationRatio` CPU. Подробное объяснение и примеры см. в разделе [управление ресурсами][Resource Management]. |
| `resources.memoryAllocationRatio` | `1` | Коэффициент распределения памяти: на единицу настроенной памяти запрашивается `1/memoryAllocationRatio` памяти. |
| `resources.ephemeralStorageAllocationRatio` | `40` | Коэффициент распределения ephemeral storage: на единицу настроенного хранилища запрашивается `1/ephemeralStorageAllocationRatio` ephemeral storage. |

#### Внутренние поля

Эти поля автоматически управляются оператором Cozystack, их не следует изменять вручную.

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `sourceRef.kind` | `"OCIRepository"` | Тип ссылки на источник для пакета платформы. |
| `sourceRef.name` | `"cozystack-platform"` | Имя ссылки на источник. |
| `sourceRef.namespace` | `"cozy-system"` | Namespace ссылки на источник. |
| `sourceRef.path` | `"/"` | Путь ссылки на источник. |
| `migrations.enabled` | `false` | Включены ли миграции платформы. |
| `migrations.image` | — | Контейнерный образ, используемый для запуска миграций платформы. |
| `migrations.targetVersion` | — | Номер целевой версии миграции. |

[enable-disable]: {{% ref "/docs/v1.3/operations/configuration/components#enabling-and-disabling-components" %}}
[overwrite-parameters]: {{% ref "/docs/v1.3/operations/configuration/components#overwriting-component-parameters" %}}
[Resource Management]: {{% ref "/docs/v1.3/guides/resource-management#cpu-allocation-ratio" %}}
[oidc]: {{% ref "/docs/v1.3/operations/oidc" %}}
[telemetry]: {{% ref "/docs/v1.3/operations/configuration/telemetry" %}}
[kube-ovn]: https://kubeovn.github.io/docs/en/guide/subnet/#join-subnet
