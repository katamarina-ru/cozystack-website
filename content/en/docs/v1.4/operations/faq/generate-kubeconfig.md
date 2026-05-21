---
title: "Как сгенерировать kubeconfig для пользователей tenant"
linkTitle: "Генерация kubeconfig тенанта"
description: "Руководство по генерации kubeconfig-файла для пользователей tenant в Cozystack."
weight: 30
aliases:
  - /docs/v1.4/operations/faq/generate-kubeconfig
---

Чтобы сгенерировать `kubeconfig` для пользователей tenant, используйте следующий скрипт.
В результате вы получите файл tenant-kubeconfig, который можно передать пользователю.


```bash
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
kubectl get secret tenant-root -n tenant-root -o go-template='
apiVersion: v1
kind: Config
clusters:
- name: tenant-root
  cluster:
    server: '"$SERVER"'
    certificate-authority-data: {{ index .data "ca.crt" }}
contexts:
- name: tenant-root
  context:
    cluster: tenant-root
    namespace: {{ index .data "namespace" | base64decode }}
    user: tenant-root
current-context: tenant-root
users:
- name: tenant-root
  user:
    token: {{ index .data "token" | base64decode }}
' \
> tenant-root.kubeconfig
```
