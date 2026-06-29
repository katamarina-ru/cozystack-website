---
title: Как настроить Google как Identity Provider
linkTitle: Google
description: "Как настроить Google как Identity Provider"
weight: 30
aliases:
  - /docs/v1.5/oidc/identity_providers/google
---

## Настройте Google

- Перейдите в [Google Console](https://console.cloud.google.com/apis/dashboard), войдите в консоль с Google account, после чего откроется Google Developer Console. После входа используйте выпадающее меню вверху слева, чтобы создать новый project.
![1](/img/oidc/identity_providers/google/1.jpeg)

- Нажмите "New Project", чтобы продолжить.
![2](/img/oidc/identity_providers/google/2.jpeg)

- Введите имя project и выберите Organisation, если у вас несколько organisations. Затем нажмите "Create".
![3](/img/oidc/identity_providers/google/3.jpeg)

- После создания project появится pop-up с предложением настроить consent screen. Если он не появился, перейдите в Dashboard и откройте "Explore and enable APIs". Затем нажмите "Credentials" > "Configure Consent Screen" и переходите к следующему шагу.
![4](/img/oidc/identity_providers/google/4.jpeg)

- Нажмите "External", так как нужно разрешить вход в приложение любому Google account, затем нажмите "Create".
![5](/img/oidc/identity_providers/google/5.jpeg)

- После этого вы будете перенаправлены на страницы, где нужно настроить несколько параметров:
    - Application type: Public
    - Application name: Your application name
    - Authorised domains: Your application top-level domain name
    - Application Homepage link: Your application homepage
    - Application Privacy Policy link: Your application privacy policy link

- Теперь перейдите к Create Credentials в navbar и нажмите "OAuth Client ID".
![6](/img/oidc/identity_providers/google/6.jpeg)

- Выберите Application type "Web application" и задайте имя приложения. Затем добавьте ссылку из вкладки Keycloak в "Authorized Redirect URIs" и нажмите "Create". Ссылка должна выглядеть примерно так:
```bash
https://YOUR_KEYCLOAK_DOMAIN/auth/realms/cozy/broker/google/endpoint
```
![7](/img/oidc/identity_providers/google/7.jpeg)

- После завершения появится pop-up с информацией, нужной на следующем шаге. Вам понадобятся "Client ID" и "Client secret", поэтому сохраните их в безопасном месте.
![8](/img/oidc/identity_providers/google/8.jpeg)

## Настройте Keycloak Identity Provider
Создайте ресурс `KeycloakRealmIdentityProvider` со следующей конфигурацией:

```yaml
apiVersion: v1.edp.epam.com/v1
kind: KeycloakRealmIdentityProvider
metadata:
  name: google
spec:
  realmRef:
    name: keycloakrealm-cozy
    kind: ClusterKeycloakRealm
  alias: google
  authenticateByDefault: false
  enabled: true
  providerId: "google"
  config:
    clientId: "YOUR GOOGLE APP ID"
    clientSecret: "YOUR GOOGLE APP SECRET"
    syncMode: "IMPORT"
  mappers:
    - name: "username"
      identityProviderMapper: "oidc-username-idp-mapper"
      identityProviderAlias: "google"
      config:
        target: "LOCAL"
        syncMode: "INHERIT"
        template: "${ALIAS}---${CLAIM.email}"
```
