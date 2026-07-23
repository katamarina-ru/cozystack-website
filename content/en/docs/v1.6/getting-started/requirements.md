---
title: "Требования и набор инструментов"
linkTitle: "Требования"
description: "Подготовьте инфраструктуру и установите необходимые инструменты."
weight: 1
---

## Набор инструментов

На вашей рабочей станции должны быть установлены следующие инструменты:

-   [talosctl](https://www.talos.dev/{{< version-pin "talos_minor" >}}/talos-guides/install/talosctl/), клиент командной строки для Talos Linux (используйте серию {{< version-pin "talos_minor" >}}.x, соответствующую Cozystack {{< version-pin "cozystack_version" >}}).
-   [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl), клиент командной строки для Kubernetes.
-   [Talm](https://github.com/cozystack/talm?tab=readme-ov-file#installation), собственный менеджер конфигурации Talos Linux от Cozystack:<br>
    
    ```bash
    curl -sSL https://github.com/cozystack/talm/raw/refs/heads/main/hack/install.sh | sh -s
    ```

## Требования к оборудованию

Для прохождения этого руководства вам потребуется следующая конфигурация:

**Узлы кластера:** три bare-metal сервера или виртуальные машины. Требования к оборудованию зависят от вашего сценария использования:

{{< include "docs/v1.6/install/_include/hardware-config-tabs.md" >}}

**Хранилище:**
-   **Основной диск**: используется для Talos Linux, хранилища etcd и загруженных образов. Требуется низкая задержка.
-   **Дополнительный диск**: используется для данных пользовательских приложений (ZFS pool).

**ОС:**
-   Любой дистрибутив Linux, например Ubuntu.<br>
-   Есть и [другие способы установки]({{% ref "/docs/v1.6/install/talos" %}}), для которых на старте требуется либо любой Linux, либо вообще не требуется установленная ОС.

**BIOS/UEFI Settings:**
-   **Secure Boot.**<br>
    Talos Linux ships pre-signed kernel modules and works with Secure Boot enabled. On non-Talos Ubuntu hosts, the default piraeus-operator flow compiles DRBD in-cluster; the resulting unsigned modules are rejected by kernel lockdown when Secure Boot is enforced. The simplest path is to disable Secure Boot in BIOS/UEFI; alternatively, follow [Ubuntu + Secure Boot]({{% ref "/docs/v1.6/install/kubernetes/ubuntu-secure-boot" %}}) to pre-install dkms-signed DRBD on the host.

**Сеть:**
-   Маршрутизируемый домен с FQDN.<br>Если его нет, можно использовать [nip.io](https://nip.io/) с dash-нотацией.
-   Узлы должны находиться в одном L2-сегменте сети.
-   Anti-spoofing должен быть отключён.<br>
    Это необходимо для MetalLB — балансировщика нагрузки, используемого в Cozystack.

**Виртуальные машины:**
-   В настройках гипервизора должен быть включён CPU passthrough, а модель CPU должна быть установлена в `host`.
-   Должна быть включена nested virtualization.<br>
    Это требуется для виртуальных машин и Kubernetes-кластеров tenant'ов.

Более подробное описание требований к оборудованию для разных сценариев см. в разделе [Требования к оборудованию]({{% ref "/docs/v1.6/install/hardware-requirements" %}})
    
