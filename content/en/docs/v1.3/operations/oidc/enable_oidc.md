---
title: "Включение OIDC Server"
linkTitle: "Сервер OIDC"
description: "Как включить OIDC Server"
weight: 36
aliases:
  - /docs/v1.3/oidc/enable_oidc
---

## Предварительные требования

1. **Конфигурация OIDC**
   API server должен быть настроен на использование OIDC. Если используется Talos Linux, machine configuration должна включать следующие параметры:

   ```yaml
   cluster:
     apiServer:
       extraArgs:
         oidc-issuer-url: "https://keycloak.example.org/realms/cozy"
         oidc-client-id: "kubernetes"
         oidc-username-claim: "preferred_username"
         oidc-groups-claim: "groups"
   ```

   **Для Talm**
   Добавьте в `values.yaml` в репозитории talm:
   ```yaml
   oidcIssuerUrl: "https://keycloak.<YOUR_ROOT_DOMAIN>/realms/cozy"
   ```

2. **Доступность домена**
   Убедитесь, что домен `keycloak.example.org` доступен из кластера и резолвится в root ingress controller.

3. **Конфигурация storage**
   Storage должен быть корректно настроен.

## Конфигурация

Если все предварительные требования выполнены, можно переходить к настройке.

### Шаг 1: включите OIDC в Cozystack

Пропатчите Platform Package, чтобы включить OIDC. Это также автоматически опубликует сервис Keycloak:

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=merge -p '{
  "spec": {
    "components": {
      "platform": {
        "values": {
          "authentication": {
            "oidc": {
              "enabled": true
            }
          }
        }
      }
    }
  }
}'
```

Если нужно добавить дополнительные redirect URLs для dashboard client (например, при доступе к dashboard через port-forwarding),
пропатчите Platform Package. Несколько redirect URLs разделяются запятыми.

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=merge -p '{
  "spec": {
    "components": {
      "platform": {
        "values": {
          "authentication": {
            "oidc": {
              "keycloakExtraRedirectUri": "http://127.0.0.1:8080/oauth2/callback/*,http://localhost:8080/oauth2/callback/*"
            }
          }
        }
      }
    }
  }
}'
```

{{% alert color="info" %}}
**Опционально**: если нужно, чтобы dashboard обращался к Keycloak через внутреннюю сеть кластера вместо external ingress, задайте `keycloakInternalUrl`. Это полезно в окружениях с self-signed certificates или ограниченным внешним доступом. Подробности см. в [Self-Signed Certificates]({{% ref "/docs/v1.3/operations/oidc/self-signed-certificates" %}}).
{{% /alert %}}

В течение минуты CozyStack выполнит reconcile и создаст три новых ресурса `HelmRelease`:

```bash
# kubectl get hr -n cozy-keycloak
cozy-keycloak                    keycloak                    26s    Unknown   Running 'install' action with a timeout of 5m0s
cozy-keycloak                    keycloak-configure          26s    False     dependency 'cozy-keycloak/keycloak-operator' is not ready
cozy-keycloak                    keycloak-operator           26s    False     dependency 'cozy-keycloak/keycloak' is not ready
```

### Шаг 2: дождитесь завершения установки

Дождитесь, пока все ресурсы успешно установятся и перейдут в состояние `Ready`:

```bash
NAME                 AGE     READY   STATUS
keycloak             2m19s   True    Release reconciliation succeeded
keycloak-configure   2m19s   True    Release reconciliation succeeded
keycloak-operator    2m19s   True    Release reconciliation succeeded
```

<!-- TODO: automate this -->
Выполните reconcile tenants:

```
kubectl annotate -n tenant-root hr/tenant-root reconcile.fluxcd.io/forceAt=$(date +"%Y-%m-%dT%H:%M:%SZ") --overwrite
```

### Шаг 3: откройте Keycloak

Теперь Keycloak доступен по адресу `https://keycloak.example.org` (замените `example.org` на домен вашей инфраструктуры).

Чтобы получить credentials Keycloak для пользователя `admin` по умолчанию, выполните:

```bash
kubectl get secret -o yaml -n cozy-keycloak keycloak-credentials -o go-template='{{ printf "%s\n" (index .data "password" | base64decode) }}'
```

1. Переключите realm на `cozy`.
2. Создайте пользователя в realm `cozy`.

   Создание пользователя в realm `cozy` описано в [документации Keycloak](https://www.keycloak.org/docs/latest/server_admin/index.html#proc-creating-user_server_administration_guide).

3. После создания пользователя перейдите к его details в Keycloak admin console и включите toggle "Verified email". Это нужно для корректной работы OIDC authentication.

4. Добавьте пользователя в группу `cozystack-cluster-admin`.

5. Теперь вы сможете войти в dashboard с OIDC credentials.

   {{% alert color="warning" %}}
   Если dashboard все еще запрашивает token вместо login/password, вручную выполните reconcile:
   
   ```bash
   kubectl annotate -n cozy-dashboard hr/dashboard reconcile.fluxcd.io/forceAt=$(date +"%Y-%m-%dT%H:%M:%SZ") --overwrite
   ```
   {{% /alert %}}

### Шаг 4: получите kubeconfig

Чтобы получить доступ к кластеру через Dashboard, скачайте kubeconfig: выберите развернутый tenant и скопируйте secret из resource map.

Этот kubeconfig будет автоматически настроен на использование OIDC authentication и namespace, выделенного tenant.

Установите [kubelogin](https://github.com/int128/kubelogin), необходимый для использования kubeconfig с OIDC.
```bash
# Homebrew (macOS and Linux)
brew install int128/kubelogin/kubelogin

# Krew (macOS, Linux, Windows and ARM)
kubectl krew install oidc-login

# Chocolatey (Windows)
choco install kubelogin
```
