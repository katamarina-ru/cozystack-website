---
title: "PROXY-protocol и исправление hairpin-NAT"
linkTitle: "PROXY-protocol и hairpin"
description: "Включение PROXY-protocol на ingress-nginx в Cozystack и исправление возникающей проблемы hairpin-NAT с помощью входящего в состав платформы компонента ouroboros."
weight: 25
---

## О чём эта страница

PROXY-protocol на ingress-nginx управляющего кластера, порождаемая им проблема hairpin-NAT, входящее в состав Cozystack исправление (`ouroboros`, реализация [`compumike/hairpin-proxy`](https://github.com/compumike/hairpin-proxy) на Go - см. [`lexfrei/ouroboros`](https://github.com/lexfrei/ouroboros)), единый флаг платформы, связывающий обе части, аддон для того же исправления внутри кластеров тенантов и несимметричные пути отключения на каждом уровне.

## Почему PROXY-protocol ломает трафик внутри кластера

Когда вышестоящий балансировщик L4 (облачный LB, hcloud-CCM, F5, haproxy за MetalLB и т.д.) добавляет [заголовок PROXY-protocol v1](https://www.haproxy.org/download/1.8/doc/proxy-protocol.txt) к каждому соединению, приходящему на ingress-nginx, ingress-nginx настраивается с `use-proxy-protocol: "true"` и принимает только соединения с заголовком. Внешний трафик работает.

Трафик внутри кластера - нет. Под, который резолвит публичное имя самого кластера (self-check'и HTTP-01 в cert-manager, внутренние вызовы `https://` по публичному DNS, обращения ArgoCD к самому себе и т.д.), обращается к CoreDNS и получает в ответ IP LoadBalancer. kube-proxy / Cilium-KPR видит этот IP LB и срезает путь напрямую к локальному сервису, минуя вышестоящий балансировщик. Соединение приходит на ingress-nginx **без** заголовка PROXY, который тот теперь требует. Ingress-nginx закрывает соединение. Hairpin молча ломается.

[KEP-1860](https://kubernetes.io/blog/2023/12/18/kubernetes-1-29-feature-loadbalancer-ip-mode-alpha/) (`status.loadBalancer.ingress[].ipMode: Proxy`) - это апстрим-решение для кластеров, стоящих за внешним прокси-балансировщиком под управлением CCM. Оно **не** подходит для настроек Cozystack по умолчанию: при `kubeProxyReplacement: true` и IP-адресах LB, анонсируемых Cilium, Cilium полностью убирает фронтенд LB, когда `ipMode != VIP`, ломая сервис и для внутрикластерного, и для внешнего трафика. Вместо этого Cozystack использует ouroboros.

## Как это исправляет ouroboros

ouroboros - небольшой контроллер внутри кластера, который отслеживает имена хостов в `Ingress` (и опционально `Gateway` / `HTTPRoute`) и переписывает внутрикластерный DNS так, чтобы эти имена резолвились в небольшой внутрикластерный прокси, добавляющий заголовок PROXY-protocol перед пересылкой на ingress-nginx. Он состоит из двух взаимодействующих частей:

- **контроллер**, который отслеживает ресурсы Ingress / Gateway и добавляет в CoreDNS строки `rewrite name <host> ouroboros-proxy.…svc.cluster.local.`;
- **TCP-прокси**, который слушает порты 8080/8443, добавляет заголовок PROXY-protocol v1 и пересылает трафик на настоящий сервис ingress-nginx.

Cozystack использует два режима работы в зависимости от уровня:

| Уровень | Режим | Что записывает ouroboros |
| --- | --- | --- |
| Управляющий кластер | `coredns` | Рабочий Corefile `kube-system/coredns`, между маркерами `# === BEGIN ouroboros (do not edit by hand) ===`. CoreDNS управляющего кластера управляется Talos и не содержит директивы `import`, поэтому альтернативный режим там молча ничего бы не делал. |
| Кластеры Kubernetes тенантов | `coredns-import` | Только строки `rewrite name` в ключ данных `ouroboros.override` ConfigMap `kube-system/coredns-custom` - отдельного ConfigMap, который поставляется чартом cozystack-coredns и подключается в Corefile через `import /etc/coredns/custom/*.override`. ouroboros никогда не трогает Corefile, отрендеренный чартом, поэтому не конфликтует с чартом при каждом согласовании Flux. |

## Включение в управляющем кластере

Один флаг платформы включает PROXY-protocol на ingress-nginx управляющего кластера **и** автоматически развёртывает ouroboros на стороне управляющего кластера:

```yaml
publishing:
  proxyProtocol: true
```

По умолчанию `false` - кластеры, не использующие PROXY-protocol, не получают ни новых ресурсов, ни изменений RBAC, ни изменений поведения.

### Предусловие: вышестоящий балансировщик

Флаг не настраивает за вас балансировщик L4 перед ingress-nginx - тот находится вне кластера (облачный LB, F5, MetalLB+haproxy, hcloud-cloud-controller-manager и т.д.). Вышестоящий балансировщик **обязан** уже добавлять заголовки PROXY-protocol v1 до переключения флага.

Кадры PROXY-protocol передаются от вышестоящего балансировщика к ingress-nginx (балансировщик открывает новое TCP-соединение к бэкенду и добавляет кадр в это соединение), а не обратно к исходному клиенту - `nc` с ноутбука их никогда не увидит. Есть два практических способа проверки, выберите один:

- Запустите `tcpdump --interface any port 80 or port 443 -A` на узле с ingress-nginx **до** переключения флага и посмотрите, есть ли ведущий кадр `PROXY TCP4 …\r\n` во входящем TCP-трафике от балансировщика. Если кадр есть, балансировщик выполняет вставку и флаг можно безопасно переключать.
- Выполните любой внешний HTTP-запрос **после** изменения на стороне балансировщика, но **до** переключения `publishing.proxyProtocol`, и посмотрите в логах ingress-nginx (`kubectl --namespace cozy-ingress-nginx logs deploy/ingress-nginx-controller`) сообщение `client sent invalid proxy protocol header` - эта ошибка означает, что балансировщик начал вставлять кадры PROXY, а ingress-nginx ещё не настроен их принимать; это ровно то переходное состояние, которое флаг и призван устранить. Противоположный лог (`broken header` после переключения флага, когда балансировщик **не** вставляет кадры) сигнализирует, что предусловие на самом деле не выполнялось, и из этого состояния нужно откатываться.

Без выполнения предусловия каждый внешний запрос к ingress-nginx ломается в момент включения флага. Если ни один из способов проверки не показывает кадры PROXY, сначала исправьте вышестоящий балансировщик и только потом трогайте `publishing.proxyProtocol`.

### Окно нестабильности при перерендеринге Talos

CoreDNS управляющего кластера - это Deployment под управлением Talos; ouroboros изменяет его рабочий Corefile на месте между маркерами BEGIN/END. Применение machine-config Talos или обновление перерендеривает Corefile и затирает маркеры - возникает окно нестабильности длиной в один цикл согласования ouroboros (значение чарта по умолчанию `controller.resync: 10m`, сверху ограниченное ближайшим событием Ingress/Gateway), пока контроллер не применит блок заново. Любое событие Ingress или Gateway в течение окна запускает согласование раньше и укорачивает его. Внутрикластерный DNS для hairpin-имён в это окно ненадолго возвращает IP вышестоящего балансировщика вместо ClusterIP прокси, что ломается так же, как ломается внутрикластерный hairpin вовсе без ouroboros (короткое замыкание kube-proxy снова вступает в силу; запросы без PROXY попадают на ingress-nginx и отклоняются). Это приемлемо, но об этом стоит помнить во время обновления Talos.

### Обёртка cozystack-coredns

Cozystack поставляет собственную тонкую обёртку над апстрим-пакетом `coredns/helm-charts`: в Corefile добавляется директива `import /etc/coredns/custom/*.override` в серверный блок `.:53`, а Deployment CoreDNS монтирует пустой ConfigMap `coredns-custom` в `/etc/coredns/custom/` (с `optional: true`). Шаблон обёртки рендерит этот ConfigMap **вообще без поля `data:`** - поэтому трёхстороннему слиянию Helm не с чем сравнивать со стороны шаблона при каждом согласовании, и записи `data.ouroboros.override`, которые ouroboros добавляет на стороне apiserver во время работы, переживают любое обновление чарта нетронутыми. Аннотация `helm.sh/resource-policy: keep` на том же ConfigMap - отдельная, более слабая мера: она лишь не даёт `helm uninstall` удалить ConfigMap, но не защищает от затирания при обновлении чарта. Инвариант закреплён проверкой `notExists: data` в `packages/system/coredns/tests/coredns_custom_test.yaml` - будущее изменение чарта, добавляющее хотя бы `data: {}` «для явности», уронит эту проверку до того, как регрессия попадёт в релиз. Сегодня эта схема используется Deployment'ами CoreDNS **тенантов** (где ouroboros работает в режиме `coredns-import`); CoreDNS управляющего кластера управляется Talos и никогда не использует этот чарт, поэтому установка в управляющем кластере работает в режиме `coredns` с рабочим Corefile.

### Домен кластера DNS у тенантов

Чарт ouroboros начиная с версии 0.7.0 поддерживает два пути определения `clusterDomain`: явное закрепление через `controller.clusterDomain` или автоопределение во время работы из `/etc/resolv.conf`. Cozystack закрепляет в обёртке аддона тенанта `controller.clusterDomain: cluster.local`, потому что автоопределение возвращает неверное значение на тенантах Cozystack. Kubelet тенанта подставляет clusterDomain платформы управляющего кластера (обычно `cozy.local`) в `resolv.conf` пода как поисковый домен, тогда как управляемый Kamaji CoreDNS тенанта обслуживает собственный домен кластера тенанта (`cluster.local` согласно `TenantControlPlane.networkProfile.clusterDomain`). Автоопределение собрало бы `<service>.<namespace>.svc.cozy.local.`, который CoreDNS тенанта не обслуживает, и `/readyz` прокси вечно получал бы NXDOMAIN. Закреплённое значение совпадает с тем, что CoreDNS тенанта действительно обслуживает, и контроллер выдаёт `--proxy-fqdn=<service>.<namespace>.svc.cluster.local.`.

Операторы тенантов с нестандартным доменом кластера тенанта (федерации, пользовательский `TenantControlPlane.networkProfile.clusterDomain` в Kamaji и т.п.) могут переопределить его через `addons.ouroboros.valuesOverride.ouroboros.controller.clusterDomain` в CR `Kubernetes`. Чарт учитывает переопределение и выдаёт `--proxy-fqdn=<service>.<namespace>.svc.<cluster-domain>.`. Указывать `_cluster.cluster-domain` (соглашение платформы Cozystack на стороне управляющего кластера, часто `cozy.local`) здесь было бы неправильно: это значение отражает clusterDomain платформы управляющего кластера, а не то, что обслуживает CoreDNS тенанта.

## Включение для отдельного тенанта

Тенантам, которые запускают собственный ingress-nginx с PROXY-protocol, нужен ouroboros внутри кластера тенанта. Параметр `addons.ouroboros` в CR `Kubernetes` конкретного тенанта включает там этот чарт:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: Kubernetes
metadata:
  name: production
  namespace: tenant-acme
spec:
  addons:
    ingressNginx:
      enabled: true
      hosts: [acme.example.org]
      valuesOverride:
        ingress-nginx:
          controller:
            config:
              use-proxy-protocol: "true"
              use-forwarded-headers: "true"
              compute-full-forwarded-for: "true"
              real-ip-header: proxy_protocol
              enable-real-ip: "true"
              # SECURITY: when use-forwarded-headers is on, ALWAYS pair it with
              # proxy-real-ip-cidr scoped to the upstream LB's CIDR. Without
              # that pairing, any client can spoof X-Forwarded-For and
              # bypass IP-based controls. The host platform deliberately
              # omits use-forwarded-headers / compute-full-forwarded-for
              # for this reason — turn them on at the tenant only when you
              # have a paired CIDR.
              # proxy-real-ip-cidr: "10.0.0.0/24"
    ouroboros:
      enabled: true
```

Прежде чем переключать `enabled` обратно в `false`, прочитайте раздел [Отключение](#отключение) ниже - блок rewrite, который ouroboros записал в CoreDNS тенанта, не вычищается автоматически.

`addons.ouroboros.enabled: true` требует `addons.ingressNginx.enabled: true`. Иначе рендер чарта тенанта завершается понятной ошибкой - без ingress-nginx исправлению hairpin нечего исправлять, а аддон-пустышка, который молча ничего не делает, отлаживать сложнее, чем явную ошибку на этапе рендера. Если вам нужен именно ouroboros, сначала включите ingress-nginx. В отличие от флага управляющего кластера, аддон тенанта **не** включает автоматически PROXY-protocol на ingress-nginx тенанта - конфигурация `use-proxy-protocol` / `use-forwarded-headers` / `real-ip-header` задаётся вручную через `valuesOverride`, потому что у тенантов часто разные конфигурации вышестоящих балансировщиков (одни получают кадры PROXY от балансировщика управляющего кластера Cozystack, другие - от собственной граничной инфраструктуры тенанта). Без этой конфигурации ouroboros ничего не делает, поэтому, когда PROXY-protocol выключен, отключённый аддон экономит ресурсы.

## Отключение

Отключение устроено по-разному на двух уровнях, и это сделано намеренно. Путь управляющего кластера имеет шлюз подтверждения на этапе рендера (`publishing.proxyProtocolAcknowledgeUnclean`), потому что `helm.sh/resource-policy: keep` на CR Package платформы создаёт асимметрию «перестали генерировать, но осталось установленным», которую опасно обнаружить слишком поздно. Путь тенанта шлюза **не** имеет - `addons.ouroboros.enabled: false` напрямую запускает `helm uninstall`, pre-delete-хук чарта выполняет очистку при удалении, а шаблон тенанта Cozystack намеренно не содержит рендер-защиты на основе `lookup` (проверка на остаточный HelmRelease заблокировала бы обычное отключение: рендер родителя выполняется до того, как helm-controller применит diff с отсутствующим дочерним ресурсом, поэтому lookup всегда находил бы остаток в момент переключения флага).

**Уровень управляющего кластера.** Переключение `publishing.proxyProtocol` из `true` в `false` делает две вещи:

- Со стороны ingress-nginx: следующее согласование перегенерирует `cozystack.ingress-application` без `use-proxy-protocol` / `real-ip-header` / `enable-real-ip` (Cozystack намеренно НЕ устанавливает `use-forwarded-headers` и `compute-full-forwarded-for` в управляющем кластере: эти ключи позволили бы любому вышестоящему прокси подделывать `X-Forwarded-For` без парного `proxy-real-ip-cidr`). ingress-nginx перестаёт принимать заголовки PROXY-protocol. **Если вышестоящий балансировщик L4 в этот момент всё ещё добавляет кадры PROXY, каждый внешний запрос к ingress-nginx ломается, пока балансировщик тоже не будет перенастроен.** Сначала выключите PROXY на балансировщике, затем переключайте этот флаг.
- Со стороны ouroboros: платформа перестаёт генерировать CR Package `cozystack.ouroboros`, но каждый CR Package несёт `helm.sh/resource-policy: keep`. Helm оставляет существующий Package в кластере, ouroboros остаётся установленным, а блок rewrite в рабочем Corefile продолжает указывать на всё ещё работающий сервис `ouroboros-proxy`. Само по себе переключение флага **не** удаляет ouroboros.

Платформа отказывается рендерить простое переключение флага, когда CR Package `cozystack.ouroboros` уже есть в кластере - `helm template` / `helm upgrade` сразу завершается ошибкой, указывающей на `kubectl delete package.cozystack.io cozystack.ouroboros` (что запускает helm uninstall и pre-delete-хук очистки чарта) и на поле подтверждения. Вендоренный чарт содержит pre-delete-хук (`charts/ouroboros/templates/coredns-cleanup-hook.yaml`), который останавливает контроллер и с помощью `sed` вырезает блок `# === BEGIN ouroboros … END ouroboros ===` из `kube-system/coredns` автоматически, когда helm действительно удаляет чарт, - операторам **не** нужно выполнять ручной рецепт с `sed` при обычном отключении. Полная последовательность отключения в управляющем кластере:

1. Выключите вставку PROXY-protocol на вышестоящем балансировщике (предусловие для внешнего трафика).
2. Удалите CR Package командой `kubectl delete package.cozystack.io cozystack.ouroboros` (или добавьте его в `bundles.disabledPackages`). Это запускает helm uninstall, который выполняет pre-delete-хук чарта и автоматически патчит `kube-system/coredns`.
3. Установите `publishing.proxyProtocol: false` в значениях платформы. Рендер-защита теперь проходит (`lookup` для `cozystack.ouroboros` возвращает nil после шага 2), поэтому `publishing.proxyProtocolAcknowledgeUnclean` остаётся в значении по умолчанию `false`.

Если у оператора есть причина переключить `publishing.proxyProtocol: false` ДО удаления CR Package (строгий GitOps, где `kubectl delete` не входит в основной процесс, параллельные откаты и т.п.), установите `publishing.proxyProtocolAcknowledgeUnclean: true` вместе с переключением флага в том же коммите, а удаление Package выполните отдельно. Верните `proxyProtocolAcknowledgeUnclean` в `false`, когда кластер пробудет чистым один цикл согласования. Это аварийный клапан, а не рекомендуемый путь - поэтапная последовательность выше оставляет флаг подтверждения в значении по умолчанию и избавляет от лишнего цикла.

Рецепт очистки управляющего кластера ниже - ручной запасной вариант для редкого случая, когда pre-delete-хук чарта не сработал (под контроллера застрял в CrashLoop и заблокировал шаг остановки, дрейф RBAC на ConfigMap, helm uninstall прерван до выполнения хука). Прибегайте к нему только тогда, когда автоматический путь не сработал и блок BEGIN/END всё ещё находится в `kube-system/coredns` после удаления пакета.

**Известная дыра**: оператор, который удаляет CR Package до переключения флага, полностью обходит защиту (`lookup` возвращает nil, рендер платформы проходит). Этот путь в основном безопасен - `kubectl delete package` запускает helm uninstall, и pre-delete-хук чарта патчит Corefile при удалении. Дыра - это редкий случай, когда сам хук не сработал (застрявший контроллер, дрейф RBAC, тайм-аут хука), а оператор этого не заметил. Шлюз подтверждения - это эшелонированная защита, а не герметичный замок.

**Уровень тенанта.** Переключение `addons.ouroboros.enabled` из `true` в `false` прекращает рендер HelmRelease, и Flux удаляет чарт при следующем согласовании на стороне тенанта. Аннотация `helm.sh/resource-policy: keep`, упомянутая выше для управляющего кластера, находится на CR Package платформы - на стороне тенанта она **не** действует, поэтому отключение там действительно удаляет рабочую нагрузку, а не просто прекращает её генерацию. helm uninstall выполняет тот же pre-delete-хук чарта на тенанте: он автоматически обнуляет ключ `ouroboros.override` в `kube-system/coredns-custom` до удаления пода контроллера. Полная последовательность отключения на тенанте состоит из одного шага:

1. Установите `addons.ouroboros.enabled: false` в CR `Kubernetes` тенанта. Flux выполнит `helm uninstall`, и pre-delete-хук чарта сам патчит `kube-system/coredns-custom`.

Если pre-delete-хук чарта не сработал (под контроллера застрял в CrashLoop, дрейф RBAC на ConfigMap, тайм-аут Job, ручной `kubectl delete hr` в обход helm uninstall), симптомом будет устаревшая запись rewrite в ConfigMap `kube-system/coredns-custom` тенанта, указывающая на уже несуществующий сервис. Для восстановления выполните рецепт очистки тенанта ниже с использованием admin-kubeconfig тенанта.

Ingress-nginx тенанта не затрагивается переключением одного лишь `addons.ouroboros` - PROXY-protocol на ingress тенанта настраивается вручную через `valuesOverride` и остаётся таким, каким его задал оператор.

### Рецепт очистки управляющего кластера (запасной вариант)

Этот рецепт - ручной запасной вариант для редкого случая, когда pre-delete-хук чарта не сработал (штатный путь, автоматически выполняющий хук, описан в последовательности отключения выше). Требования: `kubectl` с kubeconfig управляющего кластера, а также `jq` и `sed` на рабочей станции оператора. Блок ограничен строками `# === BEGIN ouroboros (do not edit by hand) ===` и `# === END ouroboros ===` (пояснение `(do not edit by hand)` есть только в строке BEGIN). Диапазон `sed` ниже использует сопоставление по префиксу с обеих сторон, поэтому маркеры находятся независимо от их хвостовой части.

```bash
# === BEGIN cleanup-recipe ===
existing=$(kubectl --namespace kube-system get configmap coredns \
  --output jsonpath='{.data.Corefile}')
cleaned=$(printf '%s\n' "$existing" \
  | sed '/# === BEGIN ouroboros/,/# === END ouroboros/d')
kubectl --namespace kube-system patch configmap coredns \
  --type merge \
  --patch "$(jq --null-input --arg c "$cleaned" \
      '{data: {Corefile: $c}}')"
kubectl --namespace kube-system rollout restart deployment/coredns
# === END cleanup-recipe ===
```

Рецепт использует JSON merge-patch, поэтому метки, аннотации и другие ключи данных ConfigMap `coredns` (включая любые метаданные, управляемые Talos) сохраняются.

### Рецепт очистки тенанта (запасной вариант)

Этот рецепт - ручной запасной вариант для редкого случая, когда pre-delete-хук чарта не смог самостоятельно обнулить ключ `ouroboros.override` (штатный путь на тенанте оставляет очистку чарту и вообще не требует ручного рецепта). Требования: `kubectl` с admin-kubeconfig тенанта (`jq` / `sed` не нужны - рецепт для тенанта состоит из одного разового патча). Выполните его после неудавшегося отключения, чтобы вернуть ConfigMap в чистое состояние.

```bash
kubectl --kubeconfig <tenant-admin-kubeconfig> --namespace kube-system patch \
  configmap coredns-custom --type merge \
  --patch '{"data":{"ouroboros.override":null}}'
```

`ouroboros.override` - единственный ключ, которым ouroboros владеет внутри `coredns-custom`; его обнуление не затрагивает остальные ключи (принадлежащие оператору фрагменты `*.override`, будущие дополнения Cozystack).

## Операторы изолированных сред

Чарт и образ загружаются напрямую из апстрим-реестра `lexfrei/ouroboros` - они не зеркалируются в `ghcr.io/cozystack/*`. Операторам изолированных (air-gapped) сред нужно отзеркалировать два дополнительных источника:

- `oci://ghcr.io/lexfrei/charts/ouroboros:<version>` (чарт, дайджест зафиксирован в `packages/system/ouroboros/Makefile` как `OUROBOROS_CHART_DIGEST=sha256:…` - точные значения `OUROBOROS_CHART_VERSION` и `OUROBOROS_CHART_DIGEST` берите из Makefile того релиза Cozystack, который вы зеркалируете);
- `ghcr.io/lexfrei/ouroboros:<version>@sha256:…` (образ, дайджест зафиксирован в `packages/system/ouroboros/values.yaml` в `image.tag` - передайте именно эту ссылку в `regsync` / `crane copy` / `skopeo copy`).

Ссылка на образ в Cozystack включает дайджест `@sha256:…`, указанный выше. Инструменты зеркалирования должны либо сохранить этот дайджест на всём пути (стандартное поведение `regsync`, `crane copy`, `skopeo copy`), либо убрать закрепление `@sha256:…` из `values.yaml` после зеркалирования - иначе kubelet при загрузке будет резолвить апстрим-дайджест, не найдёт его среди тегов зеркала и попадёт в `ErrImagePull`.

## Почему в настройках Cozystack по умолчанию не используется KEP-1860

Значение по умолчанию `kubeProxyReplacement: true` в Cozystack означает, что Cilium полностью убирает фронтенд LB, когда `ipMode != VIP`, ломая приём трафика сервисов для IP-адресов, анонсируемых по L2/BGP. Режим `Proxy` из KEP-1860 предназначен для кластеров за внешним прокси-балансировщиком под управлением CCM, который сам обрабатывает соединение; это не тот контракт, который поставляет Cozystack. Для топологий с анонсами L2/BGP, которые Cozystack поставляет по умолчанию, правильное решение - ouroboros.
