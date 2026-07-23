---
title: "Ресурсы виртуальных машин"
linkTitle: "Справочник по ресурсам"
description: "Справочник по типам инстансов и профилям инстансов ВМ"
weight: 100
aliases:
  - /docs/v1.6/operations/virtualization/resources
---

У каждой виртуальной машины есть две следующие настройки конфигурации:

- `instanceType` определяет ресурсы, предоставляемые виртуальной машине.
- `instanceProfile` определяет набор предпочтений для виртуальных машин в соответствии с используемой ОС.

## Ресурсы типа инстанса

### Справочная таблица

Следующие ресурсы instancetype предоставляются Cozystack:

Имя | vCPUs | память
-----|-------|-------
cx1.2xlarge  |  8  |  16Gi
cx1.4xlarge  |  16  |  32Gi
cx1.8xlarge  |  32  |  64Gi
cx1.large  |  2  |  4Gi
cx1.medium  |  1  |  2Gi
cx1.xlarge  |  4  |  8Gi
gn1.2xlarge  |  8  |  32Gi
gn1.4xlarge  |  16  |  64Gi
gn1.8xlarge  |  32  |  128Gi
gn1.xlarge  |  4  |  16Gi
m1.2xlarge  |  8  |  64Gi
m1.4xlarge  |  16  |  128Gi
m1.8xlarge  |  32  |  256Gi
m1.large  |  2  |  16Gi
m1.xlarge  |  4  |  32Gi
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


### Серия U

Серия U достаточно нейтральна и предоставляет ресурсы для
приложений общего назначения.

*U* — это сокращение от «Universal» (универсальный), намекающее на универсальное
отношение к рабочим нагрузкам.

ВМ этих типов инстансов будут совместно использовать физические ядра CPU
с другими ВМ на основе разделения по времени.

Особые характеристики этой серии:
- *Burstable-производительность CPU* — у рабочей нагрузки есть базовая вычислительная
  производительность, но ей разрешено превышать этот базовый уровень, если
  доступны избыточные вычислительные ресурсы.
- *Соотношение vCPU к памяти (1:4)* — соотношение vCPU к памяти 1:4 для меньшего
  уровня помех на узел.

### Серия O

Серия O основана на серии U, единственное отличие
заключается в том, что память переподписана (overcommitted).

*O* — это сокращение от «Overcommitted» (переподписанный).

Особые характеристики этой серии:
- *Burstable-производительность CPU* — у рабочей нагрузки есть базовая вычислительная
  производительность, но ей разрешено превышать этот базовый уровень, если
  доступны избыточные вычислительные ресурсы.
- *Переподписанная память* — память переподписана для достижения
  более высокой плотности рабочих нагрузок.
- *Соотношение vCPU к памяти (1:4)* — соотношение vCPU к памяти 1:4 для меньшего
  уровня помех на узел.

### Серия CX

Серия CX предоставляет эксклюзивные вычислительные ресурсы для
вычислительно-интенсивных приложений.

*CX* — это сокращение от «Compute Exclusive» (эксклюзивные вычисления).

Эксклюзивные ресурсы предоставляются вычислительным потокам
ВМ. Чтобы это обеспечить, будут запрошены некоторые дополнительные ядра (в зависимости
от количества дисков и NIC) для разгрузки
потоков ввода-вывода с ядер, выделенных под рабочую нагрузку.
Кроме того, в этой серии топология NUMA используемых
ядер предоставляется ВМ.

Особые характеристики этой серии:
- *Hugepages* — Hugepages используются для повышения производительности
  памяти.
- *Выделенный CPU* — физические ядра эксклюзивно назначаются каждому
  vCPU, чтобы обеспечить фиксированные и высокие вычислительные гарантии для
  рабочей нагрузки.
- *Изолированные потоки эмулятора* — потоки эмулятора гипервизора изолируются
  от vCPU, чтобы снизить влияние эмуляции на
  рабочую нагрузку.
- *vNUMA* — физическая топология NUMA отражается в гостевой системе для
  оптимизации использования кэша на стороне гостя.
- *Соотношение vCPU к памяти (1:2)* — соотношение vCPU к памяти 1:2.

### Серия M

Серия M предоставляет ресурсы для приложений, интенсивно
использующих память.

*M* — это сокращение от «Memory» (память).

Особые характеристики этой серии:
- *Hugepages* — Hugepages используются для повышения производительности
  памяти.
- *Burstable-производительность CPU* — у рабочей нагрузки есть базовая вычислительная
  производительность, но ей разрешено превышать этот базовый уровень, если
  доступны избыточные вычислительные ресурсы.
- *Соотношение vCPU к памяти (1:8)* — соотношение vCPU к памяти 1:8 для гораздо
  меньшего уровня помех на узел.

### Серия RT

Серия RT предоставляет ресурсы для приложений реального времени, таких как Oslat.

*RT* — это сокращение от «realtime» (реальное время).

Этой серии типов инстансов требуются узлы, способные выполнять
приложения реального времени.

Особые характеристики этой серии:
- *Hugepages* — Hugepages используются для повышения производительности
  памяти.
- *Выделенный CPU* — физические ядра эксклюзивно назначаются каждому
  vCPU, чтобы обеспечить фиксированные и высокие вычислительные гарантии для
  рабочей нагрузки.
- *Изолированные потоки эмулятора* — потоки эмулятора гипервизора изолируются
  от vCPU, чтобы снизить влияние эмуляции на
  рабочую нагрузку.
- *Соотношение vCPU к памяти (1:4)* — соотношение vCPU к памяти 1:4, начиная с
  размера medium.

## Ресурсы профиля инстанса

Следующие ресурсы предпочтений предоставляются Cozystack:

Имя | Гостевая ОС
-----|---------
alpine | Alpine
centos.7 | CentOS 7
centos.7.desktop | CentOS 7
centos.stream10 | CentOS Stream 10
centos.stream10.desktop | CentOS Stream 10
centos.stream8 | CentOS Stream 8
centos.stream8.desktop | CentOS Stream 8
centos.stream8.dpdk | CentOS Stream 8
centos.stream9 | CentOS Stream 9
centos.stream9.desktop | CentOS Stream 9
centos.stream9.dpdk | CentOS Stream 9
cirros | Cirros
fedora | Fedora (amd64)
fedora.arm64 | Fedora (arm64)
opensuse.leap | OpenSUSE Leap
opensuse.tumbleweed | OpenSUSE Tumbleweed
rhel.10 | Red Hat Enterprise Linux 10 Beta (amd64)
rhel.10.arm64 | Red Hat Enterprise Linux 10 Beta (arm64)
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
sles | SUSE Linux Enterprise Server
ubuntu | Ubuntu
windows.10 | Microsoft Windows 10
windows.10.virtio | Microsoft Windows 10 (virtio)
windows.11 | Microsoft Windows 11
windows.11.virtio | Microsoft Windows 11 (virtio)
windows.2k16 | Microsoft Windows Server 2016
windows.2k16.virtio | Microsoft Windows Server 2016 (virtio)
windows.2k19 | Microsoft Windows Server 2019
windows.2k19.virtio | Microsoft Windows Server 2019 (virtio)
windows.2k22 | Microsoft Windows Server 2022
windows.2k22.virtio | Microsoft Windows Server 2022 (virtio)
windows.2k25 | Microsoft Windows Server 2025
windows.2k25.virtio | Microsoft Windows Server 2025 (virtio)


## Разработка типов и профилей инстансов

Чтобы начать настройку или создание собственных instancetypes и предпочтений,
см. [Руководство разработчика](/docs/v1.6/development/).
