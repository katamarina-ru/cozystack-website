---
title: "Виртуальная машина"
linkTitle: "Виртуальная машина"
weight: 10
aliases:
  - /docs/reference/applications/vm-instance
  - /docs/v1.7/reference/applications/vm-instance
---

<!--
Автоматически сгенерированное содержимое. Не редактируйте этот файл напрямую; редактируйте исходные файлы.
metadata: https://github.com/cozystack/website/blob/main/content/en/docs/v1.7/virtualization/_include/vm-instance.md
source: https://github.com/cozystack/cozystack/blob/release-1.7/packages/apps/vm-instance/README.md
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

## Parameters

### Common parameters

| Name                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Type       | Value       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| `external`               | Enable external access from outside the cluster.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `bool`     | `false`     |
| `externalMethod`         | Method to pass through traffic to the VM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `string`   | `PortList`  |
| `externalPorts`          | Ports to forward from outside the cluster.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `[]int`    | `[22]`      |
| `externalAllowICMP`      | Whether to accept ICMP traffic to the VM in PortList mode (preserves ping and PMTU discovery). No effect in WholeIP mode. Default true so ping behaves as users expect even when port filtering is in effect.                                                                                                                                                                                                                                                                                                                                                                                                         | `bool`     | `true`      |
| `runStrategy`            | Requested running state of the VirtualMachineInstance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `string`   | `Always`    |
| `instanceType`           | Virtual Machine instance type. Ignored when `resources` sizes the VM, which needs whole-number cpu and sockets plus memory; the whole type is dropped then, so any dedicated CPU placement, hugepages, NUMA or realtime settings it carries go with it. While this field is set, a `resources` block that sizes only part of the VM is rejected outright instead of ignored, so complete it or clear it.                                                                                                                                                                                                              | `string`   | `u1.medium` |
| `instanceProfile`        | Virtual Machine preferences profile.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `string`   | `ubuntu`    |
| `disks`                  | List of disks to attach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `[]object` | `[]`        |
| `disks[i].name`          | Disk name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `string`   | `""`        |
| `disks[i].bus`           | Disk bus type (e.g. "sata").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `string`   | `""`        |
| `networks`               | Networks to attach the VM to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `[]object` | `[]`        |
| `networks[i].name`       | Network attachment name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `string`   | `""`        |
| `subnets`                | Deprecated: use networks instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `[]object` | `[]`        |
| `subnets[i].name`        | Network attachment name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `string`   | `""`        |
| `gpus`                   | List of GPUs to attach (NVIDIA driver requires at least 4 GiB RAM).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `[]object` | `[]`        |
| `gpus[i].name`           | The name of the GPU resource to attach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `string`   | `""`        |
| `cpuModel`               | Model specifies the CPU model inside the VMI. List of available models https://github.com/libvirt/libvirt/tree/master/src/cpu_map                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `string`   | `""`        |
| `firmware`               | Firmware and boot configuration (UEFI/BIOS selection, Secure Boot, persistent EFI NVRAM).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `object`   | `{}`        |
| `firmware.bootloader`    | Bootloader to boot the VM with: "uefi" (OVMF) or "bios" (SeaBIOS). Empty inherits the instanceProfile default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `string`   | `""`        |
| `firmware.secureBoot`    | Enable UEFI Secure Boot. Only applies when bootloader is "uefi".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `bool`     | `false`     |
| `firmware.efiPersistent` | Persist EFI NVRAM (e.g. enrolled Secure Boot keys, such as an updated Microsoft UEFI CA) across reboots. Only applies when bootloader is "uefi".                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `bool`     | `false`     |
| `resources`              | Resource configuration for the virtual machine. Set whole-number cpu and sockets together with memory to size the VM directly, which overrides `instanceType`. Alongside an `instanceType`, a block that sizes only part of the VM is rejected; a whole-number cpu or sockets on its own sizes nothing and is ignored.                                                                                                                                                                                                                                                                                                | `object`   | `{}`        |
| `resources.cpu`          | Number of CPU cores allocated, as a positive whole number such as `2`. Millicore or other unit-suffixed, fractional, zero, negative, above 4294967295 and quoted leading-zero values are rejected at render time, because the value becomes the VM's unsigned integer `domain.cpu.cores`.                                                                                                                                                                                                                                                                                                                             | `quantity` | `""`        |
| `resources.memory`       | Amount of memory allocated, as a quantity of at least `1M` such as `8Gi`. Less than 1M is rejected at render time, because KubeVirt refuses a non-zero amount below 1M and a zero or negative amount sizes nothing.                                                                                                                                                                                                                                                                                                                                                                                                   | `quantity` | `""`        |
| `resources.sockets`      | Number of CPU sockets (vCPU topology), as a positive whole number such as `1`. Millicore or other unit-suffixed, fractional, zero, negative, above 4294967295 and quoted leading-zero values are rejected at render time, because the value becomes the VM's unsigned integer `domain.cpu.sockets`.                                                                                                                                                                                                                                                                                                                   | `quantity` | `""`        |
| `sshKeys`                | List of SSH public keys for authentication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `[]string` | `[]`        |
| `cloudInit`              | Cloud-init user data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `string`   | `""`        |
| `netplanDhcp`            | Supply cloud-init network-data that requests DHCP on every `en*` and `eth*` interface and keeps the DNS search domains DHCP offers. Needed for a netplan guest (Ubuntu, Debian) to address a secondary network such as a VPC subnet. Leave it off for a guest rendered by anything other than netplan, which would lose DHCP on every interface, and for a guest that configures an interface statically through netplan, which this configuration would shadow. Turning it on for a VM that has neither `cloudInit` nor `sshKeys` adds a cloud-init disk, and the guest's next boot is then treated as a first boot. | `bool`     | `false`     |
| `cloudInitSeed`          | Seed string to generate SMBIOS UUID for the VM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `string`   | `""`        |


## U Series

The U Series is quite neutral and provides resources for
general purpose applications.

*U* is the abbreviation for "Universal", hinting at the universal
attitude towards workloads.

VMs of instance types will share physical CPU cores on a
time-slice basis with other VMs.

### U Series Characteristics

Specific characteristics of this series are:
- *Burstable CPU performance* - The workload has a baseline compute
  performance but is permitted to burst beyond this baseline, if
  excess compute resources are available.
- *vCPU-To-Memory Ratio (1:4)* - A vCPU-to-Memory ratio of 1:4, for less
  noise per node.

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
