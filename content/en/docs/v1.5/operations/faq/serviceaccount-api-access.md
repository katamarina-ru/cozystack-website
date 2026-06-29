---
title: "Токены ServiceAccount для доступа к API"
linkTitle: "ServiceAccount и API"
description: "Как получить и использовать токены ServiceAccount в Cozystack."
weight: 20
aliases:
  - /docs/v1.5/operations/api-access
---

## Предварительные требования

Перед началом убедитесь, что:
-   Tenant уже существует в Cozystack.
    Если он еще не создан, см. [Создание пользовательского tenant]({{% ref "/docs/v1.5/getting-started/create-tenant" %}}).
-   У вас есть доступ к namespace tenant - через OIDC-учетные данные или административный kubeconfig.
-   `kubectl` установлен и настроен.
-   (Опционально) установлен `jq`.

## Получение токена ServiceAccount

У каждого tenant в Cozystack есть Secret с токеном ServiceAccount.
Secret имеет то же имя, что и tenant, и находится в namespace этого tenant.

{{< tabs name="get_token" >}}
{{% tab name="Dashboard" %}}

1.  Войдите в Dashboard пользователем, у которого есть доступ к tenant.
1.  При необходимости переключите контекст на нужный tenant.
1.  В левой боковой панели перейдите на страницу **Administration** -> **Info** и откройте вкладку **Secrets**.
1.  Найдите secret с именем `tenant-<name>` (например, `tenant-team1`), где **Key** равен **token**.
1.  Нажмите значок глаза, чтобы показать поле **Value**, затем нажмите на показанные данные. Текст будет автоматически скопирован в буфер обмена.

{{% /tab %}}

{{% tab name="kubectl" %}}

Получите токен для tenant с именем `<name>`:

```bash
kubectl -n tenant-<name> get tenantsecret tenant-<name> -o json | jq -r '.data.token | @base64d'
```

Чтобы сохранить токен в переменную для последующих команд:

```bash
export TOKEN=$(kubectl -n tenant-<name> get tenantsecret tenant-<name> -o json | jq -r '.data.token | @base64d')
```

{{% /tab %}}
{{< /tabs >}}

## Использование токена для доступа к API

Получив токен, вы можете [сгенерировать kubeconfig]({{% ref "/docs/v1.5/operations/faq/generate-kubeconfig" %}}) для доступа через kubectl или использовать токен напрямую через `curl`, как показано ниже.

{{% alert color="warning" %}}
**Безопасность токена**

Токены ServiceAccount в Cozystack по умолчанию **не имеют срока действия**. Обращайтесь с ними так же аккуратно, как с паролями.
{{% /alert %}}

### Проверка подключения

Сначала убедитесь, что текущий контекст kubectl указывает на нужный кластер Cozystack:

```bash
kubectl config current-context
kubectl cluster-info
```

Затем получите адрес API-сервера:

```bash
export API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
```

После этого извлеките CA-сертификат из secret tenant:

```bash
kubectl -n tenant-<name> get secret tenant-<name> -o jsonpath='{.data.ca\.crt}' | base64 -d > ca.crt
```

Теперь проверьте подключение:

```bash
curl --cacert ca.crt -H "Authorization: Bearer ${TOKEN}" ${API_SERVER}/api
```

> После проверки файл `ca.crt` можно удалить.
