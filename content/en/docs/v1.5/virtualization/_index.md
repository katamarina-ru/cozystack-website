---
title: "Возможности виртуализации в Cozystack"
linkTitle: "Виртуализация"
description: "Всё о развёртывании, настройке и использовании виртуальных машин в Cozystack."
weight: 50
aliases:
  - /docs/v1.5/operations/virtualization
  - /docs/v1.5/operations/virtualization/virtual-machines
---

В этом руководстве объясняется, как работает виртуализация в Cozystack.

## Пакеты виртуализации

Каталог Cozystack включает два пакета, связанных с виртуализацией:

- `vm-disk` - диск виртуальной машины
- `vm-instance` - экземпляр виртуальной машины

### Диск виртуальной машины

Прежде чем создать экземпляр виртуальной машины, необходимо создать диск, с которого будет загружаться ВМ.

Этот пакет определяет диск виртуальной машины, используемый для хранения данных.
Вы можете использовать подготовленный образ (также известный как golden image), загрузить образ на диск по HTTP или загрузить его из локального образа.
Также можно создать пустой образ.

1. **Golden Image**:

   ```yaml
   ## @param source The source image location used to create a disk
   source:
     image:
       name: ubuntu
   ```
    

1. **HTTP:**

   ```yaml
   source:
     http:
       url: "https://download.cirros-cloud.net/0.6.2/cirros-0.6.2-x86_64-disk.img"
   ```

3. **Upload:**

   ```yaml
   source:
     upload: {}
   ```
   После создания диска будет сгенерирована команда для загрузки с помощью инструмента virtctl.

   {{< note >}}
   Если вы хотите, чтобы virtctl знал о правильной конечной точке для загрузки образов, необходимо настроить кластер, указав для него конечную точку:

   1. Пропатчите Platform Package, чтобы открыть доступ к `cdi-uploadproxy` вместе с панелью управления:

      ```bash
      kubectl patch packages.cozystack.io cozystack.cozystack-platform --type=json \
        -p '[{"op": "add", "path": "/spec/components/platform/values/publishing/exposedServices/-", "value": "cdi-uploadproxy"}]'
      ```

   <!-- TODO: automate this -->
   2. Укажите действительную конечную точку CDI uploadproxy, пропатчив Package `kubevirt-cdi`:

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

   {{< /note >}}

4. **Empty:**

   ```yaml
   source: {}
   ```


При желании можно указать, что диск является оптическим CD-ROM:

```yaml
optical: true
```

Созданные диски можно подключать к экземпляру виртуальной машины.

См. справочник по приложению: [`vm-disk`]({{% ref "/docs/v1.5/virtualization/vm-disk" %}}).

### Экземпляр виртуальной машины

Этот пакет определяет экземпляр виртуальной машины, для которого требуется указать ранее созданный vm-disk.
Первый диск всегда является загрузочным, и ВМ будет пытаться загрузиться с него.

```yaml
disks:
- name: example-system
- name: example-data
```

Остальные параметры аналогичны Virtual Machine (simple).

См. справочник по приложению: [`vm-instance`]({{% ref "/docs/v1.5/virtualization/vm-instance" %}}).

## Доступ к виртуальным машинам

Получить доступ к виртуальной машине можно с помощью инструмента virtctl:
- [KubeVirt User Guide - Virtctl Client Tool](https://kubevirt.io/user-guide/user_workloads/virtctl_client_tool/)

Для доступа к последовательной консоли:

```
virtctl console <vm>
```

Для доступа к ВМ через VNC:

```
virtctl vnc <vm>
```

Для подключения к ВМ по SSH:

```
virtctl ssh <user>@<vm>
```
