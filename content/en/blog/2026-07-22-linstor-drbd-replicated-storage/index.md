---
title: "Как LINSTOR и DRBD сохраняют ваши данные, когда сервер умирает"
slug: linstor-drbd-replicated-storage
date: 2026-07-22
author: "Timur Tukaev"
description: "Как Cozystack использует LINSTOR и DRBD для синхронной репликации на блочном уровне на физическом железе (bare metal): настройка пулов хранения, реплицированный StorageClass и что происходит при отказе узла."
article_types:
  - tech-article
  - storage
topics:
  - storage
  - linstor
  - drbd
  - kubernetes
  - platform

---

# Как LINSTOR и DRBD сохраняют ваши данные, когда сервер умирает

Кошмар любого bare-metal оператора: диск отказывает в 3 часа ночи. Если ваше хранилище привязано к узлу (local-path или hostPath том, закреплённый за одним узлом), вы восстанавливаетесь из бэкапа и молитесь, чтобы он был свежим. Ceph даёт репликацию, но требует 3+ выделенных storage-узла, докторскую степень по CRUSH-картам и постоянную настройку. Большинство команд либо переинвестируют в инфраструктуру хранения, либо недоинвестируют - и платят за это простоями.

Cozystack использует LINSTOR + DRBD для реплицируемого блочного хранилища. DRBD реплицирует данные на уровне блочного устройства — ниже файловой системы, ниже базы данных, ниже всего остального. Технология проверена в Linux HA-конфигурациях более двух десятилетий. LINSTOR добавляет сверху Kubernetes-native уровень оркестрации.

## Как это работает

1. DRBD (Distributed Replicated Block Device) синхронно зеркалирует блочные устройства между узлами. Каждая запись на Узел A немедленно записывается на Узел B, прежде чем приложение получит подтверждение.
2. LINSTOR управляет ресурсами DRBD как Kubernetes StorageClasses. Когда PVC запрашивает хранилище, LINSTOR создаёт DRBD-том, выбирает узлы-реплики и управляет жизненным циклом.
3. CSI Driver предоставляет тома LINSTOR как стандартные Kubernetes PersistentVolumes.

Результат: любой pod или VM, использующий StorageClass replicated, получает синхронную блочную репликацию между узлами - прозрачно.

## Настройка хранилища

**Шаг 1 - Подготовка дисков:**

```
# Настройка алиаса для LINSTOR CLI
alias linstor='kubectl exec -n cozy-linstor deploy/linstor-controller -- linstor'

# Проверяем, что видит LINSTOR
linstor node list
linstor physical-storage list
```

Если диски не отображаются, вероятно на них остались метаданные. Очистите их:

```
# Используя talm (установка описана в ПОСТЕ 9)
# ВНИМАНИЕ: никогда не очищайте диск с установленной ОС (machine.install.disk) — только диски с данными.
talm -f nodes/node1.yaml wipe disk nvme0n1 nvme1n1
```

**Шаг 2 - Создание storage pool (ZFS):**

```
linstor physical-storage create-device-pool \
  zfs node1 \
  /dev/nvme0n1 /dev/nvme1n1 \
  --pool-name data \
  --storage-pool data
```

Повторите для каждого узла.

**Шаг 3 - Проверка:**

```
linstor storage-pool list
```

Вы должны увидеть pool data на каждом узле с доступной ёмкостью.

**Шаг 4 - Использование:**

Любое приложение, указывающее storageClass: replicated, теперь получает DRBD-реплицированные тома (три реплики по умолчанию). PostgreSQL, MongoDB, диски VM — все они.

```
# В конфигурации любого приложения:
values:
  storageClass: replicated
  size: 50Gi
```

## Что происходит при отказе узла:

1. DRBD обнаруживает, что узел недоступен
2. Том остаётся доступным на уцелевшем узле-реплике
3. Kubernetes перепланирует pod на узел, имеющий реплику
4. Когда отказавший узел возвращается, DRBD автоматически синхронизируется

Без ручного вмешательства. Без восстановления из бэкапа. Без потери данных.

## Документация

- Подготовка дисков: [https://cozystack.ru/docs/v1.5/storage/disk-preparation/](https://cozystack.ru/docs/v1.5/storage/disk-preparation/)
- Шифрование дисков: [https://cozystack.ru/docs/v1.5/storage/disk-encryption/](https://cozystack.ru/docs/v1.5/storage/disk-encryption/)
- Настройка DRBD: [https://cozystack.ru/docs/v1.5/storage/drbd-tuning/](https://cozystack.ru/docs/v1.5/storage/drbd-tuning/)
- NFS (RWX): [https://cozystack.ru/docs/v1.5/storage/nfs/](https://cozystack.ru/docs/v1.5/storage/nfs/)

Присоединяйтесь к сообществу:
Telegram-группа: t.me/cozystack_ru
Slack-группа: [https://kubernetes.slack.com/archives/C06L3CPRVN1](https://kubernetes.slack.com/archives/C06L3CPRVN1)
(Получить инвайт на https://slack.kubernetes.io)

Ресурсы Cozystack:
[https://cozystack.ru](https://cozystack.ru)
[https://cozystack.ru/docs/v1.5/get-started](https://cozystack.ru/docs/v1.5/get-started)
[https://cozystack.ru/blog](https://cozystack.ru/blog)
[https://github.com/cozystack/cozystack](https://github.com/cozystack/cozystack)

#Cozystack #LINSTOR #DRBD #Kubernetes #CloudNative #BareMetal #PrivateCloud #Storage
