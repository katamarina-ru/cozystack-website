---
title: "Масштабирование кластера: добавление и удаление узлов"
linkTitle: "Масштабирование кластера"
description: "Добавление и удаление узлов в кластере Cozystack."
weight: 20
---

## Как добавить узел в кластер Cozystack

Узел добавляется почти так же, как при обычной установке Cozystack.

1.  [Установите Talos на узел]({{% ref "/docs/v1.5/install/talos" %}}), используя кастомный образ Talos для Cozystack.

1.  Сгенерируйте конфигурацию для нового узла по руководству [Talm]({{% ref "/docs/v1.5/install/kubernetes/talm#3-generate-node-configuration-files" %}})
    или [talosctl]({{% ref "/docs/v1.5/install/kubernetes/talosctl#2-generate-node-configuration-files" %}}).
    
    Например, конфигурация узла control plane:

    ```bash
    talm template -e 192.168.123.20 -n 192.168.123.20 -t templates/controlplane.yaml -i > nodes/nodeN.yaml
    ```
    
    а для worker-узла:
    ```bash
    talm template -e 192.168.123.20 -n 192.168.123.20 -t templates/worker.yaml -i > nodes/nodeN.yaml
    ```

1.  Примените сгенерированную конфигурацию к узлу по руководству [Talm]({{% ref "/docs/v1.5/install/kubernetes/talm#41-apply-configuration-files" %}})
    или [talosctl]({{% ref "/docs/v1.5/install/kubernetes/talosctl#3-apply-node-configuration" %}}).
    Например:

    ```bash
    talm apply -f nodes/nodeN.yaml -i
    ```

1.  Дождитесь, пока узел перезагрузится и самостоятельно подключится к кластеру.
    Запускать bootstrap вручную или устанавливать на него Cozystack не нужно: все будет выполнено автоматически.

    Результат можно проверить командой `kubectl get nodes`.


## Как удалить узел из кластера Cozystack

Когда узел кластера выходит из строя, Cozystack автоматически поддерживает отказоустойчивость, пересоздавая реплицированные PVC и workloads на других узлах.
Однако иногда для устранения проблем узел нужно удалить:

-   PV локального хранилища могут остаться привязанными к отказавшему узлу, что вызывает проблемы с новыми pod.
    Такие ресурсы нужно очистить вручную.

-   Отказавший узел будет по-прежнему существовать в кластере, что может привести к несогласованности состояния кластера и повлиять на планирование pod.


### Шаг 1: удалите узел из кластера

Выполните следующую команду, чтобы удалить отказавший узел. Замените `mynode` на фактическое имя узла:

```bash
kubectl delete node mynode
```

Если отказавший узел был узлом control plane, также удалите его etcd member из кластера etcd:

```bash
talm -f nodes/node1.yaml etcd member list
```

Пример вывода:

```console
NODE         ID                  HOSTNAME   PEER URLS                    CLIENT URLS                  LEARNER
37.27.60.28  2ba6e48b8cf1a0c1    node1      https://192.168.100.11:2380  https://192.168.100.11:2379  false
37.27.60.28  b82e2194fb76ee42    node2      https://192.168.100.12:2380  https://192.168.100.12:2379  false
37.27.60.28  f24f4de3d01e5e88    node3      https://192.168.100.13:2380  https://192.168.100.13:2379  false
```

Затем удалите соответствующий member. Замените ID на ID отказавшего узла:

```bash
talm -f nodes/node1.yaml etcd remove-member f24f4de3d01e5e88
```

### Шаг 2: удалите PVC и pod, привязанные к отказавшему узлу

Ниже несколько команд, которые помогут очистить отказавший узел:

-   **Удалите PVC**, привязанные к отказавшему узлу:<br>
    (Замените `mynode` на имя отказавшего узла)
    
    ```bash
    kubectl get pv -o json | jq -r '.items[] | select(.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0] == "mynode").spec.claimRef | "kubectl delete pvc -n \(.namespace) \(.name)"' | sh -x
    ```
    
-   **Удалите pod**, зависшие в состоянии `Pending` во всех namespaces:
    
    ```bash
    kubectl get pod -A | awk '/Pending/ {print "kubectl delete pod -n " $1 " " $2}' | sh -x
    ```

### Шаг 3: проверьте состояние ресурсов

После очистки проверьте проблемы с ресурсами с помощью `linstor advise`:

```console
# linstor advise resource
╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
┊ Resource                                 ┊ Issue                                             ┊ Possible fix                                                           ┊
╞═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╡
┊ pvc-02b0c0a1-e0b6-4e98-9384-60ff24f3b3b6 ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-02b0c0a1-e0b6-4e98-9384-60ff24f3b3b6 ┊
┊ pvc-06e3b406-23f0-4f10-8b03-84063c1b2a12 ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-06e3b406-23f0-4f10-8b03-84063c1b2a12 ┊
┊ pvc-a0b8aeaf-076e-4bd9-93ed-c4db09c04d0b ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-a0b8aeaf-076e-4bd9-93ed-c4db09c04d0b ┊
┊ pvc-a523ebeb-c3b6-468d-abe5-f6afbbf31081 ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-a523ebeb-c3b6-468d-abe5-f6afbbf31081 ┊
┊ pvc-cf7e87b5-3e6d-4034-903d-4625830fb5b4 ┊ Resource expected to have 1 replicas, got only 0. ┊ linstor rd ap --place-count 1 pvc-cf7e87b5-3e6d-4034-903d-4625830fb5b4 ┊
┊ pvc-d344bc83-97fd-4489-bbe7-5399eea57165 ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-d344bc83-97fd-4489-bbe7-5399eea57165 ┊
┊ pvc-d39345a9-5446-4c64-a5ba-957ff7c7a31f ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-d39345a9-5446-4c64-a5ba-957ff7c7a31f ┊
┊ pvc-db6d4236-93bd-4268-9dcc-0ed275b17067 ┊ Resource expected to have 1 replicas, got only 0. ┊ linstor rd ap --place-count 1 pvc-db6d4236-93bd-4268-9dcc-0ed275b17067 ┊
┊ pvc-ebb412c3-083c-4eee-93dc-70917ea6d87e ┊ Resource expected to have 1 replicas, got only 0. ┊ linstor rd ap --place-count 1 pvc-ebb412c3-083c-4eee-93dc-70917ea6d87e ┊
┊ pvc-f107aacb-78d7-4ac6-97f8-8ed529a9c292 ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-f107aacb-78d7-4ac6-97f8-8ed529a9c292 ┊
┊ pvc-f347d71a-b646-45e5-a717-f0a745061beb ┊ Resource expected to have 1 replicas, got only 0. ┊ linstor rd ap --place-count 1 pvc-f347d71a-b646-45e5-a717-f0a745061beb ┊
┊ pvc-f6e96c83-6144-4510-b0ab-61936db52391 ┊ Resource expected to have 3 replicas, got only 2. ┊ linstor rd ap --place-count 3 pvc-f6e96c83-6144-4510-b0ab-61936db52391 ┊
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Run the `linstor rd ap` commands suggested in the "Possible fix" column to restore the desired replica count.
