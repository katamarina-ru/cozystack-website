---
title: "Простой способ установить Talos Linux на любую машину, у любого провайдера"
slug: a-simple-way-to-install-talos-linux-on-any-machine-with-any-provider
date: 2025-04-28
author: "Andrei Kvapil"
description: "Talos Linux — это специализированная операционная система, предназначенная для запуска Kubernetes. На мой взгляд, она справляется с этой задачей лучше других. Прежде…"
images:
  - "https://cdn-images-1.medium.com/max/800/1*ca81wgE3M5JA6B9ST8gT1A.png"
article_types:
  - how-to
topics:
  - talos

---

### Простой способ установить Talos Linux на любую машину, у любого провайдера

Talos Linux — это специализированная операционная система, предназначенная для запуска Kubernetes. На мой взгляд, она справляется с этой задачей лучше других. Прежде всего, она берёт на себя полное управление жизненным циклом компонентов control-plane Kubernetes.

С другой стороны, Talos Linux ориентирован на безопасность, сводя к минимуму возможность пользователя влиять на систему. Отличительная особенность этой ОС — почти полное отсутствие исполняемых файлов, включая отсутствие оболочки (shell) и невозможность входа по SSH. Вся конфигурация Talos Linux выполняется через Kubernetes-подобный API.

![](https://cdn-images-1.medium.com/max/800/1*ca81wgE3M5JA6B9ST8gT1A.png)

Обычно Talos Linux поставляется в виде набора готовых образов для различных окружений.

Стандартный способ установки предполагает, что вы возьмёте готовый образ для вашего конкретного облачного провайдера или гипервизора и создадите из него виртуальную машину. Что касается физических серверов, здесь возможны такие варианты, как загрузка образа Talos Linux методами ISO или PXE.

К сожалению, это не работает в случае провайдеров, которые предоставляют предварительно настроенный сервер или виртуальную машину, не позволяя загрузить собственный образ или даже использовать ISO для установки через KVM. В этом случае ваш выбор ограничен теми дистрибутивами, которые предоставляет облачный провайдер.

Обычно в процессе установки Talos Linux нужно ответить на два вопроса: (1) как загрузить и запустить образ Talos Linux и (2) как подготовить и применить machine-config (основной конфигурационный файл Talos Linux) к этому загруженному образу. Поговорим о каждом из этих шагов.

### Загрузка в Talos Linux

Один из самых универсальных методов — использовать механизм ядра Linux под названием [kexec](https://en.wikipedia.org/wiki/Kexec).

*kexec* — это одновременно утилита и одноимённый системный вызов. Он позволяет загрузиться в новое ядро из уже работающей системы без физической перезагрузки машины. Это значит, что вы можете скачать нужные *vmlinuz* и *initramfs* для Talos Linux, затем указать необходимую *cmdline* ядра и сразу переключиться на новую систему. Всё выглядит так, будто ядро было загружено штатным загрузчиком при старте, только в этом случае роль загрузчика играет ваша существующая ОС.

По сути, всё, что вам нужно, — это любой дистрибутив Linux. Это может быть физический сервер, запущенный в режиме восстановления (rescue mode), или даже виртуальная машина с предустановленной операционной системой. Рассмотрим пример с Ubuntu, но это может быть буквально любой другой дистрибутив Linux.

Войдите по SSH и установите пакет *kexec-tools* — он содержит утилиту *kexec*, которая понадобится вам позже:

``` graf
apt install kexec-tools -y
```

Далее нужно скачать Talos Linux, то есть *kernel* и *initramfs*. Их можно загрузить из официального репозитория:

``` graf
wget -O /tmp/vmlinuz https://github.com/siderolabs/talos/releases/latest/download/vmlinuz-amd64
wget -O /tmp/initramfs.xz https://github.com/siderolabs/talos/releases/latest/download/initramfs-amd64.xz
```

Если у вас физический сервер, а не виртуальный, вам потребуется собрать собственный образ со всеми необходимыми прошивками с помощью сервиса [Talos Factory](https://factory.talos.dev). Как вариант, можно использовать готовые образы из проекта Cozystack (решение для построения облаков, которое мы создали в Ænix и передали в CNCF Sandbox) — эти образы уже включают все необходимые модули и прошивки:

``` graf
wget -O /tmp/vmlinuz https://github.com/cozystack/cozystack/releases/latest/download/kernel-amd64
wget -O /tmp/initramfs.xz https://github.com/cozystack/cozystack/releases/latest/download/initramfs-metal-amd64.xz
```

Теперь вам нужна сетевая информация, которая будет передана Talos Linux при загрузке. Ниже приведён небольшой скрипт, который собирает всё необходимое и задаёт переменные окружения:

``` graf
IP=$(ip -o -4 route get 8.8.8.8 | awk -F"src " '{sub(" .*", "", $2); print $2}')
GATEWAY=$(ip -o -4 route get 8.8.8.8 | awk -F"via " '{sub(" .*", "", $2); print $2}')
ETH=$(ip -o -4 route get 8.8.8.8 | awk -F"dev " '{sub(" .*", "", $2); print $2}')
CIDR=$(ip -o -4 addr show "$ETH" | awk -F"inet $IP/" '{sub(" .*", "", $2); print $2; exit}')
NETMASK=$(echo "$CIDR" | awk '{p=$1;for(i=1;i<=4;i++){if(p>=8){o=255;p-=8}else{o=256-2^(8-p);p=0}printf(i<4?o".":o"\n")}}')
DEV=$(udevadm info -q property "/sys/class/net/$ETH" | awk -F= '$1~/ID_NET_NAME_ONBOARD/{print $2; exit} $1~/ID_NET_NAME_PATH/{v=$2} END{if(v) print v}')
```

Эти параметры можно передать через cmdline ядра. Используйте параметр ip=, чтобы настроить сеть с помощью механизма [конфигурации IP на уровне ядра](https://cateee.net/lkddb/web-lkddb/IP_PNP.html). Этот способ позволяет ядру автоматически поднять интерфейсы и назначить IP-адреса во время загрузки на основе информации, переданной через cmdline ядра. Это встроенная возможность ядра, включаемая опцией CONFIG_IP_PNP. В Talos Linux она включена по умолчанию. Вам нужно лишь передать корректно отформатированные сетевые настройки в cmdline ядра.

Правильный синтаксис этой опции можно найти в [документации Talos Linux](https://www.talos.dev/latest/talos-guides/install/bare-metal-platforms/network-config/#kernel-command-line). Также [официальная документация ядра Linux](https://www.kernel.org/doc/Documentation/filesystems/nfs/nfsroot.txt) содержит более подробные примеры.

Задайте переменную CMDLINE с опцией ip, содержащей настройки текущей системы, и выведите её:

``` graf
CMDLINE="init_on_alloc=1 slab_nomerge pti=on console=tty0 console=ttyS0 printk.devkmsg=on talos.platform=metal ip=${IP}::${GATEWAY}:${NETMASK}::${DEV}:::::"
echo $CMDLINE
```

Вывод должен выглядеть примерно так:

``` graf
init_on_alloc=1 slab_nomerge pti=on console=tty0 console=ttyS0 printk.devkmsg=on talos.platform=metal ip=10.0.0.131::10.0.0.1:255.255.255.0::eno2np0:::::
```

Убедитесь, что всё выглядит правильно, и загрузите наше новое ядро:

``` graf
kexec -l /tmp/vmlinuz --initrd=/tmp/initramfs.xz --command-line="$CMDLINE"
kexec -e
```

Первая команда загружает ядро Talos в оперативную память, вторая переключает текущую систему на это новое ядро.

В результате вы получите работающий экземпляр Talos Linux с настроенной сетью. Однако сейчас он работает целиком в оперативной памяти, поэтому при перезагрузке сервера система вернётся в исходное состояние (загрузив ОС с жёсткого диска, например Ubuntu).

### Применение machine-config и установка Talos Linux на диск

Чтобы установить Talos Linux на диск на постоянной основе и заменить текущую ОС, нужно применить machine-config, указав диск для установки. Для настройки машины можно использовать либо официальную утилиту [talosctl](https://www.talos.dev/latest/learn-more/talosctl/), либо [Talm](https://github.com/cozystack/talm) — утилиту, поддерживаемую проектом Cozystack (Talm работает и с ванильным Talos Linux).

Сначала рассмотрим настройку с помощью *talosctl*. Прежде чем применять конфигурацию, убедитесь, что она содержит сетевые настройки для вашего узла; иначе после перезагрузки узел не сможет настроить сеть. Во время установки загрузчик записывается на диск и не содержит опции `ip` для автоконфигурации ядра.

Вот пример патча конфигурации с необходимыми значениями:

``` graf
# node1.yaml
machine:
  install:
    disk: /dev/sda
  network:
    hostname: node1
    nameservers:
    - 1.1.1.1
    - 8.8.8.8
    interfaces:
    - interface: eno2np0
      addresses:
      - 10.0.0.131/24
      routes:
      - network: 0.0.0.0/0
        gateway: 10.0.0.1
```

Его можно использовать для генерации полного machine-config:

``` graf
talosctl gen secrets
talosctl gen config --with-secrets=secrets.yaml --config-patch-control-plane=@node1.yaml  
```

Просмотрите получившуюся конфигурацию и примените её к узлу:

``` graf
talosctl apply -f controlplane.yaml -e 10.0.0.131 -n 10.0.0.131 -i
```

После того как вы примените `controlplane.yaml`, узел установит Talos на диск `/dev/sda`, перезаписав существующую ОС, и затем перезагрузится.

Теперь остаётся лишь выполнить команду `bootstrap`, чтобы инициализировать кластер etcd:

``` graf
talosctl --talosconfig=talosconfig bootstrap -e 10.0.0.131 -n 10.0.0.131
```

В любой момент вы можете посмотреть статус узла с помощью команды `dashboard`:

``` graf
talosctl --talosconfig=talosconfig dashboard -e 10.0.0.131 -n 10.0.0.131
```

Как только все сервисы перейдут в состояние `Ready`, получите kubeconfig — и вы сможете пользоваться свежеустановленным Kubernetes:

``` graf
talosctl --talosconfig=talosconfig kubeconfig kubeconfig
export KUBECONFIG=${PWD}/kubeconfig
```

### Используйте Talm для управления конфигурацией

Когда конфигураций много, вам понадобится удобный способ ими управлять. Это особенно полезно с bare-metal-узлами, где у каждого узла могут быть разные диски, интерфейсы и специфические сетевые настройки. В результате может потребоваться держать отдельный патч для каждого узла.

Чтобы решить эту задачу, мы разработали [Talm](https://github.com/cozystack/talm) — менеджер конфигураций для Talos Linux, работающий подобно Helm.

Идея проста: у вас есть общий шаблон конфигурации с lookup-функциями, и когда вы генерируете конфигурацию для конкретного узла, Talm динамически обращается к Talos API и подставляет значения в итоговую конфигурацию.

Talm включает почти все возможности *talosctl*, добавляя ещё несколько. Он умеет генерировать конфигурации из Helm-подобных шаблонов и запоминать параметры узла и endpoint для каждого узла в итоговом файле, так что вам не нужно указывать эти параметры каждый раз при работе с узлом.

**Покажу, как выполнить те же шаги для установки Talos Linux с помощью Talm:**

Сначала инициализируйте конфигурацию для нового кластера:

``` graf
mkdir talos-config
cd talos-config
talm init --preset generic --name talos
```

Настройте значения для вашего кластера в `values.yaml`:

``` graf
endpoint: "https://10.0.0.131:6443"
podSubnets:
- 10.244.0.0/16
serviceSubnets:
- 10.96.0.0/16
advertisedSubnets:
- 10.0.0.0/24
```

Сгенерируйте конфигурацию для вашего узла:

``` graf
talm template -t templates/controlplane.yaml -e 10.0.0.131 -n 10.0.0.131 > nodes/node1.yaml
```

Результат будет выглядеть примерно так:

``` graf
# talm: nodes=["10.0.0.131"], endpoints=["10.0.0.131"], templates=["templates/controlplane.yaml"]
# ЭТОТ ФАЙЛ СГЕНЕРИРОВАН АВТОМАТИЧЕСКИ. ПРЕДПОЧТИТЕЛЬНЕЕ РЕДАКТИРОВАТЬ ШАБЛОНЫ, А НЕ ПРАВИТЬ ВРУЧНУЮ.
machine:
  type: controlplane
  kubelet:
    nodeIP:
      validSubnets:
        - 10.0.0.0/24
  network:
    hostname: node1
    # -- Обнаруженные интерфейсы:
    # eno2np0:
    #   hardwareAddr:a0:36:bc:cb:eb:98
    #   busPath: 0000:05:00.0
    #   driver: igc
    #   vendor: Intel Corporation
    #   product: Ethernet Controller I225-LM)
    interfaces:
      - interface: eno2np0
        addresses:
          - 10.0.0.131/24
        routes:
          - network: 0.0.0.0/0
            gateway: 10.0.0.1
    nameservers:
      - 1.1.1.1
      - 8.8.8.8
  install:
    # -- Обнаруженные диски:
    # /dev/sda:
    #    model: SAMSUNG MZQL21T9HCJR-00A07
    #    serial: S64GNG0X444695
    #    wwid: eui.36344730584446950025384700000001
    #    size: 1.9 TB
    disk: /dev/sda
cluster:
  controlPlane:
    endpoint: https://10.0.0.131:6443
  clusterName: talos
  network:
    serviceSubnets:
      - 10.96.0.0/16
  etcd:
    advertisedSubnets:
      - 10.0.0.0/24
```

Остаётся лишь применить её к вашему узлу:

``` graf
talm apply -f nodes/node1.yaml -i
```

Talm автоматически определяет адрес узла и endpoint из «modeline» (специального комментария в начале файла) и применяет конфигурацию.

Точно так же можно выполнять и другие команды, не указывая опции адреса узла и endpoint. Вот несколько примеров:

Посмотреть статус узла с помощью встроенной команды dashboard:

``` graf
talm dashboard -f nodes/node1.yaml
```

Инициализировать кластер etcd на `node1`:

``` graf
talm bootstrap -f nodes/node1.yaml
```

Сохранить kubeconfig в текущий каталог:

``` graf
talm kubeconfig -f nodes/node1.yaml
```

В отличие от официальной утилиты *talosctl*, сгенерированные конфигурации не содержат секретов, что позволяет хранить их в git без дополнительного шифрования. Секреты хранятся в корне вашего проекта и только в этих файлах: `secrets.yaml`, `talosconfig` и `kubeconfig`.

### Итог

Это наша полная схема установки Talos Linux практически в любой ситуации. Краткое резюме:

1.  Используйте *kexec*, чтобы запустить Talos Linux на любой существующей системе.
2.  Убедитесь, что у нового ядра правильные сетевые настройки, собрав их из текущей системы и передав через параметр `ip` в *cmdline*. Это позволит подключиться к только что загруженной системе через API.
3.  Когда ядро загружено через *kexec*, Talos Linux работает целиком в оперативной памяти (RAM). Чтобы установить Talos на диск, примените свою конфигурацию с помощью *talosctl* или Talm.
4.  Применяя конфигурацию, не забудьте указать сетевые настройки для вашего узла, поскольку конфигурация загрузчика на диске не получает их автоматически.
5.  Наслаждайтесь свежеустановленным и полностью работоспособным Talos Linux.

### Дополнительные материалы

- [Как мы построили динамический Kubernetes API Server для слоя агрегации API в Cozystack](https://kubernetes.io/blog/2024/11/21/dynamic-kubernetes-api-server-for-cozystack/)
- [DIY: создайте собственное облако с Kubernetes](https://kubernetes.io/blog/2024/04/05/diy-create-your-own-cloud-with-kubernetes-part-1/)
- [Cozystack становится проектом CNCF Sandbox](https://blog.aenix.io/cozystack-becomes-a-cncf-sandbox-project-3702b8906971)
- [Путь к стабильной инфраструктуре с Talos Linux &amp; Cozystack | Andrei Kvapil | SREday London 2024](https://www.youtube.com/watch?v=uhXujtTzG44)
- [Talos Linux: вам не нужна операционная система, нужен только Kubernetes / Andrei Kvapil](https://www.youtube.com/watch?v=9CIMTum9bTA)
- [Сравнение GitOps: Argo CD против Flux CD, с Andrei Kvapil | KubeFM](https://www.youtube.com/watch?v=4RVe32xRITo)
- [Cozystack на Talos Linux](https://www.youtube.com/watch?v=s79VqXu-eG4)