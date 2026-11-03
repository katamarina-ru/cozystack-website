---
title: "Справочник Platform Package"
linkTitle: "Пакет платформы"
description: "Справочник по Cozystack Platform Package, который задает ключевые параметры конфигурации для установки и эксплуатации Cozystack."
weight: 10
aliases:
  - /docs/v1.7/install/cozystack/configmap
  - /docs/v1.7/operations/configuration/configmap
---

На этой странице описана роль Cozystack Platform Package и приведен полный справочник по его values.

Основная конфигурация Cozystack задается custom resource `Package`.
Этот Package включает [вариант Cozystack]({{% ref "/docs/v1.7/operations/configuration/variants" %}}), [настройки компонентов]({{% ref "/docs/v1.7/operations/configuration/components" %}}),
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
| `spec.variant` | Variant to use for installation (e.g., `isp-full`, `isp-full-generic`, `isp-hosted`, `isp-slim`, `isp-slim-generic`, `isp-hosted-slim`). |

### Platform values (`spec.components.platform.values.*`)

#### Публикация

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `publishing.host` | `"example.org"` | Основной домен для всех сервисов, создаваемых в Cozystack: dashboard, Grafana, Keycloak и других. |
| `publishing.apiServerEndpoint` | `""` | Используется для генерации kubeconfig-файлов для пользователей. Рекомендуется использовать маршрутизируемый FQDN или IP-адрес вместо адресов, доступных только локально. Пример: `"https://api.example.org"`. |
| `publishing.exposedServices` | `[api, dashboard, vm-exportproxy, cdi-uploadproxy]` | Список сервисов для публикации. Возможные значения: `api`, `dashboard`, `cdi-uploadproxy`, `vm-exportproxy`. |
| `publishing.ingressName` | `"tenant-root"` | Ingress controller, используемый для публикации сервисов. |
| `publishing.externalIPs` | `[]` | Список external IP, используемых указанным ingress controller. Если не задан, по умолчанию используется сервис LoadBalancer. |
| `publishing.ingressNameAdmin` | `""` | Имя **отдельного** административного ingress, к которому системные компоненты подключают свои административные маршруты (на данный момент только Keycloak) — например, привязанного к приватному IP и недоступного из интернета. На пути через Gateway значение — это namespace (для `Gateway` с именем `cozystack`); на пути через ingress-nginx это `ingressClassName`. Эти два варианта совпадают, потому что Cozystack называет каждый ingressClass по имени namespace тенанта. Пустое значение (по умолчанию) оставляет административные эндпоинты на `publishing.ingressName`. Два предостережения: Cozystack **не** создаёт административный Gateway — его нужно предварительно подготовить отдельно, иначе административные маршруты окажутся ни к чему не подключены; а также административные маршруты рендерятся только когда у Keycloak установлен `ingress.adminHost`, поэтому установка одного этого ключа сама по себе ничего не даёт. |
| `publishing.exposureClass.name` | `""` | Логическое имя кластерного ресурса `ExposureClass`, который нужно отрендерить. Пустое значение (по умолчанию) оставляет путь `publishing.externalIPs` без изменений. Когда значение задано, host ingress — при пустом `publishing.externalIPs` — публикует свой Service как `type: LoadBalancer`, а `cozystack-controller` транслирует класс в пул VIP выбранного backend и его анонсировщик. Это путь миграции с `Service.spec.externalIPs`, устаревшего начиная с Kubernetes v1.36 (KEP-5707). Удаление происходит поэтапно: feature gate `AllowServiceExternalIPs` поставляется включённым в v1.36, затем по умолчанию становится **false** (цель KEP: v1.40), после чего kube-proxy перестаёт программировать правила для этого поля — API всё ещё принимает его, поэтому Service выглядит здоровым, хотя трафик никуда не приходит. На последующих этапах gate блокируется в выключенном состоянии, а поддержка в kube-proxy полностью удаляется, и в итоге сам gate и admission-контроллер `DenyServiceExternalIPs` убираются. KEP указывает эти более поздние релизы как приблизительные, а объявление для v1.36 обещает лишь «будущий минорный релиз», поэтому переключение значения по умолчанию на false стоит воспринимать как дедлайн и мигрировать на класс **до** этого обновления, а не ориентироваться на конкретную версию. |
| `publishing.loadBalancerClass` | `""` | Native `loadBalancerClass` for the host ingress. When `publishing.externalIPs` is empty the host ingress publishes its Service as `type: LoadBalancer`; this is the `loadBalancerClass` of the LoadBalancer controller that should handle it. The admin provisions the matching address pool or announcer out of band (a MetalLB `IPAddressPool`, a Cilium LB-IPAM pool, a cloud LB). Empty (the default) lets the cluster's default LoadBalancer controller claim the Service. `spec.loadBalancerClass` is immutable: on a cluster whose host ingress Service already exists as `type: LoadBalancer`, setting, changing or clearing this value requires recreating that Service once. Until then the `ingress` HelmRelease in the host ingress namespace fails to reconcile, and its error carries the exact `kubectl delete service` command. With a non-empty `publishing.externalIPs` the host ingress Service stays `ClusterIP` and this value is ignored without an error. This is the migration path off `Service.spec.externalIPs`, deprecated in Kubernetes v1.36 (KEP-5707). The removal is phased: the `AllowServiceExternalIPs` feature gate ships enabled in v1.36, then defaults to **false** (KEP target: v1.40), at which point kube-proxy stops programming rules for the field — the API still accepts it, so the Service looks healthy while no traffic arrives. Later phases lock the gate off and strip kube-proxy's support outright, and finally drop the gate and the `DenyServiceExternalIPs` admission controller. The KEP gives those later releases as approximate and the v1.36 announcement commits only to "a future minor release", so treat the default flipping to false as the deadline and move the host ingress off `publishing.externalIPs` **before** that upgrade rather than planning against a specific version. |
| `publishing.ingressNameAdmin` | `""` | Name of a **separate** admin ingress that system components attach their admin routes to (currently only Keycloak) — for example one bound to a private IP and unreachable from the internet. On the Gateway path the value is a namespace (of a `Gateway` named `cozystack`); on the ingress-nginx path it is an `ingressClassName`. The two coincide because Cozystack names each ingressClass after its tenant namespace. Empty (the default) keeps admin endpoints on `publishing.ingressName`. Two caveats: Cozystack does **not** create the admin Gateway — provision it out of band first, or the admin routes attach to nothing; and the admin routes render only when Keycloak's `ingress.adminHost` is set, so setting this key alone is a no-op. |
| `publishing.certificates.solver` | `"http01"` | ACME challenge solver type for default letsencrypt issuer. Possible values: `http01`, `dns01`. |
| `publishing.certificates.issuerName` | `"letsencrypt-prod"` | `ClusterIssuer` name for TLS certificates used in system Helm releases. |
| `publishing.certificates.wildcard` | `false` | Opt-in shared wildcard certificate on the default ingress-nginx path (`gateway.enabled=false`). When `true` with `solver=dns01` and no `publishing.certificates.wildcardSecretName`, the platform issues one `*.<root-host>` + `<root-host>` `Certificate` via the DNS-01 `ClusterIssuer` and serves it as the ingress controller's default SSL certificate, so system services stop minting a per-host ACME certificate each — avoiding Let's Encrypt rate limits at scale, at parity with the Gateway API path. Ignored on `http01` (cannot issue wildcards) and when `gateway.enabled=true` (the `TenantGateway` controller issues the wildcard there). Enabling it feeds the issued Secret name into the same cluster values channel as `publishing.certificates.wildcardSecretName`, so it carries the same child-tenant hazard and the same open bug ([cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296)): every tenant's system ingresses drop their per-host ACME certificate cluster-wide, but the wildcard is served only by the publishing controller. A child tenant running its own ingress controller (`ingress: true`) is then left with no certificate and serves ingress-nginx's built-in self-signed one; an inheriting child on the shared controller instead gets a hostname mismatch, because a single-label `*.<root-host>` wildcard does not cover a nested `<service>.<tenant>.<root-host>` host or a custom `ingress.host` on another domain. Only enable it when every exposed host is covered and no child tenant runs its own ingress controller. Off by default so a `dns01` cluster is never switched silently on upgrade. |
| `publishing.certificates.wildcardSecretName` | `""` | Operator-provided wildcard TLS Secret. When set, platform services and the root tenant's ingress/Gateway serve this pre-existing Secret instead of minting per-host ACME certificates (only the NAME travels the values channel — never the key material), and this value takes precedence over `publishing.certificates.wildcard`. A `GatewayClass` listed in `gateway.edgeTerminatedClasses` outranks both: that tenant's Gateway serves no Secret at all. The Secret must exist in the publishing namespace (`tenant-root` by default), hold valid PEM under `tls.crt` / `tls.key` (created as `kubernetes.io/tls`, though only the material is validated), and cover the served hosts. **Scoped to the root tenant but not enforced** — the name reaches every tenant, so a child running its own ingress controller can be left serving a self-signed certificate ([cozystack/cozystack#3296](https://github.com/cozystack/cozystack/issues/3296)). See [Gateway API → Certificates]({{% ref "/docs/v1.7/networking/gateway-api#certificates" %}}) for the full behaviour and the three child-tenant cases. Leave empty to keep ACME issuance. |
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
| `publishing.serviceDomain` | `""` | DNS suffix the dashboard appends to the name of a LoadBalancer Service on the application **Services** tab, shown under the external IP as `<service-name>.<serviceDomain>` (for example `demo-external-write.svc.example.org` for a postgres release named `demo`). Display-only: nothing in the platform creates DNS records for it. Set it only when your DNS already resolves exactly that name to the Service's LoadBalancer IP, for example external-dns with a matching fqdn template. A CoreDNS `k8s_external` zone does not fit: it answers `<service>.<namespace>.<zone>`, which this suffix cannot express. This is not the `<release>.<tenant host>` name the app charts put into their certificates, so a TLS client may see a SAN mismatch unless DNS and certificates are aligned by the operator. The suffix is cluster-wide, so two tenants with a release of the same name get the same hostname. Empty (the default) shows no hostname. |
| `publishing.proxyProtocol` | `false` | Enables PROXY-protocol on the host ingress-nginx and auto-deploys [ouroboros]({{% ref "/docs/v1.7/networking/hairpin-proxy-protocol" %}}) to fix the resulting hairpin-NAT problem. The upstream L4 LB in front of ingress-nginx must already be injecting PROXY-v1 headers before this flag flips on; see the linked page for verification recipes and the disable path. |
| `publishing.proxyProtocolAcknowledgeUnclean` | `false` | Acknowledgement gate for the `helm.sh/resource-policy: keep` asymmetry on the host disable path. Flipping `publishing.proxyProtocol` from `true` back to `false` stops emitting the `cozystack.ouroboros` Package CR but does not uninstall the existing one — the platform render fails until either the Package CR is deleted (which triggers the chart's pre-delete cleanup hook) or this flag is set to `true` to confirm the operator has handled the asymmetry. See [hairpin-proxy-protocol → Disable path]({{% ref "/docs/v1.7/networking/hairpin-proxy-protocol#disable-path" %}}) for the full sequence. |

`publishing.exposure` is not listed above on purpose: the key existed in v1.4 only and was removed before v1.5 shipped. It still works on a v1.4 cluster, but has no effect from v1.5 onward — an empty `publishing.externalIPs` now yields the `LoadBalancer` Service on its own, and from v1.6 `publishing.loadBalancerClass` picks the controller that serves it. Drop the key when upgrading from v1.4 — and check what the host ingress Service becomes. A v1.4 cluster running `publishing.exposure: loadBalancer` had a `LoadBalancer` Service with `externalTrafficPolicy: Local`; from v1.5 the key is ignored, so a cluster with `publishing.externalIPs` set silently falls back to a `ClusterIP` Service with `externalTrafficPolicy: Cluster` and stops preserving client source IPs.

#### Networking

| Value | Default | Description |
| --- | --- | --- |
| `networking.clusterDomain` | `"cozy.local"` | Внутреннее доменное имя кластера. |
| `networking.podCIDR` | `"10.244.0.0/16"` | The pod subnet used by Pods to assign IPs. Used by Kube-OVN only: ignored on `isp-hosted` and the slim variants. On the Kube-OVN variants its last /21 is reserved for the router and Gateway API Ingress addresses of Cilium and Kube-OVN does not hand it out, so it needs a prefix of /20 or shorter. Each node takes a /29 of that /21, which caps these variants at 256 nodes. |
| `networking.podGateway` | `"10.244.0.1"` | The gateway address for the pod subnet. Kube-OVN only. |
| `networking.serviceCIDR` | `"10.96.0.0/16"` | The service subnet used by Services to assign IPs. Kube-OVN only. |
| `networking.joinCIDR` | `"100.64.0.0/16"` | The `join` subnet for network communication between the Node and Pod. Follow the [kube-ovn] documentation to learn more. Kube-OVN only. |
| `networking.kubeovn.MASTER_NODES` | `""` | Comma-separated list of KubeOVN master node IPs. By default, KubeOVN uses `lookup` to find control-plane nodes by label `node-role.kubernetes.io/control-plane`. On fresh clusters, lookup may return empty results. Set this to override. |
| `networking.stageCniPlugins` | unset (on) | Installs the upstream reference CNI plugins (`bridge`, `macvlan`, `ipvlan` and others) from the multus image into `/opt/cni/bin` on every node, so Multus NetworkAttachmentDefinitions can delegate to them. Talos ships only some of them and generic Linux gives no guarantee at all. Unset means on; set `false` for nodes whose `/opt/cni/bin` is managed by something else. Accepted spellings are `true`/`yes`/`on`/`1` and `false`/`no`/`off`/`0`, and anything else stops the whole platform render. When on, the plugins are rewritten every time the Multus pod is recreated. |
| `networking.multus.resources` | unset | Resources of the `kube-multus` container, merged over the multus chart defaults: requests of `100m` CPU and `100Mi` memory, a `4Gi` memory limit and no CPU limit. Unset keeps the defaults. A value that is not a map stops the platform render, and the multus release refuses to render without a memory limit and a memory request. |
| `networking.encryption.enabled` | `false` | Opt-in encryption of pod-to-pod traffic that crosses nodes, at the network layer and whether or not the workload speaks TLS. On `isp-full` and `isp-full-generic`, where Kube-OVN owns the datapath, it turns on Kube-OVN IPsec for the Geneve overlay; Kube-OVN provisions the IPsec CA and the per-node certificates itself through the Kubernetes CSR API, so no cert-manager setup is needed. `isp-slim` and `isp-slim-generic` refuse it and fail the platform render, because their Cilium-only datapath has no encryption wiring yet. On `isp-hosted` and `isp-hosted-slim`, where Cozystack does not manage the CNI, it has no effect. Traffic between pods on the same node is not tunneled and stays unencrypted. The ESP overhead lowers the effective MTU, so east-west throughput drops and latency rises, most for high-bandwidth flows. Turning it on for an existing cluster rolls out the CNI components. It complements TLS on exposed endpoints and does not replace it: no external client and no tenant certificate is involved. |

#### Bundles

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `bundles.system.enabled` | `false` | Enable the system bundle. Managed by the operator based on `spec.variant`. |
| `bundles.system.variant` | `"isp-full"` | System bundle variant. Options: `isp-full`, `isp-full-generic`, `isp-hosted`, `isp-slim`, `isp-slim-generic`, `isp-hosted-slim`. Managed by the operator based on `spec.variant`. |
| `bundles.iaas.enabled` | `false` | Enable the IaaS bundle. Managed by the operator based on `spec.variant`. |
| `bundles.paas.enabled` | `false` | Enable the PaaS bundle. Managed by the operator based on `spec.variant`. |
| `bundles.naas.enabled` | `false` | Enable the NaaS bundle. Managed by the operator based on `spec.variant`. |
| `bundles.enabledPackages` | `[]` | List of optional bundle components to include in the installation. Read more in ["How to enable and disable bundle components"][enable-disable]. |
| `bundles.disabledPackages` | `[]` | List of bundle components to exclude from the installation. Read more in ["How to enable and disable bundle components"][enable-disable]. |

#### Аутентификация

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `authentication.oidc.enabled` | `false` | Enable [OIDC][oidc] feature in Cozystack. |
| `authentication.oidc.insecureSkipVerify` | `false` | Skip TLS certificate verification for the OIDC provider. |
| `authentication.oidc.keycloakExtraRedirectUri` | `""` | Additional redirect URI for Keycloak OIDC client. |
| `authentication.oidc.realmName` | `"cozy"` | Name of the Keycloak realm that holds the Cozystack clients and the cluster-admin roles. `keycloak-configure` creates the realm under this name, and the dashboard, linstor-gui, the generated kubeconfig and the derived `keycloakInternalUrl` point at `/realms/<realmName>`. The OIDC issuer of the management cluster's API server is configured outside this Package, through the talm `oidcIssuerUrl`, and must name the same realm, or the tokens issued here are rejected. The value must be a quoted string of letters, digits, `.`, `_` and `-` that starts with a letter or digit, and `master` is refused because that realm holds the Keycloak super-admin; any other value fails the platform render. Set it at install time. Changing it on a running cluster does not rename the realm: a new, empty realm is created under the new name and every account, session and client in the old one is left behind. |
| `authentication.oidc.keycloakInternalUrl` | `null` | Internal URL for backend-to-backend requests to Keycloak. The dashboard's oauth2-proxy skips OIDC discovery and sends token, JWKS, userinfo and logout requests to this URL, while browser redirects keep the external URL. Left unset, it is derived from `realmName` as `http://keycloak-http.cozy-keycloak.svc:8080/realms/<realmName>`. An empty string `""` restores full OIDC discovery against the external issuer. Any other value is used as is, so an explicit URL has to name the same realm as `realmName`. |

#### Gateway

Общеплатформенная интеграция Gateway API. Фактический per-tenant Gateway создаётся только для тенантов, которые явно включают его через `tenant.spec.gateway: true` (обычно `tenant-root` плюс любой тенант, которому нужен собственный LB IP, кастомный apex или отдельный ACME-аккаунт). Все остальные тенанты в дереве публикуются через Gateway ближайшего предка, который им владеет — так же, как наследование `_namespace.ingress`. Полную архитектуру и путь миграции см. в [руководстве по Gateway API]({{% ref "/docs/v1.7/networking/gateway-api" %}}).

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `gateway.enabled` | `false` | Enable Gateway API support across the platform. When `true`, cert-manager `ClusterIssuer`s use an `http01.gatewayHTTPRoute` solver attached to the publishing tenant's Gateway, and exposed services (`dashboard`, `keycloak`, `grafana`, `alerta`, `harbor`, `bucket`, `cozystack-api`, `vm-exportproxy`, `cdi-uploadproxy`) render `HTTPRoute`/`TLSRoute` instead of `Ingress`. Materialising the actual per-tenant Gateway still requires an owning tenant to set `tenant.spec.gateway: true`. |
| `gateway.http2` | `true` | Advertise HTTP/2 via TLS ALPN (`h2`, then `http/1.1`) on every Gateway API listener served by the bundled Cilium dataplane. Browsers negotiate HTTP/2 exclusively through ALPN, so with this off every client silently falls back to HTTP/1.1 — the pre-Gateway ingress-nginx path advertised `h2` out of the box, hence on by default. Affects only the client↔gateway hop: gateway↔backend connections stay HTTP/1.1 unless a `Service` opts in per [GEP-1911](https://gateway-api.sigs.k8s.io/geps/gep-1911/) by declaring `appProtocol: kubernetes.io/h2c` on its port (that backend-protocol support is switched on together with ALPN). Maps to Cilium's cluster-wide `enable-gateway-api-alpn` agent setting, so it covers the root and all tenant Gateways at once, with no per-Gateway granularity; only effective on bundles where Cozystack manages Cilium (`isp-full`, `isp-full-generic`, `isp-slim`, `isp-slim-generic`). Flipping it re-rolls the `cilium` DaemonSet on the next platform upgrade, the same disruption profile as any other Cilium config change. |
| `gateway.className` | `"cilium"` | The `GatewayClass` every tenant Gateway uses unless the tenant names another one via `tenant.spec.gatewayClass`. Nothing checks the name against the classes the cluster has installed — a name no controller claims produces a `Gateway` that is created but never programmed, surfacing as `Ready=False` with reason `GatewayNotAccepted` on the `TenantGateway`. Changing it while a tenant pins the outgoing name fails that tenant's gateway release, because the set a tenant may name is built from the *current* default; add the outgoing class to `gateway.tenantSelectableClasses` first. |
| `gateway.tenantSelectableClasses` | `[]` | Additional `GatewayClass` names a tenant may select for its own Gateway with `tenant.spec.gatewayClass`. The set a tenant may name is this list plus the current `gateway.className`, so a tenant may always name the default explicitly; anything else fails that tenant's own gateway release at render time, naming the class and the allowed set, and reaches no other tenant. Empty means no tenant can pick anything but the default. The allowlist exists because `Tenant` is tenant-writable while a `GatewayClass` is cluster-scoped. |
| `gateway.edgeTerminatedClasses` | `[]` | `GatewayClass` names whose provider terminates TLS upstream of the Gateway. Membership here is the only thing that puts a tenant into `edge` cert mode, which renders port-80 listeners only and issues no `Issuer` and no `Certificate`; it wins over `publishing.certificates.wildcardSecretName` and over the solver. Nothing verifies the assertion — listing a class whose provider does *not* terminate TLS makes its Gateways serve every application hostname over plain HTTP, with no redirect and no certificate. Setting `gateway.className` to a class in this list also puts the publishing tenant on it, which unpublishes whichever of the TLS-passthrough endpoints (Kubernetes API, VM export, CDI upload) are published at all — each renders its `TLSRoute` only when `gateway.enabled` is on and its name is in `publishing.exposedServices`. Nothing fails at render time and nothing reports it: the controller writes no route conditions in this mode and removes none, so an orphaned `TLSRoute` can still show the `Accepted=True` it was given under the previous mode. |
| `gateway.attachedNamespaces` | (see below) | Namespaces whose `HTTPRoute` / `TLSRoute` resources should publish through the owning tenant Gateway. The controller patches `namespace.cozystack.io/gateway = <owner>` onto each listed namespace so its routes pass the HTTPS and TLS-passthrough listeners' `allowedRoutes` label selector. The port-80 HTTP listener uses a separate, narrower whitelist (`<owner-tenant-ns>` and `cozy-cert-manager` only) and does NOT admit routes from `attachedNamespaces` — except on an edge-terminated class, which renders no HTTPS or passthrough listeners and gives its port-80 listeners the same wide selector, so routes from `attachedNamespaces` do bind them. The publishing tenant's own namespace and descendants are admitted via the same label written by the tenant chart. Tenant namespaces (`tenant-*`) may be listed too — they simply pick up the gateway-attach label alongside the `cozy-*` system namespaces. The `default` namespace is included by default because the Kubernetes API `TLSRoute` lives next to the `kubernetes` Service in `default`. |

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

#### Monitoring

| Value | Default | Description |
| --- | --- | --- |
| `monitoring.rootEnabled` | `true` | Whether the root tenant hosts the platform metrics and logs stack, that is, whether `Tenant/root` has `spec.monitoring: true`. When `true`, the platform creates the `ExternalName` Services in `cozy-monitoring` that redirect metrics and logs into `tenant-root`. Nothing sets `spec.monitoring` on the root Tenant from this value: set it to match the root Tenant. With `true` while the root tenant has monitoring disabled, the redirects lead nowhere and fluent-bit silently drops logs. The default `true` keeps the earlier behaviour of always creating them; the slim variants (`isp-slim`, `isp-slim-generic`, `isp-hosted-slim`) default to `false`. |
| `monitoring.tracingCentralTenantBytesPerSecond` | `0` | The rate, in bytes per second counted uncompressed and before sampling, at which each tenant using shared-central tracing may write into the traces store that `tenant-root` hosts. Each tenant's collector refuses data above it: an OTLP/HTTP sender gets a `429` and retries, while an OTLP/gRPC sender gets `RESOURCE_EXHAUSTED` and drops the spans, so central tenants should export over HTTP. An OTLP/HTTP request larger than 3 MiB gets a `400` and is not retried. `0` keeps the default of about 97 KiB/s, at which one tenant alone cannot fill the disk cap of a default 10Gi store within the two days VictoriaTraces always keeps, so a larger store needs the rate raised with it. The value must be a whole number of bytes per second, or a string of plain decimal digits, up to `1099511627776` (1 TiB/s); anything else, such as `"1Mi"` or `1.5`, fails the platform render. Each collector pod starts with a full bucket, so a pod start lets through up to 5 MiB above the rate, or one second of the pod's share of the rate when that is larger. The rate bounds each tenant, not the sum of all tenants. A change upgrades every release in every tenant once, since it travels in the `cozystack-values` Secret they all read. |

#### Backup storage

| Value | Default | Description |
| --- | --- | --- |
| `backupStorage` | `{}` | Координаты S3 для управляемого платформой класса резервного копирования `cozy-default` (BackupClass). Весь этот блок передаётся в компонент `backupstrategy-controller` и глубоко объединяется (deep-merge) со значениями по умолчанию из чарта; ключи включают `provisionBucket`, `bucketName`, `endpoint`, `region`, `forcePathStyle`, `systemSecretName` и `systemNamespaces`. См. [Классы резервного копирования]({{% ref "/docs/v1.7/operations/services/backup-classes" %}}) для подробного описания каждого параметра. |
| `backupStrategyController` | `{}` | Overrides for the backup strategy objects the platform ships, forwarded as is into the `backupstrategy-controller` component as its `backupStrategyController` values. The knob that needs it is `redisBackupResources`, the requests and limits of the Pod the Redis strategy runs. The restore side holds the whole dataset in memory and writes it to ephemeral storage, so a large Redis needs more memory and `ephemeral-storage` than the defaults, which suit small and medium instances. The `cozy-default-redis` strategy is managed by Helm and a direct edit is reverted on upgrade, so raise the values here. Empty forwards nothing. |

Example under `spec.components.platform.values`:

```yaml
backupStrategyController:
  redisBackupResources:
    requests:
      memory: 2Gi
      ephemeral-storage: 8Gi
    limits:
      memory: 4Gi
      ephemeral-storage: 16Gi
```


#### Брендинг

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `branding` | `{}` | Объект конфигурации UI branding. Доступные поля и использование описаны в руководстве [White Labeling]({{% ref "/docs/v1.7/operations/configuration/white-labeling" %}}). У отдельных полей, например `titleText`, `logoSvg`, есть собственные значения по умолчанию, если они не заданы. |

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

| Value | Default | Description |
| --- | --- | --- |
| `kubevirt.disabledFeatureGates` | `[]` | KubeVirt feature gates to switch off, on top of the ones the platform disables itself (`Template`, `ExternalNetResourceInjection`, and `ImageVolume` on Kubernetes older than 1.35). KubeVirt enables every Beta gate by default; list a gate here when the cluster cannot carry it, for example `ImageVolume` on a container runtime without image volume support. A gate the platform enables cannot be switched off here: the render stops and names the gate. |
| `resources.cpuAllocationRatio` | `10` | CPU allocation ratio: на 1 vCPU запрашивается `1/cpuAllocationRatio` CPU. Подробное объяснение и примеры см. в [Resource Management]. |
| `resources.memoryAllocationRatio` | `1` | Memory allocation ratio: на единицу настроенной памяти запрашивается `1/memoryAllocationRatio` памяти. |
| `resources.ephemeralStorageAllocationRatio` | `40` | Ephemeral storage allocation ratio: на единицу настроенного хранилища запрашивается `1/ephemeralStorageAllocationRatio` ephemeral storage. |

#### Внутренние поля

```yaml
kubevirt:
  migrations:
    bandwidthPerMigration: 625M
    parallelMigrationsPerCluster: 2
    parallelOutboundMigrationsPerNode: 1
```

`bandwidthPerMigration` is a quantity in bytes per second: `625M` is 625,000,000 bytes/s (5 Gbit/s) per migration. This example allows up to two migrations across the cluster and one outbound migration per node.

#### Kubernetes worker images

| Value | Default | Description |
| --- | --- | --- |
| `kubernetesWorkerImage` | `{}` | Values for the optional `cozystack.kubernetes-worker-image` package, forwarded as is into that component. The package keeps a catalog of golden Talos worker OS images as DataVolumes in the `cozy-public` namespace, and a `KubernetesNodes` pool that sets `osImage.builtin` boots its workers from a storage-level clone of one instead of each worker importing the image from the Talos Image Factory. The package is opt-in: add `cozystack.kubernetes-worker-image` to `bundles.enabledPackages`, since this key alone does not enable it. Empty forwards nothing and keeps the chart defaults. |

The keys the package accepts:

| Key | Default | Description |
| --- | --- | --- |
| `imageFactoryURL` | `"https://factory.talos.dev"` | Base URL of the Talos Image Factory the golden images are imported from, without a trailing slash. Repoint it on an air-gapped or rate-limited cluster. |
| `storageClass` | `"replicated"` | StorageClass of the golden images. It must match the StorageClass of the worker disks that clone them, because CDI cannot clone across StorageClasses; a pool whose class differs fails its render. Use a class whose volumes are reachable from any node, in practice a replicated DRBD class: cloning on a node-pinned class is unsupported. |
| `storage` | `"6Gi"` | Size of each golden image. It must be at least the imported image size and at most the smallest worker disk that clones it. |
| `images` | one entry | The catalog, a list of entries with `schematicID` and `version` and optionally their own `imageFactoryURL`, `storage` and `storageClass`. Each entry becomes a golden named `talos-worker-<schematicID>-<version>`. |

A list set here replaces the shipped `images` list rather than extending it. A pool that names a `(schematicID, version)` pair missing from `images`, or one whose golden failed to import, fails its render rather than falling back to the HTTP import, so add an entry before any pool points at it. An entry is effectively immutable once its golden exists: its size, class and source URL cannot be patched in place, so treat a change to any of them as a new entry and move the pools onto it. Removing an entry stops managing its golden but does not delete it.

Example under `spec.components.platform.values`:

```yaml
bundles:
  enabledPackages:
    - cozystack.kubernetes-worker-image
kubernetesWorkerImage:
  imageFactoryURL: "https://factory.internal.example.org"
  images:
    - schematicID: "<schematicID>"
      version: "<talos version>"
```

#### Internal fields

| Значение | По умолчанию | Описание |
| --- | --- | --- |
| `sourceRef.kind` | `"OCIRepository"` | Kind source reference для platform package. |
| `sourceRef.name` | `"cozystack-platform"` | Имя source reference. |
| `sourceRef.namespace` | `"cozy-system"` | Namespace source reference. |
| `sourceRef.path` | `"/"` | Path source reference. |
| `migrations.enabled` | `false` | Включены ли platform migrations. |
| `migrations.image` | — | Container image, используемый для запуска platform migrations. |
| `migrations.targetVersion` | — | Номер целевой версии миграции. |

[enable-disable]: {{% ref "/docs/v1.7/operations/configuration/components#enabling-and-disabling-components" %}}
[overwrite-parameters]: {{% ref "/docs/v1.7/operations/configuration/components#overwriting-component-parameters" %}}
[Resource Management]: {{% ref "/docs/v1.7/guides/resource-management#cpu-allocation-ratio" %}}
[oidc]: {{% ref "/docs/v1.7/operations/oidc" %}}
[telemetry]: {{% ref "/docs/v1.7/operations/configuration/telemetry" %}}
[kube-ovn]: https://kubeovn.github.io/docs/en/guide/subnet/#join-subnet
