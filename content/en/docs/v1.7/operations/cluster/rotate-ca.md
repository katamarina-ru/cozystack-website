---
title: "Как ротировать Certificate Authority"
linkTitle: "Ротация CA"
description: "Как ротировать Certificate Authority"
weight: 110
---


Talos создает корневые центры сертификации со сроком действия 10 лет,
и все сертификаты Talos API и Kubernetes API выпускаются этими корневыми CA.
В обычной эксплуатации почти никогда не требуется ротировать корневой CA-сертификат и ключ для Talos API и Kubernetes API.

Ротация корневого CA нужна только в следующих случаях:

- есть подозрение, что private key был скомпрометирован;
- нужно отозвать доступ к кластеру для утекшего `talosconfig` или `kubeconfig`;
- прошло 10 лет.

### Ротация CA для Talos API

Чтобы ротировать Talos CA для management-кластера, используйте следующую команду.

Сначала запустите ее в dry-run-режиме, чтобы предварительно посмотреть изменения:

```bash
talm -f nodes/node.yaml rotate-ca --talos=true --kubernetes=false
```

Затем выполните реальную ротацию:

```bash
talm -f nodes/node.yaml rotate-ca --talos=true --kubernetes=false --dry-run=false
```

После завершения ротации скачайте новый `talosconfig` из secrets.

### Ротация CA для management-кластера Kubernetes

Чтобы ротировать Kubernetes CA для management-кластера, используйте следующую команду.

Сначала запустите ее в dry-run-режиме, чтобы предварительно посмотреть изменения:

```bash
talm -f nodes/node.yaml rotate-ca --talos=false --kubernetes=true
```

Затем выполните реальную ротацию:

```bash
talm -f nodes/node.yaml rotate-ca --talos=false --kubernetes=true --dry-run=false
```

### Ротация CA для tenant-кластера Kubernetes

См.: https://kamaji.clastix.io/guides/certs-lifecycle/

```bash
export NAME=k8s-cluster-name
export NAMESPACE=k8s-cluster-namespace

kubectl -n ${NAMESPACE} delete secret ${NAME}-ca
kubectl -n ${NAMESPACE} delete secret ${NAME}-sa-certificate

kubectl -n ${NAMESPACE} delete secret ${NAME}-api-server-certificate
kubectl -n ${NAMESPACE} delete secret ${NAME}-api-server-kubelet-client-certificate
kubectl -n ${NAMESPACE} delete secret ${NAME}-datastore-certificate
kubectl -n ${NAMESPACE} delete secret ${NAME}-front-proxy-client-certificate
kubectl -n ${NAMESPACE} delete secret ${NAME}-konnectivity-certificate

kubectl -n ${NAMESPACE} delete secret ${NAME}-admin-kubeconfig
kubectl -n ${NAMESPACE} delete secret ${NAME}-controller-manager-kubeconfig
kubectl -n ${NAMESPACE} delete secret ${NAME}-konnectivity-kubeconfig
kubectl -n ${NAMESPACE} delete secret ${NAME}-scheduler-kubeconfig

kubectl delete po -l app.kubernetes.io/name=kamaji -n cozy-kamaji
kubectl delete po -l app=${NAME}-kcsi-driver
```

Дождитесь перезапуска pod `virt-launcher-kubernetes-*`.
После этого скачайте новый сертификат Kubernetes.
