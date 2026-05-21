---
title: "Настройка брендинга"
linkTitle: "Брендирование"
description: "Настройка брендинга Cozystack Dashboard и страниц аутентификации."
weight: 50
---

Настройка брендинга позволяет заменить стандартное оформление Cozystack на собственные логотипы и тексты в Dashboard UI и на страницах аутентификации Keycloak.

## Обзор

Брендинг настраивается через поле `branding` в пакете платформы (`spec.components.platform.values.branding`). Конфигурация автоматически распространяется на:

- **Dashboard**: логотип, заголовок страницы, текст footer, favicon и идентификатор tenant;
- **Keycloak**: отображаемое имя realm на страницах аутентификации.

## Настройка

Измените пакет платформы, добавив или обновив секцию `branding`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-full # use your variant
  components:
    platform:
      values:
        branding:
          # Dashboard branding
          titleText: "My Company Dashboard"
          footerText: "My Company Platform"
          tenantText: "Production v1.0"
          logoText: ""
          logoSvg: "<base64-encoded SVG>"
          iconSvg: "<base64-encoded SVG>"
          # Keycloak branding
          brandName: "My Company"
          brandHtmlName: "<div style='font-weight:bold;'>My Company</div>"
```

Примените изменения:

```bash
kubectl apply --server-side --filename platform-package.yaml
```

## Поля конфигурации

### Поля Dashboard

| Поле | По умолчанию | Описание |
| --- | --- | --- |
| `titleText` | `Cozystack Dashboard` | Заголовок вкладки браузера и текст заголовка в Dashboard. |
| `footerText` | `Cozystack` | Текст, отображаемый в footer Dashboard. |
| `tenantText` | Строка версии платформы | Версия или идентификатор tenant, отображаемый в Dashboard. |
| `logoText` | `""` (пусто) | Альтернативный текстовый логотип. Используется, если SVG-логотип не задан. |
| `logoSvg` | Логотип Cozystack (base64) | SVG-логотип в кодировке base64, отображаемый в заголовке Dashboard. |
| `iconSvg` | Иконка Cozystack (base64) | SVG-иконка в кодировке base64, используемая как favicon браузера. |

### Поля Keycloak

| Поле | По умолчанию | Описание |
| --- | --- | --- |
| `brandName` | Не задано | Текстовое имя realm, отображаемое во вкладке браузера Keycloak. |
| `brandHtmlName` | Не задано | HTML-форматированное имя realm, отображаемое на страницах входа Keycloak. Поддерживает inline HTML/CSS для стилизованного брендинга. |

## Подготовка SVG-логотипов

### SVG-переменные с учетом темы

Dashboard поддерживает шаблонные переменные в SVG, которые адаптируются к светлой и темной теме:

- `{token.colorText}` — во время выполнения заменяется текущим цветом текста темы.

{{< note >}}
Синтаксис `{token.colorText}` **не является валидным XML**. Значение атрибута намеренно не заключено в кавычки, потому что Dashboard перед отрисовкой выполняет прямую строковую замену в исходном SVG: `{token.colorText}` заменяется фактическим значением цвета. Поэтому SVG-файлы с такими placeholder'ами нельзя открыть напрямую в браузере или проверить XML-парсером. Это ожидаемое поведение, соответствующее реализации upstream Dashboard.
{{< /note >}}

Пример SVG с переменной, зависящей от темы:

```text
<svg width="150" height="30" viewBox="0 0 150 30" fill="none"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M10 5h30v20H10z" fill={token.colorText} />
  <text x="50" y="20" fill={token.colorText}>My Company</text>
</svg>
```

### Преобразование SVG в base64

Закодируйте SVG-файлы в строки base64:

```bash
base64 < logo.svg | tr -d '\n'
```

### Пример workflow

```bash
# Encode logos
LOGO_B64=$(base64 < logo.svg | tr -d '\n')
ICON_B64=$(base64 < icon.svg | tr -d '\n')

