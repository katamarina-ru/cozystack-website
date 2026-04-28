---
title: "Выберите версию документации"
linkTitle: "Документация"
description: "Выберите версию документации Cozystack соответствующую вашему окружению"
layout: docs-landing
weight: 40
cascade:
  type: docs
menu:
  main:
    weight: 40
---

### Проверка используемой версии

Если у вас уже есть развернутая инсталляция, выполните:

```bash
kubectl get deployment -n cozy-system
```

- **v1.x:** Будет отображено развертывание с помощью `cozystack-operator`.
- **v0:** Будет отображено развертывание с помощью`cozystack` (legacy-инсталлятор).

**Дополнительные ресурсы:**
- [Заметки о выпусках](https://github.com/cozystack/cozystack/releases)
