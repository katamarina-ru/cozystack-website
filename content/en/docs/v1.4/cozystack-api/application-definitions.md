---
title: Справочник ApplicationDefinition
linkTitle: ApplicationDefinition
description: Как ресурсы ApplicationDefinition описывают типы приложений и как искать их из клиентского кода
weight: 15
---

## Обзор

`ApplicationDefinition` (`applicationdefinitions.cozystack.io/v1alpha1`) — это
CRD кластерного масштаба, описывающий каждый тип приложения, предоставляемый платформой.
Каждое определение объявляет Kind Kubernetes, который используют тенанты в
агрегированном API (`spec.application.kind`), схему OpenAPI для отображения
формы на дашборде и валидации пользовательского ввода
(`spec.application.openAPISchema`), а также метаданные дашборда: категорию, иконку
и отображаемые имена (`spec.dashboard`).

Агрегированный API-сервер (`cozystack-api`) перечисляет все `ApplicationDefinition`
**один раз при запуске** и регистрирует соответствующий ресурс под
`apps.cozystack.io/v1alpha1`. Набор тенант-ориентированных Kind не меняется
пока работает API-сервер — добавление, удаление или переименование
`ApplicationDefinition` вступает в силу только после перезапуска `cozystack-api`.

Специальный контроллер (`applicationdefinition-controller`, поставляемый вместе с
Cozystack) следит за `ApplicationDefinition` и автоматически инициирует этот перезапуск:
при любом изменении набора он вычисляет контрольную сумму SHA-256 по
отсортированным определениям и записывает её в аннотацию `cozystack.io/config-hash`
шаблона пода в Deployment `cozy-system/cozystack-api`,
после чего Kubernetes выполняет плавный перезапуск. События дебаунсятся
в течение короткого окна, и если контрольная сумма не изменилась — перезапуск
пропускается. Операторам не нужно вручную выполнять `kubectl rollout restart`.

Когда пользователь создаёт CR `Postgres` через дашборд, `kubectl` или Go-клиент,
агрегированный слой транслирует его в Flux `HelmRelease`, использующий
чарт, указанный в определении.

## Соглашение об именовании

`ApplicationDefinition` использует два независимых стиля именования. Каждое определение
задаёт их явно, и связь между ними **не может быть выведена
никаким строковым преобразованием**:

| Поле | Стиль | Пример (HTTP-кэш) | Пример (диск VM) | Пример (TCP-балансировщик) |
| --- | --- | --- | --- | --- |
| `metadata.name` | строчные-с-дефисами | `http-cache` | `vm-disk` | `tcp-balancer` |
| `spec.application.kind` | CamelCase, акронимы сохраняются | `HTTPCache` | `VMDisk` | `TCPBalancer` |
| `spec.application.singular` | строчные, без дефисов | `httpcache` | `vmdisk` | `tcpbalancer` |
| `spec.application.plural` | строчные, без дефисов | `httpcaches` | `vmdisks` | `tcpbalancers` |

Обратите внимание, что `metadata.name` не является функцией от `spec.application.kind`. Расположение
дефисов (`tcp-balancer`, `vm-disk`, `http-cache`) и их отсутствие
в `singular`/`plural` (`tcpbalancer`, `vmdisk`, `httpcache`) —
это соглашения, выбранные для каждого приложения отдельно, а не результат работы общего алгоритма.
`strings.ToLower(kind)` даёт `httpcache`, что совпадает с
`spec.application.singular`, но **не** с `metadata.name`. Прямой поиск по
Kind в нижнем регистре поэтому завершится ошибкой:

```bash
# Ресурс агрегированного API использует plural в нижнем регистре:
$ kubectl get httpcaches --namespace tenant-demo
NAME       READY   AGE   VERSION
frontend   True    2m    1.2.0

# Но ApplicationDefinition, лежащий в его основе, хранится под другим именем:
$ kubectl get applicationdefinition httpcache
Error from server (NotFound): applicationdefinitions.cozystack.io "httpcache" not found

$ kubectl get applicationdefinition http-cache
NAME         AGE
http-cache   14d
```

Акронимы делают это особенно наглядным: `TCPBalancer`, `HTTPCache` и `VMDisk` — все
теряют заглавные буквы в имени агрегированного ресурса (`tcpbalancers`,
`httpcaches`, `vmdisks`), но сохраняют дефисы в имени CRD (`tcp-balancer`,
`http-cache`, `vm-disk`).

## Рекомендуемый шаблон поиска

Клиентский код, которому нужно разрешить Kind Cozystack — например дашборд,
получающий `HTTPCache` из метки HelmRelease и желающий отрендерить
соответствующую форму — должен **получить список всех `ApplicationDefinition` и фильтровать по
`spec.application.kind`** вместо попытки прямого `Get` по Kind в нижнем регистре.
Набор определений невелик (порядка десятков элементов) и изменяется редко, поэтому
такой подход дёшев и надёжен. Возвращайте весь найденный объект, чтобы
вызывающий код мог читать `spec.application.openAPISchema`,
`spec.dashboard` или любое другое поле без второго обращения к API.

