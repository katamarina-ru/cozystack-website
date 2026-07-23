---
title: "Справочник Platform Package"
linkTitle: "Пакет платформы"
description: "Справочник по Cozystack Platform Package, который задает ключевые параметры конфигурации для установки и эксплуатации Cozystack."
weight: 10
aliases:
  - /docs/v1.6/install/cozystack/configmap
  - /docs/v1.6/operations/configuration/configmap
---

На этой странице описана роль Cozystack Platform Package и приведен полный справочник по его values.

Основная конфигурация Cozystack задается custom resource `Package`.
Этот Package включает [вариант Cozystack]({{% ref "/docs/v1.6/operations/configuration/variants" %}}), [настройки компонентов]({{% ref "/docs/v1.6/operations/configuration/components" %}}),
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
| `publishing.host` | `"example.org"` | The main domain for all services created under Cozystack, such as the dashboard, Grafana, Keycloak, etc. |
| `publishing.apiServerEndpoint` | `""` | Used for generating kubeconfig files for your users. It is recommended to use a routable FQDN or IP address instead of local-only addresses. Example: `"https://api.example.org"`. |
| `publishing.exposedServices` | `[api, dashboard, vm-exportproxy, cdi-uploadproxy]` | List of services to expose. Possible values: `api`, `dashboard`, `cdi-uploadproxy`, `vm-exportproxy`. |
| `publishing.ingressName` | `"tenant-root"` | Ingress controller to use for exposing services. |
| `publishing.externalIPs` | `[]` | List of external IPs used for the specified ingress controller. If not specified, a LoadBalancer service is used by default. |
| `publishing.ingressNameAdmin` | `""` | Name of a **separate** admin ingress that system components attach their admin routes to (currently only Keycloak) — for example one bound to a private IP and unreachable from the internet. On the Gateway path the value is a namespace (of a `Gateway` named `cozystack`); on the ingress-nginx path it is an `ingressClassName`. The two coincide because Cozystack names each ingressClass after its tenant namespace. Empty (the default) keeps admin endpoints on `publishing.ingressName`. Two caveats: Cozystack does **not** create the admin Gateway — provision it out of band first, or the admin routes attach to nothing; and the admin routes render only when Keycloak's `ingress.adminHost` is set, so setting this key alone is a no-op. |
| `publishing.exposureClass.name` | `""` | Logical name of the cluster-scoped `ExposureClass` to render. Empty (the default) leaves the `publishing.externalIPs` path untouched. When set, the host ingress — with `publishing.externalIPs` empty — publishes its Service as `type: LoadBalancer`, and `cozystack-controller` translates the class into the chosen backend's VIP pool and announcer. This is the migration path off `Service.spec.externalIPs`, deprecated in Kubernetes v1.36 (KEP-5707). The removal is phased: the `AllowServiceExternalIPs` feature gate ships enabled in v1.36, then defaults to **false** (KEP target: v1.40), at which point kube-proxy stops programming rules for the field — the API still accepts it, so the Service looks healthy while no traffic arrives. Later phases lock the gate off and strip kube-proxy's support outright, and finally drop the gate and the `DenyServiceExternalIPs` admission controller. The KEP gives those later releases as approximate and the v1.36 announcement commits only to "a future minor release", so treat the default flipping to false as the deadline and migrate onto a class **before** that upgrade rather than planning against a specific version. |
| `publishing.exposureClass.backend` | `"externalIPs"` | LoadBalancer mechanism behind the class. `externalIPs` pins node IPs with no pool or announcer (the historical behaviour); `metallb` renders an `IPAddressPool` + `L2Advertisement`; `cilium` renders a `CiliumLoadBalancerIPPool` + `CiliumL2AnnouncementPolicy`; `robotlb` uses a cloud (Hetzner) load balancer, where allocation and announcement happen off-cluster. Once `publishing.exposureClass.name` is set, a pool or cloud backend (`metallb`, `cilium`, `robotlb`) is mutually exclusive with a non-empty `publishing.externalIPs` — the platform render fails with an explicit error rather than shipping the dead end, because the host ingress Service would stay `ClusterIP` + `externalIPs`, never become `type: LoadBalancer`, and the allocated pool would go unused. |
| `publishing.exposureClass.addresses` | `[]` | VIP CIDRs or `start-end` ranges for the pool-backed backends (`metallb`, `cilium`). |
| `publishing.exposureClass.l2` | `true` | L2 (ARP / NDP) announcement for the bare-metal backends. |
| `publishing.exposureClass.isDefault` | `true` | Make this the class used by any `ServiceExposure` that names none. A `ServiceExposure` is the cluster-internal resource `cozystack-controller` reconciles to publish a Service through the class's backend; workloads do not create one directly. Because this defaults to `true`, hand-creating a second `ExposureClass` without clearing its default flag leaves two default classes, and the controller then fails every unnamed `ServiceExposure` with `AmbiguousDefaultClass` — keep exactly one default. |
| `publishing.certificates.solver` | `"http01"` | ACME challenge solver type for default letsencrypt issuer. Possible values: `http01`, `dns01`. |
| `publishing.certificates.issuerName` | `"letsencrypt-prod"` | `ClusterIssuer` name for TLS certificates used in system Helm releases. |
| `publishing.certificates.wildcard` | `false` | Opt-in shared wildcard certificate on the default ingress-nginx path (`gateway.enabled=false`). When `true` with `solver=dns01` and no `publishing.certificates.wildcardSecretName`, the platform issues one `*.<root-host>` + `<root-host>` `Certificate` via the DNS-01 `ClusterIssuer` and serves it as the ingress controller's default SSL certificate, so system services stop minting a per-host ACME certificate each — avoiding Let's Encrypt rate limits at scale, at parity with the Gateway API path. Ignored on `http01` (cannot issue wildcards) and when `gateway.enabled=true` (the `TenantGateway` controller issues the wildcard there). Enabling it feeds the issued Secret name into the same cluster values channel as `publishing.certificates.wildcardSecretName`, so it carries the same child-tenant hazard and the same open bug ([cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296)): every tenant's system ingresses drop their per-host ACME certificate cluster-wide, but the wildcard is served only by the publishing controller. A child tenant running its own ingress controller (`ingress: true`) is then left with no certificate and serves ingress-nginx's built-in self-signed one; an inheriting child on the shared controller instead gets a hostname mismatch, because a single-label `*.<root-host>` wildcard does not cover a nested `<service>.<tenant>.<root-host>` host or a custom `ingress.host` on another domain. Only enable it when every exposed host is covered and no child tenant runs its own ingress controller. Off by default so a `dns01` cluster is never switched silently on upgrade. |
| `publishing.certificates.wildcardSecretName` | `""` | Operator-provided wildcard TLS Secret. When set, platform services and the root tenant's ingress/Gateway serve this pre-existing Secret instead of minting per-host ACME certificates (only the NAME travels the values channel — never the key material), and takes precedence over `publishing.certificates.wildcard`. The Secret must exist in the publishing namespace (`tenant-root` by default), hold valid PEM under `tls.crt` / `tls.key` (created as `kubernetes.io/tls`, though only the material is validated), and cover the served hosts. **Scoped to the root tenant but not enforced** — the name reaches every tenant, so a child running its own ingress controller can be left serving a self-signed certificate ([cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296)). See [Gateway API → Certificates]({{% ref "/docs/v1.6/networking/gateway-api#certificates" %}}) for the full behaviour and the three child-tenant cases. Leave empty to keep ACME issuance. |
| `publishing.certificates.dns01.provider` | `"cloudflare"` | DNS-01 provider when `solver=dns01`. Possible values: `cloudflare`, `route53`, `digitalocean`, `rfc2136`. Both the per-tenant Issuer (rendered by `cozystack-controller` from the `TenantGateway` CR) and the cluster-wide `letsencrypt-prod` / `letsencrypt-stage` `ClusterIssuer`s used by the legacy ingress flow read this. |
| `publishing.certificates.dns01.cloudflare.secretName` | `"cloudflare-api-token-secret"` | Secret name holding a Cloudflare API token with `Zone:Read` + `Zone:DNS:Edit` on the apex zone. |
| `publishing.certificates.dns01.cloudflare.secretKey` | `"api-token"` | Key inside the Secret holding the API token. |
| `publishing.certificates.dns01.route53.region` | `""` | AWS region of the Route53 hosted zone. Required when `provider=route53`. |
| `publishing.certificates.dns01.route53.accessKeyID` | `""` | IAM access key ID. Optional when running with IRSA / instance profile. |
| `publishing.certificates.dns01.route53.secretName` | `""` | Secret name holding the IAM secret access key. Optional when running with IRSA / instance profile. |
| `publishing.certificates.dns01.route53.secretKey` | `"secret-access-key"` | Key inside the Route53 Secret holding the secret access key. |
| `publishing.certificates.dns01.digitalocean.secretName` | `"digitalocean-api-token-secret"` | Secret name holding a DigitalOcean API token with write access to the apex domain. |
| `publishing.certificates.dns01.digitalocean.secretKey` | `"access-token"` | Key inside the Secret holding the DigitalOcean token. |
| `publishing.certificates.dns01.rfc2136.nameserver` | `""` | `host:port` of the authoritative nameserver accepting RFC 2136 dynamic updates. Required when `provider=rfc2136`. |
| `publishing.certificates.dns01.rfc2136.tsigKeyName` | `""` | TSIG key name authorising the dynamic updates. Required when `provider=rfc2136`. |
| `publishing.certificates.dns01.rfc2136.tsigAlgorithm` | `"HMACSHA256"` | TSIG HMAC algorithm. |
| `publishing.certificates.dns01.rfc2136.secretName` | `""` | Secret name holding the TSIG key material. Required when `provider=rfc2136`. |
| `publishing.certificates.dns01.rfc2136.secretKey` | `"tsig-secret-key"` | Key inside the Secret holding the TSIG key. |
| `publishing.proxyProtocol` | `false` | Enables PROXY-protocol on the host ingress-nginx and auto-deploys [ouroboros]({{% ref "/docs/v1.6/networking/hairpin-proxy-protocol" %}}) to fix the resulting hairpin-NAT problem. The upstream L4 LB in front of ingress-nginx must already be injecting PROXY-v1 headers before this flag flips on; see the linked page for verification recipes and the disable path. |
| `publishing.proxyProtocolAcknowledgeUnclean` | `false` | Acknowledgement gate for the `helm.sh/resource-policy: keep` asymmetry on the host disable path. Flipping `publishing.proxyProtocol` from `true` back to `false` stops emitting the `cozystack.ouroboros` Package CR but does not uninstall the existing one — the platform render fails until either the Package CR is deleted (which triggers the chart's pre-delete cleanup hook) or this flag is set to `true` to confirm the operator has handled the asymmetry. See [hairpin-proxy-protocol → Disable path]({{% ref "/docs/v1.6/networking/hairpin-proxy-protocol#disable-path" %}}) for the full sequence. |

`publishing.exposure` is not listed above on purpose: the key existed in v1.4 only and was removed before v1.5 shipped. It still works on a v1.4 cluster, but has no effect from v1.5 onward — `publishing.exposureClass` is its successor. Drop the key when upgrading from v1.4 — and check what the host ingress Service becomes. A v1.4 cluster running `publishing.exposure: loadBalancer` had a `LoadBalancer` Service with `externalTrafficPolicy: Local`; from v1.5 the key is ignored, so a cluster with `publishing.externalIPs` set silently falls back to a `ClusterIP` Service with `externalTrafficPolicy: Cluster` and stops preserving client source IPs.

#### Сеть

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `networking.clusterDomain` | `"cozy.local"` | Внутреннее доменное имя кластера. |
| `networking.podCIDR` | `"10.244.0.0/16"` | Pod-подсеть, из которой Pods получают IP-адреса. |
| `networking.podGateway` | `"10.244.0.1"` | Адрес gateway для pod-подсети. |
| `networking.serviceCIDR` | `"10.96.0.0/16"` | Service-подсеть, из которой Services получают IP-адреса. |
| `networking.joinCIDR` | `"100.64.0.0/16"` | Подсеть `join` для сетевого взаимодействия между Node и Pod. Подробнее см. в документации [kube-ovn]. |
| `networking.kubeovn.MASTER_NODES` | `""` | Разделённый запятыми список IP-адресов master-узлов KubeOVN. По умолчанию KubeOVN использует `lookup`, чтобы найти control-plane-узлы по label `node-role.kubernetes.io/control-plane`. На новых кластерах lookup может вернуть пустой результат. Задайте это значение, чтобы переопределить поведение. |

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

#### Gateway

Общеплатформенная интеграция Gateway API. Фактический per-tenant Gateway создаётся только для тенантов, которые явно включают его через `tenant.spec.gateway: true` (обычно `tenant-root` плюс любой тенант, которому нужен собственный LB IP, кастомный apex или отдельный ACME-аккаунт). Все остальные тенанты в дереве публикуются через Gateway ближайшего предка, который им владеет — так же, как наследование `_namespace.ingress`. Полную архитектуру и путь миграции см. в [руководстве по Gateway API]({{% ref "/docs/v1.6/networking/gateway-api" %}}).

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `gateway.enabled` | `false` | Enable Gateway API support across the platform. When `true`, cert-manager `ClusterIssuer`s use an `http01.gatewayHTTPRoute` solver attached to the publishing tenant's Gateway, and exposed services (`dashboard`, `keycloak`, `grafana`, `alerta`, `harbor`, `bucket`, `cozystack-api`, `vm-exportproxy`, `cdi-uploadproxy`) render `HTTPRoute`/`TLSRoute` instead of `Ingress`. Materialising the actual per-tenant Gateway still requires an owning tenant to set `tenant.spec.gateway: true`. |
| `gateway.http2` | `true` | Advertise HTTP/2 via TLS ALPN (`h2`, then `http/1.1`) on every Gateway API listener served by the bundled Cilium dataplane. Browsers negotiate HTTP/2 exclusively through ALPN, so with this off every client silently falls back to HTTP/1.1 — the pre-Gateway ingress-nginx path advertised `h2` out of the box, hence on by default. Affects only the client↔gateway hop: gateway↔backend connections stay HTTP/1.1 unless a `Service` opts in per [GEP-1911](https://gateway-api.sigs.k8s.io/geps/gep-1911/) by declaring `appProtocol: kubernetes.io/h2c` on its port (that backend-protocol support is switched on together with ALPN). Maps to Cilium's cluster-wide `enable-gateway-api-alpn` agent setting, so it covers the root and all tenant Gateways at once, with no per-Gateway granularity; only effective on bundles where Cozystack manages Cilium (`isp-full`, `isp-full-generic`). Flipping it re-rolls the `cilium` DaemonSet on the next platform upgrade, the same disruption profile as any other Cilium config change. |
| `gateway.attachedNamespaces` | (see below) | Namespaces whose `HTTPRoute` / `TLSRoute` resources should publish through the owning tenant Gateway. The controller patches `namespace.cozystack.io/gateway = <owner>` onto each listed namespace so its routes pass the HTTPS and TLS-passthrough listeners' `allowedRoutes` label selector. The port-80 HTTP listener uses a separate, narrower whitelist (`<owner-tenant-ns>` and `cozy-cert-manager` only) and does NOT admit routes from `attachedNamespaces`. The publishing tenant's own namespace and descendants are admitted via the same label written by the tenant chart. Tenant namespaces (`tenant-*`) may be listed too — they simply pick up the gateway-attach label alongside the `cozy-*` system namespaces. The `default` namespace is included by default because the Kubernetes API `TLSRoute` lives next to the `kubernetes` Service in `default`. |

`gateway.attachedNamespaces` по умолчанию:

```yaml
gateway:
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

#### Планирование

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `scheduling.globalAppTopologySpreadConstraints` | `""` | Глобальные pod topology spread constraints, применяемые ко всем managed applications. |

#### Backup storage

| Value | Default | Description |
| --- | --- | --- |
| `backupStorage` | `{}` | S3 coordinates for the platform-managed `cozy-default` BackupClass. The whole block is forwarded into the `backupstrategy-controller` component and deep-merged over its chart defaults; keys include `provisionBucket`, `bucketName`, `endpoint`, `region`, `forcePathStyle`, `systemSecretName`, and `systemNamespaces`. See [Backup Classes]({{% ref "/docs/v1.6/operations/services/backup-classes" %}}) for the knob-by-knob reference. |

#### Брендинг

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `branding` | `{}` | Объект конфигурации UI branding. Доступные поля и использование описаны в руководстве [White Labeling]({{% ref "/docs/v1.6/operations/configuration/white-labeling" %}}). У отдельных полей, например `titleText`, `logoSvg`, есть собственные значения по умолчанию, если они не заданы. |

#### Registries

Конфигурация mirrors для container registry. Позволяет направлять image pulls через локальные mirrors.

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `registries.mirrors` | `{}` | Карта имён registry hostnames к mirror endpoints. Каждая запись сопоставляет registry, например `docker.io`, со списком mirror endpoints. |
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

[enable-disable]: {{% ref "/docs/v1.6/operations/configuration/components#enabling-and-disabling-components" %}}
[overwrite-parameters]: {{% ref "/docs/v1.6/operations/configuration/components#overwriting-component-parameters" %}}
[Resource Management]: {{% ref "/docs/v1.6/guides/resource-management#cpu-allocation-ratio" %}}
[oidc]: {{% ref "/docs/v1.6/operations/oidc" %}}
[telemetry]: {{% ref "/docs/v1.6/operations/configuration/telemetry" %}}
[kube-ovn]: https://kubeovn.github.io/docs/en/guide/subnet/#join-subnet
