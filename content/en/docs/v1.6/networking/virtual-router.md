---
title: "Виртуальные маршрутизаторы"
linkTitle: "Виртуальные маршрутизаторы"
description: "Развёртывание виртуального маршрутизатора в ВМ"
weight: 40
aliases:
  - /docs/v1.6/operations/virtualization/virtual-router
---

Начиная с версии [v0.27.0](https://github.com/cozystack/cozystack/releases/tag/v0.27.0)
Cozystack может развёртывать виртуальные маршрутизаторы (также известные как «router appliances» или «middlebox appliances»).
Эта возможность позволяет создать виртуальный маршрутизатор на основе экземпляра виртуальной машины.
Виртуальный маршрутизатор может маршрутизировать трафик между разными сетями.

## Создание виртуального маршрутизатора

Для создания виртуального маршрутизатора требуется учётная запись администратора Cozystack.

1.  **Создайте экземпляр ВМ**<br/>
    Используйте стандартные пакеты `vm-instance` и `virtual-machine`, чтобы создать экземпляр виртуальной машины.

1.  **Отключите защиту от подмены адресов (anti-spoofing)**<br/>
    Чтобы экземпляр ВМ мог работать как виртуальный маршрутизатор, у него должна быть отключена защита от подмены адресов:

    ```bash
    kubectl patch virtualmachines.kubevirt.io virtual-machine-example --type=merge \
        -p '{"spec":{"template":{"metadata":{"annotations":{"ovn.kubernetes.io/port_security": "false"}}}}}'
    ```

1.  **Перезапустите виртуальную машину**

    ```bash
    virtctl stop virtual-machine-example
    virtctl start virtual-machine-example
    ```

1.  **Получите IP-адрес ВМ**

    ```bash
    kubectl get vmi
    ```

    В выводе будет строка с IP-адресом новой ВМ:

    ```console
    NAME                      AGE     PHASE     IP            NODENAME        READY
    virtual-machine-example   3d4h    Running   10.244.8.56   gld-csxhk-003   True
    ```

1.  **Настройте пользовательские маршруты для тенанта**<br/>
    Отредактируйте пространство имён тенанта:

    ```bash
    kubectl edit namespace tenant-example
    ```

    Добавьте следующую аннотацию, указав полученный ранее IP-адрес маршрутизатора в `gw`
    и маску подсети, которую должен обслуживать маршрутизатор, в `dst`:

    ```yaml
    ovn.kubernetes.io/routes: |
      [{
        "gw": "10.244.8.56",
        "dst": "10.10.13.0/24"
      }]
    ```

Теперь эти пользовательские маршруты будут применяться ко всем подам в пространстве имён тенанта.
