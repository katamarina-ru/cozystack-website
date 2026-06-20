---
title: "Справочник компонентов Cozystack"
linkTitle: "Компоненты"
description: "Полный справочник по компонентам Cozystack."
weight: 30
aliases:
  - /docs/v1.3/install/cozystack/components
---

### Переопределение параметров компонентов

Иногда требуется изменить отдельные параметры компонентов.
Для этого измените соответствующий ресурс Package и задайте значения
в секции `spec.components`. Структура значений соответствует файлу
[values.yaml](https://github.com/cozystack/cozystack/tree/main/packages/system)
соответствующего системного chart'а в репозитории Cozystack.

Например, чтобы включить режим FRR-K8s для MetalLB, посмотрите его
[values.yaml](https://github.com/cozystack/cozystack/blob/main/packages/system/metallb/values.yaml),
чтобы понять доступные параметры, а затем измените Package `cozystack.metallb`:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.metallb
  namespace: cozy-system
spec:
  variant: default
  components:
    metallb:
      values:
        metallb:
          frrk8s:
            enabled: true
```

### Включение и отключение компонентов

В bundle есть необязательные компоненты, которые нужно явно включать в установку.
Обычные компоненты bundle, наоборот, можно отключить, если они не нужны.

Используйте `bundles.enabledPackages` и `bundles.disabledPackages` в значениях пакета платформы.
Каждая запись в этих списках — полное имя Package, такое же, как в выводе
`kubectl get package`. Все пакеты платформы используют префикс `cozystack.`, например
`cozystack.metallb`, `cozystack.hetzner-robotlb`, `cozystack.nfs-driver`. Перед изменением
пакета платформы выполните `kubectl get package`, чтобы увидеть точные имена, доступные в вашем кластере.

Например, при [установке Cozystack в Hetzner]({{% ref "/docs/v1.3/install/providers/hetzner" %}})
нужно заменить стандартный балансировщик нагрузки MetalLB на RobotLB, созданный специально для Hetzner:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
spec:
  variant: isp-full
  components:
    platform:
      values:
        bundles:
          disabledPackages:
            - cozystack.metallb
          enabledPackages:
            - cozystack.hetzner-robotlb
        # rest of the config
```

Компоненты нужно отключать до установки Cozystack.
Применение обновленной конфигурации с `disabledPackages` не удалит компоненты, которые уже установлены.
Чтобы удалить уже установленные компоненты, удалите Helm release вручную:

```bash
kubectl delete hr -n <namespace> <component>
```
