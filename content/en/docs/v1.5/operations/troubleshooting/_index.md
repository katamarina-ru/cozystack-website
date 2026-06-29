---
title: "Руководство по устранению неполадок Cozystack"
linkTitle: "Устранение неполадок"
description: "Начальные шаги для проверки состояния кластера и поиска проблем."
weight: 110
aliases:
  - /docs/v1.5/troubleshooting
---

В этом руководстве приведены начальные шаги для проверки состояния кластера и поиска проблем.
Внизу страницы находятся ссылки на руководства по устранению неполадок для разных компонентов Cozystack и аспектов эксплуатации кластера.

## Чеклист диагностики

Используйте следующие команды, чтобы проверить состояние кластера.

```bash
# === Flux CD ===
# не должно быть сломанных HelmRelease
kubectl get hr -A | grep -v True

# === Kubernetes ===
# не должно быть узлов не в состоянии Ready
kubectl get node

# === LINSTOR ===
alias linstor='kubectl exec -n cozy-linstor deploy/linstor-controller -ti -- linstor'

# узлы LINSTOR находятся online
linstor node list

# storage-pool LINSTOR находятся в состоянии Ok
linstor storage-pool list

# нет сломанных ресурсов
linstor resource list --faulty

# === Kube-OVN ===
alias ovn-appctl='kubectl -n cozy-kubeovn exec deploy/ovn-central -c ovn-central -- ovn-appctl' 

# Проверить Northbound database
ovn-appctl -t /var/run/ovn/ovnnb_db.ctl cluster/status OVN_Northbound

# Проверить Southbound database
ovn-appctl -t /var/run/ovn/ovnsb_db.ctl cluster/status OVN_Southbound

# убедитесь, что:
# 1. Количество Servers совпадает с количеством control-plane узлов
# 2. IP-адреса корректны
# 3. Нет дубликатов (например, двух servers с одним IP)

# вывести список control-plane узлов
kubectl get node -o wide -l node-role.kubernetes.io/control-plane=

# Проверить, что вы не упираетесь в namespace quotas и есть ресурсы для обновления
kubectl get resourcequota --all-namespaces
```

Дополнительно можно проверить, есть ли в кластере pod не в состоянии Running:
```bash
kubectl get pod -A | grep -v 'Running\|Completed'
```

## Получение базовой информации

Логи оператора Cozystack можно посмотреть командой:

```bash
kubectl logs -n cozy-system deploy/cozystack-operator -f
```

Все компоненты платформы устанавливаются через Flux CD HelmRelease.

Получить все установленные HelmRelease можно так:

```console
# kubectl get hr -A
NAMESPACE                        NAME                        AGE    READY   STATUS
cozy-cert-manager                cert-manager                4m1s   True    Release reconciliation succeeded
cozy-cert-manager                cert-manager-issuers        4m1s   True    Release reconciliation succeeded
cozy-cilium                      cilium                      4m1s   True    Release reconciliation succeeded
cozy-cluster-api                 capi-operator               4m1s   True    Release reconciliation succeeded
cozy-cluster-api                 capi-providers              4m1s   True    Release reconciliation succeeded
cozy-dashboard                   dashboard                   4m1s   True    Release reconciliation succeeded
cozy-fluxcd                      cozy-fluxcd                 4m1s   True    Release reconciliation succeeded
cozy-grafana-operator            grafana-operator            4m1s   True    Release reconciliation succeeded
cozy-kamaji                      kamaji                      4m1s   True    Release reconciliation succeeded
cozy-kubeovn                     kubeovn                     4m1s   True    Release reconciliation succeeded
cozy-kubevirt-cdi                kubevirt-cdi                4m1s   True    Release reconciliation succeeded
cozy-kubevirt-cdi                kubevirt-cdi-operator       4m1s   True    Release reconciliation succeeded
cozy-kubevirt                    kubevirt                    4m1s   True    Release reconciliation succeeded
cozy-kubevirt                    kubevirt-operator           4m1s   True    Release reconciliation succeeded
cozy-linstor                     linstor                     4m1s   True    Release reconciliation succeeded
cozy-linstor                     piraeus-operator            4m1s   True    Release reconciliation succeeded
cozy-mariadb-operator            mariadb-operator            4m1s   True    Release reconciliation succeeded
cozy-metallb                     metallb                     4m1s   True    Release reconciliation succeeded
cozy-monitoring                  monitoring                  4m1s   True    Release reconciliation succeeded
cozy-postgres-operator           postgres-operator           4m1s   True    Release reconciliation succeeded
cozy-rabbitmq-operator           rabbitmq-operator           4m1s   True    Release reconciliation succeeded
cozy-redis-operator              redis-operator              4m1s   True    Release reconciliation succeeded
cozy-telepresence                telepresence                4m1s   True    Release reconciliation succeeded
cozy-victoria-metrics-operator   victoria-metrics-operator   4m1s   True    Release reconciliation succeeded
tenant-root                      tenant-root                 4m1s   True    Release reconciliation succeeded
```

В нормальном состоянии все они должны быть `Ready` и иметь статус `Release reconciliation succeeded`.

## Packages застряли в DependenciesNotReady

Если некоторые packages показывают статус `DependenciesNotReady`:

```console
$ kubectl get pkg -A | grep -v True
NAME                                        VARIANT          READY   STATUS
cozystack.cozystack-basics                  default          False   One or more dependencies are not ready
cozystack.tenant-application                default          False   One or more dependencies are not ready
cozystack.monitoring-application            default          False   One or more dependencies are not ready
```

Обычно это означает, что package в цепочке зависимостей отсутствует или отключен. Для диагностики:

1. **Найдите первопричину**: проверьте логи оператора на сообщения `"dependency not found"`:

   ```bash
   kubectl logs -n cozy-system deploy/cozystack-operator | grep "dependency not found"
   ```

   Команда покажет, какой зависимости не хватает, например:

   ```
   dependency not found, marking as not ready  package=cozystack.monitoring-application  dependency=cozystack.postgres-operator
   ```

2. **Проверьте, не отключили ли вы обязательный package**: некоторые packages зависят от других packages. Если отключить package, например `cozystack.postgres-operator`, от которого зависят другие packages, будет заблокирована вся цепочка зависимостей.

3. **Исправьте проблему**: либо снова включите отключенный package, либо, если вы намеренно хотите оставить его отключенным, добавьте его в `ignoreDependencies` у затронутого package:

   ```bash
   kubectl edit pkg cozystack.monitoring-application
   ```

   ```yaml
   spec:
     ignoreDependencies:
       - cozystack.postgres-operator
   ```

## Специализированные руководства

### Bootstrap кластера

См. [устранение неполадок установки Kubernetes]({{% ref "/docs/v1.5/install/kubernetes/troubleshooting" %}}).

### Обслуживание кластера

#### Удаление отказавшего узла из кластера

См. [Обслуживание кластера > Масштабирование кластера]({{% ref "/docs/v1.5/operations/cluster/scaling" %}}).

### Flux CD

[Устранение неполадок Flux CD]({{% ref "/docs/v1.5/operations/troubleshooting/flux-cd" %}}).

### Kube-OVN

[Устранение неполадок Kube-OVN]({{% ref "/docs/v1.5/operations/troubleshooting/kube-ovn" %}}).
