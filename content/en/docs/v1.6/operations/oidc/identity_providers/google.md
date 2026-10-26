---
title: Как настроить Google как Identity Provider
linkTitle: Google
description: "Как настроить Google как Identity Provider"
weight: 30
aliases:
  - /docs/v1.6/oidc/identity_providers/google
---

## Настройте Google

- Head over to [Google Console](https://console.cloud.google.com/apis/dashboard), login in to the console using Google account and you will see Google Developer Console. Once logged in, head over the top left drop-down to create new project.
![1](/img/OIDC/identity_providers/google/1.jpeg)

- Click on "New Project" to proceed.
![2](/img/OIDC/identity_providers/google/2.jpeg)

- Enter the project name of your choice and select the Organisation if you have multiple organisations. Once done click on "Create"
![3](/img/OIDC/identity_providers/google/3.jpeg)

- Once the project is created you will get a pop-up suggesting to configure the consent screen. If not then head over to the Dashboard and head over to "Explore and enable APIs" options. Then Click on "Credentials" > "Configure Consent Screen" and head over to the next step.
![4](/img/OIDC/identity_providers/google/4.jpeg)

- Click on "External" as we want to allow any Google account to be able to sign in to our application and hit "Create".
![5](/img/OIDC/identity_providers/google/5.jpeg)

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
![7](/img/OIDC/identity_providers/google/7.jpeg)

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
