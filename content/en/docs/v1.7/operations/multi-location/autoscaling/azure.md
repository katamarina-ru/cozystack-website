---
title: "Cluster Autoscaler для Azure"
linkTitle: "Azure"
description: "Настройка автоматического масштабирования узлов в Azure с Talos Linux и VMSS."
weight: 20
---

В этом руководстве описано, как настроить cluster-autoscaler для автоматического масштабирования узлов в Azure с Talos Linux.

## Предварительные требования

- Подписка Azure с Service Principal, имеющим роль Contributor
- Установленный CLI `az`
- Существующий Kubernetes-кластер на Talos
- Настроенные [Networking Mesh]({{% ref "../networking-mesh" %}}) и [Local CCM]({{% ref "../local-ccm" %}})

## Шаг 1. Создание инфраструктуры Azure

### 1.1. Вход через Service Principal

```bash
az login --service-principal \
  --username "<APP_ID>" \
  --password "<PASSWORD>" \
  --tenant "<TENANT_ID>"
```

### 1.2. Создание группы ресурсов

```bash
az group create \
  --name <resource-group> \
  --location <location>
```

### 1.3. Создание VNet и подсети

```bash
az network vnet create \
  --resource-group <resource-group> \
  --name cozystack-vnet \
  --address-prefix 10.2.0.0/16 \
  --subnet-name workers \
  --subnet-prefix 10.2.0.0/24 \
  --location <location>
```

### 1.4. Создание Network Security Group

```bash
az network nsg create \
  --resource-group <resource-group> \
  --name cozystack-nsg \
  --location <location>

# Разрешить WireGuard
az network nsg rule create \
  --resource-group <resource-group> \
  --nsg-name cozystack-nsg \
  --name AllowWireGuard \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Udp \
  --destination-port-ranges 51820

# Разрешить Talos API
az network nsg rule create \
  --resource-group <resource-group> \
  --nsg-name cozystack-nsg \
  --name AllowTalosAPI \
  --priority 110 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 50000

# Связать NSG с подсетью
az network vnet subnet update \
  --resource-group <resource-group> \
  --vnet-name cozystack-vnet \
  --name workers \
  --network-security-group cozystack-nsg
```

## Шаг 2. Создание образа Talos

### 2.1. Генерация Schematic ID

