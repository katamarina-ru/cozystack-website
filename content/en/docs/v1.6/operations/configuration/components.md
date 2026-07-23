---
title: "Справочник компонентов Cozystack"
linkTitle: "Компоненты"
description: "Полный справочник по компонентам Cozystack."
weight: 30
aliases:
  - /docs/v1.6/install/cozystack/components
---

### Переопределение параметров компонентов

Иногда нужно переопределить отдельные параметры компонентов.
Для этого измените соответствующий ресурс Package и укажите значения в секции `spec.components`.
Структура values соответствует файлу [values.yaml](https://github.com/cozystack/cozystack/tree/main/packages/system)
соответствующего системного chart в репозитории Cozystack.

Например, если нужно включить режим FRR-K8s для MetalLB, посмотрите его
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

В bundles есть опциональные компоненты, которые нужно явно включать в установку.
Обычные компоненты bundle, наоборот, можно отключить и исключить из установки, если они не нужны.

Используйте `bundles.enabledPackages` и `bundles.disabledPackages` в values Platform Package.
Каждая запись в этих списках - это полное имя Package, такое же, как в выводе `kubectl get package`.
Все platform packages находятся под префиксом `cozystack.`, например `cozystack.metallb`, `cozystack.hetzner-robotlb`, `cozystack.nfs-driver`.
Перед редактированием Platform Package выполните `kubectl get package`, чтобы увидеть точные имена, доступные в вашем кластере.

Например, при [установке Cozystack в Hetzner]({{% ref "/docs/v1.6/install/providers/hetzner" %}})
нужно заменить load balancer по умолчанию, MetalLB, на RobotLB, специально сделанный для Hetzner:

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
        # остальная конфигурация
```

Компоненты нужно отключать до установки Cozystack.
Применение обновленной конфигурации с `disabledPackages` не удалит компоненты, которые уже установлены.
Чтобы удалить уже установленные компоненты, вручную удалите Helm release следующей командой:

```bash
kubectl delete hr -n <namespace> <component>
```
