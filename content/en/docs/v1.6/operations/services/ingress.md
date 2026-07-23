---
title: "Справочник Ingress-NGINX Controller"
linkTitle: "Ingress"
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/operations/services/_include/ingress.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/extra/ingress/README.md
-->


## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `replicas` | Количество реплик ingress-nginx. | `int` | `2` |
| `whitelist` | Список клиентских сетей. | `[]string` | `[]` |
| `cloudflareProxy` | Восстановление исходных IP посетителей, когда включён Cloudflare proxied. | `bool` | `false` |
| `proxyProtocol` | Включить PROXY-protocol (use-proxy-protocol) на tenant Ingress. Upstream L4 load balancer перед ingress-nginx ОБЯЗАТЕЛЬНО должен уже добавлять заголовки PROXY-protocol v1, иначе весь трафик к этому ingress ломается — включая внутрикластерный и прямой (hairpin) доступ к его публичным hostnames через Service. Взаимоисключающе с cloudflareProxy. Для host (внешнего) ingress вместо этого используйте платформенный переключатель publishing.proxyProtocol; per-app значение там отклоняется, так как оно обошло бы обработку hairpin в ouroboros и защиту от опасного отключения. | `bool` | `false` |
| `resources` | Явная конфигурация CPU и памяти для каждой реплики ingress-nginx. Если не задано, применяется пресет, указанный в `resourcesPreset`. | `object` | `{}` |
| `resources.cpu` | CPU, доступный каждой реплике. | `quantity` | `""` |
| `resources.memory` | Память (RAM), доступная каждой реплике. | `quantity` | `""` |
| `resourcesPreset` | Пресет размера по умолчанию, используемый, когда `resources` не задан. | `string` | `t1.micro` |
