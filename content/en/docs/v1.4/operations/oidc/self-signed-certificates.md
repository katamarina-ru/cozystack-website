---
title: "Self-Signed Certificates"
linkTitle: "Самоподписанные сертификаты"
description: "Как настроить OIDC с self-signed certificates"
weight: 60
aliases:
  - /docs/oidc/self-signed-certificates
  - /docs/operations/oidc/self-signed-certificates
---

В этом руководстве описано, как настроить Kubernetes API server для OIDC authentication с Keycloak при использовании self-signed certificates. По умолчанию Cozystack выпускает certificates через LetsEncrypt, но в некоторых окружениях, например air-gapped или private enterprise networks, может использоваться custom CA.

## Предварительные требования

- Cozystack cluster с включенным OIDC (см. [Enable OIDC Server]({{% ref "/docs/v1.4/operations/oidc/enable_oidc" %}}))
- Control plane nodes на Talos Linux
- `talosctl`, настроенный для вашего кластера
- Установленный `kubelogin`

## Шаг 1: получите сертификат Keycloak

Получите certificate из ingress controller:

```bash
echo | openssl s_client -connect <KEYCLOAK_INGRESS_IP>:443 \
  -servername keycloak.example.org 2>/dev/null | openssl x509
```

Замените `<KEYCLOAK_INGRESS_IP>` на IP-адрес ingress controller, а `keycloak.example.org` - на фактический домен Keycloak.

Сохраните вывод (certificate между `-----BEGIN CERTIFICATE-----` и `-----END CERTIFICATE-----`) для следующего шага.

## Шаг 2: настройте Talos control plane nodes

Для каждого control plane node добавьте следующее в machine configuration:

```yaml
machine:
  network:
    extraHostEntries:
      - ip: <KEYCLOAK_INGRESS_IP>
        aliases:
          - keycloak.example.org
  files:
    - content: |
        -----BEGIN CERTIFICATE-----
        <YOUR_CERTIFICATE_CONTENT>
        -----END CERTIFICATE-----
      permissions: 0o644
      path: /var/oidc-ca.crt
      op: create

cluster:
  apiServer:
    extraArgs:
      oidc-issuer-url: https://keycloak.example.org/realms/cozy
      oidc-client-id: kubernetes
      oidc-username-claim: preferred_username
      oidc-groups-claim: groups
      oidc-ca-file: /etc/kubernetes/oidc/ca.crt
    extraVolumes:
      - hostPath: /var/oidc-ca.crt
        mountPath: /etc/kubernetes/oidc/ca.crt
```

Примените конфигурацию к каждому control plane node:

```bash
talosctl apply-config -n <NODE_IP> -f nodes/<node>.yaml
```

{{% alert color="info" %}}
Конфигурация `extraHostEntries` гарантирует, что домен Keycloak корректно резолвится внутри кластера, что важно при использовании internal ingress IPs.
{{% /alert %}}

## Опционально: настройте internal Keycloak URL для Dashboard

По умолчанию oauth2-proxy Cozystack Dashboard подключается к Keycloak через external ingress URL. В окружениях с self-signed certificates или ограниченным внешним доступом можно настроить dashboard на использование внутреннего cluster service Keycloak для backend requests (token exchange, JWKS validation, userinfo, logout), сохранив browser redirects на внешний URL.

Пропатчите Platform Package:

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=merge -p '{
  "spec": {
    "components": {
      "platform": {
        "values": {
          "authentication": {
            "oidc": {
              "keycloakInternalUrl": "http://keycloak-http.cozy-keycloak.svc:8080/realms/cozy"
            }
          }
        }
      }
    }
  }
}'
```

{{% alert color="info" %}}
Это влияет только на oauth2-proxy dashboard (pod-to-pod communication). Kubernetes API server все равно требует `extraHostEntries` для доступа к Keycloak, потому что `kube-apiserver` использует host-level DNS и не может резолвить cluster service names.
{{% /alert %}}

## Шаг 3: настройте kubelogin

Установите kubelogin, если он еще не установлен:

```bash
# Homebrew (macOS and Linux)
brew install int128/kubelogin/kubelogin

# Krew (macOS, Linux, Windows and ARM)
kubectl krew install oidc-login

# Chocolatey (Windows)
choco install kubelogin
```

Save the CA certificate from Step 1 to a file on your local machine:

```bash
# Save the certificate to a file (e.g., ~/.kube/oidc-ca.pem)
cat > ~/.kube/oidc-ca.pem <<EOF
-----BEGIN CERTIFICATE-----
<YOUR_CERTIFICATE_CONTENT>
-----END CERTIFICATE-----
EOF
```

Set up OIDC login (this will open a browser for authentication):

```bash
kubectl oidc-login setup \
  --oidc-issuer-url=https://keycloak.example.org/realms/cozy \
  --oidc-client-id=kubernetes \
  --certificate-authority=~/.kube/oidc-ca.pem
```

Configure kubectl credentials:

```bash
kubectl config set-credentials oidc \
  --exec-api-version=client.authentication.k8s.io/v1 \
  --exec-interactive-mode=IfAvailable \
  --exec-command=kubectl \
  --exec-arg=oidc-login \
  --exec-arg=get-token \
  --exec-arg="--oidc-issuer-url=https://keycloak.example.org/realms/cozy" \
  --exec-arg="--oidc-client-id=kubernetes" \
  --exec-arg="--certificate-authority=~/.kube/oidc-ca.pem"
```

Переключитесь на OIDC user и проверьте:

```bash
kubectl config set-context --current --user=oidc
kubectl get nodes
```

{{% alert color="info" %}}
Если CA вашей организации уже установлен в system trust store (часто встречается в enterprise environments), флаг `--certificate-authority` можно полностью опустить: kubelogin автоматически использует system CA bundle.
{{% /alert %}}

{{% alert color="warning" %}}
Избегайте `--insecure-skip-tls-verify`. Если вы не можете установить CA certificate на свою машину или передать его через `--certificate-authority`, можно временно использовать `--insecure-skip-tls-verify`, но это отключает TLS verification и не рекомендуется для production.
{{% /alert %}}

## Устранение неполадок

### Проверьте OIDC logs API Server

```bash
kubectl logs -n kube-system -l component=kube-apiserver --tail=50 | grep oidc
```

### Проверьте, что OIDC flags применены

```bash
kubectl get pods -n kube-system -l component=kube-apiserver \
  -o jsonpath='{.items[0].spec.containers[0].command}' | tr ',' '\n' | grep oidc
```

### Типичные проблемы

- **Certificate not found**: убедитесь, что path certificate file в `extraVolumes` совпадает с path, указанным в `oidc-ca-file`.
- **Domain resolution fails**: проверьте, что `extraHostEntries` корректно настроен на всех control plane nodes.
- **Authentication fails**: проверьте, что пользователь существует в Keycloak и состоит в нужных groups (см. [Users and Roles]({{% ref "/docs/v1.4/operations/oidc/users_and_roles" %}})).
