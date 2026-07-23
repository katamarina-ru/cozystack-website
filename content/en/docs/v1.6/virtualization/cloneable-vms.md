---
title: "Клонируемые виртуальные машины"
linkTitle: "Клонируемые виртуальные машины"
description: "Создание клонируемых виртуальных машин"
weight: 40
---

Чтобы создать клонируемую VM, вам потребуется создать `VMDisk` и `VMInstance`. В этом руководстве в качестве примера используется базовый образ `ubuntu`.

1. **Создайте VMDisk**

   ```yaml
   apiVersion: apps.cozystack.io/v1alpha1
   kind: VMDisk
   metadata:
     name: ubuntu-source
     namespace: tenant-root
   spec:
     optical: false
     source:
       http:
         url: https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
     storage: 20Gi
     storageClass: replicated
   ```

   {{% alert color="info" %}}
   Поскольку расширение диска может быть сложной задачей, мы рекомендуем создавать его с запасом места для будущего роста.
   {{% /alert %}}

2. **Создайте VMInstance**

   Поскольку пользовательский ресурс `VirtualMachine` не предоставляет удобного способа работы с несколькими дисками, используйте вместо него `VMInstance`.

   Создайте `VMInstance`, используя следующий шаблон:

   ```yaml
   apiVersion: apps.cozystack.io/v1alpha1
   kind: VMInstance
   metadata:
     name: sourcevm
     namespace: tenant-root
   spec:
     externalMethod: PortList
     disks:
       - name: ubuntu-source
     externalPorts:
       - 22
     instanceProfile: ubuntu
     instanceType: ""
     running: true
     sshKeys:
       - <paste your ssh public key here>
     external: true
     resources:
       cpu: "2"
       memory: 4Gi
   ```

   После создания VM она получит внешний IP-адрес балансировщика нагрузки. Вы можете получить его с помощью:

   ```bash
   kubectl get svc -n tenant-root vm-instance-sourcevm
   ```

3. **Подключитесь к VM по SSH**

   Теперь вы можете подключиться к VM по SSH, используя внешний IP-адрес. Пользователь по умолчанию для базового образа `ubuntu` — `ubuntu`.
   ```bash
   ssh ubuntu@<external IP>
   ```

   Настройте виртуальную машину перед клонированием.

4. **Удалите VMInstance**

   Данные на диске будут сохранены.
   ```bash
   kubectl delete vminstance -n tenant-root sourcevm
   ```

5. **Создайте образ диска**
   ```yaml
   apiVersion: cdi.kubevirt.io/v1beta1
   kind: DataVolume
   metadata:
     name: "vm-image-sourcevm" # prefix vm-image is necessary
     namespace: cozy-public # do not change
     annotations:
       cdi.kubevirt.io/storage.bind.immediate.requested: "true"
   spec:
     source:
       pvc:
         name: vm-disk-ubuntu-source
         namespace: tenant-root
     storage:
       resources:
         requests:
           storage: 20Gi
       storageClassName: replicated
   ```

   Это займёт некоторое время. Подождите, прежде чем продолжить.
   Вы можете проверить ход выполнения с помощью:
   ```bash
   kubectl get datavolume -n cozy-public vm-image-sourcevm
   ```
   Пример вывода, когда всё готово:

   ```text
   NAME                PHASE       PROGRESS   RESTARTS   AGE
   vm-image-sourcevm   Succeeded   100.0%                7m32s
   ```

6. **Создайте VMDisk из клонированного образа**
   ```yaml
   apiVersion: apps.cozystack.io/v1alpha1
   kind: VMDisk
   metadata:
     name: ubuntu-cloned-1
     namespace: tenant-root
   spec:
     optical: false
     source:
       image:
         name: sourcevm # image name without prefix
     storage: 20Gi # size greater or equal to the disk image size
     storageClass: replicated
   ```

7. **Создайте VMInstance из клонированного диска**
   ```yaml
   apiVersion: apps.cozystack.io/v1alpha1
   kind: VMInstance
   metadata:
     name: cloned-vm
     namespace: tenant-root
   spec:
     external: true
     externalMethod: PortList
     cloudInit: "hostname: my-cloned-vm"
     cloudInitSeed: "1"
     disks:
       - name: ubuntu-cloned-1
     externalPorts:
       - 22
     instanceProfile: ubuntu
     running: true
   ```

   Чтобы сетевые функции клонированной VM работали корректно, вы должны переопределить её `hostname` через `.spec.cloudInit` и указать уникальный `.spec.cloudInitSeed`, чтобы избежать конфликтов с исходной VM.
