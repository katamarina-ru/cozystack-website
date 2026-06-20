---
title: "Устранение неполадок Flux CD"
linkTitle: "Flux CD"
description: "Как устранять ошибки Flux CD."
weight: 10
---

## Диагностика ошибки `install retries exhausted`

Иногда можно столкнуться с такой ошибкой:

```console
# kubectl get hr -A -n cozy-dashboard dashboard
NAMESPACE          NAME          AGE   READY   STATUS
cozy-dashboard     dashboard     15m   False   install retries exhausted
```

Попробуйте разобраться через events:

```bash
kubectl describe hr -n cozy-dashboard dashboard
```

Если указано `Events: <none>`, приостановите и возобновите release:

```bash
kubectl patch hr -n cozy-dashboard dashboard -p '{"spec": {"suspend": true}}' --type=merge
kubectl patch hr -n cozy-dashboard dashboard -p '{"spec": {"suspend": null}}' --type=merge
```

Затем снова проверьте events:

```bash
kubectl describe hr -n cozy-dashboard dashboard
```
