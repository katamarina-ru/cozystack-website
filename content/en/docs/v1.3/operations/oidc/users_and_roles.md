---
title: Создание пользователей и назначение ролей
linkTitle: Пользователи и роли
description: "Как создавать пользователей и назначать им роли"
weight: 50
aliases:
  - /docs/v1.3/oidc/users_and_roles
---

Создание пользователей и назначение им ролей.

### Обзор

При создании tenant в Cozy (начиная с версии 1.6.0) roles, RoleBindings и группы Keycloak автоматически создаются в Kubernetes cluster.

Создание пользователя описано в документации:
[Keycloak Admin Console Documentation](https://www.keycloak.org/docs/latest/server_admin/#using-the-admin-console)

## Назначение роли пользователю для tenant

1. **Откройте Keycloak**:
   Чтобы получить login credentials, проверьте secret следующей командой:
   ```bash
   kubectl get secret keycloak-credentials -n cozy-keycloak -o yaml
   ```
   **Адрес Keycloak**:
   Адрес Keycloak будет соответствовать значению `publishing.host`, указанному в Platform Package. Например, если Package содержит:

   ```yaml
   spec:
     components:
       platform:
         values:
           publishing:
             host: "infra.example.org"
   ```

   Тогда Keycloak будет доступен по адресу: `keycloak.infra.example.org`

  {{% alert color="warning" %}}
  Если вы планируете интеграцию с внешними сервисами как clients или как IdPs, адрес Keycloak должен быть публично доступен и достижим для этих сервисов.
  {{% /alert %}}


## Настройка ролей для каждого tenant в Cozy

### На уровне кластера
- **`cozystack-cluster-admin`**
  - Разрешено все.

- **`cozystack-cluster-admin`**
  - Разрешено все в api group ""
  - Разрешено все для helmreleases в helm.toolkit.fluxcd.io и apps.cozystack.io

### На уровне tenant
- **`tenant-abc-view`**
  - Read-only доступ к ресурсам из нашего API.
  - Возможность просматривать logs.

- **`tenant-abc-use`**
  - Все предыдущие permissions.
  - VNC access для virtual machines.

- **`tenant-abc-admin`**
  - Все предыдущие permissions.
  - Возможность удалять pods, а также все permissions из `tenant-abc-use`.
  - Возможность создавать, обновлять и удалять ресурсы из нашего API, кроме `tenant`, `monitoring`, `etcd`, `ingress`.

- **`tenant-abc-super-admin`**
  - Все предыдущие permissions.
  - Возможность создавать, обновлять и удалять `tenant`, `monitoring`, `etcd` и `ingress`.
