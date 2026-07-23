---
title: "Виртуальная машина"
linkTitle: "Виртуальная машина"
weight: 10
aliases:
  - /docs/reference/applications/vm-instance
  - /docs/v1.6/reference/applications/vm-instance
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.6/virtualization/_include/vm-instance.md
source: https://github.com/cozystack/cozystack/blob/release-1.6/packages/apps/vm-instance/README.md
-->


Виртуальная машина (ВМ) имитирует аппаратное обеспечение компьютера, позволяя запускать различные операционные системы и приложения в изолированной среде.

## Детали развёртывания

Виртуальная машина управляется и размещается с помощью KubeVirt, что позволяет использовать преимущества виртуализации в рамках вашей экосистемы Kubernetes.

- Документация: [KubeVirt User Guide](https://kubevirt.io/user-guide/)
- GitHub: [KubeVirt Repository](https://github.com/kubevirt/kubevirt)

## Доступ к виртуальной машине

Вы можете получить доступ к виртуальной машине с помощью инструмента virtctl:
- [KubeVirt User Guide - Virtctl Client Tool](https://kubevirt.io/user-guide/user_workloads/virtctl_client_tool/)

Для доступа к последовательной консоли:

```
virtctl console <vm>
```

Для доступа к ВМ по VNC:

```
virtctl vnc <vm>
```

Для подключения к ВМ по SSH:

```
virtctl ssh <user>@<vm>
```

## Параметры

### Общие параметры

| Имя | Описание | Тип | Значение |
| --- | --- | --- | --- |
| `external`          | Включить внешний доступ извне кластера.                                                                                                                                                              | `bool`     | `false`     |
| `externalMethod`    | Метод передачи трафика к ВМ.                                                                                                                                                                     | `string`   | `PortList`  |
| `externalPorts`     | Порты для проброса извне кластера.                                                                                                                                                    | `[]int`    | `[22]`      |
| `externalAllowICMP` | Принимать ли ICMP-трафик к ВМ в режиме PortList (сохраняет ping и обнаружение PMTU). Не действует в режиме WholeIP. По умолчанию true, чтобы ping работал так, как ожидают пользователи, даже когда действует фильтрация портов. | `bool`     | `true`      |
| `runStrategy`       | Запрошенное состояние работы VirtualMachineInstance                                                                                                                                                         | `string`   | `Always`    |
| `instanceType`      | Тип инстанса виртуальной машины.                                                                                                                                                                                | `string`   | `u1.medium` |
| `instanceProfile`   | Профиль предпочтений виртуальной машины.                                                                                                                                                                          | `string`   | `ubuntu`    |
| `disks`             | Список дисков для подключения.                                                                                                                                                                                      | `[]object` | `[]`        |
| `disks[i].name`     | Имя диска.                                                                                                                                                                                                    | `string`   | `""`        |
| `disks[i].bus`      | Тип шины диска (например, "sata").                                                                                                                                                                                  | `string`   | `""`        |
| `networks`          | Сети, к которым подключается ВМ.                                                                                                                                                                                 | `[]object` | `[]`        |
| `networks[i].name`  | Имя сетевого подключения (network attachment).                                                                                                                                                                                      | `string`   | `""`        |
| `subnets`           | Устарело: используйте networks вместо этого.                                                                                                                                                                             | `[]object` | `[]`        |
| `subnets[i].name`   | Имя сетевого подключения (network attachment).                                                                                                                                                                                      | `string`   | `""`        |
| `gpus`              | Список GPU для подключения (драйвер NVIDIA требует не менее 4 ГиБ RAM).                                                                                                                                                           | `[]object` | `[]`        |
| `gpus[i].name`      | Имя ресурса GPU для подключения.                                                                                                                                                                       | `string`   | `""`        |
| `cpuModel`          | Model задаёт модель CPU внутри VMI. Список доступных моделей https://github.com/libvirt/libvirt/tree/master/src/cpu_map                                                                             | `string`   | `""`        |
| `resources`         | Конфигурация ресурсов для виртуальной машины.                                                                                                                                                               | `object`   | `{}`        |
| `resources.cpu`     | Количество выделенных ядер CPU.                                                                                                                                                                                | `quantity` | `""`        |
| `resources.memory`  | Объём выделенной памяти.                                                                                                                                                                                   | `quantity` | `""`        |
| `resources.sockets` | Количество сокетов CPU (топология vCPU).                                                                                                                                                                        | `quantity` | `""`        |
| `sshKeys`           | Список открытых SSH-ключей для аутентификации.                                                                                                                                                                   | `[]string` | `[]`        |
| `cloudInit`         | Пользовательские данные cloud-init.                                                                                                                                                                         | `string`   | `""`        |
| `cloudInitSeed`     | Seed-строка для генерации SMBIOS UUID для ВМ.                                                                                                                                                               | `string`   | `""`        |


## Серия U

Серия U довольно нейтральна и предоставляет ресурсы для
приложений общего назначения.

*U* — это сокращение от «Universal», что намекает на универсальное
отношение к рабочим нагрузкам.

ВМ этих типов инстансов делят физические ядра CPU на основе
квантования времени с другими ВМ.

### Характеристики серии U

Специфические характеристики этой серии:
- *Пакетная (burstable) производительность CPU* — рабочая нагрузка имеет базовый уровень
  вычислительной производительности, но может выходить за пределы этого базового уровня, если
  доступны избыточные вычислительные ресурсы.
- *Соотношение vCPU к памяти (1:4)* — соотношение vCPU к памяти 1:4, для меньшего
  «шума» на узел.

## Серия O

Серия O основана на серии U, с единственным отличием,
заключающимся в том, что память переподписана (overcommitted).

*O* — это сокращение от «Overcommitted».

### Характеристики серии UO

Специфические характеристики этой серии:
- *Пакетная (burstable) производительность CPU* — рабочая нагрузка имеет базовый уровень
  вычислительной производительности, но может выходить за пределы этого базового уровня, если
  доступны избыточные вычислительные ресурсы.
- *Переподписанная память* — память переподписана для достижения
  более высокой плотности рабочих нагрузок.
- *Соотношение vCPU к памяти (1:4)* — соотношение vCPU к памяти 1:4, для меньшего
  «шума» на узел.

## Серия CX

Серия CX предоставляет эксклюзивные вычислительные ресурсы для
вычислительно интенсивных приложений.

*CX* — это сокращение от «Compute Exclusive».

Эксклюзивные ресурсы предоставляются вычислительным потокам
ВМ. Чтобы обеспечить это, будут запрошены некоторые дополнительные ядра (в зависимости
от количества дисков и NIC), чтобы вынести
потоки ввода-вывода с ядер, выделенных для рабочей нагрузки.
Кроме того, в этой серии топология NUMA используемых
ядер предоставляется ВМ.

### Характеристики серии CX

Специфические характеристики этой серии:
- *Hugepages* — Hugepages используются для улучшения производительности
  памяти.
- *Выделенный CPU* — физические ядра эксклюзивно назначаются каждому
  vCPU, чтобы предоставить фиксированные и высокие гарантии вычислений для
  рабочей нагрузки.
- *Изолированные потоки эмулятора* — потоки эмулятора гипервизора изолированы
  от vCPU, чтобы уменьшить влияние, связанное с эмуляцией, на
  рабочую нагрузку.
- *vNUMA* — физическая топология NUMA отражается в гостевой системе, чтобы
  оптимизировать использование кэша на стороне гостя.
- *Соотношение vCPU к памяти (1:2)* — соотношение vCPU к памяти 1:2.

## Серия M

Серия M предоставляет ресурсы для приложений,
интенсивно использующих память.

*M* — это сокращение от «Memory».

### Характеристики серии M

Специфические характеристики этой серии:
- *Hugepages* — Hugepages используются для улучшения производительности
  памяти.
- *Пакетная (burstable) производительность CPU* — рабочая нагрузка имеет базовый уровень
  вычислительной производительности, но может выходить за пределы этого базового уровня, если
  доступны избыточные вычислительные ресурсы.
- *Соотношение vCPU к памяти (1:8)* — соотношение vCPU к памяти 1:8, для гораздо
  меньшего «шума» на узел.

## Серия RT

Серия RT предоставляет ресурсы для приложений реального времени, таких как Oslat.

*RT* — это сокращение от «realtime».

Эта серия типов инстансов требует узлов, способных запускать
приложения реального времени.

### Характеристики серии RT

Специфические характеристики этой серии:
- *Hugepages* — Hugepages используются для улучшения производительности
  памяти.
- *Выделенный CPU* — физические ядра эксклюзивно назначаются каждому
  vCPU, чтобы предоставить фиксированные и высокие гарантии вычислений для
  рабочей нагрузки.
- *Изолированные потоки эмулятора* — потоки эмулятора гипервизора изолированы
  от vCPU, чтобы уменьшить влияние, связанное с эмуляцией, на
  рабочую нагрузку.
- *Соотношение vCPU к памяти (1:4)* — соотношение vCPU к памяти 1:4, начиная с
  размера medium.

## Разработка

Чтобы начать настройку или создание собственных instancetypes и preferences,
см. [DEVELOPMENT.md](./DEVELOPMENT.md).

## Ресурсы

Следующие ресурсы instancetype предоставляются Cozystack:

Name | vCPUs | Memory
-----|-------|-------
cx1.2xlarge  |  8  |  16Gi
cx1.2xlarge1gi  |  8  |  16Gi
cx1.4xlarge  |  16  |  32Gi
cx1.4xlarge1gi  |  16  |  32Gi
cx1.8xlarge  |  32  |  64Gi
cx1.8xlarge1gi  |  32  |  64Gi
cx1.large  |  2  |  4Gi
cx1.large1gi  |  2  |  4Gi
cx1.medium  |  1  |  2Gi
cx1.medium1gi  |  1  |  2Gi
cx1.xlarge  |  4  |  8Gi
cx1.xlarge1gi  |  4  |  8Gi
d1.2xlarge  |  8  |  32Gi
d1.2xmedium  |  2  |  4Gi
d1.4xlarge  |  16  |  64Gi
d1.8xlarge  |  32  |  128Gi
d1.large  |  2  |  8Gi
d1.medium  |  1  |  4Gi
d1.micro  |  1  |  1Gi
d1.nano  |  1  |  512Mi
d1.small  |  1  |  2Gi
d1.xlarge  |  4  |  16Gi
gn1.2xlarge  |  8  |  32Gi
gn1.4xlarge  |  16  |  64Gi
gn1.8xlarge  |  32  |  128Gi
gn1.xlarge  |  4  |  16Gi
m1.2xlarge  |  8  |  64Gi
m1.2xlarge1gi  |  8  |  64Gi
m1.4xlarge  |  16  |  128Gi
m1.4xlarge1gi  |  16  |  128Gi
m1.8xlarge  |  32  |  256Gi
m1.8xlarge1gi  |  32  |  256Gi
m1.large  |  2  |  16Gi
m1.large1gi  |  2  |  16Gi
m1.xlarge  |  4  |  32Gi
m1.xlarge1gi  |  4  |  32Gi
n1.2xlarge  |  16  |  32Gi
n1.4xlarge  |  32  |  64Gi
n1.8xlarge  |  64  |  128Gi
n1.large  |  4  |  8Gi
n1.medium  |  4  |  4Gi
n1.xlarge  |  8  |  16Gi
o1.2xlarge  |  8  |  32Gi
o1.4xlarge  |  16  |  64Gi
o1.8xlarge  |  32  |  128Gi
o1.large  |  2  |  8Gi
o1.medium  |  1  |  4Gi
o1.micro  |  1  |  1Gi
o1.nano  |  1  |  512Mi
o1.small  |  1  |  2Gi
o1.xlarge  |  4  |  16Gi
rt1.2xlarge  |  8  |  32Gi
rt1.4xlarge  |  16  |  64Gi
rt1.8xlarge  |  32  |  128Gi
rt1.large  |  2  |  8Gi
rt1.medium  |  1  |  4Gi
rt1.micro  |  1  |  1Gi
rt1.small  |  1  |  2Gi
rt1.xlarge  |  4  |  16Gi
u1.2xlarge  |  8  |  32Gi
u1.2xmedium  |  2  |  4Gi
u1.4xlarge  |  16  |  64Gi
u1.8xlarge  |  32  |  128Gi
u1.large  |  2  |  8Gi
u1.medium  |  1  |  4Gi
u1.micro  |  1  |  1Gi
u1.nano  |  1  |  512Mi
u1.small  |  1  |  2Gi
u1.xlarge  |  4  |  16Gi

Следующие ресурсы preference предоставляются Cozystack:

Name | Guest OS
-----|---------
alpine | Alpine
centos.stream10 | CentOS Stream 10
centos.stream10.desktop | CentOS Stream 10
centos.stream9 | CentOS Stream 9
centos.stream9.desktop | CentOS Stream 9
centos.stream9.dpdk | CentOS Stream 9
cirros | Cirros
debian | Debian
fedora | Fedora (amd64)
fedora.arm64 | Fedora (arm64)
fedora.s390x | Fedora (s390x)
legacy | Legacy Guest
linux | Linux Guest
linux.efi | Linux EFI Guest
linux.virtiotransitional | Linux Virtio Transitional Guest
opensuse.leap | OpenSUSE Leap
opensuse.tumbleweed | OpenSUSE Tumbleweed
oraclelinux | Oracle Linux
rhel.10 | Red Hat Enterprise Linux 10 (amd64)
rhel.10.arm64 | Red Hat Enterprise Linux 10 (arm64)
rhel.10.s390x | Red Hat Enterprise Linux 10 (s390x)
rhel.7 | Red Hat Enterprise Linux 7
rhel.7.desktop | Red Hat Enterprise Linux 7
rhel.8 | Red Hat Enterprise Linux 8
rhel.8.desktop | Red Hat Enterprise Linux 8
rhel.8.dpdk | Red Hat Enterprise Linux 8
rhel.9 | Red Hat Enterprise Linux 9 (amd64)
rhel.9.arm64 | Red Hat Enterprise Linux 9 (arm64)
rhel.9.desktop | Red Hat Enterprise Linux 9 Desktop (amd64)
rhel.9.dpdk | Red Hat Enterprise Linux 9 DPDK (amd64)
rhel.9.realtime | Red Hat Enterprise Linux 9 Realtime (amd64)
rhel.9.s390x | Red Hat Enterprise Linux 9 (s390x)
sles | SUSE Linux Enterprise Server
ubuntu | Ubuntu
windows.10 | Microsoft Windows 10
windows.10.virtio | Microsoft Windows 10 (virtio)
windows.11 | Microsoft Windows 11
windows.11.virtio | Microsoft Windows 11 (virtio)
windows.2k12 | Microsoft Windows Server 2012/2012 R2
windows.2k12.virtio | Microsoft Windows Server 2012/2012 R2 (virtio)
windows.2k16 | Microsoft Windows Server 2016
windows.2k16.virtio | Microsoft Windows Server 2016 (virtio)
windows.2k19 | Microsoft Windows Server 2019
windows.2k19.virtio | Microsoft Windows Server 2019 (virtio)
windows.2k22 | Microsoft Windows Server 2022
windows.2k22.virtio | Microsoft Windows Server 2022 (virtio)
windows.2k25 | Microsoft Windows Server 2025
windows.2k25.virtio | Microsoft Windows Server 2025 (virtio)
windows.2k3 | Microsoft Windows Server 2003
windows.2k8 | Microsoft Windows Server 2008/2008 R2
windows.2k8.virtio | Microsoft Windows Server 2008/2008 R2 (virtio)
windows.7 | Microsoft Windows 7
windows.7.virtio | Microsoft Windows 7 (virtio)
windows.xp | Microsoft Windows XP
