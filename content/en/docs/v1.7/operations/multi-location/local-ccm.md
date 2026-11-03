---
title: "Local Cloud Controller Manager"
linkTitle: "Локальный CCM"
description: "Определение IP узлов и lifecycle management для multi-location clusters."
weight: 15
---

Package `local-ccm` предоставляет легкий cloud controller manager для self-managed clusters.
Он отвечает за node IP detection и node lifecycle без необходимости во внешнем cloud provider.

## Что он делает

- **External IP detection**: определяет external IP каждого узла через `ip route get` (target по умолчанию: `8.8.8.8`)
- **Node initialization**: удаляет taint `node.cloudprovider.kubernetes.io/uninitialized`, чтобы pods могли планироваться
- **Node lifecycle controller** (опционально): мониторит NotReady nodes через ICMP ping и удаляет их после настраиваемого timeout

## Установка

```bash
cozypkg add cozystack.local-ccm
```

## Talos machine config

На всех узлах кластера, включая control plane, должен быть задан `cloud-provider: external`,
чтобы kubelet передавал node initialization в cloud controller manager:

```yaml
machine:
  kubelet:
    extraArgs:
      cloud-provider: external
```

{{% alert title="Важно" color="warning" %}}
Настройка `cloud-provider: external` должна присутствовать на **всех** узлах кластера,
включая control plane nodes. Без нее cluster-autoscaler не сможет сопоставить Kubernetes
nodes с экземплярами cloud provider, например Azure VMSS.
{{% /alert %}}
