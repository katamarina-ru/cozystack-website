---
title: "Cozystack 1.4: новый интерфейс панели управления, постоянные воркеры арендаторов, стратегии резервного копирования и разделение GPU по частям"
slug: cozystack-1-4-new-dashboard-persistent-workers-backup-strategies-gpu-sharing
date: 2026-05-21
author: "Cozystack Team"
description: "Cozystack v1.4.0 приносит панель управления на основе схем, постоянное хранилище для рабочих узлов арендаторского Kubernetes, облачные пресеты ресурсов, декларативное резервное копирование для управляемых приложений, разделение GPU по частям на базе HAMi, устранение проблемы PROXY-протокола и hairpin-NAT одним переключателем, а также операционные улучшения для обновлений, планирования и наблюдаемости."
images:
  - "cozystack-1-4-banner.jpg"
article_types:
  - announcement
topics:
  - platform
  - release
---

{{< figure src="cozystack-1-4-banner.jpg" alt="Баннер релиза Cozystack v1.4.0" width="720" >}}

Cozystack v1.4.0 теперь доступен. Релиз был опубликован 19 мая 2026 года и включает все исправления, вышедшие в линейке патчей с v1.3.1 по v1.3.3.

Этот цикл сосредоточен на операционном опыте эксплуатации Cozystack как продуктовой платформы: более быстрая архитектура панели управления, более устойчивые рабочие узлы арендаторского Kubernetes, более понятное определение размеров ресурсов, рабочие процессы резервного копирования для управляемых приложений, лучшая утилизация GPU, более безопасная публикация ingress и меньше состояний гонки при первых установках и обновлениях.

## Основные моменты

### Новый интерфейс панели управления на основе схем

Cozystack 1.4 поставляется с переписанной панелью управления из проекта `cozystack/cozystack-ui`. Прежний стек `openapi-ui` вместе с BFF был заменён на фронтенд на React 19 и TypeScript, который напрямую взаимодействует с Kubernetes API.

Новая архитектура убирает дополнительный процесс и слой прокси, сохраняя при этом работу панели управления на основе схем. Она также улучшает несколько повседневных рабочих процессов:

* VNC-доступ к виртуальным машинам теперь использует динамические WebSocket-URL вместо привязанных к конкретному развёртыванию предположений о `localhost`.
* Панель управления может читать ресурсы `ApplicationDefinition` для каталога приложений и маркетплейса.
* Операторы могут внедрять брендирование во время выполнения через ConfigMap, включая логотипы, названия и фирменные цвета, без пересборки образа.
* Существующие закладки `/openapi-ui/*` перенаправляются на новую консоль.
* Пакет был последовательно переименован в `cozy-dashboard`.

{{< figure src="dashboard-marketplace-iaas.webp" alt="Панель управления Cozystack 1.4 — маркетплейс IaaS с сервисами Bucket, Kubernetes, VirtualPrivateCloud, VMDisk и VMInstance" width="720" caption="Новая панель управления предоставляет маркетплейс IaaS, управляемый ресурсами ApplicationDefinition." >}}

{{< figure src="dashboard-marketplace-paas.webp" alt="Панель управления Cozystack 1.4 — маркетплейс PaaS с управляемыми PostgreSQL, MariaDB, ClickHouse, Kafka, Redis, OpenSearch, NATS, Harbor, Keycloak и другими" width="720" caption="Каталог PaaS охватывает управляемые базы данных, обмен сообщениями, объектное хранилище, секреты, поиск и сервисы инференса." >}}

{{< figure src="dashboard-deploy-kubernetes.webp" alt="Панель управления Cozystack 1.4 — форма развёртывания нового Kubernetes с аддонами кластера (cert-manager, Cilium, Gateway API, ingress-nginx, GPU Operator)" width="720" caption="Развёртывание управляемого кластера Kubernetes использует ту же форму на основе схем, с декларативно предоставленными аддонами кластера." >}}