Создайте schematic на [factory.talos.dev](https://factory.talos.dev) с нужными расширениями:

```bash
curl -s -X POST https://factory.talos.dev/schematics \
  -H "Content-Type: application/json" \
  -d '{
    "customization": {
      "systemExtensions": {
        "officialExtensions": [
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

### 2.2. Создание Managed Image из VHD

```bash
# Скачать образ Talos для Azure
curl -L -o azure-amd64.raw.xz \
  "https://factory.talos.dev/image/${SCHEMATIC_ID}/<talos-version>/azure-amd64.raw.xz"

# Распаковать
xz -d azure-amd64.raw.xz

# Конвертировать в VHD
qemu-img convert -f raw -o subformat=fixed,force_size -O vpc \
  azure-amd64.raw azure-amd64.vhd

# Получить размер VHD
VHD_SIZE=$(stat -f%z azure-amd64.vhd)  # macOS
# VHD_SIZE=$(stat -c%s azure-amd64.vhd)  # Linux

# Создать managed disk для загрузки
az disk create \
  --resource-group <resource-group> \
  --name talos-<talos-version> \
  --location <location> \
  --upload-type Upload \
  --upload-size-bytes $VHD_SIZE \
  --sku Standard_LRS \
  --os-type Linux \
  --hyper-v-generation V2

# Получить SAS URL для загрузки
SAS_URL=$(az disk grant-access \
  --resource-group <resource-group> \
  --name talos-<talos-version> \
  --access-level Write \
  --duration-in-seconds 3600 \
  --query accessSAS --output tsv)

# Загрузить VHD
azcopy copy azure-amd64.vhd "$SAS_URL" --blob-type PageBlob

# Отозвать доступ
az disk revoke-access \
  --resource-group <resource-group> \
  --name talos-<talos-version>

# Создать managed image из диска
az image create \
  --resource-group <resource-group> \
  --name talos-<talos-version> \
  --location <location> \
  --os-type Linux \
  --hyper-v-generation V2 \
  --source $(az disk show --resource-group <resource-group> \
    --name talos-<talos-version> --query id --output tsv)
```

## Шаг 3. Создание Talos machine config для Azure

В репозитории кластера сгенерируйте конфигурационный файл worker-узла:

```bash
talm template -t templates/worker.yaml --offline --full > nodes/azure.yaml
```

Затем отредактируйте `nodes/azure.yaml` для worker-узлов Azure:

1. Добавьте метаданные локации Azure (см. [Networking Mesh]({{% ref "../networking-mesh" %}})):
   ```yaml
   machine:
     nodeAnnotations:
       kilo.squat.ai/location: azure
       kilo.squat.ai/persistent-keepalive: "20"
     nodeLabels:
       topology.kubernetes.io/zone: azure
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
   укажите в `machine.kubelet.nodeIP.validSubnets` фактическую подсеть Azure, в которой будут работать автомасштабируемые узлы, например `192.168.102.0/23`.
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
    kilo.squat.ai/location: azure
    kilo.squat.ai/persistent-keepalive: "20"
  nodeLabels:
    topology.kubernetes.io/zone: azure
  kubelet:
    nodeIP:
      validSubnets:
        - 192.168.102.0/23             # замените на подсеть worker-узлов Azure
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

## Шаг 4. Создание VMSS (Virtual Machine Scale Set)

```bash
IMAGE_ID=$(az image show \
  --resource-group <resource-group> \
  --name talos-<talos-version> \
  --query id --output tsv)

az vmss create \
  --resource-group <resource-group> \
  --name workers \
  --location <location> \
  --orchestration-mode Uniform \
  --image "$IMAGE_ID" \
  --vm-sku Standard_D2s_v3 \
  --instance-count 0 \
  --vnet-name cozystack-vnet \
  --subnet workers \
  --public-ip-per-vm \
  --custom-data nodes/azure.yaml \
  --security-type Standard \
  --admin-username talos \
  --authentication-type ssh \
  --generate-ssh-keys \
  --upgrade-policy-mode Manual

# Включить IP forwarding на NIC в VMSS (нужно, чтобы лидер Kilo пересылал трафик)
az vmss update \
  --resource-group <resource-group> \
  --name workers \
  --set virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].enableIPForwarding=true
```

{{% alert title="Важно" color="warning" %}}
- Обязательно используйте `--orchestration-mode Uniform`: cluster-autoscaler требует режим Uniform.
- Обязательно используйте `--public-ip-per-vm` для связности WireGuard.
- На NIC в VMSS должен быть включен IP forwarding, чтобы лидер Kilo мог пересылать трафик между WireGuard mesh и не-лидерными узлами в той же подсети.
- Проверьте квоту VM в своем регионе: `az vm list-usage --location <location>`.
- `--custom-data` передает Talos machine config новым инстансам.
{{% /alert %}}

## Шаг 5. Развертывание Cluster Autoscaler

Создайте ресурс Package:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cluster-autoscaler-azure
spec:
  variant: default
  components:
    cluster-autoscaler-azure:
      values:
        cluster-autoscaler:
          azureClientID: "<APP_ID>"
          azureClientSecret: "<PASSWORD>"
          azureTenantID: "<TENANT_ID>"
          azureSubscriptionID: "<SUBSCRIPTION_ID>"
          azureResourceGroup: "<RESOURCE_GROUP>"
          azureVMType: "vmss"
          autoscalingGroups:
            - name: workers
              minSize: 0
              maxSize: 10
```

Примените манифест:
```bash
kubectl apply -f package.yaml
```

## Шаг 6. Связность Kilo WireGuard

Узлы Azure находятся за NAT, поэтому их начальный WireGuard endpoint будет приватным IP-адресом. Kilo обрабатывает это автоматически через встроенный в WireGuard NAT traversal, если настроен `persistent-keepalive` (он уже добавлен в machine config на шаге 3).

Процесс работает так:
1. Узел Azure инициирует WireGuard handshake с on-premises лидером, у которого есть публичный IP-адрес.
2. `persistent-keepalive` периодически отправляет keepalive-пакеты и поддерживает NAT mapping.
3. On-premises лидер Kilo через WireGuard определяет реальный публичный endpoint узла Azure.
4. Kilo сохраняет обнаруженный endpoint и использует его для последующих подключений.

{{% alert title="Примечание" color="info" %}}
Ручная аннотация `force-endpoint` не нужна. Аннотации `kilo.squat.ai/persistent-keepalive: "20"` в machine config достаточно, чтобы Kilo автоматически обнаруживал NAT endpoints. Без этой аннотации механизм NAT traversal в Kilo отключен, и туннель не стабилизируется.
{{% /alert %}}

## Проверка

### Ручная проверка масштабирования

```bash
# Увеличить размер группы
az vmss scale --resource-group <resource-group> --name workers --new-capacity 1

# Проверить, что узел присоединился
kubectl get nodes -o wide

# Проверить туннель WireGuard
kubectl logs -n cozy-kilo <kilo-pod-on-azure-node>

# Уменьшить размер группы
az vmss scale --resource-group <resource-group> --name workers --new-capacity 0
```

### Проверка autoscaler

Разверните workload, который вызовет автомасштабирование:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-azure-autoscale
spec:
  replicas: 3
  selector:
    matchLabels:
      app: test-azure
  template:
    metadata:
      labels:
        app: test-azure
    spec:
      nodeSelector:
        topology.kubernetes.io/zone: azure
      containers:
        - name: pause
          image: registry.k8s.io/pause:3.9
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
```

## Устранение неполадок

### Подключение к удаленным worker-узлам для диагностики

Worker-узлы Azure можно диагностировать через **Serial console** в Azure Portal:
перейдите к инстансу VMSS → **Support + troubleshooting** → **Serial console**.
Так вы получите прямой доступ к консольному выводу узла без сетевого подключения.

Также можно использовать `talm dashboard` для подключения через control plane:

```bash
talm dashboard -f nodes/<control-plane>.yaml -n <worker-node-ip>
```

Здесь `<control-plane>.yaml` - конфигурация узла control plane, а `<worker-node-ip>` -
внутренний Kubernetes IP удаленного worker-узла.

### Узел застрял в maintenance mode

Если в serial console отображаются такие сообщения:

```
[talos]  talosctl apply-config --insecure --nodes 10.2.0.5 --file <config.yaml>
[talos] or apply configuration using talosctl interactive installer:
[talos]  talosctl apply-config --insecure --nodes 10.2.0.5 --mode=interactive
```

Это означает, что machine config не был применен или содержит ошибки. Частые причины:

- **Неподдерживаемая версия Kubernetes**: версия образа `kubelet` в конфигурации несовместима с текущей версией Talos.
- **Некорректная конфигурация**: ошибки синтаксиса YAML или недопустимые значения полей.
- **`customData` не применен**: инстанс VMSS был создан до обновления конфигурации.

Для диагностики примените конфигурацию вручную через Talos API (порт 50000 должен быть открыт в NSG):

```bash
talosctl apply-config --insecure --nodes <node-public-ip> --file nodes/azure.yaml
```

Если конфигурация будет отклонена, сообщение об ошибке покажет, что нужно исправить.

Чтобы обновить machine config для новых инстансов VMSS:

```bash
az vmss update \
  --resource-group <resource-group> \
  --name workers \
  --custom-data @nodes/azure.yaml
```

После обновления удалите существующие инстансы, чтобы они были пересозданы с новой конфигурацией:

```bash
az vmss delete-instances \
  --resource-group <resource-group> \
  --name workers \
  --instance-ids "*"
```

{{% alert title="Предупреждение" color="warning" %}}
Azure не предоставляет способ прочитать `customData` обратно из VMSS: его можно только задать. Всегда храните файл machine config (`nodes/azure.yaml`) в системе контроля версий как единственный источник истины.
{{% /alert %}}

### Узел не присоединяется к кластеру
- Проверьте, что endpoint control plane из Talos machine config доступен из Azure.
- Убедитесь, что правила NSG разрешают исходящий трафик на порт 6443.
- Убедитесь, что правила NSG разрешают входящий трафик на порт 50000 (Talos API) для диагностики.
- Проверьте состояние provisioning у инстанса VMSS: `az vmss list-instances --resource-group <resource-group> --name workers`.

### Не-лидерные узлы недоступны (`kubectl logs`/`exec` завершается по timeout)

Если `kubectl logs` или `kubectl exec` работает для узла-лидера Kilo, но завершается по timeout для всех остальных узлов в той же подсети Azure:

1. **Проверьте, что IP forwarding** включен на VMSS:
   ```bash
   az vmss show --resource-group <resource-group> --name workers \
     --query "virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].enableIPForwarding"
   ```
   Если значение `false`, включите его и примените к существующим инстансам:
   ```bash
   az vmss update --resource-group <resource-group> --name workers \
     --set virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].enableIPForwarding=true
   az vmss update-instances --resource-group <resource-group> --name workers --instance-ids "*"
   ```

2. **Проверьте обратный маршрут** с узла-лидера:
   ```bash
   # Это должно работать (та же подсеть, прямое подключение)
   kubectl exec -n cozy-kilo <leader-kilo-pod> -- ping -c 2 <non-leader-ip>
   ```

### Ошибки квоты VM
- Проверьте квоту: `az vm list-usage --location <location>`.
- Запросите увеличение квоты через Azure Portal.
- Попробуйте другое семейство VM, в котором есть доступная квота.

### Ошибки SkuNotAvailable
- Некоторые размеры VM могут быть недоступны в отдельных регионах из-за ограничений емкости.
- Попробуйте другой размер VM: `az vm list-skus --location <location> --size <prefix>`.
