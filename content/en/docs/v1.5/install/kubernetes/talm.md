---
title: Использование Talm для инициализации кластера Cozystack
linkTitle: Talm
description: "`talm` — декларативный CLI-инструмент, созданный разработчиками Cozystack и оптимизированный для развертывания Cozystack.<br> Рекомендуется для infrastructure-as-code и GitOps."
weight: 5
aliases:
  - /docs/v1.5/operations/talos/configuration/talm
  - /docs/v1.5/talos/bootstrap/talm
  - /docs/v1.5/talos/configuration/talm
---

В этом руководстве описано, как установить и настроить Kubernetes в кластере Talos Linux с помощью Talm.
После выполнения этого руководства у вас будет кластер Kubernetes, готовый к установке Cozystack.

[Talm](https://github.com/cozystack/talm) — Helm-подобная утилита для декларативного управления конфигурацией Talos Linux.
Talm был создан Ænix, чтобы сделать конфигурации управления кластером более декларативными и настраиваемыми.
Talm поставляется с готовыми пресетами для Cozystack.

## Предварительные требования

К началу работы с этим руководством [Talos Linux должен быть установлен]({{% ref "/docs/v1.5/install/talos" %}}) на нескольких узлах, но еще не инициализирован (bootstrapped).
Эти узлы должны находиться в одной подсети или иметь публичные IP-адреса.

В руководстве используется пример, где узлы кластера находятся в подсети `192.168.123.0/24` и имеют следующие IP-адреса:

- `node1`: private `192.168.123.11` or public `12.34.56.101`.
- `node2`: private `192.168.123.12` or public `12.34.56.102`.
- `node3`: private `192.168.123.13` or public `12.34.56.103`.

Публичные IP-адреса необязательны.
Для установки с Talm нужен только доступ к узлам: напрямую, через VPN, bastion host или другим способом.
В примерах этого руководства по умолчанию используются private IP, а public IP используются в инструкциях и примерах, относящихся к конфигурации с public IP.

Если вы используете DHCP, вы можете не знать IP-адреса, назначенные узлам в private subnet.
Узлы с Talos Linux [открывают Talos API на порту `50000`](https://www.talos.dev/{{< version-pin "talos_minor" >}}/learn-more/talos-network-connectivity/).
Чтобы найти их, можно использовать `nmap`, указав маску сети (`192.168.123.0/24` в примере):

```bash
nmap -Pn -n -p 50000 192.168.123.0/24 -vv | grep 'Discovered'
```

Пример вывода:

```console
Discovered open port 50000/tcp on 192.168.123.11
Discovered open port 50000/tcp on 192.168.123.12
Discovered open port 50000/tcp on 192.168.123.13
```


## 1. Установка зависимостей

Для этого руководства нужно установить несколько инструментов:

-   **Talm**.
    Чтобы установить последнюю сборку для вашей платформы, скачайте и запустите установочный скрипт:
    
    ```bash
    curl -sSL https://github.com/cozystack/talm/raw/refs/heads/main/hack/install.sh | sh -s
    ```
    Для Talm доступны бинарные файлы для Linux, macOS и Windows, как для AMD, так и для ARM.
    Также можно [скачать бинарный файл с GitHub](https://github.com/cozystack/talm/releases)
    или [собрать Talm из исходного кода](https://github.com/cozystack/talm).
    

-   **talosctl** распространяется как brew package:

    ```bash
    brew install siderolabs/tap/talosctl
    ```

    Другие варианты установки см. в [руководстве по установке `talosctl`](https://www.talos.dev/{{< version-pin "talos_minor" >}}/talos-guides/install/talosctl/)

## 2. Инициализация конфигурации кластера

Первый шаг — инициализировать шаблоны конфигурации и указать значения для шаблонизации.


### 2.1 Инициализация конфигурации

Начните с инициализации конфигурации для нового кластера, используя preset `cozystack`:

```bash
mkdir -p cozystack-cluster
cd cozystack-cluster
talm init --preset cozystack --name mycluster
```

Структура проекта в основном повторяет обычный Helm chart:

- `charts` - каталог с общим library chart, содержащим функции для запроса информации из Talos Linux.
- `Chart.yaml` - файл с общей информацией о проекте; имя chart используется как имя создаваемого кластера.
- `templates` - каталог для описания шаблонов генерации конфигурации.
- `secrets.yaml` - файл с secrets вашего кластера.
- `secrets.encrypted.yaml`, `talosconfig.encrypted` - encrypted counterparts produced from `talm.key` (commit these to git instead of the plaintext files).
- `talm.key` - the project-local age key used for encrypt / decrypt. Back this up; without it the encrypted files cannot be reopened.
- `values.yaml` - общий values-файл для передачи параметров в шаблоны.
- `nodes` - необязательный каталог для описания и хранения сгенерированной конфигурации узлов.


#### Available Presets

`talm` ships two embedded presets:

- `cozystack` - the production preset used by this guide.
- `talm` - a minimal library chart for advanced users who want to build their own preset on top of it.

Pass the preset name via `-p` / `--preset`.

#### `talm init` Flag Reference

Run `talm init -h` for the canonical list. Grouped by mode:

**Create a new project (default mode):**

- `-p, --preset <name>` - preset for file generation.
- `-N, --name <cluster-name>` - cluster name.
- `--endpoints <list>` - Talos API endpoints (comma-separated) embedded into `talosconfig.contexts.<name>.endpoints` for the talosctl client. See "Endpoint flags: talosctl client vs Kubernetes control plane" below.
- `--cluster-endpoint <url>` - Kubernetes control-plane URL written to `values.yaml::endpoint` (e.g. `https://<vip>:6443`). Validated for scheme + host + port at init time.
- `--image <ref>` - override the Talos installer image written to the preset's `values.yaml` (e.g. `factory.talos.dev/installer/<sha256>:<version>`).
- `--talos-version <ver>` - desired Talos contract version for backwards-compatibility templating (e.g. `v1.12`).
- `--force` - overwrite existing files without prompt.

##### Endpoint flags: talosctl client vs Kubernetes control plane

Two distinct concepts share the word "endpoint" in talm projects:

- **`talosconfig.contexts.<name>.endpoints`** - list of `host[:port]` entries the talosctl client uses to reach the Talos API. Populated by `--endpoints` (plural, comma-separated list).
- **`values.yaml::endpoint`** - single URL with scheme + host + port that the chart renders into `cluster.controlPlane.endpoint` of every node's MachineConfig. This is what kubelet and kube-proxy dial. Populated by `--cluster-endpoint` (singular, full URL).

When `--endpoints` is given exactly one value, init auto-derives `values.yaml::endpoint` as `https://<that>:6443` because the single-target case is unambiguous. Multi-endpoint inputs never auto-derive (picking one node would silently couple cluster availability to it) - pass `--cluster-endpoint` explicitly or fill `values.yaml::endpoint` later by hand. The init flow prints a hint at the end when the field is left empty.

**Update an existing project to the latest bundled library chart:**

- `-u, --update` - re-extract `charts/talm/` and other preset-shipped files from the talm binary. `--preset` is required; `--name` is not.
- `--force` - auto-accept every preset-template diff (skip the interactive prompt; safe to use in CI).

`--update` rewrites preset-shipped files only; your `values.yaml`, `secrets.yaml`, `templates/`, and `nodes/` customisations are preserved.

**Manage encrypted secrets in-place:**

- `-e, --encrypt` - encrypt `secrets.yaml` / `talosconfig` / `kubeconfig` into their `.encrypted` counterparts. Requires `talm.key`.
- `-d, --decrypt` - reverse the above. Does not require `--preset` or `--name`.

#### Updating to a Newer Talm Release

When a new talm version ships a newer bundled library chart, refresh your project in place:

```bash
cd cozystack-cluster
talm init --update --preset cozystack          # interactive: prompts for each preset-template diff
talm init --update --preset cozystack --force  # non-interactive: auto-accept all diffs
```

#### Encrypt / Decrypt Round-Trip

The encrypted copies are what you commit to git; the plaintext copies are what `talm` reads. Use these to round-trip between the two:

```bash
talm init --encrypt   # secrets.yaml -> secrets.encrypted.yaml; talosconfig -> talosconfig.encrypted
talm init --decrypt   # reverse — does not require --preset or --name
```

Lose the `talm.key` file and the encrypted counterparts become unreadable, so keep a backup of the key out-of-band. When `talm init --decrypt` runs against a project where `talm.key` is missing, talm surfaces both recovery paths in the error hint: restore the backed-up key, or re-run `talm init` to regenerate (with the explicit warning that regenerating writes new secrets, making the old `secrets.encrypted.yaml` undecryptable without the original key).


### 2.2. Редактирование значений конфигурации и шаблонов

Сила Talm — в шаблонизации.
Есть несколько файлов с исходными значениями и шаблонами, которые можно редактировать: `Chart.yaml`, `values.yaml` и `templates/*`.
Talm использует эти значения и шаблоны для генерации конфигурации Talos для всех узлов кластера: и control plane, и workers.

Все часто изменяемые значения конфигурации находятся в `values.yaml`:

```yaml
## Используется для доступа к control plane кластера
endpoint: "https://192.168.100.10:6443"
## Домен кластера Cozystack API — используется сервисами и K8s-кластерами tenant'ов для доступа к управляющему кластеру
clusterDomain: cozy.local
## Floating IP — должен быть неиспользуемым IP-адресом в той же подсети, что и узлы
floatingIP: 192.168.100.10
## Исходный образ Talos: используйте последнюю доступную версию
## https://github.com/cozystack/cozystack/pkgs/container/cozystack%2Ftalos
image: "ghcr.io/cozystack/cozystack/talos:{{< version-pin "talos" >}}"
## Подсеть Pod'ов — используется для назначения IP-адресов pod'ам
podSubnets:
- 10.244.0.0/16
## Подсеть сервисов — используется для назначения IP-адресов сервисам
serviceSubnets:
- 10.96.0.0/16
## Подсеть с IP-адресами узлов
advertisedSubnets:
- 192.168.100.0/24
## Добавьте URL OIDC issuer, чтобы включить OIDC — см. комментарии ниже.
oidcIssuerUrl: ""
certSANs: []
```

На этом шаге не нужно указывать IP-адреса узлов.
Вы укажете их позже, при генерации конфигураций узлов.

#### Extending the rendered Talos config (Talm v0.30+)

The `cozystack` preset ships curated defaults for `machine.kernel.modules`, `machine.sysctls`, `machine.kubelet.extraConfig`, and `machine.files`. Operators wanting to add to any of these without forking the chart use four `extra*` values keys:

| Key | Shape | Semantics on the `cozystack` preset |
| --- | --- | --- |
| `extraKernelModules` | list | Appended to the built-in modules (`openvswitch`, `drbd`, `zfs`, `spl`, `vfio_pci`, `vfio_iommu_type1`). Each entry is a Talos kernel-module spec. |
| `extraKubeletExtraArgs` | map | Merged into `kubelet.extraConfig` after the preset's `cpuManagerPolicy: static`, `maxPods: 512`. Operator keys must NOT collide with built-ins — yaml.v3 rejects duplicate map keys on decode, so a collision fails the render with a precise hint pointing at the offending key. Fork the preset if you need a different default. |
| `extraSysctls` | map | Merged into `machine.sysctls` after the preset's built-in entries: the `gc_thresh1/2/3` ARP-cache sizes, the always-on DRBD/LINSTOR tuning (`tcp_orphan_retries`, `tcp_fin_timeout`, `netdev_max_backlog`, `netdev_budget`, `netdev_budget_usecs`), `vm.nr_hugepages` (when set), and the `tcp_keepalive_*` triplet while `tcpKeepaliveTuning` is enabled. All of these are preset-owned — the same collision-fails-render contract as `extraKubeletExtraArgs` applies. Values must be YAML strings (Talos expects strings even for numeric sysctls). |
| `extraMachineFiles` | list | Appended to the preset's CRI customization and `lvm.conf` entries. Talos rejects duplicate `path:` at apply time. |

Example `values.yaml` addition:

```yaml
extraKernelModules:
  - name: nf_conntrack
extraKubeletExtraArgs:
  feature-gates: "NodeSwap=true"
extraSysctls:
  net.core.somaxconn: "65535"
extraMachineFiles:
  - path: /etc/example.conf
    op: create
    content: "hello = world"
```

The `generic` preset ships no defaults under any of these sections — each block emits only when the matching `extra*` key is non-empty.

Beyond the `extra*` extension points, the `cozystack` preset exposes two opinionated tunables you can change without forking the chart:

| Key | Default | Effect |
| --- | --- | --- |
| `tcpKeepaliveTuning` | `false` | When `true`, adds `net.ipv4.tcp_keepalive_time=600` / `intvl=10` / `probes=6` to `machine.sysctls`, reaping a dead idle socket in ~660s instead of the kernel default ~2h. These sysctls are kernel-wide — they change failure detection for every long-lived idle TCP connection on the node, not just DRBD — so they are opt-in. DRBD already detects dead peers in seconds via its own protocol-level ping, so leave this off unless you specifically want faster node-wide dead-socket detection. |
| `etcd.quotaBackendBytes` | `"8589934592"` (8 GiB) | etcd backend DB size ceiling, emitted as `cluster.etcd.extraArgs.quota-backend-bytes` on controlplane nodes only. Raises etcd's own 2 GiB default so a LINSTOR-heavy control plane holding many DRBD-resource CRDs in aggregate does not trip the NOSPACE alarm. It is a ceiling, not a reservation: a small DB stays small and costs no extra RAM/disk. Set it to `""` to fall back to etcd's built-in default. This governs total DB size, not single-object size — per-object writes stay bounded by kube-apiserver's fixed 3 MiB request-body limit, which has no configuration knob. |

The five always-on DRBD/LINSTOR sysctls listed in the `extraSysctls` row above ship unconditionally on the `cozystack` preset — they address TCP-port exhaustion observed under DRBD reconnect storms and have no equivalent on the `generic` preset.

### 2.3 Add Keycloak Configuration

By default, the cluster will be accessible only by authentication with a token.
However, you can configure an OIDC provider to use account-based authentication.
This configuration starts at this step and continues later, after installing Cozystack.

To configure Keycloak as an OIDC provider, apply the following changes to the templates:

-   For Talm v0.6.6 or later: in `./templates/_helpers.tpl` replace `keycloak.example.com` with `keycloak.<your-domain.tld>`.

-   For Talm earlier than v0.6.6, update `./templates/_helpers.tpl` in the following way:

    ```yaml
     cluster:
       apiServer:
         extraArgs:
           oidc-issuer-url: "https://keycloak.example.com/realms/cozy"
           oidc-client-id: "kubernetes"
           oidc-username-claim: "preferred_username"
           oidc-groups-claim: "groups"
    ```


## 3. Генерация конфигурационных файлов узлов

Следующий шаг — создать конфигурационные файлы узлов из шаблонов.
Создайте каталог `nodes` и соберите информацию с каждого узла в отдельный файл для этого узла:

```bash
mkdir nodes
talm template -e 192.168.123.11 --nodes 192.168.123.11 -t templates/controlplane.yaml -i > nodes/node1.yaml
talm template -e 192.168.123.12 --nodes 192.168.123.12 -t templates/controlplane.yaml -i > nodes/node2.yaml
talm template -e 192.168.123.13 --nodes 192.168.123.13 -t templates/controlplane.yaml -i > nodes/node3.yaml
```

Параметр `--insecure` (`-i`) нужен потому, что Talm должен получить конфигурационные данные
с узлов Talos, которые еще не инициализированы, находятся в maintenance mode и поэтому не могут принять аутентифицированное соединение.
Узлы будут инициализированы только на следующем шаге с помощью `talm apply`.

Сгенерированные файлы содержат блок комментариев с обнаруженными сетевыми интерфейсами и дисками.
Эти файлы можно отредактировать перед применением, чтобы настроить сетевую конфигурацию.
Например, если нужно настроить network bonding (LACP), см.
[Настройка bonding (LACP)]({{% ref "/docs/v1.5/install/how-to/bonding" %}}).


## 4. Применение конфигурации и инициализация кластера

На этом этапе конфигурационные файлы в `node/*.yaml` готовы к применению на узлах.


### 4.1 Применение конфигурационных файлов

Используйте `talm apply`, чтобы применить конфигурационные файлы к соответствующим узлам:

```bash
talm apply -f nodes/node1.yaml -i
talm apply -f nodes/node2.yaml -i
talm apply -f nodes/node3.yaml -i
```

Эта команда инициализирует узлы и настраивает аутентифицированное соединение, поэтому дальше `-i` (`--insecure`) не потребуется.
Если команда выполнена успешно, она вернет IP узла:

```console
$ talm apply -f nodes/node1.yaml -i
- talm: file=nodes/node1.yaml, nodes=[192.168.123.11], endpoints=[192.168.123.11]
```

Позже с `talm apply` также можно использовать следующие опции:

- `--dry-run` - dry run mode покажет diff с существующей конфигурацией без внесения изменений.
- `-m try` - try mode откатит конфигурацию через 1 минуту.


### 4.2 Ожидание перезагрузки

Дождитесь, пока все узлы перезагрузятся.
Если использовался установочный носитель, например USB-накопитель, извлеките его, чтобы узлы загрузились с внутреннего диска.

Когда узлы будут готовы, они откроют порт `50000`; это признак того, что узел завершил настройку Talos и перезагрузился.
Если нужно автоматизировать проверку готовности узлов, используйте такой пример:

```bash
timeout 60 sh -c 'until \
  nc -nzv 192.168.123.11 50000 && \
  nc -nzv 192.168.123.12 50000 && \
  nc -nzv 192.168.123.13 50000; \
  do sleep 1; done'
```


### 4.3. Инициализация Kubernetes

Инициализируйте кластер Kubernetes, выполнив `talm bootstrap` для одного из узлов control plane:

```bash
talm bootstrap -f nodes/node1.yaml
```


## 5. Доступ к кластеру Kubernetes

На этом этапе кластер Kubernetes готов к установке Cozystack.

До этого шага взаимодействие с кластером выполнялось через Talos API и `talosctl`.
Для следующих шагов нужны Kubernetes API и `kubectl`, которым требуется `kubeconfig`.


### 5.1. Получение kubeconfig

Используйте Talm, чтобы сгенерировать административный `kubeconfig`:

```bash
talm kubeconfig -f nodes/node1.yaml
```

Эта команда создаст файл `kubeconfig` в текущем каталоге.


### 5.2. Изменение URL Cluster API

Теперь в `kubeconfig` URL Cluster API указывает на floating IP (VIP) в private subnet.

Если вместо floatingIP используется public IP, обновите endpoint соответствующим образом.
Отредактируйте `kubeconfig` — замените URL кластера на public IP одного из узлов:

```diff
  apiVersion: v1                                                                                                          
  clusters:                                                                                                               
  - cluster:     
      certificate-authority-data: ...                                                                                                         
-     server: https://10.0.1.101:6443   
+     server: https://12.34.56.101:6443   
```


### 5.3. Активация kubeconfig

Затем настройте переменную `KUBECONFIG` или используйте другие инструменты, чтобы сделать этот kubeconfig
доступным вашему клиенту `kubectl`:

```bash
export KUBECONFIG=$PWD/kubeconfig
```

{{% alert color="info" %}}
Чтобы сделать этот `kubeconfig` постоянно доступным, можно сделать его конфигурацией по умолчанию (`~/.kube/config`),
использовать `kubectl config use-context` или применить другие методы.
См. [документацию Kubernetes о доступе к кластеру](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/).
{{% /alert %}}


### 5.4. Проверка доступности кластера

Проверьте, что кластер доступен:

```bash
kubectl get ns
```

Пример вывода:

```console
NAME              STATUS   AGE
default           Active   7m56s
kube-node-lease   Active   7m56s
kube-public       Active   7m56s
kube-system       Active   7m56s
```

### 5.5. Проверка состояния узлов

Проверьте состояние узлов кластера:

```bash
kubectl get nodes    
```

Вывод показывает состояние узлов и версию Kubernetes:

```console
NAME    STATUS     ROLES           AGE     VERSION
node1   NotReady   control-plane   7m56s   v1.33.1
node2   NotReady   control-plane   7m56s   v1.33.1
node3   NotReady   control-plane   7m56s   v1.33.1
```

Обратите внимание, что все узлы показывают `STATUS: NotReady`, и на этом этапе это нормально.
Так происходит потому, что стандартный [CNI-плагин Kubernetes](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
был отключен в конфигурации Talos, чтобы Cozystack мог установить собственный CNI-плагин.


## Следующие шаги

Теперь у вас есть инициализированный кластер Kubernetes, готовый к установке Cozystack.
Чтобы завершить установку, следуйте руководству по развертыванию, начиная с раздела
[Установка Cozystack]({{% ref "/docs/v1.5/getting-started/install-cozystack" %}}).
