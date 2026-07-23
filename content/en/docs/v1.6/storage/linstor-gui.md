---
title: "LINSTOR GUI"
linkTitle: "LINSTOR GUI"
description: "Включение и доступ к дополнительной веб-консоли LINSTOR для управления узлами хранения, ресурсами и томами."
weight: 40
aliases:
  - /docs/v1.6/operations/storage/linstor-gui
---

Пакет `linstor-gui` развёртывает [LINSTOR GUI от LINBIT](https://github.com/LINBIT/linstor-gui) - веб-консоль
для просмотра и управления узлами LINSTOR, определениями ресурсов, томами, пулами хранения и снимками.
Интерфейс проксирует REST API контроллера LINSTOR внутри кластера с использованием mTLS, поэтому учётные данные никогда не попадают в браузер.

Пакет является **опциональным** и включается по требованию. Рабочий процесс с CLI не меняется - включение GUI никак не влияет на поведение LINSTOR.

## Включение пакета

Добавьте `cozystack.linstor-gui` в `bundles.enabledPackages` в [Platform Package]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}):

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
  -p '[{"op": "add", "path": "/spec/components/platform/values/bundles/enabledPackages/-", "value": "cozystack.linstor-gui"}]'
```

Подождите около минуты, пока чарт платформы выполнит согласование, затем убедитесь, что HelmRelease создан:

```bash
kubectl get helmrelease --namespace cozy-linstor linstor-gui
```

## Доступ к интерфейсу

### Вариант 1 - Ingress, защищённый Keycloak (рекомендуется)

Если включена [аутентификация OIDC]({{% ref "/docs/v1.6/operations/oidc" %}}), интерфейс можно опубликовать по адресу
`https://linstor-gui.<root-host>` за realm Keycloak кластера.
Добавьте `linstor-gui` в `publishing.exposedServices` в Platform Package:

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
  -p '[{"op": "add", "path": "/spec/components/platform/values/publishing/exposedServices/-", "value": "linstor-gui"}]'
```

{{% alert color="info" %}}
Ingress создаётся только при выполнении обоих условий: `linstor-gui` указан в `publishing.exposedServices`
**и** включён OIDC (`authentication.oidc.enabled: true`). Без Keycloak перед прокси REST API LINSTOR
нет слоя аутентификации, поэтому чарт намеренно не создаёт Ingress.
{{% /alert %}}

Доступ ограничен участниками группы Keycloak `cozystack-cluster-admin` - той же группы, которая выдаёт
права cluster-admin RBAC в управляющем кластере. После включения откройте `https://linstor-gui.<root-host>` в браузере
и войдите, используя учётные данные Keycloak.

### Вариант 2 - Проброс порта

Для разового доступа без Keycloak пробросьте порт сервиса `ClusterIP`:

```bash
kubectl -n cozy-linstor port-forward svc/linstor-gui 3373:80
```

Затем откройте <http://localhost:3373>.
