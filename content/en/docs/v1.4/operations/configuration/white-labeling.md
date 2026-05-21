---
title: "White Labeling"
linkTitle: "Брендирование"
description: "Настройка брендинга в Cozystack Dashboard и на страницах аутентификации Keycloak, включая custom Keycloak themes"
weight: 50
---

White labeling позволяет заменить стандартный брендинг Cozystack собственными логотипами и текстами в Dashboard UI и на страницах аутентификации Keycloak.

## Обзор

Брендинг настраивается через поле `branding` в Platform Package (`spec.components.platform.values.branding`). Конфигурация автоматически распространяется на:

- **Dashboard**: логотип, заголовок страницы, текст footer, favicon и идентификатор tenant
- **Keycloak**: display name realm на страницах аутентификации

## Конфигурация

Измените Platform Package, чтобы добавить или обновить секцию `branding`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-full # используйте свой вариант
  components:
    platform:
      values:
        branding:
          # Брендинг Dashboard
          titleText: "My Company Dashboard"
          footerText: "My Company Platform"
          tenantText: "Production v1.0"
          logoText: ""
          logoSvg: "<base64-encoded SVG>"
          iconSvg: "<base64-encoded SVG>"
          # Брендинг Keycloak
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
| `titleText` | `Cozystack Dashboard` | Заголовок вкладки браузера и текст header в Dashboard. |
| `footerText` | `Cozystack` | Текст, отображаемый в footer Dashboard. |
| `tenantText` | Строка версии platform | Версия или идентификатор tenant, отображаемый в Dashboard. |
| `logoText` | `""` (пусто) | Альтернативный текстовый логотип. Используется, если SVG-логотип не задан. |
| `logoSvg` | Логотип Cozystack (base64) | SVG-логотип в base64, отображаемый в header Dashboard. |
| `iconSvg` | Иконка Cozystack (base64) | SVG-иконка в base64, используемая как browser favicon. |

### Поля Keycloak

| Поле | По умолчанию | Описание |
| --- | --- | --- |
| `brandName` | Не задано | Plain text имя realm, отображаемое во вкладке браузера Keycloak. |
| `brandHtmlName` | Не задано | HTML-форматированное имя realm, отображаемое на страницах входа Keycloak. Поддерживает inline HTML/CSS для стилизованного брендинга. |

## Подготовка SVG-логотипов

### SVG-переменные с учетом темы

Dashboard поддерживает template variables в SVG, которые адаптируются к светлой и темной темам:

- `{token.colorText}` - во время выполнения заменяется на цвет текста текущей темы

{{< note >}}
Синтаксис `{token.colorText}` **не является валидным XML**. Значение атрибута намеренно не заключено в кавычки, потому что Dashboard выполняет raw string substitution в исходном SVG перед render: заменяет `{token.colorText}` на фактическое значение цвета. Это означает, что SVG-файлы с такими placeholders нельзя напрямую открыть в браузере или проверить XML parser. Это ожидаемое поведение, соответствующее upstream-реализации Dashboard.
{{< /note >}}

Пример SVG с theme-aware переменной:

```text
<svg width="150" height="30" viewBox="0 0 150 30" fill="none"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M10 5h30v20H10z" fill={token.colorText} />
  <text x="50" y="20" fill={token.colorText}>My Company</text>
</svg>
```

### Конвертация SVG в Base64

Закодируйте SVG-файлы в строки base64:

```bash
base64 < logo.svg | tr -d '\n'
```

### Пример workflow

```bash
# Закодировать логотипы
LOGO_B64=$(base64 < logo.svg | tr -d '\n')
ICON_B64=$(base64 < icon.svg | tr -d '\n')

# Изменить Platform Package
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

1. **Проверьте Platform Package**:

   ```bash
   kubectl get packages.cozystack.io cozystack.cozystack-platform \
     --output jsonpath='{.spec.components.platform.values.branding}' | jq .
   ```

2. **Dashboard**: откройте URL Dashboard и проверьте логотип, заголовок, footer и favicon.

3. **Keycloak**: откройте страницу входа Keycloak и проверьте display name realm.

{{< note >}}
Чтобы увидеть обновленный брендинг, может потребоваться hard refresh (Ctrl+Shift+R / Cmd+Shift+R) или очистка кеша браузера.
{{< /note >}}

## Custom Keycloak themes

Для более глубокой визуальной настройки страниц аутентификации Keycloak (login, registration, account management) можно подключать custom themes, собранные как container images.

### Контракт theme image

Theme image должен содержать файлы темы в директории `/themes/`. Структура директорий должна соответствовать стандартному [формату themes Keycloak](https://www.keycloak.org/docs/latest/server_development/index.html#_themes):

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

При запуске pod init containers копируют файлы из каждого theme image в директорию Keycloak `/opt/keycloak/themes/`. Встроенные themes Keycloak, упакованные в JAR-файлы, не затрагиваются.

Если несколько theme images содержат файлы по одному и тому же path, более поздние записи в списке имеют приоритет.

### Конфигурация

Custom themes настраиваются на системном компоненте Keycloak. Измените Package `cozystack.keycloak`:

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

### Поля theme

| Поле | Обязательно | Описание |
| --- | --- | --- |
| `name` | Да | Идентификатор theme. Используется как имя init container после приведения к формату DNS-1123. |
| `image` | Да | Container image, содержащий файлы theme в `/themes/`. |

### Private registries

Если theme images хранятся в private registry, добавьте `imagePullSecrets`:

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

### Активация custom theme

После развертывания theme image активируйте его в Keycloak:

1. Откройте admin console Keycloak.
2. Перейдите в **Realm Settings** > **Themes**.
3. Выберите custom theme в выпадающем списке для нужного типа темы: login, account, email или admin.
4. Сохраните изменения.

## Миграция с v0

В Cozystack v0 брендинг настраивался через отдельный ConfigMap `cozystack-branding` в namespace `cozy-system`. В v1 этот ConfigMap больше не используется. [Скрипт миграции]({{% ref "/docs/v1.4/operations/upgrades#step-3-generate-the-platform-package" %}}) автоматически преобразует старые значения ConfigMap в поле `branding` Platform Package.

Если раньше вы использовали подход с ConfigMap, ручная миграция не нужна: процесс обновления выполнит ее автоматически.
