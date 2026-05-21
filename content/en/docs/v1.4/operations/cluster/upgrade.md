---
title: "Обновление Cozystack и проверки после обновления"
linkTitle: "Обновление Cozystack"
description: "Обновление системных компонентов Cozystack."
weight: 10
aliases:
  - /docs/v1.4/upgrade
  - /docs/v1.4/operations/upgrade
---

## О версиях Cozystack

Cozystack использует поэтапный процесс выпуска релизов, чтобы сохранять стабильность и гибкость во время разработки.

Существует три типа релизов:

-   **Alpha, Beta и Release Candidate (RC)** - предварительные версии, например `v0.42.0-alpha.1` или `v0.42.0-rc.1`, которые используются для финального тестирования и проверки.
-   **Стабильные релизы** - обычные версии, например `v0.42.0`, с полным набором функций и тщательным тестированием.
    Такие версии обычно добавляют новые возможности, обновляют зависимости и могут содержать изменения API.
-   **Патч-релизы** - обновления только с исправлениями ошибок, например `v0.42.1`, которые выпускаются после стабильного релиза из отдельной release-ветки.

В production-средах настоятельно рекомендуется устанавливать только стабильные релизы и патч-релизы.

Полный список релизов доступен на странице [Releases](https://github.com/cozystack/cozystack/releases) в GitHub.

Подробнее о процессе выпуска Cozystack см. в документе [Cozystack Release Workflow](https://github.com/cozystack/cozystack/blob/main/docs/release.md).

## Обновление Cozystack

### 1. Проверьте состояние кластера

Перед обновлением проверьте текущее состояние кластера Cozystack по шагам из раздела

- [Чек-лист диагностики]({{% ref "/docs/v1.4/operations/troubleshooting/#troubleshooting-checklist" %}})

Убедитесь, что Platform Package находится в рабочем состоянии и содержит ожидаемую конфигурацию:

```bash
kubectl get packages.cozystack.io cozystack.cozystack-platform -o yaml
```

### 2. Защитите критически важные ресурсы

Перед обновлением добавьте аннотацию `helm.sh/resource-policy=keep` к namespace `cozy-system` и ConfigMap `cozystack-version`, чтобы Helm не удалил их во время обновления:

```bash
kubectl annotate namespace cozy-system helm.sh/resource-policy=keep --overwrite
kubectl annotate configmap -n cozy-system cozystack-version helm.sh/resource-policy=keep --overwrite
```

{{% alert color="warning" %}}
**Этот шаг обязателен.** Без этих аннотаций удаление или обновление Helm-релиза установщика может удалить namespace `cozy-system` и все ресурсы внутри него.
{{% /alert %}}

### 3. Обновите оператор Cozystack

Обновите Helm-релиз оператора Cozystack до целевой версии:

{{< reuse-values-warning >}}

```bash
helm upgrade cozystack oci://ghcr.io/cozystack/cozystack/cozy-installer \
  --version X.Y.Z \
  --namespace cozy-system
```

Логи оператора можно посмотреть так:

```bash
kubectl logs -n cozy-system deploy/cozystack-operator -f
```

### 4. Проверьте состояние кластера после обновления

```bash
kubectl get pods -n cozy-system
kubectl get hr -A | grep -v "True"
```

Если статус pod указывает на сбой, проверьте логи:

```bash
kubectl logs -n cozy-system deploy/cozystack-operator --previous
```

Чтобы убедиться, что все работает как ожидается, повторите шаги из раздела

- [Чек-лист диагностики]({{% ref "/docs/v1.4/operations/troubleshooting/#troubleshooting-checklist" %}})
