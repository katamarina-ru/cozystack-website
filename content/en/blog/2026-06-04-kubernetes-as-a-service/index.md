---
title: "От нуля до kubectl за 5 минут — управляемый Kubernetes на вашем железе"
slug: from-zero-to-kubectl-managed-kubernetes-on-your-own-metal
date: 2026-06-04
author: "Timur Tukaev"
description: "Разверните production-кластер Kubernetes на собственном оборудовании за считанные минуты. Cozystack использует Kamaji, Cluster API и KubeVirt, чтобы предоставить полностью управляемый Kubernetes с автомасштабированием, Cilium CNI и встроенными аддонами — без счетов за облако."
images:
  - "001.png"
article_types:
  - how-to
topics:
  - kubernetes
  - platform
---

С этим сталкивалась каждая платформенная команда: новому проекту нужен кластер Kubernetes. У облачных провайдеров это означает новый биллинговый аккаунт, выбор региона, решения по сети и базовую стоимость $70–300 в месяц ещё до того, как запустится первый под. Self-hosting с kubeadm? Дни на настройку, сертификаты, управление etcd и тревога перед обновлениями. Rancher помогает, но жизненным циклом вы всё равно управляете сами.

Что, если создать production-кластер Kubernetes было бы так же просто, как заполнить форму?

## Разверните управляемый кластер Kubernetes

Cozystack использует [Kamaji](https://kamaji.clastix.io/) для control plane (работают как поды — никаких выделенных ВМ под мастера), [Cluster API](https://cluster-api.sigs.k8s.io/) для управления жизненным циклом и [KubeVirt](https://kubevirt.io/) для ВМ рабочих узлов. Вы выбираете версию, тип инстанса и количество узлов.

### Через панель управления

1. Откройте панель управления Cozystack по адресу `https://dashboard.<your-domain>`.
2. Перейдите в **Marketplace** и найдите **Kubernetes**.

{{< figure src="001.png" alt="Marketplace панели управления Cozystack с плиткой приложения Kubernetes" width="720" >}}

3. Нажмите **Deploy** и настройте:
   - **Name:** напр., `dev-cluster`
   - **Version:** выберите от v1.30 до v1.35
   - **Node group:** задайте `minReplicas: 2`, `maxReplicas: 5`
   - **Instance type:** напр., `u1.large` (2 vCPU, 8 Gi RAM)
   - **Addons:** отметьте `ingress`, `cert-manager`, `monitoring`

{{< figure src="002.png" alt="Форма развёртывания Kubernetes с настроенными версией, группой узлов и аддонами" width="720" >}}

4. Нажмите **Deploy**.

Рабочие узлы загружаются как ВМ, присоединяются к кластеру и переходят в состояние Ready — обычно в течение 3–5 минут.

{{< figure src="003.png" alt="Рабочие узлы кластера Kubernetes сообщают о статусе Ready после развёртывания" width="720" >}}

> **Что входит в комплект:** Каждый кластер уже предварительно настроен с [Cilium CNI](https://cilium.io/) (сеть на базе eBPF), драйвером KubeVirt CSI (для постоянных томов) и Cluster Autoscaler (автоматическое масштабирование узлов по нагрузке).

### Через kubectl

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: kubernetes-dev
  namespace: tenant-team1
spec:
  chart:
    spec:
      chart: kubernetes
      reconcileStrategy: Revision
      sourceRef:
        kind: HelmRepository
        name: cozystack-apps
        namespace: cozy-public
  interval: 0s
  values:
    host: dev.team1.example.org
    version: v1.33
    nodeGroups:
      md0:
        minReplicas: 2
        maxReplicas: 5
        instanceType: u1.large
        ephemeralStorage: 20Gi
    controlPlane:
      replicas: 2
    addons:
      ingressNginx:
        enabled: true
      certManager:
        enabled: true
      monitoringAgents:
        enabled: true
```

```bash
kubectl apply -f kubernetes-dev.yaml
```

### Получите свой kubeconfig

В панели управления откройте приложение кластера → вкладка **Secrets** → скачайте `admin.conf`.

{{< figure src="004.png" alt="Вкладка Secrets приложения кластера с доступным для скачивания kubeconfig admin.conf" width="720" >}}

Или через CLI:

```bash
kubectl get secret -n tenant-team1 kubernetes-dev-admin-kubeconfig \
  -o jsonpath='{.data.admin\.conf}' | base64 -d > kubeconfig-dev.yaml

export KUBECONFIG=kubeconfig-dev.yaml
kubectl get nodes
```

```
NAME                              STATUS   ROLES           AGE   VERSION
kubernetes-dev-md0-vn8dh-jjbm9   Ready    ingress-nginx   4m    v1.33.2
kubernetes-dev-md0-vn8dh-xhsvl   Ready    ingress-nginx   3m    v1.33.2
```

Разворачивайте свои приложения стандартными `kubectl` или `helm` — никаких специфичных для вендора инструментов не требуется.

## Узнать больше

- [Документация по управляемому Kubernetes](https://cozystack.io/docs/v1/kubernetes/)
- [Руководство по развёртыванию приложений](https://cozystack.io/docs/v1/getting-started/deploy-app/)
- [Создание арендатора](https://cozystack.io/docs/v1/getting-started/create-tenant/)

## Присоединяйтесь к сообществу

- [GitHub](https://github.com/cozystack/cozystack)
- Telegram [группа](https://t.me/cozystack)
- Slack [группа](https://kubernetes.slack.com/archives/C06L3CPRVN1) (получите приглашение на [https://slack.kubernetes.io](https://slack.kubernetes.io))
- [Календарь встреч сообщества](https://calendar.google.com/calendar?cid=ZTQzZDIxZTVjOWI0NWE5NWYyOGM1ZDY0OWMyY2IxZTFmNDMzZTJlNjUzYjU2ZGJiZGE3NGNhMzA2ZjBkMGY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)