Перед использованием названий группы и ресурса ниже убедитесь в их актуальности для
вашего кластера:

```bash
$ kubectl api-resources | grep applicationdefinition
applicationdefinitions                                cozystack.io/v1alpha1                  false        ApplicationDefinition
```

Строка должна содержать `applicationdefinitions` в столбце `NAME`,
`cozystack.io/v1alpha1` в столбце `APIVERSION`, `false` в столбце
`NAMESPACED` (ресурс имеет кластерный масштаб) и `ApplicationDefinition`
в столбце `KIND`. Если группа отличается в вашем кластере, скорректируйте
`GroupVersionResource` в примере соответственно.

```go
import (
    "context"
    "fmt"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
    "k8s.io/apimachinery/pkg/runtime/schema"
    "k8s.io/client-go/dynamic"
)

// findByKind возвращает ApplicationDefinition, чей spec.application.kind
// совпадает с запрошенным kind, или ошибку, если совпадение не найдено. Вызывающий
// получает полный объект, поэтому поля вроде spec.application.openAPISchema
// доступны без второго обращения к API.
func findByKind(ctx context.Context, client dynamic.Interface, kind string) (*unstructured.Unstructured, error) {
    if kind == "" {
        return nil, fmt.Errorf("kind must not be empty")
    }

    gvr := schema.GroupVersionResource{
        Group:    "cozystack.io",
        Version:  "v1alpha1",
        Resource: "applicationdefinitions",
    }

    // Набор ApplicationDefinition на кластере Cozystack невелик
    // (порядка десятков), поэтому одного непагинированного List достаточно.
    // Если вы адаптируете этот хелпер для большего каталога, задайте ListOptions.Limit
    // и переходите по continue-токену, чтобы избежать неявного усечения.
    list, err := client.Resource(gvr).List(ctx, metav1.ListOptions{})
    if err != nil {
        return nil, fmt.Errorf("list %s/%s/%s: %w",
            gvr.Group, gvr.Version, gvr.Resource, err)
    }
    for i := range list.Items {
        specKind, found, err := unstructured.NestedString(
            list.Items[i].Object, "spec", "application", "kind")
        if err != nil || !found {
            // Пропускаем определения с отсутствующим или нестроковым kind, чтобы
            // итерация не совпала с некорректной записью.
            continue
        }
        if specKind == kind {
            return &list.Items[i], nil
        }
    }
    // Включаем GVR в ошибку, чтобы неверная группа (например после переименования
    // CRD) отличалась от настоящего "такого kind нет".
    return nil, fmt.Errorf("no ApplicationDefinition with spec.application.kind %q found under %s/%s/%s",
        kind, gvr.Group, gvr.Version, gvr.Resource)
}
```

Набор `ApplicationDefinition`, предоставляемых через агрегированный API, заморожен
на момент запуска `cozystack-api` (см. [Обзор](#обзор)), однако базовые
CRD можно редактировать в режиме реального времени: администратор может изменить
`spec.application.openAPISchema` или `spec.dashboard` в существующем
определении или добавить новый Kind — `applicationdefinition-controller` затем
инициирует плавный перезапуск `cozystack-api`, чтобы изменение стало
доступным через агрегированный API без ручного вмешательства. Насколько
агрессивно клиент должен кэшировать — зависит от его собственного времени жизни:

- **Короткоживущие процессы** (CLI-инструменты, одноразовые скрипты, serverless-функции)
  могут безопасно кэшировать результат `findByKind` на всё время жизни процесса.
- **Долгоживущие процессы** (дашборды, контроллеры, операторы) должны
  повторно получать список `ApplicationDefinition` с периодичностью, соответствующей тому,
  как часто их операторы редактируют схемы — обычно раз в несколько минут достаточно.
  Определения меняются редко, поэтому watch не оправдывает сложности. Новый
  `ApplicationDefinition` станет доступен через агрегированный API вскоре после создания,
  как только инициированный контроллером плавный перезапуск `cozystack-api` завершится.

{{% alert color="info" %}}
Plural в нижнем регистре (`httpcaches`, `vmdisks`) **является** корректным именем для
тенант-ориентированных ресурсов под `apps.cozystack.io/v1alpha1`. Только
CRD `applicationdefinitions.cozystack.io` использует форму с дефисами.
{{% /alert %}}

## См. также

- [Обзор Cozystack API]({{% ref "/docs/v1.4/cozystack-api" %}}) — использование kubectl,
  Terraform и Go-клиента для тенант-ориентированных ресурсов.
- [Go Types]({{% ref "/docs/v1.4/cozystack-api/go-types" %}}) — типизированные Go-клиенты
  для ресурсов `apps.cozystack.io/v1alpha1`.
