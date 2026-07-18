---
title: "Виртуальные машины KubeVirt — это просто: VM Disk и VM Instance в Cozystack"
slug: kubevirt-vm-disk-vm-instance
date: 2026-06-19
author: "Timur Tukaev"
description: "KubeVirt делает запуск виртуальных машин в Kubernetes мощным, но сложным. Cozystack сводит VirtualMachine, DataVolume и PVC к двум чистым примитивам — VM Disk и VM Instance — с независимыми жизненными циклами для золотых образов, клонирования и быстрого выделения ресурсов."
images:
  - "social-card.png"
article_types:
  - how-to
topics:
  - kubevirt
  - platform
---

![Виртуальные машины KubeVirt — это просто с Cozystack VM Disk и VM Instance](social-card.png)

Если вы работали с KubeVirt напрямую, вам знакома эта боль: VirtualMachine, VirtualMachineInstance, DataVolume, PVC — целый лабиринт ресурсов только для того, чтобы запустить простую виртуальную машину. А если нужно клонировать VM, использовать общий базовый образ или мигрировать хранилище независимо от вычислительных ресурсов? Удачи собрать всё это вручную.

Cozystack сводит это к двум пользовательским ресурсам: **VMDisk** и **VMInstance**. У них независимые жизненные циклы, и в этом весь смысл — удалите VM, а диск останется; позже подключите тот же диск к более мощной VM; клонируйте золотой образ один раз и переиспользуйте его для каждой новой VM. Неизменяемая инфраструктура и быстрое выделение ресурсов достаются бесплатно.

{{< figure src="vmdisk-vminstance.png" alt="VM Disk подключаются к VM Instance; при удалении VM диски сохраняются" width="720" >}}

## Сравнение

|                 | VMDisk                                  | VMInstance                                            |
|-----------------|-----------------------------------------|-------------------------------------------------------|
| Что это         | Постоянное блочное устройство           | Работающая виртуальная машина                         |
| Жизненный цикл  | Независимый, переживает удаление VM      | Эфемерный — пересоздаётся в любой момент без потери данных |
| Аналог в KubeVirt | DataVolume + PVC                      | VirtualMachine + VirtualMachineInstance               |
| Что настраиваете | Исходный образ, размер, storageClass    | Тип инстанса, диски, SSH-ключи, cloud-init, GPU       |
| Для чего        | Золотые образы, диски с данными, предварительное выделение ресурсов | Вычисления, сеть, пользовательские данные |

## Создание VM Disk

**Через панель управления:** **Catalog** -> **VM Disk** -> задайте имя, выберите исходный образ (Ubuntu, Windows и т.д.), укажите размер и storageClass -> **Deploy**.

**Через kubectl:**

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: ubuntu-base
  namespace: tenant-team1
spec:
  source:
    image:
      name: ubuntu
  storage: 50Gi
  storageClass: replicated
```

Источники также включают `http.url` (загрузка по URL) и `disk.name` (клонирование существующего VMDisk для сценариев с золотыми образами).

## Создание VM Instance

**Через панель управления:** **Catalog** -> **VM Instance** -> имя, тип инстанса (например, `u1.medium`), подключите VMDisk, добавьте SSH-ключ и, при необходимости, cloud-init -> **Deploy**.

**Через kubectl:**

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMInstance
metadata:
  name: dev-server
  namespace: tenant-team1
spec:
  instanceType: u1.medium
  instanceProfile: ubuntu
  disks:
    - name: ubuntu-base
  sshKeys:
    - "ssh-ed25519 AAAA... user@workstation"
  cloudInit: |
    #cloud-config
    packages:
      - nginx
```

Поле `disks[].name` — это `metadata.name` существующего VMDisk в том же пространстве имён.

## Доступ к вашей VM

```bash
# Последовательная консоль
virtctl console dev-server

# SSH
virtctl ssh ubuntu@dev-server

# VNC (графический интерфейс)
virtctl vnc dev-server
```

## Почему это отдельные CR (а не релизы Helm)

Под капотом Cozystack по-прежнему использует Flux и Helm для развёртывания ресурсов, но обращённый к пользователю API — это группа `apps.cozystack.io/v1alpha1`. Вы пишете `VMDisk` или `VMInstance`, а оператор Cozystack берёт на себя всю обвязку HelmRelease/KubeVirt/DataVolume. То же самое относится к каждому управляемому сервису в каталоге — Postgres, Kubernetes, VPC, OpenBao имеют собственные нативные CR.

## Документация

- [VM Instance](https://cozystack.io/docs/v1/virtualization/vm-instance/)
- [VM Disk](https://cozystack.io/docs/v1/virtualization/vm-disk/)
- [Проброс GPU](https://cozystack.io/docs/v1/virtualization/gpu-passthrough/)

## Присоединяйтесь к сообществу

* GitHub: [cozystack/cozystack](https://github.com/cozystack/cozystack)
* Telegram: [@cozystack](https://t.me/cozystack)
* Slack: [#cozystack](https://kubernetes.slack.com/archives/C06L3CPRVN1) в рабочем пространстве Kubernetes ([приглашение](https://slack.kubernetes.io))
* [Подпишитесь на календарь встреч сообщества](https://zoom-lfx.platform.linuxfoundation.org/meetings/cozystack)
* [Добавьте встречи в свой календарь](https://webcal.prod.itx.linuxfoundation.org/lfx/lfsixxnFWxbvsyEuC2)
