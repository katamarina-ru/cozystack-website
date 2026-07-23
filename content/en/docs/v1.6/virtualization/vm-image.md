---
title: "Создание и использование именованных образов ВМ"
linkTitle: "Golden Images"
description: "Руководство по созданию, управлению и использованию золотых (именованных) образов ВМ в Cozystack для ускорения развёртывания виртуальных машин."
weight: 35
---

<!--
https://app.read.ai/analytics/meetings/01K0BTTJ1VMJHJ6A5FVV81A3PD
-->

Золотые образы (golden images) в Cozystack позволяют администраторам подготовить **именованные образы операционных систем**, которые пользователи смогут впоследствии повторно использовать при создании виртуальных машин.  
В этом руководстве объясняются преимущества золотых образов, способы их создания и использования при развёртывании ВМ.

По умолчанию каждый раз, когда пользователь создаёт виртуальную машину, Cozystack загружает требуемый образ из его источника по URL.  
Это может стать узким местом, когда несколько ВМ создаются в быстрой последовательности.  
Золотые образы решают эту проблему, кэшируя образ локально, что устраняет повторные загрузки и ускоряет развёртывание.

## Соглашения об именовании (важно)

Cozystack автоматически добавляет префиксы к внутренним ресурсам Kubernetes:

| Имя, видимое пользователю | Resource Kind | Фактическое имя ресурса |
| --- | --- | --- |
| `<image>`         | DataVolume в `cozy-public` (золотой образ) | `vm-default-images-<image>` |
| `<disk>`          | DataVolume, созданный из VMDisk             | `vm-disk-<disk>`   |
| `<vm>`            | VirtualMachine, созданная из VMInstance     | `vm-instance-<vm>` |

Это означает, что если вы создадите VMInstance с именем `ubuntu`, VirtualMachine в Kubernetes будет называться `vm-instance-ubuntu`.

## Коллекция образов по умолчанию (подключаемый пакет)

Cozystack поставляется с необязательным пакетом `vm-default-images`, который предоставляет тщательно подобранную коллекцию готовых золотых образов (Ubuntu, Rocky Linux, AlmaLinux, Debian, CentOS Stream, openSUSE, Alpine) в пространстве имён `cozy-public`. **Пакет отключён по умолчанию и должен быть включён явно.**

{{% alert title="Storage requirements" color="warning" %}}
Набор образов по умолчанию запрашивает примерно **320Gi** хранилища (16 образов × 20Gi каждый). Перед включением сократите список образов или уменьшите размеры хранилища для каждого образа, чтобы они соответствовали ёмкости вашего кластера.
{{% /alert %}}

Коллекция по умолчанию включает:

| Имя образа | Описание |
| --- | --- |
| `ubuntu-20.04` | Ubuntu 20.04 LTS (Focal Fossa) |
| `ubuntu-22.04` | Ubuntu 22.04 LTS (Jammy Jellyfish) |
| `ubuntu-24.04` | Ubuntu 24.04 LTS (Noble Numbat) |
| `debian-12` | Debian 12 (Bookworm) |
| `debian-13` | Debian 13 (Trixie) |
| `rocky-8` | Rocky Linux 8 |
| `rocky-9` | Rocky Linux 9 |
| `rocky-10` | Rocky Linux 10 |
| `almalinux-8` | AlmaLinux 8 |
| `almalinux-9` | AlmaLinux 9 |
| `almalinux-10` | AlmaLinux 10 |
| `centos-stream-9` | CentOS Stream 9 |
| `centos-stream-10` | CentOS Stream 10 |
| `opensuse-leap-15.6` | openSUSE Leap 15.6 |
| `opensuse-leap-16.0` | openSUSE Leap 16.0 |
| `alpine-3.21` | Alpine Linux 3.21 |

Вы можете вывести список всех доступных образов с помощью:
```bash
kubectl -n cozy-public get dv -l app.kubernetes.io/managed-by=cozystack
```

### Включение пакета

Добавьте `cozystack.vm-default-images` в `bundles.enabledPackages` в [Platform Package]({{% ref "/docs/v1.6/operations/configuration/platform-package" %}}):

```bash
kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
  -p '[{"op": "add", "path": "/spec/components/platform/values/bundles/enabledPackages/-", "value": "cozystack.vm-default-images"}]'
```

Подождите минуту, пока чарт платформы согласует состояние, затем проверьте HelmRelease и DataVolumes:

```bash
kubectl get helmrelease -n cozy-system vm-default-images
kubectl -n cozy-public get dv
```

DataVolumes, предоставляемые пакетом, именуются `vm-default-images-<image>` и доступны тенантам как золотые образы с именем `<image>` (например, `ubuntu-24.04`, `debian-12`).

### Настройка списка образов