# Patch the Platform Package
kubectl patch packages.cozystack.io cozystack.cozystack-platform \
  --type merge --server-side \
  --patch "{
    \"spec\": {
      \"components\": {
        \"platform\": {
          \"values\": {
            \"branding\": {
              \"logoSvg\": \"$LOGO_B64\",
              \"iconSvg\": \"$ICON_B64\"
            }
          }
        }
      }
    }
  }"
```

## Проверка

После применения изменений проверьте, что брендинг настроен корректно:

1. **Проверьте пакет платформы**:

   ```bash
   kubectl get packages.cozystack.io cozystack.cozystack-platform \
     --output jsonpath='{.spec.components.platform.values.branding}' | jq .
   ```

2. **Dashboard**: откройте URL Dashboard и проверьте логотип, заголовок, footer и favicon.

3. **Keycloak**: откройте страницу входа Keycloak и проверьте отображаемое имя realm.

{{< note >}}
Чтобы увидеть обновленный брендинг, может потребоваться принудительно обновить страницу (Ctrl+Shift+R / Cmd+Shift+R) или очистить кэш браузера.
{{< /note >}}

## Пользовательские темы Keycloak

Для более глубокой визуальной настройки страниц аутентификации Keycloak (вход, регистрация, управление аккаунтом) можно подключить пользовательские темы, собранные в виде контейнерных образов.

### Требования к образу темы

Образ темы должен содержать файлы темы в директории `/themes/`. Структура директорий должна соответствовать стандартному [формату тем Keycloak](https://www.keycloak.org/docs/latest/server_development/index.html#_themes):

```text
/themes/
  my-brand/
    login/
      theme.properties
      resources/
        css/
        img/
    account/
      theme.properties
```

При запуске pod'а init containers копируют файлы из каждого образа темы в директорию Keycloak `/opt/keycloak/themes/`. Встроенные темы Keycloak, поставляемые в JAR-файлах, не изменяются.

Если несколько образов темы содержат файлы по одному и тому же пути, записи, расположенные позже в списке, имеют приоритет.

### Конфигурация

Пользовательские темы настраиваются в системном компоненте Keycloak. Измените Package `cozystack.keycloak`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.keycloak
  namespace: cozy-system
spec:
  variant: default
  components:
    keycloak:
      values:
        themes:
          - name: my-brand
            image: registry.example.com/my-keycloak-theme:v1.0
```

Примените изменения:

```bash
kubectl apply --server-side --filename keycloak-package.yaml
```

### Поля темы

| Поле | Обязательно | Описание |
| --- | --- | --- |
| `name` | Да | Идентификатор темы. Используется как имя init container после приведения к формату DNS-1123. |
| `image` | Да | Контейнерный образ с файлами темы в директории `/themes/`. |

### Приватные registry

Если образы тем хранятся в приватном registry, добавьте `imagePullSecrets`:

```yaml
keycloak:
  values:
    themes:
      - name: my-brand
        image: private-registry.example.com/my-keycloak-theme:v1.0
    imagePullSecrets:
      - name: my-registry-secret
```

Указанный Secret должен существовать в namespace `cozy-keycloak`.

### Активация пользовательской темы

После развертывания образа темы активируйте ее в Keycloak:

1. Откройте административную консоль Keycloak.
2. Перейдите в **Realm Settings** > **Themes**.
3. Выберите пользовательскую тему из выпадающего списка для нужного типа темы: login, account, email или admin.
4. Сохраните изменения.

## Миграция с v0

В Cozystack v0 брендинг настраивался через отдельный ConfigMap `cozystack-branding` в namespace `cozy-system`. В v1 этот ConfigMap больше не используется. [Скрипт миграции]({{% ref "/docs/v1.3/operations/upgrades#step-3-generate-the-platform-package" %}}) автоматически преобразует старые значения ConfigMap в поле `branding` пакета платформы.

Если раньше вы использовали подход с ConfigMap, ручная миграция не требуется: процесс обновления выполнит ее автоматически.
