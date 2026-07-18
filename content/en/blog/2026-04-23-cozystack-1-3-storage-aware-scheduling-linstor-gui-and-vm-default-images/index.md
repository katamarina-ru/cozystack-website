---
title: "Cozystack 1.3: планирование с учётом хранилища, LINSTOR GUI и образы ВМ по умолчанию"
slug: cozystack-1-3-storage-aware-scheduling-linstor-gui-and-vm-default-images
date: 2026-04-23
author: "Timur Tukaev"
description: "Cozystack 1.3 приносит планирование подов с учётом хранилища, управляемый LINSTOR GUI, курируемый каталог образов ВМ, наблюдаемость на уровне приложений и восстановление резервных копий ВМ между пространствами имён."
article_types:
  - release
topics:
  - platform
  - storage
  - virtualization
  - observability
images:
  - "cozystack-v1.3.0.png"
---

{{< figure src="cozystack-v1.3.0.png" alt="Cozystack v1.3.0" width="720" >}}

### Cozystack 1.3: планирование с учётом хранилища, LINSTOR GUI и образы ВМ по умолчанию

[Cozystack v1.3.0](https://github.com/cozystack/cozystack/releases/tag/v1.3.0) теперь доступен. Релиз также включает все исправления, вышедшие в линейке патчей v1.2.1 → v1.2.4.

В этом цикле платформа продвинулась вперёд в пяти ясных направлениях: более умное размещение хранилища, управляемый UI для LINSTOR, встроенный каталог базовых образов ВМ, более глубокая наблюдаемость на уровне приложений и полноценное резервное копирование и восстановление ВМ между пространствами имён.

### Основные моменты

#### Планирование с учётом хранилища через расширитель LINSTOR

Теперь `cozystack-scheduler` обращается к **расширителю планировщика LINSTOR** при размещении подов, которые объявляют одновременно `SchedulingClass` и PVC на базе LINSTOR. Поды предпочтительно размещаются на узлах, где уже находятся реплики их томов, что сокращает межузловой трафик репликации и снижает задержку ввода-вывода для рабочих нагрузок с интенсивным использованием хранилища — баз данных, объектных хранилищ, ВМ.

Это развивает систему SchedulingClass, представленную в v1.2, и не требует настройки на стороне арендатора. Операторы могут по-прежнему сочетать локальность хранилища с существующими ограничениями по дата-центру / поколению оборудования в SchedulingClass.

#### LINSTOR GUI: управляемая веб-консоль для администрирования хранилища

Новый подключаемый пакет `linstor-gui` развёртывает **linstor-gui от LINBIT** рядом с контроллером LINSTOR с клиентской аутентификацией mTLS и security-контекстом без прав root. Когда настроен OIDC, опциональный защищённый Keycloak ingress (через oauth2-proxy) открывает доступ к UI; доступ ограничен участниками группы `cozystack-cluster-admin`, что согласуется с RBAC администратора хост-кластера. Рабочий процесс через CLI не изменился — GUI строго дополняет его.

#### Образы ВМ по умолчанию: подготовка ВМ из коробки

Новый пакет `vm-default-images` поставляет курируемый набор **образов ВМ уровня кластера** (Ubuntu, Debian, CentOS Stream и другие) в виде заранее заполненных DataVolume. Арендаторы могут развёртывать ВМ на основе хорошо известных базовых образов, не загружая их предварительно. Пакет подключается через комплект `iaas` и по умолчанию использует реплицируемое хранилище. Чарт `vm-disk` также получает новый тип источника «disk» для клонирования из существующих vm-disk в том же пространстве имён.

#### Наблюдаемость на уровне приложений: WorkloadsReady, Events и учёт S3

Теперь приложения предоставляют условие **WorkloadsReady** в своём статусе, агрегируя лежащие в их основе ресурсы WorkloadMonitor, что даёт операторам единый сигнал готовности для Deployment, StatefulSet, DaemonSet и PVC. Панель управления получает новую **вкладку Events**, показывающую события Kubernetes в рамках пространства имён для каждого приложения.

Реконсилятор WorkloadMonitor расширен для отслеживания объектов **COSI BucketClaim** как полноценных Workload, а контроллер бакетов запрашивает метрики размера бакетов SeaweedFS из VictoriaMetrics — что позволяет строить конвейеры биллинга S3 наравне с Pod и PVC.

#### Восстановление резервных копий ВМ между пространствами имён и панель RestoreJob

Система резервного копирования теперь поддерживает **восстановление резервных копий VMInstance в другое пространство имён** с сохранением IP/MAC и безопасной семантикой переименования. Процессы резервного копирования и восстановления «на месте» для VMDisk и VMInstance улучшены по всем направлениям, а сообщения об ошибках Velero теперь передаются в статус Application. Панель управления получает полноценную **работу с RestoreJob**: представление списка, страницу с деталями, форму создания и пункт в боковой панели.

### Также в v1.3.0

- **Более строгая проверка имён арендаторов** — только буквенно-цифровые символы на уровне API, плюс проверка того, что вычисленное пространство имён цепочки предков укладывается в ограничение Kubernetes в 63 символа.
- **Поле `subnets` в VMInstance переименовано в `networks`** с выпадающим селектором в панели управления; старое поле остаётся поддерживаемым через миграцию 36.
- **Пользовательские темы Keycloak можно внедрять** через `initContainers`; Keycloak-Configure добавляет подтверждение email и настройки SMTP для процессов самостоятельной регистрации.
- **Предварительная проверка среды выполнения хоста** (`make preflight`) предупреждает, когда отдельный containerd или docker работает рядом со встроенной средой выполнения k3s.
- **Системный PostgreSQL закреплён на версии 17.7-standard-trixie** для Grafana, Alerta, Harbor, Keycloak и SeaweedFS — чтобы предотвратить дрейф на PostgreSQL 18.
- **kube-ovn обновлён до v1.15.10** с исправлением регрессии port-group, сохраняющим членство LSP для ВМ при живой миграции.
- **Все исправления ошибок из v1.2.1 → v1.2.4** включены в v1.3.0.

### Документация, о которой стоит знать

Этот релиз сопровождается значительным обновлением документации. Новые и переписанные руководства, которые напрямую дополняют возможности v1.3:

- [Пользовательские темы Keycloak / white-labeling](https://cozystack.io/docs/v1.3/operations/configuration/white-labeling/) — контракт образа, настройка, `imagePullSecrets` и активация темы.
- [Настройка агрегации сетевых каналов (LACP)](https://cozystack.io/docs/v1.3/install/how-to/bonding/) — настройка LACP для установок Cozystack.
- [Резервное копирование и восстановление для VMInstance и VMDisk](https://cozystack.io/docs/v1.3/virtualization/backup-and-recovery/) — обновлено для процессов восстановления между пространствами имён в v1.3.
- [Внешние приложения через ApplicationDefinition API](https://cozystack.io/docs/v1.3/applications/external/) — полностью переписанное руководство на примерах сервера Minecraft.
- [Go-типы для управляемых приложений Cozystack](https://cozystack.io/docs/v1.3/cozystack-api/go-types/) — использование сгенерированного модуля Go из ваших собственных контроллеров.
- [Соглашение об именовании ApplicationDefinition](https://cozystack.io/docs/v1.3/cozystack-api/application-definitions/) — как `cozystack-api` разрешает виды (kinds) в их базовые определения.
- [Структура пространств имён арендаторов и вывод родитель / потомок](https://cozystack.io/docs/v1.3/guides/tenants/) — как вычисляются пространства имён вложенных арендаторов.
- [Матрица соответствия версий Talos / talosctl / Cozystack](https://cozystack.io/docs/v1.3/install/kubernetes/talm/) — исчерпывающий справочник по совместимости.
- [Зеркала реестров для Kubernetes арендатора в изолированной (air-gapped) среде](https://cozystack.io/docs/v1.3/install/kubernetes/air-gapped/) — улучшенные рекомендации для офлайн-установок.

### Управление проектом

В этом цикле мы также приветствовали двух новых мейнтейнеров: **Mattia Eleuteri** ([@mattia-eleuteri](https://github.com/mattia-eleuteri)) — CSI, хранилище, сети и безопасность — и **Matthieu Robin** ([@matthieu-robin](https://github.com/matthieu-robin)) — управляемые приложения, качество платформы и бенчмаркинг.

### Спасибо всем участникам

Этот релиз сформирован работой [@androndo](https://github.com/androndo), [@Arsolitt](https://github.com/Arsolitt), [@BROngineer](https://github.com/BROngineer), [@IvanHunters](https://github.com/IvanHunters), [@kitsunoff](https://github.com/kitsunoff), [@kvaps](https://github.com/kvaps), [@lexfrei](https://github.com/lexfrei), [@lllamnyp](https://github.com/lllamnyp), [@mattia-eleuteri](https://github.com/mattia-eleuteri), [@myasnikovdaniil](https://github.com/myasnikovdaniil), [@sircthulhu](https://github.com/sircthulhu) и [@tym83](https://github.com/tym83).

Особо приветствуем нашего впервые присоединившегося участника [@Arsolitt](https://github.com/Arsolitt). Спасибо всем.

### Ссылки на релиз

- [Cozystack v1.3.0 на GitHub](https://github.com/cozystack/cozystack/releases/tag/v1.3.0)
- [Полный список изменений v1.2.0 → v1.3.0](https://github.com/cozystack/cozystack/compare/v1.2.0...v1.3.0)

### Присоединяйтесь к сообществу

- Telegram [группа](https://t.me/cozystack)
- Slack [группа](https://kubernetes.slack.com/archives/C06L3CPRVN1) (получите приглашение на [https://slack.kubernetes.io](https://slack.kubernetes.io))
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)
- [Cozysummit Virtual 2026](https://community.cncf.io/events/details/cncf-virtual-project-events-hosted-by-cncf-presents-cozysummit-virtual-2026/)
