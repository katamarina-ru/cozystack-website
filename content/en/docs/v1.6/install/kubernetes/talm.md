---
title: Использование Talm для инициализации кластера Cozystack
linkTitle: Talm
description: "`talm` — декларативный CLI-инструмент, созданный разработчиками Cozystack и оптимизированный для развертывания Cozystack.<br> Рекомендуется для infrastructure-as-code и GitOps."
weight: 5
aliases:
  - /docs/v1.6/operations/talos/configuration/talm
  - /docs/v1.6/talos/bootstrap/talm
  - /docs/v1.6/talos/configuration/talm
---

В этом руководстве описано, как установить и настроить Kubernetes в кластере Talos Linux с помощью Talm.
После выполнения этого руководства у вас будет кластер Kubernetes, готовый к установке Cozystack.

[Talm](https://github.com/cozystack/talm) — Helm-подобная утилита для декларативного управления конфигурацией Talos Linux.
Talm был создан Ænix, чтобы сделать конфигурации управления кластером более декларативными и настраиваемыми.
Talm поставляется с готовыми пресетами для Cozystack.

## Предварительные требования

К началу работы с этим руководством [Talos Linux должен быть установлен]({{% ref "/docs/v1.6/install/talos" %}}) на нескольких узлах, но еще не инициализирован (bootstrapped).
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

- `charts` - a directory that includes a common library chart with functions used for querying information from Talos Linux.
- `Chart.yaml` - a file containing the common information about your project; the name of the chart is used as the name for the newly created cluster.
- `templates` - a directory used to describe templates for the configuration generation.
- `secrets.yaml` - a file containing secrets for your cluster.
- `secrets.encrypted.yaml`, `talosconfig.encrypted` - encrypted counterparts produced from `talm.key` (commit these to git instead of the plaintext files).
- `talm.key` - the project-local age key used for encrypt / decrypt. Back this up; without it the encrypted files cannot be reopened.
- `values.yaml` - a common values file used to provide parameters for the templating.
- `.talm-preset.lock` - a machine-managed file recording the preset name and its content hash at init time; used to detect preset drift after a talm binary upgrade. Commit it to git so the baseline is shared across the team.
- `nodes` - an optional directory used to describe and store generated configuration for nodes.


#### Доступные пресеты

`talm` поставляется с двумя встроенными пресетами:

- `cozystack` — production-пресет, используемый в этом руководстве.
- `talm` — минимальный library chart для продвинутых пользователей, желающих построить собственный пресет поверх него.

Имя пресета передаётся через `-p` / `--preset`.

#### Справочник флагов `talm init`

Каноничный список см. по `talm init -h`. Сгруппировано по режимам:

**Создание нового проекта (режим по умолчанию):**

- `-p, --preset <name>` — пресет для генерации файлов.
- `-N, --name <cluster-name>` — имя кластера.
- `--endpoints <list>` — Talos API endpoints (через запятую), встраиваемые в `talosconfig.contexts.<name>.endpoints` для клиента talosctl. См. «Флаги endpoint: клиент talosctl против control plane Kubernetes» ниже.
- `--cluster-endpoint <url>` — URL control-plane Kubernetes, записываемый в `values.yaml::endpoint` (например, `https://<vip>:6443`). При init проверяется на наличие scheme + host + port.
- `--image <ref>` — переопределить образ установщика Talos, записываемый в `values.yaml` пресета (например, `factory.talos.dev/installer/<sha256>:<version>`).
- `--talos-version <ver>` — желаемая contract-версия Talos для шаблонизации с обратной совместимостью (например, `v1.12`).
- `--force` — перезаписывать существующие файлы без запроса.

##### Флаги endpoint: клиент talosctl против control plane Kubernetes

В проектах talm слово «endpoint» обозначает две разные сущности:

- **`talosconfig.contexts.<name>.endpoints`** — список записей `host[:port]`, которые клиент talosctl использует для доступа к Talos API. Заполняется флагом `--endpoints` (множественное число, список через запятую).
- **`values.yaml::endpoint`** — один URL со scheme + host + port, который чарт подставляет в `cluster.controlPlane.endpoint` в MachineConfig каждого узла. Именно к нему обращаются kubelet и kube-proxy. Заполняется флагом `--cluster-endpoint` (единственное число, полный URL).

Когда `--endpoints` задан ровно с одним значением, init автоматически выводит `values.yaml::endpoint` как `https://<это>:6443`, потому что случай с единственной целью однозначен. При нескольких endpoints автоматический вывод не выполняется (выбор одного узла молча привязал бы доступность кластера к нему) — задайте `--cluster-endpoint` явно или заполните `values.yaml::endpoint` позже вручную. В конце init выводит подсказку, если поле осталось пустым.

**Обновление существующего проекта до последнего встроенного library chart:**

- `-u, --update` — заново извлечь `charts/talm/` и другие файлы пресета из бинарника talm. `--preset` обязателен; `--name` — нет.
- `--force` — автоматически принимать все diff шаблонов пресета (пропустить интерактивный запрос; безопасно использовать в CI).

`--update` перезаписывает только файлы, поставляемые пресетом; ваши изменения в `values.yaml`, `secrets.yaml`, `templates/` и `nodes/` сохраняются.

**Управление зашифрованными secrets на месте:**

- `-e, --encrypt` — зашифровать `secrets.yaml` / `talosconfig` / `kubeconfig` в их `.encrypted`-копии. Требует `talm.key`.
- `-d, --decrypt` — обратная операция. Не требует `--preset` или `--name`.

#### Обновление до новой версии Talm

Когда новая версия talm поставляется с более новым встроенным library chart, обновите проект на месте:

```bash
cd cozystack-cluster
talm init --update --preset cozystack          # интерактивно: запрашивает по каждому diff шаблона пресета
talm init --update --preset cozystack --force  # неинтерактивно: автоматически принять все diff
```

`--update` re-syncs the vendored `charts/talm/` exactly — files that the new library no longer ships (or strays like `.DS_Store`) are pruned — and advances the preset baseline in `.talm-preset.lock`.

#### Chart Drift Detection (Talm v0.32+)

Render commands read the project's local `charts/talm/` copy, never the binary's built-in charts, so upgrading the talm binary does not touch your project — the vendored chart silently goes stale. Release builds of talm detect this and print a non-fatal `WARN:` line on stderr for two independent signals:

- **Library drift**: the vendored `charts/talm/` differs by content from the copy built into the binary. A pure version stamp difference stays silent; a real difference is reported with a sample of the differing paths (`modified:` / `extra:` / `missing:`).
- **Preset drift**: the binary ships a newer preset than the baseline pinned in `.talm-preset.lock` at init time. Your `templates/` edits are never reported as drift — the comparison is binary-vs-baseline, not binary-vs-project.

Both warnings point at the remediation above. To escalate the warning into a hard error (exit 1) — for example, in CI — set `strictCharts: true` in `Chart.yaml` so the whole team inherits it, or pass `--strict-charts` for a single run. Under strict mode, a baseline that cannot be verified (a corrupted or deleted `.talm-preset.lock`, an unreadable `charts/talm/`) also blocks, so deleting the baseline is not a bypass; without strict mode, such failures degrade to a warning, and projects created before baseline pinning stay silent.

#### Цикл шифрования / расшифровки

В git вы коммитите зашифрованные копии, а `talm` читает копии в открытом виде. Для перехода между ними используйте:

```bash
talm init --encrypt   # secrets.yaml -> secrets.encrypted.yaml; talosconfig -> talosconfig.encrypted
talm init --decrypt   # обратная операция — не требует --preset или --name
```

Если потерять файл `talm.key`, зашифрованные копии станут нечитаемыми, поэтому храните резервную копию ключа отдельно. Когда `talm init --decrypt` запускается в проекте без `talm.key`, talm показывает оба пути восстановления в подсказке ошибки: восстановить сохранённый ключ или заново выполнить `talm init` для регенерации (с явным предупреждением, что регенерация записывает новые secrets, из-за чего старый `secrets.encrypted.yaml` нельзя будет расшифровать без исходного ключа).


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

#### Расширение формируемой конфигурации Talos (Talm v0.30+)

Пресет `cozystack` поставляется с подобранными значениями по умолчанию для `machine.kernel.modules`, `machine.sysctls`, `machine.kubelet.extraConfig` и `machine.files`. Операторам, желающим дополнить любой из них без форка чарта, доступны четыре ключа values `extra*`:

| Ключ | Тип | Семантика в пресете `cozystack` |
| --- | --- | --- |
| `extraKernelModules` | list | Добавляется к встроенным модулям (`openvswitch`, `drbd`, `zfs`, `spl`, `vfio_pci`, `vfio_iommu_type1`). Каждый элемент — spec kernel-модуля Talos. |
| `extraKubeletExtraArgs` | map | Объединяется с `kubelet.extraConfig` после заданных пресетом `cpuManagerPolicy: static`, `maxPods: 512`. Ключи оператора НЕ должны конфликтовать со встроенными — yaml.v3 отвергает дублирующиеся ключи map при декодировании, поэтому конфликт валит render с точной подсказкой на проблемный ключ. Если нужно другое значение по умолчанию — форкните пресет. |
| `extraSysctls` | map | Объединяется с `machine.sysctls` после встроенных записей пресета: размеры ARP-кэша `gc_thresh1/2/3`, всегда включённый тюнинг DRBD/LINSTOR (`tcp_orphan_retries`, `tcp_fin_timeout`, `netdev_max_backlog`, `netdev_budget`, `netdev_budget_usecs`), `vm.nr_hugepages` (когда задан) и тройка `tcp_keepalive_*`, пока включён `tcpKeepaliveTuning`. Все они принадлежат пресету — действует тот же контракт «конфликт валит render», что и для `extraKubeletExtraArgs`. Значения должны быть строками YAML (Talos ожидает строки даже для числовых sysctls). |
| `extraMachineFiles` | list | Добавляется к записям пресета для настройки CRI и `lvm.conf`. Talos отвергает дублирующиеся `path:` при применении. |

Пример дополнения `values.yaml`:

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

Пресет `generic` не поставляет значений по умолчанию ни в одной из этих секций — каждый блок формируется только когда соответствующий ключ `extra*` непуст.

Помимо точек расширения `extra*`, пресет `cozystack` предоставляет два преднастроенных параметра, которые можно менять без форка чарта:

| Ключ | По умолчанию | Эффект |
| --- | --- | --- |
| `tcpKeepaliveTuning` | `false` | Когда `true`, добавляет `net.ipv4.tcp_keepalive_time=600` / `intvl=10` / `probes=6` в `machine.sysctls`, освобождая «мёртвый» простаивающий сокет примерно за 660 с вместо стандартных для ядра ~2 ч. Эти sysctls действуют на всё ядро — они меняют обнаружение сбоев для каждого долгоживущего простаивающего TCP-соединения на узле, а не только для DRBD, — поэтому включаются по желанию. DRBD и так обнаруживает мёртвых пиров за секунды через собственный ping на уровне протокола, поэтому оставляйте выключенным, если вам специально не нужно более быстрое обнаружение мёртвых сокетов на всём узле. |
| `etcd.quotaBackendBytes` | `"8589934592"` (8 ГиБ) | Потолок размера backend-БД etcd, выставляемый как `cluster.etcd.extraArgs.quota-backend-bytes` только на узлах controlplane. Поднимает собственное значение etcd по умолчанию в 2 ГиБ, чтобы control plane с большим количеством LINSTOR, суммарно хранящий множество CRD DRBD-ресурсов, не срабатывал по alarm NOSPACE. Это потолок, а не резервирование: небольшая БД остаётся небольшой и не требует дополнительных RAM/диска. Установите `""`, чтобы вернуться к встроенному значению etcd по умолчанию. Управляет общим размером БД, а не размером отдельного объекта — записи по объектам ограничены фиксированным лимитом тела запроса kube-apiserver в 3 МиБ, у которого нет параметра конфигурации. |

Пять всегда включённых sysctls DRBD/LINSTOR, перечисленных в строке `extraSysctls` выше, поставляются безусловно в пресете `cozystack` — они устраняют исчерпание TCP-портов, наблюдаемое при штормах переподключений DRBD, и не имеют аналога в пресете `generic`.

### 2.3 Добавление конфигурации Keycloak

По умолчанию кластер будет доступен только при аутентификации с помощью токена.
Однако можно настроить OIDC-провайдера, чтобы использовать аутентификацию на основе учётных записей.
Эта настройка начинается на данном шаге и продолжается позже, после установки Cozystack.

Чтобы настроить Keycloak как OIDC-провайдера, внесите следующие изменения в шаблоны:

-   Для Talm v0.6.6 или новее: в `./templates/_helpers.tpl` замените `keycloak.example.com` на `keycloak.<your-domain.tld>`.

-   Для Talm старше v0.6.6 обновите `./templates/_helpers.tpl` следующим образом:

    ```yaml
     cluster:
       apiServer:
         extraArgs:
           oidc-issuer-url: "https://keycloak.example.com/realms/cozy"
           oidc-client-id: "kubernetes"
           oidc-username-claim: "preferred_username"
           oidc-groups-claim: "groups"
    ```


### 2.4 Encrypted user values and secret redaction (Talm v0.32+)

Beyond `secrets.yaml` (the Talos bootstrap secrets), templates often inject operator-supplied secrets into the config — a registry password, an OIDC client secret, a static-pod env value. Talm lets you keep those encrypted in git the same way as `secrets.yaml`, decrypt them in memory at render time, and keep them out of committed node files, terminal output, and CI logs.

**Step 1 — put the secret values in `values-secret.yaml`:**

```yaml
registryPassword: "s3cr3t-high-entropy-value"
```

**Step 2 — encrypt it** with the project's `talm.key`. `talm init --encrypt` produces `values-secret.encrypted.yaml`. Commit the encrypted file; the plaintext `values-secret.yaml` is git-ignored.

**Step 3 — reference the encrypted file** from `Chart.yaml` by adding it to `templateOptions.valueFiles`, so both `talm template` and `talm apply` read it:

```yaml
templateOptions:
  valueFiles:
    - values-secret.encrypted.yaml
```

Referencing it only via the CLI `--values` flag is a foot-gun: the modeline in a node file does not persist value files, so a later `talm apply` would re-render WITHOUT the secret and silently drop the field. Talm surfaces a warning when an encrypted file is passed via `--values` but is not in `templateOptions.valueFiles`.

**Step 4 — use the values in templates** like any other: `{{ .Values.registryPassword | quote }}`.

How secrets are handled across commands:

| Command | Behavior |
| --- | --- |
| `talm template` (stdout) | secret values render as `***`; `--show-secrets` prints them verbatim. |
| `talm template -I` (node file) | secret values are omitted entirely from the committed node file — the real value is re-rendered in memory only at apply, so no plaintext (or ciphertext) ever lands in `nodes/*.yaml`. |
| `talm apply --dry-run` | both diffs redact secrets: talm's structured drift preview AND the server-returned `Config diff:` block. `--show-secrets-in-drift` reveals them. |

The `--show-secrets-in-drift` flag governs every secret-bearing surface of the apply dry-run, covering both these user values and the Talos bootstrap material (`cluster.ca.key`, `machine.token`, encryption secrets, Wireguard keys, etc.). By default, a dry-run never prints a CA private key or a user secret in cleartext.

`talm apply` honors the full set of value sources, matching `talm template`: `--values`, `--set`, `--set-string`, `--set-file`, `--set-json`, `--set-literal`, merged on top of the `templateOptions.*` defaults from `Chart.yaml`. This keeps `template` and `apply` rendering identically.

**Sharp edge — value-based matching.** Redaction matches by exact value across the whole rendered config, so a secret whose plaintext coincides with an ordinary structural string (a password literally set to `controlplane`, or a bare port like `6443`) will also redact that unrelated field. Prefer high-entropy values; do not encrypt low-entropy strings that collide with non-secret config.


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
[Настройка bonding (LACP)]({{% ref "/docs/v1.6/install/how-to/bonding" %}}).


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
[Установка Cozystack]({{% ref "/docs/v1.6/getting-started/install-cozystack" %}}).