Переопределите список по умолчанию, отредактировав Package `cozystack.vm-default-images` и задав значения в `spec.components.vm-default-images.values`. Схема определена в файле [values.yaml](https://github.com/cozystack/cozystack/blob/{{< version-pin "cozystack_tag" >}}/packages/system/vm-default-images/values.yaml) чарта:

- `storageClass` — StorageClass по умолчанию для всех образов; при пустом значении используется StorageClass кластера по умолчанию.
- `images[]` — список записей золотых образов. Каждая запись содержит:
  - `name` — имя образа в том виде, в котором оно доступно пользователям (например, `ubuntu-24.04`).
  - `url` — HTTP(S)-URL источника образа.
  - `storage` — выделяемый размер хранилища (например, `20Gi`).
  - `storageClass` — переопределение глобального StorageClass для конкретного образа.
  - `os.family`, `os.name`, `os.version`, `architecture`, `description` — необязательные метаданные, отображаемые в UI.

Пример: сократить список по умолчанию до двух образов и зафиксировать StorageClass:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.vm-default-images
spec:
  variant: default
  components:
    vm-default-images:
      values:
        storageClass: replicated
        images:
          - name: ubuntu-24.04
            url: https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
            storage: 20Gi
            os:
              family: Linux
              name: Ubuntu
              version: "24.04"
            architecture: amd64
            description: "Ubuntu 24.04 LTS (Noble Numbat) cloud image"
          - name: debian-12
            url: https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2
            storage: 20Gi
            os:
              family: Linux
              name: Debian
              version: "12"
            architecture: amd64
            description: "Debian 12 (Bookworm) generic cloud image"
```

Чтобы удалить образ после установки пакета, уберите его из `images[]` и удалите осиротевший DataVolume:

```bash
kubectl -n cozy-public delete dv vm-default-images-<name>
```

## Добавление пользовательских золотых образов

Для создания дополнительных именованных образов ВМ требуется учётная запись администратора в Cozystack.

Простейший способ добавить пользовательский образ — использовать CLI-скрипт.  
Скрипт [`cdi_golden_image_create.sh`](https://github.com/cozystack/cozystack/blob/{{< version-pin "cozystack_tag" >}}/hack/cdi_golden_image_create.sh) можно скачать из тега релиза Cozystack {{< version-pin "cozystack_tag" >}}:

```bash
wget https://raw.githubusercontent.com/cozystack/cozystack/{{< version-pin "cozystack_tag" >}}/hack/cdi_golden_image_create.sh
chmod +x cdi_golden_image_create.sh
```

Этот скрипт использует вашу конфигурацию `kubectl`.  
Перед его запуском убедитесь, что ваша конфигурация указывает на целевой кластер Cozystack.

Чтобы добавить пользовательский образ, запустите скрипт с именем образа и его URL:

```bash
cdi_golden_image_create.sh '<name>' 'https://<image-url>'
```

Например, чтобы добавить образ Talos:

```bash
cdi_golden_image_create.sh 'talos' 'https://github.com/siderolabs/talos/releases/download/v1.7.6/nocloud-amd64.raw.xz'
```

Внутри скрипт создаёт ресурс Kubernetes `kind: DataVolume` в пространстве имён `cozy-public`.  
Имя ресурса — это имя образа с префиксом `vm-default-images-`.  
Например, ресурс `vm-default-images-talos` создаёт образ, доступный как `talos`.

Вы можете отслеживать ход выполнения с помощью:
```bash
kubectl -n cozy-public get dv
kubectl -n cozy-public describe dv vm-default-images-talos
```

## Использование золотых образов

### Создание VMDisk из золотого образа

Чтобы использовать золотой образ в качестве источника для диска ВМ, создайте VMDisk с `source.image.name`, ссылающимся на имя образа:

```bash
kubectl -n tenant-root create -f- <<EOF
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: ubuntu
spec:
  source:
    image:
      name: ubuntu-24.04
  storage: 20Gi
EOF
```

Вы можете отслеживать процесс с помощью следующих команд:
```bash
kubectl -n tenant-root get vmdisk
kubectl -n tenant-root get dv
kubectl -n tenant-root describe dv vm-disk-ubuntu
```

### Подключение диска к ВМ

Далее создайте VMInstance, использующий этот диск:
```bash
kubectl -n tenant-root create -f- <<EOF
apiVersion: apps.cozystack.io/v1alpha1
kind: VMInstance
metadata:
  name: ubuntu
spec:
  disks:
  - name: ubuntu
EOF
```

Вы можете проверить статус VirtualMachine с помощью:
```bash
kubectl get vm -n tenant-root
```

Чтобы подключиться к ВМ, выполните:
```bash
virtctl console vm-instance-ubuntu -n tenant-root
```
