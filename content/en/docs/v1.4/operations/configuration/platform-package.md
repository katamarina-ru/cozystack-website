---
title: "Справочник Platform Package"
linkTitle: "Пакет платформы"
description: "Справочник по Cozystack Platform Package, который задает ключевые параметры конфигурации для установки и эксплуатации Cozystack."
weight: 10
aliases:
  - /docs/v1.4/install/cozystack/configmap
  - /docs/v1.4/operations/configuration/configmap
---

На этой странице описана роль Cozystack Platform Package и приведен полный справочник по его values.

Основная конфигурация Cozystack задается custom resource `Package`.
Этот Package включает [вариант Cozystack]({{% ref "/docs/v1.4/operations/configuration/variants" %}}), [настройки компонентов]({{% ref "/docs/v1.4/operations/configuration/components" %}}),
ключевые сетевые параметры, опубликованные сервисы и другие опции.


## Пример

Ниже пример конфигурации для установки Cozystack с вариантом `isp-full`, root host `example.org`,
а также опубликованными и доступными пользователям Cozystack Dashboard и API:

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

### Поля уровня Package

| Поле | Описание |
| --- | --- |
| `spec.variant` | Вариант, используемый для установки, например `isp-full`, `isp-full-generic`, `isp-hosted`, `distro-full`. |

### Platform values (`spec.components.platform.values.*`)

#### Публикация

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `publishing.host` | `"example.org"` | Основной домен для всех сервисов, создаваемых в Cozystack: dashboard, Grafana, Keycloak и других. |
| `publishing.apiServerEndpoint` | `""` | Используется для генерации kubeconfig-файлов для пользователей. Рекомендуется использовать маршрутизируемый FQDN или IP-адрес вместо адресов, доступных только локально. Пример: `"https://api.example.org"`. |
| `publishing.exposedServices` | `[api, dashboard, vm-exportproxy, cdi-uploadproxy]` | Список сервисов для публикации. Возможные значения: `api`, `dashboard`, `cdi-uploadproxy`, `vm-exportproxy`. |
| `publishing.ingressName` | `"tenant-root"` | Ingress controller, используемый для публикации сервисов. |
| `publishing.externalIPs` | `[]` | Список external IP, используемых указанным ingress controller. Если не задан, по умолчанию используется сервис LoadBalancer. |
| `publishing.exposure` | `"externalIPs"` | Режим публикации Service ingress-nginx. Возможные значения: `externalIPs`, `loadBalancer`. Значение по умолчанию записывает `publishing.externalIPs` в `Service.spec.externalIPs`; `loadBalancer` переключает сервис на `Service.type: LoadBalancer` и создает `CiliumLoadBalancerIPPool` поверх тех же IP (с `externalTrafficPolicy: Local`, чтобы сохранить исходный IP клиента). `Service.spec.externalIPs` deprecated в upstream v1.36 (KEP-5707); планируйте переход на `loadBalancer` до обновления выше Kubernetes v1.40, когда feature gate `AllowServiceExternalIPs` будет отключен. Режим `loadBalancer` требует Cilium L2/BGP announcements, чтобы IP был доступен извне кластера (по умолчанию в cozystack отключено), и хотя бы один адрес в `publishing.externalIPs`, иначе render завершится ошибкой. |
| `publishing.certificates.solver` | `"http01"` | Тип ACME challenge solver для letsencrypt issuer по умолчанию. Возможные значения: `http01`, `dns01`. |
| `publishing.certificates.issuerName` | `"letsencrypt-prod"` | Имя `ClusterIssuer` для TLS-сертификатов, используемых в системных Helm releases. |
| `publishing.proxyProtocol` | `false` | Включает PROXY-protocol на host ingress-nginx и автоматически разворачивает [ouroboros]({{% ref "/docs/v1.4/networking/hairpin-proxy-protocol" %}}), чтобы исправить возникающую проблему hairpin-NAT. Upstream L4 LB перед ingress-nginx уже должен добавлять PROXY-v1 headers до включения этого флага; инструкции по проверке и отключению см. на связанной странице. |
| `publishing.proxyProtocolAcknowledgeUnclean` | `false` | Флаг подтверждения для асимметрии `helm.sh/resource-policy: keep` на пути отключения host. Переключение `publishing.proxyProtocol` с `true` обратно на `false` прекращает генерацию Package CR `cozystack.ouroboros`, но не удаляет уже существующий ресурс. Render platform будет падать, пока Package CR не будет удален (это запустит pre-delete cleanup hook chart) или пока этот флаг не будет установлен в `true`, подтверждая, что оператор обработал асимметрию. Полную последовательность см. в [hairpin-proxy-protocol -> Disable path]({{% ref "/docs/v1.4/networking/hairpin-proxy-protocol#disable-path" %}}). |

