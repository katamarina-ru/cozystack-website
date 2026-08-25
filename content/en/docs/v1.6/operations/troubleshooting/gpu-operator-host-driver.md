---
title: "Проброс GPU не работает на хосте с предустановленным драйвером NVIDIA"
linkTitle: "GPU Operator: драйвер на хосте"
description: "Почему vfio-manager отказывается привязывать vfio-pci, если на узле уже установлен драйвер NVIDIA из пакетного менеджера, и как привести узел в порядок."
weight: 30
---

Вариант `default` (проброс, passthrough) пакета `cozystack.gpu-operator` исходит из того, что GPU **принадлежит драйверу `vfio-pci` в ядре хоста и никому больше**. Если на узле драйвер NVIDIA уже установлен через пакетный менеджер дистрибутива, оператор обнаруживает его, отказывается что-либо трогать, и настройка проброса так и не завершается.

Проверено 28.05.2026 на чарте `gpu-operator` v26.3.1 с `nvcr.io/nvidia/cloud-native/k8s-driver-manager:v0.10.0`, на хосте с Ubuntu 24.04 и установленным `nvidia-driver-580-open` 580.82.07.

{{< note >}}

Если GPU нужны вам в **контейнерах**, а не в ВМ, то приводить узел в порядок вообще не требуется: используйте [вариант `container`](/docs/v1.6/operations/gpu-container-workloads/) — он рассчитан ровно на такую конфигурацию хоста и оставляет хостовый драйвер на месте.

{{< /note >}}

## Симптом

`kubectl get pods -n cozy-gpu-operator` показывает, что `nvidia-vfio-manager-*` застрял в состоянии `Init:Error` или `Init:CrashLoopBackOff`: init-контейнер завершается с ненулевым кодом после обнаружения хостового драйвера, поэтому kubelet перезапускает его снова и снова.

В его логе видно, что шаг привязки был пропущен:

```text
Host driver detected: 580.82.07
NVIDIA GPU driver is already pre-installed on the node,
  disabling the containerized driver
Labeling node <NODE> with nvidia.com/gpu.deploy.driver=pre-installed
```

Затем в CrashLoopBackOff уходит `nvidia-sandbox-validator`:

```text
Error: error validating vfio-pci driver installation:
  device not bound to 'vfio-pci'; device: 0000:18:00.0 driver: 'nvidia'
```

`lspci -nnk -d 10de:` по-прежнему показывает `Kernel driver in use: nvidia` для каждого целевого GPU, на узле висит метка `nvidia.com/gpu.deploy.driver=pre-installed`, а команда ниже выводит `{}` — ни один ресурс GPU не зарегистрирован:

```bash
kubectl get node <NODE> -o json | jq '.status.allocatable | with_entries(select(.key | startswith("nvidia.com/")))'
```

## Почему это происходит

DaemonSet `vfio-manager` из чарта запускает апстримный init-контейнер NVIDIA `k8s-driver-manager` с подкомандой `uninstall_driver`. Этот путь вызывает Go-метод `(*DriverManager).isHostDriver`, который выполняет `chroot /host nvidia-smi --query-gpu=driver_version --format=csv,noheader` и трактует любой непустой вывод в stdout как «хостовый драйвер присутствует». Наличие файла заранее не проверяется: если `nvidia-smi` нет, вызов в chroot завершается ошибкой и `isHostDriver` возвращает false — это и есть штатный путь на чистом хосте, после которого оператор переходит к процедуре удаления, а `vfio-manager` привязывает `vfio-pci`, как и задумано.

При положительном обнаружении бинарник пишет в лог `Host driver detected: <версия>`, ставит на узел метку `nvidia.com/gpu.deploy.driver=pre-installed` и завершается.

**`FORCE_REINSTALL` эту проверку не обходит.** В `k8s-driver-manager` v0.10.0 есть переменная окружения `FORCE_REINSTALL` и парный флаг `--force-reinstall`, но они управляют более поздней веткой «конфигурация уже загружена» внутри `uninstallDriver`, а не досрочным выходом по `isHostDriver` в самом начале. Тот, кто выставит эту переменную в расчёте на обход проверки, сообщит о несуществующем баге. Способа отключить саму проверку `isHostDriver` сейчас нет.

## Восстановление: чистим хост

Удалите хостовый стек NVIDIA и внесите модули ядра в blacklist, чтобы хост больше никогда не забирал GPU себе.

Здесь есть две ловушки. `apt autoremove` в этой ситуации опасен, потому что префикс `nvidia-` общий с userspace-пакетами NVIDIA DOCA / Mellanox / InfiniBand, и «слепой» autoremove может убить RDMA на конвергентном хосте с GPU и RDMA. А жёстко заданный список шаблонов `apt purge 'nvidia-*' 'cuda-*'` ненадёжен: `apt` трактует `*` как регулярное выражение по всему кэшу и **прерывает всю транзакцию, не удалив ничего**, если хотя бы один шаблон ничего не нашёл в кэше (например, `cuda-*` на хосте без CUDA-репозитория NVIDIA). Вместо этого сформируйте список из того, что реально установлено:

```bash
# Шаблоны dpkg-query — это настоящие глобы по УСТАНОВЛЕННЫМ пакетам:
# ни прерывания при нулевом совпадении (в отличие от регулярного
# выражения apt по всему кэшу), ни случайного совпадения по подстроке.
# Сначала получите список и просмотрите его, только потом удаляйте.
dpkg-query -W -f '${Package}\n' 'nvidia-*' 'libnvidia-*' 'cuda-*' 2>/dev/null
```

Просмотрите список перед удалением:

- `nvidia-dkms-*` и `nvidia-kernel-*` — несущие элементы в ядре: если их не удалить, DKMS пересоберёт `nvidia.ko` при следующей перезагрузке, и любой явный `modprobe` обойдёт blacklist, описанный ниже.
- На **конвергентном хосте с GPU и RDMA** исключите из списка все `libnvidia-*`, относящиеся к NVIDIA DOCA / Mellanox OFED: их удаление сломает RDMA.
- Если список **пуст**, драйвер был установлен инсталлятором NVIDIA из `.run`, а не через apt — тогда вместо удаления пакетов запустите `sudo nvidia-uninstall`.

Затем удалите просмотренный список, внесите модули в blacklist и пересоберите initramfs:

```bash
# Подставьте пакеты, которые вы оставили в списке выше.
sudo apt purge nvidia-driver-580-open nvidia-dkms-580-open <...>

sudo tee /etc/modprobe.d/blacklist-nvidia.conf > /dev/null <<'EOF'
blacklist nouveau
blacklist nvidia
blacklist nvidia_drm
blacklist nvidia_modeset
blacklist nvidia_uvm
blacklist nvidia_peermem
EOF

# Ключ -k all пересобирает initramfs для КАЖДОГО установленного ядра
# (обычный -u затрагивает только работающее ядро), поэтому только что
# обновлённое ядро тоже загрузится с blacklist и не сможет забрать GPU.
sudo update-initramfs -u -k all
sudo reboot
```

## Убеждаемся, что хост чист

Init-контейнер завершается с ненулевым кодом после обнаружения хостового драйвера, поэтому оба пода DaemonSet-ов остаются в `Init:CrashLoopBackOff` и **повторят попытку сами**: удаление подов лишь пропускает окно ожидания длиной до пяти минут.

```bash
# Не должно вывести ничего.
lsmod | grep -E '^(nvidia|nouveau)'

# command -v повторяет логику isHostDriver (поиск по PATH внутри
# chroot), поэтому находит и /usr/local/bin/nvidia-smi, оставленный
# установкой из .run или CUDA-toolkit. При успехе печатает "ok: gone".
command -v nvidia-smi >/dev/null && echo "STILL PRESENT — purge incomplete" || echo "ok: gone"

# Оставшийся модуль DKMS пересоберёт nvidia.ko при следующем обновлении
# ядра, а явный modprobe обойдёт blacklist — вывода быть не должно.
dkms status | grep -i nvidia

# Пропускаем окно ожидания CrashLoopBackOff, удаляя застрявшие поды.
# Метки этих DaemonSet-ов управляются оператором и не стабильны между
# версиями gpu-operator, поэтому удаляем по шаблону имени — с якорем,
# чтобы под шаблон попали ровно два DaemonSet-а и ничего больше.
kubectl -n cozy-gpu-operator get pods -o name \
  | grep -E '^pod/(nvidia-vfio-manager|nvidia-sandbox-validator)-' \
  | xargs -r kubectl -n cozy-gpu-operator delete
```

За пару минут `vfio-manager` должен привязать каждый целевой GPU к `vfio-pci`, а в `allocatable` узла появится зарегистрированный ресурс:

```bash
lspci -nnk -d 10de: | grep 'Kernel driver in use'
# Kernel driver in use: vfio-pci

kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.status.allocatable}{"\n"}{end}' | grep nvidia.com
```

## Убираем оставшуюся метку

Одна метка **не** снимается автоматически. Init-контейнер выставил `nvidia.com/gpu.deploy.driver=pre-installed`, а успешный путь оператора восстанавливает только метки операндов: `rescheduleGPUOperatorComponents` в `k8s-driver-manager` v0.10.0 трогает метки валидатора, toolkit и device-plugin, но не `deploy.driver`. Поэтому `pre-installed` остаётся на узле навсегда: это та же метка, которую раздел «Симптом» использует как признак проблемы, и она отключит DaemonSet контейнеризованного драйвера, если позже узел переведут на контейнерные рабочие нагрузки.

```bash
# На успешном пути эту метку никто не сбрасывает; снимите её, чтобы она
# не путала при будущей диагностике и не мешала последующему переходу на
# контейнерные рабочие нагрузки.
kubectl label node <NODE> nvidia.com/gpu.deploy.driver-
```

## Известное ограничение

Поведение «пропустить, если драйвер предустановлен» заложено в апстримном Go-бинарнике [`NVIDIA/k8s-driver-manager`](https://github.com/NVIDIA/k8s-driver-manager), в файле `cmd/driver-manager/main.go`: `(*DriverManager).isHostDriver` вызывается из `(*DriverManager).uninstallDriver` и в версии `:v0.10.0` не имеет штатного способа отключения.

Поэтому хосты, которым нужно сохранить установленный драйвер NVIDIA для задач вне Kubernetes, не могут отдать тот же GPU варианту с пробросом. Есть два выхода:

- **Использовать [вариант `container`](/docs/v1.6/operations/gpu-container-workloads/)**, если рабочие нагрузки могут быть контейнерами, а не ВМ. Он рассчитан на хост с драйвером, установленным из пакетов, и отдаёт GPU подам, не отвязывая хостовый драйвер, так что чистка не нужна.
- **Изменения в апстриме** — переопределение `isHostDriver` через переменную окружения было бы единственным структурным решением, позволяющим варианту с пробросом сосуществовать с хостовым драйвером. Запрошено в [NVIDIA/k8s-driver-manager#191](https://github.com/NVIDIA/k8s-driver-manager/issues/191), issue всё ещё открыт.

Talos это не затрагивает: образ Talos содержит только расширение `vfio-pci` и не содержит хостового стека NVIDIA, поэтому проверка на чистый хост проходит тривиально. Эта страница относится к дистрибутивам, где хостовый драйвер вы установили сами — обычно это Ubuntu, Debian или RHEL с `apt install nvidia-driver-*` или аналогом.
