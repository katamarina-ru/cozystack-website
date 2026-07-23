---
title: "Миграция виртуальных машин из Proxmox"
linkTitle: "Миграция из Proxmox"
description: "Пошаговое руководство по миграции виртуальных машин из Proxmox VE в Cozystack"
weight: 65
---

В этом руководстве описывается процесс миграции виртуальных машин из Proxmox VE в Cozystack путём экспорта образов дисков ВМ и их загрузки в целевую среду.

{{< note >}}
Миграция выполняется путём экспорта дисков ВМ в файлы и их загрузки в Cozystack.
Состояние ВМ и снимки (snapshot) при миграции не сохраняются.
{{< /note >}}

## Предварительные требования

Перед началом миграции убедитесь, что у вас есть:

1. **Клиент KubeVirt `virtctl`**, установленный на вашей локальной машине:
   - Руководство по установке: [KubeVirt User Guide - Virtctl Client Tool](https://kubevirt.io/user-guide/user_workloads/virtctl_client_tool/)

2. **Настроенный доступ к прокси загрузки** в вашем кластере Cozystack:
   - Примените патч к Platform Package, чтобы открыть `cdi-uploadproxy`:

     ```bash
     kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
       -p '[{"op": "add", "path": "/spec/components/platform/values/publishing/exposedServices/-", "value": "cdi-uploadproxy"}]'
     ```

   - Настройте конечную точку прокси загрузки CDI, применив патч к Package `kubevirt-cdi`:

     ```bash
     kubectl patch packages.cozystack.io cozystack.kubevirt-cdi --type=merge -p '{
       "spec": {
         "components": {
           "kubevirt-cdi": {
             "values": {
               "uploadProxyURL": "https://cdi-uploadproxy.example.org"
             }
           }
         }
       }
     }'
     ```

3. **Настройка DNS или файла hosts** для доступа к прокси загрузки:
   - При необходимости добавьте запись в `/etc/hosts` на вашей локальной машине:
     ```
     <UPLOAD_PROXY_IP> cdi-uploadproxy.example.org
     ```

## Шаг 1: Экспорт дисков ВМ из Proxmox

Перед экспортом убедитесь, что виртуальные машины остановлены в Proxmox.

Экспортируйте диск ВМ в файл в формате qcow2 (или другом формате, поддерживаемом KubeVirt):

```bash
# Пример: Экспорт диска ВМ из хранилища Proxmox
qm disk export <vmid> <disk> /tmp/vm-disk.qcow2
```

Результатом должен стать файл образа диска (например, `vm-disk.qcow2`), готовый к загрузке.

{{< note >}}
Конкретные команды для экспорта дисков могут различаться в зависимости от бэкенда хранилища Proxmox и его конфигурации.
Подробнее см. в [документации Proxmox VE](https://pve.proxmox.com/wiki/Qm_status).
{{< /note >}}

## Шаг 2: Создание VMDisk для загрузки

Создайте ресурс `VMDisk` в Cozystack с `source.upload`, чтобы подготовиться к загрузке образа:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMDisk
metadata:
  name: proxmox-vm-disk
  namespace: tenant-root
spec:
  source:
    upload: {}
  storage: 10Gi
  storageClass: replicated
```

Примените манифест:

```bash
kubectl apply -f vmdisk-upload.yaml
```

Отслеживайте статус создания диска:

```bash
kubectl get vmdisk -n tenant-root
kubectl describe vmdisk proxmox-vm-disk -n tenant-root
```

## Шаг 3: Загрузка образа диска

Как только VMDisk создан и готов к загрузке, используйте `virtctl` для загрузки образа диска:

```bash
virtctl image-upload dv vm-disk-proxmox-vm-disk \
  -n tenant-root \
  --image-path=./vm-disk.qcow2 \
  --uploadproxy-url https://cdi-uploadproxy.example.org \
  --insecure
```

{{< note >}}
Имя DataVolume следует шаблону `vm-disk-<vmdisk-name>`.
Если ваш VMDisk называется `proxmox-vm-disk`, то DataVolume будет `vm-disk-proxmox-vm-disk`.
{{< /note >}}

Дождитесь завершения загрузки. Вы можете отслеживать прогресс:

```bash
kubectl get dv -n tenant-root
kubectl describe dv vm-disk-proxmox-vm-disk -n tenant-root
```

Загрузка завершена, когда статус показывает `Succeeded`.

## Шаг 4: Создание VMInstance

После завершения загрузки диска создайте VMInstance для загрузки с загруженного диска:

```yaml
apiVersion: apps.cozystack.io/v1alpha1
kind: VMInstance
metadata:
  name: migrated-vm
  namespace: tenant-root
spec:
  running: true
  instanceType: u1.medium
  disks:
    - name: proxmox-vm-disk
  # Optional: configure network, cloud-init, etc.
```

Примените манифест:

```bash
kubectl apply -f vminstance.yaml
```

Убедитесь, что ВМ запущена:

```bash
kubectl get vm -n tenant-root
kubectl get vmi -n tenant-root
```

## Шаг 5: Доступ к мигрированной ВМ

Получите доступ к консоли ВМ с помощью virtctl:

```bash
# Serial console
virtctl console vm-instance-migrated-vm -n tenant-root

# VNC access
virtctl vnc vm-instance-migrated-vm -n tenant-root

# SSH (if configured)
virtctl ssh user@vm-instance-migrated-vm -n tenant-root
```

## Контрольный список миграции

Используйте этот контрольный список для отслеживания прогресса миграции:

- [ ] Экспортировать диски ВМ из Proxmox (в формате qcow2 или совместимом)
- [ ] Установить `virtctl` на вашей локальной машине
- [ ] Настроить доступ к прокси загрузки в Cozystack
- [ ] Добавить запись DNS/hosts для прокси загрузки (при необходимости)
- [ ] Создать VMDisk с `source.upload` в Cozystack
- [ ] Загрузить образ диска с помощью `virtctl image-upload`
- [ ] Дождаться завершения загрузки (статус: Succeeded)
- [ ] Создать VMInstance с загруженным диском
- [ ] Убедиться, что ВМ успешно загружается
- [ ] Проверить сетевую связность и работоспособность ВМ

## Устранение неполадок

### Загрузка завершается с ошибкой подключения

**Проблема:** `virtctl image-upload` завершается с ошибкой connection refused или тайм-аутом.

**Решение:**
- Убедитесь, что прокси загрузки доступен: `curl -k https://cdi-uploadproxy.example.org`
- Проверьте, что запись в `/etc/hosts` соответствует IP-адресу прокси загрузки
- Убедитесь, что Platform Package включает `cdi-uploadproxy` в `publishing.exposedServices`

### Загрузка застряла на 0%

**Проблема:** Загрузка начинается, но не продвигается.

**Решение:**
- Проверьте статус DataVolume: `kubectl describe dv vm-disk-<name> -n tenant-root`
- Убедитесь, что у класса хранилища есть доступная ёмкость
- Проверьте логи пода CDI: `kubectl logs -n cozy-system -l app=cdi-uploadproxy`

### ВМ не загружается после миграции

**Проблема:** ВМ загружается, но не запускается корректно.

**Решение:**
- Проверьте, что диск ВМ подключён как первый диск в spec VMInstance
- Убедитесь, что формат диска совместим (qcow2, raw)
- Просмотрите логи ВМ: `virtctl console vm-instance-<name> -n tenant-root`
- Убедитесь, что драйверы ВМ совместимы с KubeVirt (рекомендуется VirtIO)

## Дальнейшие шаги

После успешной миграции:

- Настройте [cloud-init]({{% ref "/docs/v1.6/virtualization/vm-instance" %}}) для автоматизированной настройки ВМ
- Изучите [типы инстансов и профили]({{% ref "/docs/v1.6/virtualization/resources" %}}) для оптимального распределения ресурсов
- Рассмотрите возможность создания [золотых образов]({{% ref "/docs/v1.6/virtualization/vm-image" %}}) для будущих развёртываний ВМ