#### Сеть

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `networking.clusterDomain` | `"cozy.local"` | Внутреннее доменное имя кластера. |
| `networking.podCIDR` | `"10.244.0.0/16"` | Pod-подсеть, из которой Pods получают IP-адреса. |
| `networking.podGateway` | `"10.244.0.1"` | Адрес gateway для pod-подсети. |
| `networking.serviceCIDR` | `"10.96.0.0/16"` | Service-подсеть, из которой Services получают IP-адреса. |
| `networking.joinCIDR` | `"100.64.0.0/16"` | Подсеть `join` для сетевого взаимодействия между Node и Pod. Подробнее см. в документации [kube-ovn]. |
| `networking.kubeovn.MASTER_NODES` | `""` | Разделенный запятыми список IP-адресов master-узлов KubeOVN. По умолчанию KubeOVN использует `lookup`, чтобы найти control-plane-узлы по label `node-role.kubernetes.io/control-plane`. На новых кластерах lookup может вернуть пустой результат. Задайте это значение, чтобы переопределить поведение. |

#### Bundles

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `bundles.system.enabled` | `false` | Включить system bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.system.variant` | `"isp-full"` | Вариант system bundle. Варианты: `isp-full`, `isp-full-generic`, `isp-hosted`. Управляется оператором на основе `spec.variant`. |
| `bundles.iaas.enabled` | `false` | Включить IaaS bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.paas.enabled` | `false` | Включить PaaS bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.naas.enabled` | `false` | Включить NaaS bundle. Управляется оператором на основе `spec.variant`. |
| `bundles.enabledPackages` | `[]` | Список опциональных компонентов bundle, которые нужно включить в установку. Подробнее см. ["Как включать и отключать компоненты bundle"][enable-disable]. |
| `bundles.disabledPackages` | `[]` | Список компонентов bundle, которые нужно исключить из установки. Подробнее см. ["Как включать и отключать компоненты bundle"][enable-disable]. |

#### Аутентификация

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `authentication.oidc.enabled` | `false` | Включить функцию [OIDC][oidc] в Cozystack. |
| `authentication.oidc.insecureSkipVerify` | `false` | Пропускать проверку TLS-сертификата OIDC provider. |
| `authentication.oidc.keycloakExtraRedirectUri` | `""` | Дополнительный redirect URI для Keycloak OIDC client. |
| `authentication.oidc.keycloakInternalUrl` | `""` | Внутренний URL для backend-to-backend-запросов к Keycloak. Когда он задан, oauth2-proxy dashboard пропускает OIDC discovery и направляет запросы token, JWKS, userinfo и logout через этот URL, сохраняя browser redirects на внешний URL. Пример: `http://keycloak-http.cozy-keycloak.svc:8080/realms/cozy`. |

#### Планирование

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `scheduling.globalAppTopologySpreadConstraints` | `""` | Глобальные pod topology spread constraints, применяемые ко всем managed applications. |

#### Брендинг

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `branding` | `{}` | Объект конфигурации UI branding. Доступные поля и использование описаны в руководстве [White Labeling]({{% ref "/docs/v1.4/operations/configuration/white-labeling" %}}). У отдельных полей, например `titleText`, `logoSvg`, есть собственные значения по умолчанию, если они не заданы. |

#### Registries

Конфигурация mirrors для container registry. Позволяет направлять image pulls через локальные mirrors.

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `registries.mirrors` | `{}` | Карта имен registry hostnames к mirror endpoints. Каждая запись сопоставляет registry, например `docker.io`, со списком mirror endpoints. |
| `registries.config` | `{}` | Конфигурация для отдельных endpoints, например настройки TLS. |

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
| `resources.cpuAllocationRatio` | `10` | CPU allocation ratio: на 1 vCPU запрашивается `1/cpuAllocationRatio` CPU. Подробное объяснение и примеры см. в [Resource Management]. |
| `resources.memoryAllocationRatio` | `1` | Memory allocation ratio: на единицу настроенной памяти запрашивается `1/memoryAllocationRatio` памяти. |
| `resources.ephemeralStorageAllocationRatio` | `40` | Ephemeral storage allocation ratio: на единицу настроенного хранилища запрашивается `1/ephemeralStorageAllocationRatio` ephemeral storage. |

#### Внутренние поля

Этими полями автоматически управляет оператор Cozystack, их не следует изменять вручную.

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `sourceRef.kind` | `"OCIRepository"` | Kind source reference для platform package. |
| `sourceRef.name` | `"cozystack-platform"` | Имя source reference. |
| `sourceRef.namespace` | `"cozy-system"` | Namespace source reference. |
| `sourceRef.path` | `"/"` | Path source reference. |
| `migrations.enabled` | `false` | Включены ли platform migrations. |
| `migrations.image` | — | Container image, используемый для запуска platform migrations. |
| `migrations.targetVersion` | — | Номер целевой версии миграции. |

[enable-disable]: {{% ref "/docs/v1.4/operations/configuration/components#enabling-and-disabling-components" %}}
[overwrite-parameters]: {{% ref "/docs/v1.4/operations/configuration/components#overwriting-component-parameters" %}}
[Resource Management]: {{% ref "/docs/v1.4/guides/resource-management#cpu-allocation-ratio" %}}
[oidc]: {{% ref "/docs/v1.4/operations/oidc" %}}
[telemetry]: {{% ref "/docs/v1.4/operations/configuration/telemetry" %}}
[kube-ovn]: https://kubeovn.github.io/docs/en/guide/subnet/#join-subnet
