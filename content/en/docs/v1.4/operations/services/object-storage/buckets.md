---
title: "Пользователи и Бакеты"
linkTitle: "Бакеты"
description: "Создание S3 buckets и управление учетными данными"
weight: 20
---

Приложение Bucket создает S3 bucket через COSI и подготавливает учетные данные для каждого пользователя в виде Kubernetes Secrets.

## Создание Bucket

Минимальный bucket использует BucketClass по умолчанию и не создает пользователей:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: my-bucket
  namespace: tenant-example
spec: {}
```

Это создает BucketClaim в BucketClass по умолчанию (`tenant-example`).
Чтобы bucket был полезен, добавьте хотя бы одного пользователя (см. [Пользователи](#users) ниже).

## Выбор Storage Pool

Если экземпляр SeaweedFS определяет [storage pools]({{% ref "storage-pools" %}}), используйте поле `storagePool`, чтобы выбрать конкретный pool:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: my-bucket
  namespace: tenant-example
spec:
  storagePool: ssd
```

Это создает BucketClaim в BucketClass `tenant-example-ssd`.

Когда `storagePool` пустой (значение по умолчанию), bucket использует BucketClass по умолчанию.

## Object Locking

Чтобы создать bucket с включенной блокировкой объектов, задайте `locking: true`:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: my-bucket
  namespace: tenant-example
spec:
  storagePool: ssd
  locking: true
```

Это создает BucketClaim в BucketClass с суффиксом `-lock`, например `tenant-example-ssd-lock`.
BucketClasses с включенным блокировкой используют политику удаления `Retain` и настраивают блокировку объектов в режиме COMPLIANCE с периодом хранения по умолчанию.

{{< note >}}
Object locking нельзя включить или отключить после создания bucket. Если нужно изменить эту настройку, создайте новый bucket.
{{< /note >}}

## Пользователи

Карта `users` определяет именованных S3-пользователей для bucket.
Каждая запись создает ресурс COSI BucketAccess и соответствующий Kubernetes Secret с S3 учетные данные.

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: my-bucket
  namespace: tenant-example
spec:
  storagePool: ssd
  users:
    admin: {}
    reader:
      readonly: true
```

Это создает двух пользователей:

| Пользователь | Доступ | Используемый BucketAccessClass | Имя Secret |
| --- | --- | --- | --- |
| `admin` | read-write | `tenant-example-ssd` | `my-bucket-admin` |
| `reader` | read-only | `tenant-example-ssd-readonly` | `my-bucket-reader` |

### Параметры пользователя

| Параметр | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `readonly` | `bool` | `false` | При `true` создает учетные данные из BucketAccessClass с суффиксом `-readonly` |

### Доступ к учетным данным

Каждый пользователь получает Kubernetes Secret с именем `{bucket-name}-{username}` в том же namespace.
Secret содержит S3 учетные данные, созданные COSI driver:

```bash
kubectl get secret my-bucket-admin -n tenant-example -o yaml
```

Secret содержит поля, необходимые для настройки S3 client: endpoint, access key, secret key.
Точный набор полей зависит от реализации COSI driver.

### Ротация учетных данных

Учетные данные пользователя bucket (access key и secret key) генерируются один раз при первом создании пользователя и не могут быть обновлены на месте.
Чтобы ротировать учетные данные пользователя, удалите пользователя из map `users` и примените изменения, затем добавьте пользователя обратно и примените изменения еще раз:

```yaml
# Шаг 1: удалите пользователя, чтобы удалить существующие учетные данные
spec:
  users: {}
```

```yaml
# Шаг 2: добавьте пользователя обратно, чтобы создать новый набор учетных данных
spec:
  users:
    admin: {}
```

{{< warning >}}
Все приложения, использующие старые учетные данные, потеряют доступ между шагом 1 и шагом 2.
После завершения шага 2 обновите приложения, указав новые учетные данные из Secret.
{{< /warning >}}

## Логика выбора BucketClass

Имя BucketClass составляется из трех частей:

```text
{seaweedfs-namespace}[-{storagePool}][-lock]
```

| storagePool | locking | Используемый BucketClass |
| --- | --- | --- |
| *(empty)* | `false` | `tenant-example` |
| *(empty)* | `true` | `tenant-example-lock` |
| `ssd` | `false` | `tenant-example-ssd` |
| `ssd` | `true` | `tenant-example-ssd-lock` |

Аналогично составляется BucketAccessClass:

```text
{seaweedfs-namespace}[-{storagePool}][-readonly]
```

## Полный пример

Разверните bucket в pool `ssd` с одним admin-пользователем и одним read-only пользователем:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Bucket
metadata:
  name: media-assets
  namespace: tenant-example
spec:
  storagePool: ssd
  locking: false
  users:
    app:
      readonly: false
    backup-reader:
      readonly: true
```

После создания bucket получите учетные данные:

```bash
# Read-write учетные данные для пользователя "app"
kubectl get secret media-assets-app -n tenant-example \
  -o jsonpath='{.data}' | jq 'map_values(@base64d)'

# Read-only учетные данные для пользователя "backup-reader"
kubectl get secret media-assets-backup-reader -n tenant-example \
  -o jsonpath='{.data}' | jq 'map_values(@base64d)'
```

## Связанная документация

- [Storage Pools]({{% ref "storage-pools" %}}) -- настройка tiered storage для выбора pool
- [SeaweedFS Service Reference]({{% ref "/docs/v1.4/operations/services/seaweedfs" %}}) -- полный справочник параметров
