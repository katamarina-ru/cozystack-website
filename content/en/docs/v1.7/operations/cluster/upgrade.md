---
title: "Обновление Cozystack и проверки после обновления"
linkTitle: "Обновление Cozystack"
description: "Обновление системных компонентов Cozystack."
weight: 10
aliases:
  - /docs/v1.7/upgrade
  - /docs/v1.7/operations/upgrade
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

Before moving to a new minor version, read the upgrade notes of every minor version you cross, such as [Upgrading from v1.6 to v1.7]({{% ref "/docs/v1.7/operations/cluster/upgrade-to-v1.7" %}}). Some changes need an action before the upgrade starts.

### 1. Проверьте состояние кластера

Перед обновлением проверьте текущее состояние кластера Cozystack по шагам из раздела

- [Чек-лист диагностики]({{% ref "/docs/v1.7/operations/troubleshooting/#troubleshooting-checklist" %}})

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

### 3. Pre-pull the new images (optional)

By default Talos Linux keeps `/var/lib/etcd` and `/var/lib/containerd` as directories on the same `EPHEMERAL` volume, and its kubelet pulls images in parallel.
During the upgrade many platform components restart at once, so every node pulls and unpacks their new images at the same time.
If this delays the disk writes of the etcd leader long enough, etcd logs `slow fdatasync` and `failed to send out heartbeat on time`, the other members elect a new leader, and requests to the Kubernetes API stall during each election.
Pulling the new images before the upgrade, one node at a time, keeps this load out of the rollout.

Build the list of new images from the Cozystack images the cluster runs now.
Set `FROM` to the installed version and `TO` to the target version.

```bash
FROM=v1.6.4
TO=v1.6.5
kubectl get pods --all-namespaces --output json \
  | jq --raw-output '.items[].spec | (.initContainers // [])[], .containers[] | .image' \
  | grep -E "^ghcr.io/cozystack/cozystack/[^:]+:${FROM}(@|$)" \
  | sed -E "s/:${FROM}(@sha256:[0-9a-f]+)?$/:${TO}/" \
  | sort -u > images.txt
```

The list covers the images that carry the Cozystack version in their tag.
Add other images that change in the release to `images.txt` by hand if you want them pulled too.

Find the etcd leader.
It is the node whose `MEMBER` matches the `LEADER` column.

```bash
talosctl --nodes <node1>,<node2>,<node3> etcd status
```

Then pull the images on each control plane node in turn, the leader last.
Nodes that do not run etcd can skip this step.

```bash
while read -r image; do
  talosctl --nodes <node> image pull --namespace cri "$image"
done < images.txt
```

Before you move to the next node, run `etcd status` again and check that the leader and the `RAFT TERM` are the same, and that the etcd log of the node has no new `slow fdatasync` warnings.

```bash
talosctl --nodes <node> logs etcd | grep 'slow fdatasync'
```

A pull on the leader node can still delay its heartbeats.
To avoid that, move the leadership to a node that already has the images before you pull on the leader.

```bash
talosctl --nodes <leader-node> etcd forfeit-leadership
```

Start the upgrade soon after the pull.
The pre-pulled images stay unused until the rollout, and the kubelet removes unused images once the disk usage goes above its garbage collection threshold, 85% by default.

### 4. Upgrade the Cozystack Operator

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

### 5. Check the cluster status after upgrading

```bash
kubectl get pods -n cozy-system
kubectl get hr -A | grep -v "True"
```

Если статус pod указывает на сбой, проверьте логи:

```bash
kubectl logs -n cozy-system deploy/cozystack-operator --previous
```

Чтобы убедиться, что все работает как ожидается, повторите шаги из раздела

- [Чек-лист диагностики]({{% ref "/docs/v1.7/operations/troubleshooting/#troubleshooting-checklist" %}})
