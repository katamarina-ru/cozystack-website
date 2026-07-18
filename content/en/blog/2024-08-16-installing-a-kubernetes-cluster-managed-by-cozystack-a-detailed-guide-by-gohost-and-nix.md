---
title: "Установка кластера Kubernetes под управлением Cozystack: подробное руководство от Gohost и Ænix"
slug: installing-a-kubernetes-cluster-managed-by-cozystack-a-detailed-guide-by-gohost-and-nix
date: 2024-08-16
author: "Timur Tukaev"
description: "Эту статью написал Владислав Карабасов из казахстанской хостинг-компании gohost, поэтому повествование будет вестись от…"
images:
  - "https://cdn-images-1.medium.com/max/800/1*ZLyJcdvbsPSJnErGKwlJ0g.png"
article_types:
  - how-to
topics:
  - kubernetes

---

### **Установка кластера Kubernetes под управлением Cozystack: подробное руководство от Gohost и Ænix**

Эту статью написал Владислав Карабасов из казахстанской хостинг-компании [gohost](https://gohost.kz), поэтому повествование будет вестись от первого лица.

![](https://cdn-images-1.medium.com/max/800/1*ZLyJcdvbsPSJnErGKwlJ0g.png)

На момент моего перехода в gohost.kz компания уже 15 лет работала на рынке Казахстана, предоставляя клиентам стандартный набор услуг: VPS/VDC, IaaS, виртуальный хостинг и т. д. Однако у клиентов появлялись новые потребности, поэтому мне была поставлена задача развивать направление Kubernetes as a Service.

Так началось моё «знакомство 2.0» с \*nix-системами (на этот раз с [Talos Linux](https://www.talos.dev)), а также с миром контейнеров (через Kubernetes). Работая над задачами запуска и развития этого нового направления, я наткнулся на Open Source-платформу [Cozystack](http://cozystack.io) и познакомился с её разработчиками — Андреем Квапилом и Георгом Гаалом. Мы пообщались, и я решил развернуть кластер Kubernetes под управлением Cozystack, основанный на Talos Linux.

Вот что меня заинтересовало в Cozystack:

- Платформа позволяет развёртывать кластеры Kubernetes внутри существующего кластера без использования виртуализации для запуска control plane Kubernetes, при этом рабочие узлы (workers) запускаются как виртуальные машины в существующем кластере Kubernetes. Это позволяет оптимально использовать ресурсы без ущерба для безопасности.
- Talos Linux, на котором основана платформа, имеет очень высокий уровень безопасности.
- Более того, создатели платформы — активные участники сообщества Kubernetes и вносят значительный вклад в Open Source, в том числе организовали сообщество для разработки собственного [etcd-operator](https://github.com/aenix-io/etcd-operator).

Как оказалось, gohost участвует в этом Open Source-проекте с самого первого дня, и прямо сейчас мы активно тестируем платформу и готовимся ввести её в промышленную эксплуатацию, то есть предоставлять нашим клиентам хостинга услуги на базе Cozystack.

Написать эту статью меня побудило несколько причин: я хотел систематизировать полученные знания, поделиться с сообществом своим опытом установки Cozystack на Talos Linux и рассказать о работе с различными инструментами экосистемы Kubernetes. Кроме того, наверняка найдутся читатели, которым этот материал пригодится в работе, — в общем, это моя скромная попытка что-то вернуть сообществу. Итак, начнём.

### Топология кластера

Хотя Cozystack можно развернуть на «голом железе» (bare metal) буквально за несколько минут, платформу также можно запустить в любой виртуальной среде. Например, я начинал с развёртывания кластеров в [Proxmox](https://en.wikipedia.org/wiki/Proxmox_Virtual_Environment) и [KVM](https://en.wikipedia.org/wiki/Kernel-based_Virtual_Machine).

Однако в этой статье я расскажу о своём опыте установки на реальном оборудовании. Начнём с конфигурации — вот какое оборудование у меня было:

1.  VPS 2G/2CPU (хотя можно использовать и обычный домашний ПК) — 1 шт.
2.  Коммутаторы — 2 шт. (в режиме агрегации — этот режим повышает отказоустойчивость, пропускную способность и обеспечивает балансировку нагрузки, рис. 1) или 1 шт. (без агрегации, рис. 2).
3.  Серверы с локальным хранилищем на дисках NVMe (для контейнеров) и SSD (для операционной системы). Минимальное количество серверов в кластере для обеспечения отказоустойчивости — 3 шт.

Также можно использовать сетевое хранилище (NAS), например, с комбинацией [DRBD](https://en.wikipedia.org/wiki/DRBD) + [Linstor](https://linbit.com/linstor/) (мы используем такие NAS в нашей production-среде для VPS, но их настройка — тема для отдельной большой статьи, поэтому в данном случае мы ограничимся серверами).

Вот схема настройки оборудования для развёртывания Cozystack в моём случае (рис. 1). Конфигурацию коммутации я оставлю за рамками этой статьи.

![](https://cdn-images-1.medium.com/max/800/0*Of3PAg2vcAX_FEzu)
Рис. 1. Топология с агрегацией портов

![](https://cdn-images-1.medium.com/max/800/0*kLbJNezJWLnPcGJk)
Рис. 2. Топология без агрегации портов

При организации топологии кластера необходимо обеспечить доступ в Интернет (SRV1, SRV2, SRV3). В моём случае доступ осуществляется через management-host. SRV1, SRV2 и SRV3 используют management-host в качестве шлюза по умолчанию. Кроме того, на management-host включена маршрутизация и настроены соответствующие правила iptables. При желании можно использовать и другой шлюз — management-host нужен только для первоначальной настройки кластера.

### Подготовка management-host

Сначала настроим management-host, который будет использоваться для развёртывания кластера Kubernetes под управлением Cozystack. Предполагая, что вы уже умеете настраивать хост с операционной системой, я опущу подробности — в моём случае я использовал Ubuntu 22.04.

Приступим к развёртыванию management-host. Для этого я предлагаю использовать мой bash-скрипт, который избавляет от рутины поиска и установки пакетов и автоматизирует настройку хоста. На момент написания статьи использовались следующие версии пакетов: talosctl v1.7.1 и kubectl v1.30.1.

``` graf
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Без цвета

apt update
apt upgrade -y
apt -y install ntp bind9 curl jq nload

service ntp restart
#service ntp status
sed -i -r 's/listen-on-v6/listen-on/g'  /etc/bind/named.conf.options 
sed -i '/listen-on/a \\tallow-query { any; };'  /etc/bind/named.conf.options 
apt -y  install apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install  -y docker-ce snapd make dialog nmap 
#systemctl status docker
#curl -sL https://talos.dev/install | sh

releases=$(curl -s https://api.github.com/repos/siderolabs/talos/releases | jq -r '.[].tag_name' | head -n 10)
echo -e "${YELLOW}Select version to download:${NC}"
select version in $releases; do
    if [[ -n "$version" ]]; then
        echo "You have selected a version $version"
        break
    else
        echo -e "${RED}Incorrect selection. Please try again. ${NC}"
    fi
done
url="https://github.com/siderolabs/talos/releases/download/$version/talosctl-linux-amd64"
wget $url -O talosctl
chmod +x talosctl
sudo mv talosctl /usr/local/bin/
#kubectl
releases=$(curl -s https://api.github.com/repos/kubernetes/kubernetes/releases | jq -r '.[].tag_name' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 10)
echo -e "${YELLOW}Select kubectl version to download:${NC}"
select version in $releases; do
    if [[ -n "$version" ]]; then
        echo  "You have selected a version $version"
        break
    else
        echo -e "${RED}Incorrect selection. Please try again. ${NC}"
    fi
done
url="https://storage.googleapis.com/kubernetes-release/release/$version/bin/linux/amd64/kubectl"
wget $url -O kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

curl -LO https://github.com/kvaps/kubectl-node-shell/raw/master/kubectl-node_shell
chmod +x ./kubectl-node_shell
sudo mv ./kubectl-node_shell /usr/local/bin/kubectl-node_shell

curl -LO https://github.com/aenix-io/talm/releases/download/v0.5.7/talm-linux-amd64
chmod +x ./talm-linux-amd64
sudo mv ./talm-linux-amd64 /usr/local/bin/talm

echo "Specify the directory name for the configuration files,"
echo -e "the directory will be located in the catalog ${GREEN}/opt/${NC}. By default: ${GREEN}/opt/cozystack${NC}"
echo -e "${YELLOW}"
read -p "Enter the directory name: " cozystack
echo -e "${NC}"
if [ -z "$cozystack" ]; then    
  cozystack="cozystack" 
fi
mkdir -p /opt/$cozystack
curl -LO https://github.com/aenix-io/talos-bootstrap/raw/master/talos-bootstrap
mv talos-bootstrap /opt/$cozystack
chmod +x /opt/$cozystack/talos-bootstrap
snap install  yq
echo -e "${YELLOW}Specify IP network for etcd and kubelet${NC}"
echo -e "Default: ${GREEN} 192.168.100.0/24 ${NC}"
read -p "IP network (network/mask): " IPEK 
if [ -z "$IPEK" ]; then    
  IPEK="192.168.100.0/24" 
fi
# Добавить FORWARD (RELATED,ESTABLISHED)
rule1="-d $IPEK -m state --state RELATED,ESTABLISHED -m comment --comment $cozystack -j ACCEPT"
if ! iptables-save | grep -q -- "-A FORWARD $rule1"; then
    iptables -I FORWARD -d $IPEK -m state --state RELATED,ESTABLISHED -m comment --comment $cozystack -j ACCEPT
fi
# Добавить FORWARD
rule2="-s $IPEK -m comment --comment $cozystack -j ACCEPT"
if ! iptables-save | grep -q -- "-A FORWARD $rule2"; then
    iptables -I FORWARD -s $IPEK -m comment --comment $cozystack -j ACCEPT
fi
# Добавить NAT
rule3="-s $IPEK -m comment --comment $cozystack -j MASQUERADE"
if ! iptables-save | grep -q -- "-A POSTROUTING $rule3"; then
    iptables -t nat -I POSTROUTING -s $IPEK -m comment --comment $cozystack -j MASQUERADE
fi
#sysctl -w net.ipv4.ip_forward=1
if ! grep -qF "$REQUIRED_SETTING" "$FILE"; then
  echo "net.ipv4.ip_forward = 1" | sudo tee -a "/etc/sysctl.conf" > /dev/null 
fi
sysctl -p
apt -y install iptables-persistent 

cat > /opt/$cozystack/patch.yaml <<EOT
machine:
  kubelet:
    nodeIP:
      validSubnets:
      - $IPEK
    extraConfig:
      maxPods: 512
  kernel:
    modules:
    - name: openvswitch
    - name: drbd
      parameters:
        - usermode_helper=disabled
    - name: zfs
    - name: spl
  install:
    image: ghcr.io/aenix-io/cozystack/talos:v1.7.1
  files:
  - content: |
      [plugins]
        [plugins."io.containerd.grpc.v1.cri"]
          device_ownership_from_security_context = true      
    path: /etc/cri/conf.d/20-customization.part
    op: create
cluster:
  network:
    cni:
      name: none
    dnsDomain: cozy.local
    podSubnets:
    - 10.244.0.0/16
    serviceSubnets:
    - 10.96.0.0/16
EOT

cat > /opt/$cozystack/patch-controlplane.yaml <<EOT
cluster:
  allowSchedulingOnControlPlanes: true
  controllerManager:
    extraArgs:
      bind-address: 0.0.0.0
  scheduler:
    extraArgs:
      bind-address: 0.0.0.0
  apiServer:
    certSANs:
    - 127.0.0.1
  proxy:
    disabled: true
  discovery:
    enabled: false
  etcd:
    advertisedSubnets:
    - $IPEK
EOT

echo -e "${YELLOW}========== Installed binary ===========${NC}"
echo "helm       in folder" $(which helm)
echo "yq         in folder" $(which yq)
echo "kubectl    in folder" $(which kubectl)
echo "docker     in folder" $(which  docker)
echo "talosctl   in folder" $(which  talosctl)
echo "dialog     in folder" $(which  dialog)
echo "nmap       in folder" $(which  nmap)
echo "talm       in folder" $(which  talm)
echo "node_shell       in folder" $(which  kubectl-node_shell)
echo -e "${YELLOW}========== services runing ===========${NC}"
echo "DNS Bind9"; systemctl is-active bind9 
echo "NTP"; systemctl is-active ntp
echo -e "${YELLOW}========== ADD Iptables Rule ===========${NC}"
iptables -S | grep $cozystack
iptables -t nat -S | grep $cozystack
echo -e "${RED}!!!  Please change the catalog to work with talos-bootstrap !!!${NC}"
echo -e "${GREEN}cd  /opt/$cozystack ${NC}"
```

Как работает скрипт: он скачивает и устанавливает различные инструменты, включая helm, yq, kubectl, docker, talosctl, dialog, nmap, make, kubectl-node-shell и talm (ещё одну удобную open-source-утилиту от разработчиков Cozystack для настройки Talos Linux — своего рода Helm для Talos). Затем он раскладывает их по нужным каталогам. Весь процесс автоматизирован и сопровождается понятными диалогами. Кроме того, скрипт настраивает службу времени NTP, DNS-службу bind9 и создаёт правила для доступа в интернет из кластера через management-host.

В результате выполнения скрипта в каталог /opt/your_name (по умолчанию /opt/cozystack) скачивается скрипт talos-bootstrap для развёртывания кластера, а также создаются необходимые конфигурационные файлы, такие как patch-controlplane.yaml и patch.yaml. В этих файлах указаны модули ядра, которые будут загружены, и образ, из которого будет выполнена установка.

В итоге содержимое каталога должно выглядеть так:

Рис. 3. Каталог /opt/cozystack

Management-host готов к дальнейшей работе.

### Загрузка из системного образа Talos Linux

Операционная система, на которой основан Cozystack, — это Talos Linux. Существует несколько способов установки Cozystack:

- **PXE** — для установки с помощью временных DHCP- и PXE-серверов, работающих в контейнерах Docker.
- **ISO** — для установки с помощью ISO-образов.
- **Hetzner** — для установки на серверах Hetzner.

Для установки мы будем использовать [ISO-файл](https://github.com/aenix-io/cozystack/releases). Разработчики Cozystack собирают и тестируют готовые к использованию образы платформы со всем необходимым программным обеспечением. Всё ПО также проходит проверку на совместимость с платформой и дистрибутивом Talos Linux.

### Первоначальная настройка системы

После загрузки из образа экран выглядит так. Теперь нужно настроить сетевые параметры — для этого нажмите F3 (при установке через PXE адресация на узлах настраивается автоматически).

![](https://cdn-images-1.medium.com/max/800/0*qCyRC6ImUz0sgsBD)
Рис. 4. Экран Talos Linux после загрузки

Задаём сетевые адреса — можно указать несколько DNS- и Time-серверов (вводятся через пробел или запятую). Нажмите «Save».

![](https://cdn-images-1.medium.com/max/800/0*vUUk_WTbP_TuNC96)
Рис. 5. Экран настройки Talos Linux

Аналогично настройте остальные узлы. Я использовал собственную адресацию, поэтому некоторые IP-адреса на скриншотах будут размыты.

### Запуск установки с помощью talos-bootstrap

Запустите файл `./talos-bootstrap` без параметров, чтобы получить справочную информацию.

![](https://cdn-images-1.medium.com/max/800/0*PZMYzk0CUpKTqW7q)
Рис. 6. talos-bootstrap (первый запуск)

После этого запустите `./talos-bootstrap install`, и в первом диалоговом окне будет предложено имя кластера по умолчанию — оно совпадает с каталогом, где находится скрипт (по умолчанию имя будет `cozystack`, если вы не указали своё).

![](https://cdn-images-1.medium.com/max/800/0*b9-jBcYmZdvkMa4_)
Рис. 7. talos-bootstrap (задание имени кластера)

Укажите сеть, в которой будут искаться узлы.

![](https://cdn-images-1.medium.com/max/800/0*hGR7H5OwHk-dRk7c)
Рис. 8. talos-bootstrap (поиск узлов в указанной сети)

Скрипт автоматически найдёт узлы и отобразит их — как видим, все три наших узла найдены. В какой-то момент обнаружение узлов перестало работать на management-host под управлением AlmaLinux, но я не стал разбираться с этой проблемой и просто перешёл на Ubuntu.

Также узлы можно искать вручную с помощью команды: `nmap -Pn -n -p 50000 your_ip_network -vv | awk ‘/Discovered open port/ {print $NF}’`.(Выводит список IP-адресов.)

![](https://cdn-images-1.medium.com/max/800/0*xIsMBjMhmhxqBpMF)
Рис. 9. talos-bootstrap (выбор узла для установки)

На этом этапе выберите опцию «ControlPlane» и нажмите OK (все 3 узла кластера настраиваются как Control Plane).

![](https://cdn-images-1.medium.com/max/800/0*W2wNXAL42usxPldQ)
Рис. 10. talos-bootstrap (выбор роли узла)

Далее скрипт берёт все настройки с узлов (мы задали их при настройке сети в Talos Linux, рис. 5) и выводит их в консоль. Нам остаётся только подтвердить, что всё верно.

![](https://cdn-images-1.medium.com/max/800/0*LCo8ItBTAINeUYpG)
Рис. 11. talos-bootstrap (указание имени хоста)

Выбираем диск для установки системы — у меня это `sda`.

![](https://cdn-images-1.medium.com/max/800/0*KAdAkS7j8gsD8nSP)
Рис. 12. talos-bootstrap (выбор диска для установки)

После этого появляется наш интерфейс с предварительно настроенным IP-адресом (в моём случае это `eno4`). Соглашаемся и нажимаем «OK».

![](https://cdn-images-1.medium.com/max/800/0*1RzB2i39Sw0EhYxE)
Рис. 13. talos-bootstrap (выбор сетевого интерфейса)

Выберите наш шлюз, затем согласитесь.

![](https://cdn-images-1.medium.com/max/800/0*F52GB8Qg15ue69ge)
Рис. 14. talos-bootstrap (шлюз будет использоваться для доступа в Интернет)

Появляется окно для ввода адресов DNS-серверов; их можно добавить через пробел. После этого нажмите «OK».

![](https://cdn-images-1.medium.com/max/800/0*s_gdfDIfZ0YjX7M0)
Рис. 15. talos-bootstrap (укажите DNS-серверы или согласитесь с предложенными)

В следующем окне нужно ввести floating IP. Этот механизм в Talos очень похож на работу VRRP, но вместо низкоуровневого сетевого протокола для проверки состояния он использует кластер etcd, развёрнутый на узлах Control Plane. Floating IP обеспечивает высокую доступность кластера в сети: он «плавает» между узлами, позволяя IP-адресу перемещаться без изменения конфигурации. Введите здесь любой свободный IP из адресного пространства нашей сети (можно использовать тот же, что и на схеме топологии, например, `192.168.100.10`) — это будет IP-адрес кластера.

![](https://cdn-images-1.medium.com/max/800/0*nLmkmQC9ArjbkAyf)
Рис. 16. talos-bootstrap (ввод floating IP)

После этого должно появиться окно с нашим IP. Снова согласитесь.

![](https://cdn-images-1.medium.com/max/800/0*UVQEykPP6HczIVE7)
Рис. 17. talos-bootstrap (API для kubelet)

Далее скрипт отобразит настройки, которые применяются к master-узлу.

![](https://cdn-images-1.medium.com/max/800/0*p-HiQdufxs4mAYv9)
Рис. 18. talos-bootstrap (итоговая конфигурация для запуска установки)

Нажмите «OK» и дождитесь завершения установки. В процессе установки на нашем узле будут появляться похожие строки:

![](https://cdn-images-1.medium.com/max/800/0*DjigT1rglLIJAjg9)
Рис. 19. talos-bootstrap (экран Talos Linux)

На management-host в другой консоли можно наблюдать рост потребления трафика (с помощью утилиты nload) — это означает, что образ загружается из сети.

![](https://cdn-images-1.medium.com/max/800/0*c-uWtTELv0a7gInS)
Рис. 20. nload (монитор сетевой нагрузки)

После установки узел будет перезагружен, а индикатор выполнения покажет сначала 20%, затем 50%, затем 70%. Именно на 70% узел перезагрузится. Снова подождите — время ожидания зависит от скорости интернет-соединения: чем быстрее интернет, тем быстрее загрузка.

![](https://cdn-images-1.medium.com/max/800/0*qtI6jSHwtt4FX5yA)
Рис. 21. talos-bootstrap (процесс установки)

После установки первого узла кластера нам предлагается установить etcd. Нажмите «Yes».

![](https://cdn-images-1.medium.com/max/800/0*HLBqBa_tVxDysQDW)
Рис. 22. talos-bootstrap (установка etcd)

Остальные узлы устанавливаются аналогичным образом, за исключением предпоследнего шага. Итак, приступим к установке остальных узлов.

![](https://cdn-images-1.medium.com/max/800/0*WLBCJtf2BN9L2mmE)
Рис. 23. talos-bootstrap (установка завершена)

Теперь у нас есть первый узел нашего будущего кластера.

После установки в каталоге `/opt/your_name` появятся новые файлы — команда `ls` должна выдать следующий результат:

![](https://cdn-images-1.medium.com/max/800/0*bZs2kdKXWVItTSGu)
Рис. 24. Новые файлы в каталоге

В этом каталоге нужно выполнить ряд команд — они создадут в каталоге пользователя папки с конфигурационными файлами. Эти файлы необходимы для работы kubectl и talosctl.

``` graf
mkdir $HOME/.kube/
mkdir $HOME/.talos/
cp -i kubeconfig $HOME/.kube/config
cp -i talosconfig $HOME/.talos/config
```

Если этого не сделать, конфигурационные файлы придётся загружать вручную: для talosctl используйте команду `talosctl --talosconfig=config_file`, а для kubectl нужно либо выполнить `KUBECONFIG=config_file` в консоли пользователя (это будет действовать только в текущей сессии), либо каждый раз указывать конфигурационный файл через `kubectl --kubeconfig=config_file`.

Далее выполните команду:

``` graf
kubectl get node
```

И вы получите следующий вывод:

![](https://cdn-images-1.medium.com/max/800/0*_O0J1xhi4m7d57cC)
Рис. 25. Узлы в нашем кластере

После установки остальных узлов мы завершили первоначальную настройку кластера. На данный момент он содержит лишь несколько системных компонентов, а узлы находятся в состоянии `NotReady`, поскольку мы отключили установку CNI и kube-proxy в конфигурации Talos. Эти компоненты будут предоставлены и управляться Cozystack.

### Установка Cozystack

Создайте каталог с именем `manifests` и поместите в него файл с именем `cozystack-config.yaml`:

``` graf
apiVersion: v1
kind: ConfigMap
metadata:
 name: cozystack
 namespace: cozy-system
data:
 bundle-name: "paas-full"
 ipv4-pod-cidr: "10.244.0.0/16"
 ipv4-pod-gateway: "10.244.0.1"
 ipv4-svc-cidr: "10.96.0.0/16"
 ipv4-join-cidr: "100.64.0.0/16"
```

Последовательно выполните следующие команды:

1.  `kubectl create ns cozy-system` создаёт в Kubernetes новое пространство имён с именем `cozy-system`. Пространства имён используются для организации ресурсов внутри кластера Kubernetes.
2.  `kubectl apply -f cozystack-config.yaml` применяет конфигурацию из указанного файла, описывая конфигурационные данные с именем `cozystack` в пространстве имён `cozy-system`. Этот файл определяет сети, которые будут использоваться в кластере.
3.  `kubectl apply -f `[https://github.com/aenix-io/cozystack/raw/v0.7.0/manifests/cozystack-installer.yaml](https://github.com/aenix-io/cozystack/raw/v0.7.0/manifests/cozystack-installer.yaml%60)` `— эта команда применяет конфигурацию из указанного URL. В данном случае URL указывает на файл манифеста на GitHub для установки Cozystack.

``` graf
kubectl create ns cozy-system 
kubectl apply -f cozystack-config.yaml 
kubectl apply -f https://github.com/aenix-io/cozystack/raw/v0.7.0/manifests/cozystack-installer.yaml
```

Выполните следующее:

``` graf
whatch -n1 kubectl get hr -A
```

А теперь дождитесь, пока состояние `READY` не станет `True` во всех `NAMESPACE`.

![](https://cdn-images-1.medium.com/max/800/0*Qzj07Bopc5Uhdzyy)
Рис. 26. Процесс установки компонентов в кластере

Когда это произойдёт, можно продолжать.

### Настройка дисковой подсистемы

Выполните следующие команды:

``` graf
alias linstor='kubectl exec -n cozy-linstor deploy/linstor-controller -- linstor'
linstor node list
```

Мы должны получить следующий вывод:

``` graf
+-------------------------------------------------------+

| Node | NodeType  | Addresses                 | State  |

|=======================================================|

| srv1 | SATELLITE | 192.168.100.11:3367 (SSL) | Online |

| srv2 | SATELLITE | 192.168.100.12:3367 (SSL) | Online |

| srv3 | SATELLITE | 192.168.100.13:3367 (SSL) | Online |

+-------------------------------------------------------+
linstor physical-storage list
+--------------------------------------------+

| Size         | Rotational | Nodes          |

|============================================|

| 107374182400 | True       | srv3[/dev/nvme1n1,/dev/nvme0n1 ] |

|              |            | srv1[/dev/nvme1n1,/dev/nvme0n1] |

|              |            | srv2[/dev/nvme1n1,/dev/nvme0n1] |

+--------------------------------------------+
```

Создайте пул хранения. В моём случае это диски `/dev/nvme1n1` и `/dev/nvme0n1`, но у вас они могут быть другими:

``` graf
linstor ps cdp zfs srv1 /dev/nvme1n1 /dev/nvme0n1 --pool-name data --storage-pool data
linstor ps cdp zfs srv2 /dev/nvme1n1 /dev/nvme0n1 --pool-name data --storage-pool data
linstor ps cdp zfs srv3 /dev/nvme1n1 /dev/nvme0n1 --pool-name data --storage-pool data
```

Введите команду:

``` graf
linstor sp l
```

Посмотрим, что получилось:

![](https://cdn-images-1.medium.com/max/800/0*7n7BM4CKJEe2EZcQ)
Рис. 27. Список пулов хранения

Теперь создадим классы хранилища для постоянного хранения: базовое хранилище у нас уже настроено, но нужно сообщить Kubernetes, что в нём можно создавать тома. Это делается с помощью ресурса StorageClass. Итак, мы создадим два класса:

- `local` — для локального хранилища.
- `replicated` — для данных, требующих репликации.

``` graf
kubectl create -f- <<EOT

---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
 name: local
 annotations:
   storageclass.kubernetes.io/is-default-class: "true"
provisioner: linstor.csi.linbit.com
parameters:
 linstor.csi.linbit.com/storagePool: "data"
 linstor.csi.linbit.com/layerList: "storage"
 linstor.csi.linbit.com/allowRemoteVolumeAccess: "false"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
 name: replicated
provisioner: linstor.csi.linbit.com
parameters:
 linstor.csi.linbit.com/storagePool: "data"
 linstor.csi.linbit.com/autoPlace: "3"
 linstor.csi.linbit.com/layerList: "drbd storage"
 linstor.csi.linbit.com/allowRemoteVolumeAccess: "true"
 property.linstor.csi.linbit.com/DrbdOptions/auto-quorum: suspend-io
 property.linstor.csi.linbit.com/DrbdOptions/Resource/on-no-data-accessible: suspend-io
 property.linstor.csi.linbit.com/DrbdOptions/Resource/on-suspended-primary-outdated: force-secondary
 property.linstor.csi.linbit.com/DrbdOptions/Net/rr-conflict: retry-connect
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
EOT
```

Введите команду:

``` graf
kubectl create -f- <<EOT

---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
 name: local
 annotations:
   storageclass.kubernetes.io/is-default-class: "true"
provisioner: linstor.csi.linbit.com
parameters:
 linstor.csi.linbit.com/storagePool: "data"
 linstor.csi.linbit.com/layerList: "storage"
 linstor.csi.linbit.com/allowRemoteVolumeAccess: "false"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
 name: replicated
provisioner: linstor.csi.linbit.com
parameters:
 linstor.csi.linbit.com/storagePool: "data"
 linstor.csi.linbit.com/autoPlace: "3"
 linstor.csi.linbit.com/layerList: "drbd storage"
 linstor.csi.linbit.com/allowRemoteVolumeAccess: "true"
 property.linstor.csi.linbit.com/DrbdOptions/auto-quorum: suspend-io
 property.linstor.csi.linbit.com/DrbdOptions/Resource/on-no-data-accessible: suspend-io
 property.linstor.csi.linbit.com/DrbdOptions/Resource/on-suspended-primary-outdated: force-secondary
 property.linstor.csi.linbit.com/DrbdOptions/Net/rr-conflict: retry-connect
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
EOT
```

Введите команду:

``` graf
kubectl get storageclasses
```

Посмотрим, что получилось:

Рис. 28. Список классов хранилища

### Настройка сети

Задайте пул для выделения IP-адресов из подсети, которую мы указали ранее (см. рис. 1). Примечание: если у вас другое адресное пространство (например, `192.168.100.200/192.168.100.250`), в конфигурацию потребуется внести изменения, поскольку здесь настройки применяются сразу, без создания файла. Впрочем, можно сохранить конфигурацию в файл и применить манифест командой `kubectl apply -f path_to_file`.

``` graf
kubectl create -f- <<EOT
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
 name: cozystack
 namespace: cozy-metallb
spec:
 ipAddressPools:
 - cozystack
---
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
 name: cozystack
 namespace: cozy-metallb
spec:
 addresses:
 - 192.168.100.200-192.168.100.250
 autoAssign: true
 avoidBuggyIPs: false
EOT
```

### Настройка доступа к веб-интерфейсу кластера

Получите токен:

``` graf
kubectl get secret -n tenant-root tenant-root -o go-template='{{ printf "%s\n" (index .data "token" | base64decode) }}'
```

Примечание: выполнив эту команду на management-host, мы получим токен, который нужно использовать для доступа к веб-интерфейсу Cozystack с того же management-host. Для этого выполните на management-host следующую команду:

``` graf
kubectl port-forward -n cozy-dashboard svc/dashboard 8000:80
```

Теперь перейдите по ссылке [http://localhost:8000](http://localhost:8000) и введите ранее сгенерированный токен.

Рис. 29. Окно авторизации

Нажмите на «tenant-root»:

![](https://cdn-images-1.medium.com/max/800/0*l_GRZqleA5P0J0KV)
Рис. 30. Выбор tenant-root

Нажмите «Upgrade», чтобы переразвернуть приложение с нужными нам параметрами:

![](https://cdn-images-1.medium.com/max/800/0*1Tya45nXua9OxU0j)
Рис. 31. Переход к обновлению tenant-root

Если страница не обновится сразу, нажмите F5.

![](https://cdn-images-1.medium.com/max/800/0*LjJC7INRyWk52iog)
Рис. 32. Окно для внесения изменений в tenant-root

Введите свои значения; мы укажем `kuber.gohost.kz` в поле host, переведём переключатели из `false` в `true` и нажмём «DEPLOY».

![](https://cdn-images-1.medium.com/max/800/0*sFJjdCGk1p8rDAEi)
Рис. 33. Добавление компонентов и обновление tenant-root

Вы будете перенаправлены на страницу, где можно увидеть настроенные значения:

![](https://cdn-images-1.medium.com/max/800/0*RHRR6Op5mOQbGvSl)
Рис. 34. tenant-root обновлён

Теперь введите в консоли следующую команду, чтобы просмотреть список всех PersistentVolumeClaim (PVC) в указанном пространстве имён `tenant-root` в кластере:

``` graf
kubectl get pvc -n tenant-root
```

Если ваш вывод похож на мой, значит всё в порядке:

![](https://cdn-images-1.medium.com/max/800/0*MO1oRfARTWrAPAcb)
Рис. 35. Список PVC

Вернувшись в веб-интерфейс на главную страницу, вы должны увидеть примерно следующее:

![](https://cdn-images-1.medium.com/max/800/0*ffmR8cmONnVg3IQj)
Рис. 36. Главная страница Cozystack

### Проверка подов

Чтобы проверить поды, выполните стандартную команду:

``` graf
kubectl get pod -n tenant-root
```

Вывод должен выглядеть примерно так:

![](https://cdn-images-1.medium.com/max/800/0*LB60EUghQG5pK7aO)
Рис. 37. Список всех подов в пространстве имён `tenant-root`

Теперь выполните следующую команду:

``` graf
kubectl get svc -n tenant-root root-ingress-controller
```

В выводе мы должны увидеть публичный IP-адрес ingress-контроллера:

``` graf
NAME                      TYPE           CLUSTER-IP     EXTERNAL-IP       PORT(S)                   AGE
root-ingress-controller   LoadBalancer   10.96.58.227   192.168.100.200   80:30149/TCP,443:32152/TCP   7d8h
```

### Мониторинг

После установки платформы Cozystack у нас есть предварительно настроенный мониторинг на базе Grafana. Мы настроили мониторинг во время обновления tenant-root (рис. 27–31). Давайте проверим настройки мониторинга.

Для начала выберите плитку «monitoring» на главной странице:

![](https://cdn-images-1.medium.com/max/800/0*fdWX3D9TZXL4kbFt)
Рис. 38. Доступ к мониторингу

Нажмите кнопку «Upgrade». В поле host проверьте свои значения (например, `grafana.kuber.gohost.kz`). Учётные данные можно получить, просмотрев или скопировав `password` и `user`.

![](https://cdn-images-1.medium.com/max/800/0*iU7PkiLDgsdAKwXt)
Рис. 38. Получение данных авторизации

Чтобы получить доступ к веб-интерфейсу, нужно добавить в файл `/etc/hosts` на management-host следующие данные.

``` graf
192.168.100.200 gafana.kuber.gohost.kz
```

На этом хосте откройте веб-браузер и введите `grafana.kuber.gohost.kz`. Откроется интерфейс Grafana.

![](https://cdn-images-1.medium.com/max/800/0*nauGsGzvebD5_COZ)
Рис. 39. Окно входа в систему мониторинга

В результате выполненных шагов мы получили следующее:

1.  Кластер из трёх узлов на базе Talos Linux.
2.  Хранилище, включающее LINSTOR с ZFS и DRBD «под капотом».
3.  Удобный интерфейс.
4.  Предварительно настроенный мониторинг.

В следующей статье этой серии мы разберём Kubernetes в Kubernetes, поймём, как в Cozystack работает Kubernetes as a Service, и рассмотрим каталог приложений, где приложения можно развернуть всего в несколько кликов. Мы назначим кластеру реальные IP-адреса и настроим его для доступа из публичной сети.

Вот и всё — мы успешно установили кластер Cozystack! Оставайтесь с нами, дальше будет ещё интереснее… 😊

### Дополнительные ссылки

- [Cozystack на Talos Linux, Андрей Квапил, Talos Linux Install Fest’24](https://www.youtube.com/watch?v=s79VqXu-eG4)
- [DIY: создайте собственное облако на Kubernetes (часть 1)](https://blog.aenix.io/diy-create-your-own-cloud-with-kubernetes-part-1-7a692c37f0a8?source=collection_home---4------4-----------------------)
- [DIY: создайте собственное облако на Kubernetes (часть 2)](https://blog.aenix.io/diy-create-your-own-cloud-with-kubernetes-part-2-576a2894b187?source=collection_home---4------3-----------------------)
- [DIY: создайте собственное облако на Kubernetes (часть 3)](https://blog.aenix.io/diy-create-your-own-cloud-with-kubernetes-part-3-e1a43b56b52f?source=collection_home---4------2-----------------------)
- [Сообщество Cozystack](https://blog.aenix.io/diy-create-your-own-cloud-with-kubernetes-part-3-e1a43b56b52f?source=collection_home---4------2-----------------------)
- [Встречи сообщества Cozystack](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t) (календарь)
- [Документация Cozystack](https://cozystack.io/docs/)