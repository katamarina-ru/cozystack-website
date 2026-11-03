---
title: "Устранение неполадок etcd"
linkTitle: "etcd"
description: "Как устранять проблемы и ошибки etcd."
weight: 10
---


## Как очистить состояние etcd

Чтобы удалить state etcd с узла, используйте `talm` или `talosctl` со следующими командами:

{{< tabs name="etcd reset tools" >}}
{{% tab name="Talm" %}}

Замените `nodeN` именем отказавшего узла, например `node0.yaml`:

```bash
talm reset -f nodes/nodeN.yaml --system-labels-to-wipe=EPHEMERAL --graceful=false --reboot
```

{{% /tab %}}

{{% tab name="talosctl" %}}
```bash
talosctl reset --system-labels-to-wipe=EPHEMERAL --graceful=false --reboot
```

{{% /tab %}}
{{< /tabs >}}

{{% alert color="warning" %}}
:warning: Эта команда удалит state с указанного узла. Используйте ее с осторожностью.
{{% /alert %}}
