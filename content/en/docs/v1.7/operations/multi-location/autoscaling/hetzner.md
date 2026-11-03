---
title: "Cluster Autoscaler для Hetzner Cloud"
linkTitle: "Hetzner"
description: "Настройка автоматического масштабирования узлов в Hetzner Cloud с Talos Linux."
weight: 10
---

В этом руководстве описано, как настроить cluster-autoscaler для автоматического масштабирования узлов в Hetzner Cloud с Talos Linux.

## Предварительные требования

- Аккаунт Hetzner Cloud с API token
- Установленный CLI `hcloud`
- Существующий Kubernetes-кластер на Talos
- Настроенные [Networking Mesh]({{% ref "../networking-mesh" %}}) и [Local CCM]({{% ref "../local-ccm" %}})

## Шаг 1. Создание образа Talos в Hetzner Cloud

Hetzner не поддерживает прямую загрузку образов, поэтому snapshot нужно создать через временный сервер.

### 1.1. Генерация Schematic ID

Создайте schematic на [factory.talos.dev](https://factory.talos.dev) с нужными расширениями:

```bash
curl -s -X POST https://factory.talos.dev/schematics \
  -H "Content-Type: application/json" \
  -d '{
    "customization": {
      "systemExtensions": {
        "officialExtensions": [
          "siderolabs/qemu-guest-agent",
          "siderolabs/amd-ucode",
          "siderolabs/amdgpu-firmware",
          "siderolabs/bnx2-bnx2x",
          "siderolabs/drbd",
          "siderolabs/i915-ucode",
          "siderolabs/intel-ice-firmware",
          "siderolabs/intel-ucode",
          "siderolabs/qlogic-firmware",
          "siderolabs/zfs"
        ]
      }
    }
  }'
```

Сохраните возвращенный `id` как `SCHEMATIC_ID`.

{{% alert title="Примечание" color="info" %}}
`siderolabs/qemu-guest-agent` обязателен для Hetzner Cloud. Добавьте другие расширения
(zfs, drbd и т. д.) при необходимости для ваших workload.
{{% /alert %}}

### 1.2. Настройка hcloud CLI

```bash
export HCLOUD_TOKEN="<your-hetzner-api-token>"
```

### 1.3. Создание временного сервера в rescue mode

```bash
# Создать сервер (без запуска)
hcloud server create \
  --name talos-image-builder \
  --type cpx22 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key <your-ssh-key-name> \
  --start-after-create=false

# Включить rescue mode и запустить сервер
hcloud server enable-rescue --type linux64 --ssh-key <your-ssh-key-name> talos-image-builder
hcloud server poweron talos-image-builder
```

### 1.4. Запись образа Talos на диск

```bash
# Получить IP-адрес сервера
SERVER_IP=$(hcloud server ip talos-image-builder)

# Подключиться по SSH в rescue mode и записать образ
ssh root@$SERVER_IP

# Внутри rescue mode:
wget -O- "https://factory.talos.dev/image/${SCHEMATIC_ID}/<talos-version>/hcloud-amd64.raw.xz" \
  | xz -d \
  | dd of=/dev/sda bs=4M status=progress
sync
exit
```

### 1.5. Создание snapshot и очистка

```bash
# Выключить сервер и создать snapshot
hcloud server poweroff talos-image-builder
hcloud server create-image --type snapshot --description "Talos <talos-version>" talos-image-builder

# Получить snapshot ID (сохраните его для дальнейших шагов)
hcloud image list --type snapshot

# Удалить временный сервер
hcloud server delete talos-image-builder
```

## Шаг 2. Создание Hetzner vSwitch (необязательно, но рекомендуется)

Создайте приватную сеть для связи между узлами:

```bash
# Создать сеть
hcloud network create --name cozystack-vswitch --ip-range 10.100.0.0/16

# Добавить подсеть для вашего региона (eu-central покрывает FSN1, NBG1)
hcloud network add-subnet cozystack-vswitch \
  --type cloud \
  --network-zone eu-central \
  --ip-range 10.100.0.0/24
```

## Шаг 3. Создание Talos machine config

В репозитории кластера сгенерируйте конфигурационный файл worker-узла:

```bash
talm template -t templates/worker.yaml --offline --full > nodes/hetzner.yaml
```

Затем отредактируйте `nodes/hetzner.yaml` для worker-узлов Hetzner:

1. Добавьте метаданные локации Hetzner (см. [Networking Mesh]({{% ref "../networking-mesh" %}})):
   ```yaml
   machine:
     nodeAnnotations:
       kilo.squat.ai/location: hetzner-cloud
       kilo.squat.ai/persistent-keepalive: "20"
     nodeLabels:
       topology.kubernetes.io/zone: hetzner-cloud
   ```
2. Укажите публичный endpoint Kubernetes API:
   измените `cluster.controlPlane.endpoint` на **публичный** адрес API-сервера, например `https://<public-api-ip>:6443`. Этот адрес можно найти в kubeconfig или опубликовать через ingress.
3. Удалите автоматически обнаруженные секции installer/network:
   удалите из файла секции `machine.install` и `machine.network`.
4. Укажите external cloud provider для kubelet (см. [Local CCM]({{% ref "../local-ccm" %}})):
   ```yaml
   machine:
     kubelet:
       extraArgs:
         cloud-provider: external
   ```
5. Настройте определение подсети IP-адресов узлов:
   укажите в `machine.kubelet.nodeIP.validSubnets` подсеть vSwitch, например `10.100.0.0/24`.
6. Необязательно: добавьте registry mirrors, чтобы избежать rate limiting в Docker Hub:
   ```yaml
   machine:
     registries:
       mirrors:
         docker.io:
           endpoints:
             - https://mirror.gcr.io
   ```

В результате конфигурация должна включать как минимум:

```yaml
machine:
  nodeAnnotations:
    kilo.squat.ai/location: hetzner-cloud
    kilo.squat.ai/persistent-keepalive: "20"
  nodeLabels:
    topology.kubernetes.io/zone: hetzner-cloud
  kubelet:
    nodeIP:
      validSubnets:
        - 10.100.0.0/24                    # замените на свою подсеть vSwitch
    extraArgs:
      cloud-provider: external
  registries:
    mirrors:
      docker.io:
        endpoints:
          - https://mirror.gcr.io
cluster:
  controlPlane:
    endpoint: https://<public-api-ip>:6443
```

Все остальные параметры (токены кластера, CA, расширения и т. д.) остаются такими же, как в сгенерированном шаблоне.

## Шаг 4. Создание Kubernetes Secrets

### 4.1. Создание секрета с Hetzner API token

```bash
kubectl -n cozy-cluster-autoscaler-hetzner create secret generic hetzner-credentials \
  --from-literal=token=<your-hetzner-api-token>
```

### 4.2. Создание секрета с Talos machine config

Machine config должен быть закодирован в base64:

```bash
# Закодировать worker.yaml (base64 одной строкой)
base64 -w 0 -i worker.yaml -o worker.b64

# Создать секрет
kubectl -n cozy-cluster-autoscaler-hetzner create secret generic talos-config \
  --from-file=cloud-init=worker.b64
```

## Шаг 5. Развертывание Cluster Autoscaler

Создайте ресурс Package:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cluster-autoscaler-hetzner
spec:
  variant: default
  components:
    cluster-autoscaler-hetzner:
      values:
        cluster-autoscaler:
          autoscalingGroups:
            - name: workers-fsn1
              minSize: 0
              maxSize: 10
              instanceType: cpx22
              region: FSN1
          extraEnv:
            HCLOUD_IMAGE: "<snapshot-id>"
            HCLOUD_SSH_KEY: "<ssh-key-name>"
            HCLOUD_NETWORK: "cozystack-vswitch"
            HCLOUD_PUBLIC_IPV4: "true"
            HCLOUD_PUBLIC_IPV6: "false"
          extraEnvSecrets:
            HCLOUD_TOKEN:
              name: hetzner-credentials
              key: token
            HCLOUD_CLOUD_INIT:
              name: talos-config
              key: cloud-init
```

Примените манифест:
```bash
kubectl apply -f package.yaml
```

## Шаг 6. Проверка автомасштабирования

Создайте deployment с pod anti-affinity, чтобы принудительно вызвать scale-up:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-autoscaler
spec:
  replicas: 5
  selector:
    matchLabels:
      app: test-autoscaler
  template:
    metadata:
      labels:
        app: test-autoscaler
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels:
                app: test-autoscaler
            topologyKey: kubernetes.io/hostname
      containers:
      - name: nginx
        image: nginx
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
```

Если узлов меньше, чем реплик, autoscaler создаст новые серверы Hetzner.

## Шаг 7. Проверка

```bash
# Проверить логи autoscaler
kubectl -n cozy-cluster-autoscaler-hetzner logs \
  deployment/cluster-autoscaler-hetzner-hetzner-cluster-autoscaler -f

# Проверить узлы
kubectl get nodes -o wide

# Проверить метки узла и internal IP
kubectl get node <node-name> --show-labels
```

Ожидаемый результат для автомасштабируемых узлов:
- Internal IP из диапазона vSwitch, например `10.100.0.2`.
- Метка `kilo.squat.ai/location=hetzner-cloud`.

## Справочник конфигурации

### Переменные окружения

| Переменная | Описание | Обязательна |
|----------|-------------|----------|
| `HCLOUD_TOKEN` | Hetzner API token | Да |
| `HCLOUD_IMAGE` | ID snapshot Talos | Да |
| `HCLOUD_CLOUD_INIT` | Machine config, закодированный в base64 | Да |
| `HCLOUD_NETWORK` | Имя/ID сети vSwitch | Нет |
| `HCLOUD_SSH_KEY` | Имя/ID SSH-ключа | Нет |
| `HCLOUD_FIREWALL` | Имя/ID Firewall | Нет |
| `HCLOUD_PUBLIC_IPV4` | Назначать публичный IPv4 | Нет (по умолчанию: true) |
| `HCLOUD_PUBLIC_IPV6` | Назначать публичный IPv6 | Нет (по умолчанию: false) |

### Типы серверов Hetzner

| Тип | vCPU | RAM | Подходит для |
|------|------|-----|----------|
| cpx22 | 2 | 4GB | Небольших workload |
| cpx32 | 4 | 8GB | Общих задач |
| cpx42 | 8 | 16GB | Средних workload |
| cpx52 | 16 | 32GB | Крупных workload |
| ccx13 | 2 dedicated | 8GB | CPU-intensive workload |
| ccx23 | 4 dedicated | 16GB | CPU-intensive workload |
| ccx33 | 8 dedicated | 32GB | CPU-intensive workload |
| cax11 | 2 ARM | 4GB | ARM workload |
| cax21 | 4 ARM | 8GB | ARM workload |

{{% alert title="Примечание" color="info" %}}
Некоторые старые типы серверов (cpx11, cpx21 и т. д.) могут быть недоступны в отдельных регионах.
{{% /alert %}}

### Регионы Hetzner

| Код | Локация |
|------|----------|
| FSN1 | Фалькенштайн, Германия |
| NBG1 | Нюрнберг, Германия |
| HEL1 | Хельсинки, Финляндия |
| ASH | Ашберн, США |
| HIL | Хилсборо, США |

## Устранение неполадок

### Подключение к удаленным worker-узлам для диагностики

Talos не позволяет открывать dashboard напрямую к worker-узлам. Используйте `talm dashboard`
для подключения через control plane:

```bash
talm dashboard -f nodes/<control-plane>.yaml -n <worker-node-ip>
```

Здесь `<control-plane>.yaml` - конфигурация узла control plane, а `<worker-node-ip>` -
внутренний Kubernetes IP удаленного worker-узла.

### Узлы не присоединяются к кластеру

1. Проверьте VNC console через Hetzner Cloud Console или командой:
   ```bash
   hcloud server request-console <server-name>
   ```
2. Частые ошибки:
   - **"unknown keys found during decoding"**: проверьте формат Talos config. `nodeLabels` находится в `machine`, `nodeIP` - в `machine.kubelet`.
   - **"kubelet image is not valid"**: несовпадение версии Kubernetes. Используйте версию kubelet, совместимую с вашей версией Talos.
   - **"failed to load config"**: синтаксическая ошибка в machine config.

### У узлов неправильный Internal IP

Убедитесь, что в `machine.kubelet.nodeIP.validSubnets` указана ваша подсеть vSwitch:
```yaml
machine:
  kubelet:
    nodeIP:
      validSubnets:
        - 10.100.0.0/24
```

### Scale-up не запускается

1. Проверьте логи autoscaler на ошибки.
2. Проверьте права RBAC: требуется доступ к leases.
3. Проверьте, действительно ли pod находятся в состоянии Pending:
   ```bash
   kubectl get pods --field-selector=status.phase=Pending
   ```

### Rate limiting registry (ошибки 403)

Добавьте registry mirrors в Talos config:
```yaml
machine:
  registries:
    mirrors:
      docker.io:
        endpoints:
          - https://mirror.gcr.io
      registry.k8s.io:
        endpoints:
          - https://registry.k8s.io
```

### Scale-down не работает

Autoscaler кэширует информацию об узлах до 30 минут. Подождите или перезапустите autoscaler:
```bash
kubectl -n cozy-cluster-autoscaler-hetzner rollout restart \
  deployment cluster-autoscaler-hetzner-hetzner-cluster-autoscaler
```