{{< figure src="dashboard-deploy-httpcache.webp" alt="Панель управления Cozystack 1.4 — форма развёртывания нового httpcache с параметрами size, storageClass, endpoints, реплик HAProxy и ресурсов" width="720" caption="Развёртывание управляемого HTTP-кэша, где размер PVC, класс хранилища, конечные точки и параметры ресурсов сгенерированы из схемы приложения." >}}

Документация:

* [Развёртывание приложений через новую панель управления](https://cozystack.io/docs/v1.4/getting-started/deploy-app/)
* [Справочник ApplicationDefinition](https://cozystack.io/docs/v1.4/cozystack-api/application-definitions/)
* [White-labeling и брендирование во время выполнения](https://cozystack.io/docs/v1.4/operations/configuration/white-labeling/)

### Постоянное хранилище рабочих узлов для арендаторского Kubernetes

Рабочие ВМ арендаторского Kubernetes теперь используют постоянные диски на основе PVC через `dataVolumeTemplates` KubeVirt. Ранее воркеры использовали эфемерное хранилище `emptyDisk`, из-за чего сертификаты kubelet, kubeconfig и состояние containerd терялись после перезагрузки ВМ. Перезагруженный воркер мог потерять свою идентичность и потребовать ручного восстановления.

В v1.4 состояние воркеров переживает перезапуск ВМ. Поле `ephemeralStorage` ресурса NodeGroup переименовано в `diskSize`, а новая опция `storageClass` на уровне nodeGroup позволяет операторам управлять тем, где выделяются диски воркеров. Миграция 39 автоматически переписывает устаревшие значения во время обновления.

Существующие кластеры арендаторов один раз перекатят рабочие узлы, потому что шаблон машины KubeVirt меняется. Операторам следует спланировать ёмкость для этого перекатывания и осознанно выбрать класс хранилища. Для многих сценариев с дисками рабочих узлов рекомендуется StorageClass `local`, поскольку диски воркеров теперь переживают перезапуски и не нуждаются в семантике репликации DRBD.

Документация: [Конфигурация арендаторского Kubernetes](https://cozystack.io/docs/v1.4/kubernetes/).

### Пресеты ресурсов на основе типов инстансов

Пресеты ресурсов теперь следуют облачной таксономии `<series>.<size>`. Новая модель охватывает пять серий соотношения CPU к памяти:

* `t1` для крошечных и малопамятных рабочих нагрузок.
* `c1` для рабочих нагрузок со сбалансированными вычислениями.
* `s1` для стандартных сервисов, таких как прокси и кэши.
* `u1` для универсальных рабочих нагрузок, таких как базы данных и обмен сообщениями.
* `m1` для рабочих нагрузок с интенсивным использованием памяти, таких как поиск и аналитика.

Каждая серия включает восемь размеров от `nano` до `4xlarge`, что даёт операторам и арендаторам в общей сложности 40 пресетов.

Прежние плоские имена, такие как `small`, `medium` и `large`, по-прежнему принимаются как устаревшие псевдонимы. Существующие развёртывания сохраняют те же значения CPU и памяти, тогда как Миграция 39 переписывает сохранённые значения на новые имена. Cozystack API теперь выдаёт предупреждения об устаревании, когда CR приложений всё ещё используют устаревшие имена пресетов.

Документация: [Пресеты ресурсов](https://cozystack.io/docs/v1.4/guides/resource-management/).

### Декларативные стратегии резервного копирования для управляемых приложений

Контроллер стратегий резервного копирования теперь поддерживает PostgreSQL, MariaDB, ClickHouse и FoundationDB. Арендаторы могут определить стратегию вместе с ресурсами `BackupClass`, `Plan`, `BackupJob` и `RestoreJob`, а контроллер составляет специфичные для бэкенда объекты для каждого управляемого сервиса.

Новые стратегии поддерживают резервное копирование по расписанию, снимки по запросу, восстановление на месте и рабочие процессы восстановления в копию для S3-совместимого объектного хранилища. Учётные данные ссылаются через Kubernetes Secrets вместо встроенного хранения, а RBAC контроллера ограничен так, что он может обращаться только к явно указанным секретам.

Это расширяет существующие процессы резервного копирования для VMInstance и VMDisk и приближает Cozystack к полному покрытию резервным копированием всего каталога управляемых приложений.

Документация:

* [Конфигурация резервного копирования управляемых приложений](https://cozystack.io/docs/v1.4/operations/services/managed-app-backup-configuration/)
* [Резервное копирование и восстановление приложений](https://cozystack.io/docs/v1.4/applications/backup-and-recovery/)

### Разделение GPU по частям на базе HAMi

Cozystack 1.4 добавляет `hami` как опциональный системный пакет. HAMi v2.8.1, проект CNCF Sandbox, обеспечивает разделение GPU по частям для арендаторских кластеров Kubernetes.

С включённым HAMi рабочие нагрузки арендаторов могут запрашивать ресурсы, такие как `nvidia.com/gpu`, `nvidia.com/gpumem` и `nvidia.com/gpucores`, позволяя нескольким подам совместно использовать один физический GPU NVIDIA с явным разбиением памяти и вычислений. Интеграция включает device plugin, расширитель планировщика (scheduler extender), мутирующий вебхук и RuntimeClass. Она предоставляется через опциональный переключатель `hami.enabled` и зависит от NVIDIA GPU Operator.

Есть один важный момент совместимости: изоляция вычислений HAMi зависит от образов контейнеров с glibc старше 2.34. Ограничение памяти работает широко, но образы на основе Alpine и musl не поддерживаются для изоляции вычислений HAMi-core.

Документация: [Разделение GPU с помощью HAMi](https://cozystack.io/docs/v1.4/kubernetes/gpu-sharing/).

### Один переключатель для PROXY-протокола и hairpin NAT

Новая опция `publishing.proxyProtocol: true` включает PROXY-протокол на хостовом ingress-nginx и развёртывает Ouroboros для решения связанной проблемы hairpin-NAT.

Когда PROXY-протокол включён, внутрикластерный трафик к собственным публичным именам хостов кластера в противном случае может достигать ingress-nginx без требуемого заголовка PROXY. Ouroboros исправляет этот путь через сниппеты переписывания CoreDNS. Cozystack предоставляет его как в виде системного пакета на уровне хоста, так и в виде аддона для каждого арендатора через `addons.ouroboros.enabled`.

Поведение по умолчанию не изменилось. Кластеры, которые не включают PROXY-протокол, не получают новых ресурсов.

Документация: [PROXY-протокол и hairpin NAT](https://cozystack.io/docs/v1.4/networking/hairpin-proxy-protocol/).

### Улучшенное поведение HelmRelease и надёжность bootstrap арендаторов

Оператор Cozystack теперь предоставляет настройки генерации HelmRelease в виде флагов оператора и значений чарта, включая интервал, интервал повторных попыток, таймаут установки, таймаут обновления и максимальную историю.

Стратегия повторных попыток теперь использует `RetryOnFailure`, что позволяет избежать циклов удаления-и-переустановки, когда первая установка выполняется медленно. Приложения также могут задать таймаут установки и обновления для каждого Application через аннотацию `release.cozystack.io/helm-install-timeout`. Арендаторский Kubernetes использует это, чтобы дать Kamaji достаточно времени во время холодного bootstrap, устраняя повторяющийся режим сбоя `wait hr/tenant-kubernetes timeout`.

Документация:

* [Операции с арендаторским Kubernetes](https://cozystack.io/docs/v1.4/kubernetes/)
* [Устранение неполадок Flux CD](https://cozystack.io/docs/v1.4/operations/troubleshooting/flux-cd/)

### Резервирование ресурсов kubelet для рабочих узлов

Рабочие узлы арендаторского Kubernetes теперь получают автоматически вычисляемые резервирования kubelet для CPU и памяти. Это удерживает сам kubelet от того, чтобы стать целью при нехватке памяти, и делает решения планировщика и автомасштабирования более точными.

Аннотации cluster-autoscaler теперь сообщают выделяемые (allocatable) CPU и память вместо сырых суммарных значений, поэтому решения об автомасштабировании соответствуют тому, что Kubernetes действительно может разместить.

Документация: [Операции с арендаторским Kubernetes](https://cozystack.io/docs/v1.4/kubernetes/).

## Также в v1.4.0

* Параметры PostgreSQL теперь типизированы и защищены списком запрещённых (denylist) для опасных значений, таких как `archive_command`, `restore_command`, `ssl_passphrase_command`, `dynamic_library_path` и `*_preload_libraries`.
* Keycloak получает поддержку `extraEnv` и настройки профиля пользователя.
* Приложение etcd предоставляет расписания резервного копирования в S3 через обновлённый etcd-operator.
* Политика `upgradeCRDs` для каждого пакета теперь настраиваема.
* `cozyreport` теперь собирает Flux, cert-manager, контекст хоста, ресурсы приложений и верхнеуровневый `summary.txt`.
* Ingress арендатора SeaweedFS ограничивает одиночные PUT-запросы до 5 ГБ.
* Добавлены панели наблюдаемости GPU и правила записи (recording rules) для Grafana и VictoriaMetrics.
* Исправлена фильтрация портов VMInstance в новом режиме cozy-proxy v0.3.0.
* LINSTOR CSI обновлён с исправлениями ошибок двойного подключения (dual-attach) и временного понижения (transient demotion).

Документация:

* [Конфигурация PostgreSQL](https://cozystack.io/docs/v1.4/applications/postgres/)
* [Keycloak и OIDC](https://cozystack.io/docs/v1.4/operations/oidc/)
* [Конфигурация сервиса etcd](https://cozystack.io/docs/v1.4/operations/services/etcd/)
* [Конфигурация сервиса SeaweedFS](https://cozystack.io/docs/v1.4/operations/services/seaweedfs/)
* [Панели мониторинга](https://cozystack.io/docs/v1.4/operations/services/monitoring/dashboards/)
* [Устранение неполадок и диагностика](https://cozystack.io/docs/v1.4/operations/troubleshooting/)

## Компоненты платформы

Cozystack 1.4 обновляет базу платформы и несколько основных пакетов:

* Talos: с v1.12.7 до v1.13.0
* cert-manager: с v1.19.3 до v1.20.2
* Cilium: с v1.19.1 до v1.19.3
* NVIDIA GPU Operator: с v25.3.0 до v26.3.1
* etcd-operator: с v0.4.2 до v0.4.3
* KubeVirt: с v1.6.3 до v1.8.2
* cozy-proxy: с v0.2.0 до v0.3.0
* linstor-csi: v1.10.6
* HAMi: v2.8.1
* Ouroboros: v0.7.2

Документация:

* [Обзор стека платформы](https://cozystack.io/docs/v1.4/guides/platform-stack/)
* [Руководство по обновлению](https://cozystack.io/docs/v1.4/operations/cluster/upgrade/)

## Замечания по обновлению

Большинство операторов могут обновиться до v1.4.0 без ручных изменений конфигурации. Cozystack сохраняет тот же API-контур для существующих рабочих нагрузок, а внутриплатформенные миграции обрабатывают основные переписывания значений.

Есть несколько операционных деталей, которые стоит спланировать:

* Рабочие узлы арендаторского Kubernetes перекатятся один раз. Миграция `ephemeralStorage` в `diskSize` автоматическая, но существующие рабочие ВМ заменяются одна за другой, потому что шаблон машины KubeVirt меняется.
* ВМ KubeVirt, которые уже работали до обновления платформы, нуждаются в холодном перезапуске после обновления. Переход KubeVirt с v1.6.3 на v1.8.2 пересекает изменение вышестоящего QEMU, и живая миграция ВМ, существовавших до обновления, может завершиться сбоем. Новые ВМ, созданные после обновления, не затронуты.
* Устаревшие имена пресетов ресурсов по-прежнему работают как устаревшие псевдонимы, но новые развёртывания должны использовать имена `<series>.<size>`.
* Развёртывания PostgreSQL, использующие параметры из списка запрещённых, не будут отрендерены, пока эти параметры не будут удалены.
* cert-manager v1.20 меняет UID/GID контейнера по умолчанию на 65532. Операторам с пользовательской PodSecurityPolicy, imagePullSecrets или смонтированными в файловой системе сертификатами, привязанными к прежнему UID, следует пересмотреть свою конфигурацию.

Документация:

* [Руководство по обновлению](https://cozystack.io/docs/v1.4/operations/cluster/upgrade/)
* [Операции с арендаторским Kubernetes](https://cozystack.io/docs/v1.4/kubernetes/)
* [Операции виртуализации](https://cozystack.io/docs/v1.4/virtualization/)
* [Управление ресурсами](https://cozystack.io/docs/v1.4/guides/resource-management/)
* [Конфигурация PostgreSQL](https://cozystack.io/docs/v1.4/applications/postgres/)

## Документация, о которой стоит знать

* [Новая панель управления и каталог приложений](https://cozystack.io/docs/v1.4/getting-started/deploy-app/)
* [Справочник ApplicationDefinition](https://cozystack.io/docs/v1.4/cozystack-api/application-definitions/)
* [White-labeling и брендирование во время выполнения](https://cozystack.io/docs/v1.4/operations/configuration/white-labeling/)
* [Конфигурация арендаторского Kubernetes](https://cozystack.io/docs/v1.4/kubernetes/)
* [Пресеты ресурсов](https://cozystack.io/docs/v1.4/guides/resource-management/)
* [Конфигурация резервного копирования управляемых приложений](https://cozystack.io/docs/v1.4/operations/services/managed-app-backup-configuration/)
* [Резервное копирование и восстановление приложений](https://cozystack.io/docs/v1.4/applications/backup-and-recovery/)
* [Разделение GPU с помощью HAMi](https://cozystack.io/docs/v1.4/kubernetes/gpu-sharing/)
* [PROXY-протокол и hairpin NAT](https://cozystack.io/docs/v1.4/networking/hairpin-proxy-protocol/)
* [Руководство по обновлению](https://cozystack.io/docs/v1.4/operations/cluster/upgrade/)
* [Документация Cozystack v1.4](https://cozystack.io/docs/v1.4/)

## Спасибо всем контрибьюторам

Этот релиз сформирован работой [@androndo](https://github.com/androndo), [@Arsolitt](https://github.com/Arsolitt), [@dislogical](https://github.com/dislogical), [@dvc](https://github.com/dvc), [@IvanHunters](https://github.com/IvanHunters), [@kvaps](https://github.com/kvaps), [@lexfrei](https://github.com/lexfrei), [@matthieu-robin](https://github.com/matthieu-robin), [@mattia-eleuteri](https://github.com/mattia-eleuteri), [@myasnikovdaniil](https://github.com/myasnikovdaniil), [@sircthulhu](https://github.com/sircthulhu) и [@tym83](https://github.com/tym83).

Особое приветствие впервые присоединившимся контрибьюторам [@dvc](https://github.com/dvc) и [@dislogical](https://github.com/dislogical). Спасибо всем.

## Ссылки на релиз

* [Cozystack v1.4.0 на GitHub](https://github.com/cozystack/cozystack/releases/tag/v1.4.0)
* [Полный список изменений с v1.3.0 до v1.4.0](https://github.com/cozystack/cozystack/compare/v1.3.0...v1.4.0)
* [Cozystack UI](https://github.com/cozystack/cozystack-ui)
* [HAMi](https://github.com/Project-HAMi/HAMi)
* [Ouroboros](https://github.com/lexfrei/ouroboros)

## Присоединяйтесь к сообществу

* GitHub: [cozystack/cozystack](https://github.com/cozystack/cozystack)
* Telegram: [@cozystack](https://t.me/cozystack)
* Slack: [#cozystack](https://kubernetes.slack.com/archives/C06L3CPRVN1) в рабочем пространстве Kubernetes ([приглашение](https://slack.kubernetes.io))
* [Подпишитесь на календарь встреч нашего сообщества](https://zoom-lfx.platform.linuxfoundation.org/meetings/cozystack)
* [Добавьте встречи в свой календарь](https://webcal.prod.itx.linuxfoundation.org/lfx/lfsixxnFWxbvsyEuC2)
