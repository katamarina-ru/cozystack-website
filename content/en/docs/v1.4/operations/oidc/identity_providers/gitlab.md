---
title: Как настроить GitLab как Identity Provider
linkTitle: Gitlab
description: "Как настроить GitLab как Identity Provider"
weight: 30
aliases:
  - /docs/v1.4/oidc/identity_providers/gitlab
---

GitLab можно использовать как identity provider для Keycloak.

### Обзор

## Создайте Application в GitLab

- Откройте `https://gitlab.com/groups/<YOUR_GROUP>/-/settings/applications`
- Нажмите `Add new application`
- Name: cozy, Redirect URI: `https://keycloak.<root-host>/realms/cozy/broker/gitlab/endpoint`
- Включите Confidential, api, read_api, read_user, openid, profile, email
- Скопируйте и сохраните Secret


## Настройте Keycloak Identity Provider
Создайте ресурс `KeycloakRealmIdentityProvider` со следующей конфигурацией:

```yaml
apiVersion: v1.edp.epam.com/v1
kind: KeycloakRealmIdentityProvider
metadata:
  name: gitlab
spec:
  realmRef:
    name: keycloakrealm-cozy
    kind: ClusterKeycloakRealm
  alias: gitlab
  authenticateByDefault: false
  enabled: true
  providerId: "gitlab"
  config:
    clientId: "YOUR GITLAB APP ID"
    clientSecret: "YOUR GITLAB APP SECRET"
    syncMode: "IMPORT"
  mappers:
    - name: "username"
      identityProviderMapper: "oidc-username-idp-mapper"
      identityProviderAlias: "gitlab"
      config:
        target: "LOCAL"
        syncMode: "INHERIT"
        template: "${ALIAS}---${CLAIM.preferred_username}"
```
