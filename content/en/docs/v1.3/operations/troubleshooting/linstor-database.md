---
title: "Устранение LINSTOR CrashLoopBackOff из-за поврежденной базы данных"
linkTitle: "LINSTOR: поврежденная база данных"
description: "Как устранять LINSTOR CrashLoopBackOff, связанный с поврежденной базой данных."
weight: 110
---

{{% alert color="warning" %}}
:warning: **Только для опытных пользователей**

Это руководство предназначено для опытных пользователей, которым комфортны низкоуровневая диагностика и операции восстановления данных.
Повреждение баз данных LINSTOR встречается редко и обычно указывает на серьезную базовую проблему.

**Если вы столкнулись с такой ситуацией в production-окружении, настоятельно рекомендуем обратиться в квалифицированную поддержку,**
а не пытаться исправить проблему самостоятельно. Неверные действия могут привести к безвозвратной потере данных.
{{% /alert %}}

## Введение

При запуске вне Kubernetes LINSTOR controller использует SQL database того или иного типа.
В Kubernetes `linstor-controller` не требует persistent volume или внешней базы данных.
Вместо этого он хранит всю информацию как custom resources (CR) прямо в Kubernetes control plane.
При запуске LINSTOR controller читает все CR и создает базу данных в памяти.

Эти CR находятся в API group `internal.linstor.linbit.com`:

```bash
kubectl get crds | grep internal.linstor.linbit.com
```

Пример вывода:
```console
ebsremotes.internal.linstor.linbit.com                        2024-12-28T00:39:50Z
files.internal.linstor.linbit.com                             2024-12-28T00:39:24Z
keyvaluestore.internal.linstor.linbit.com                     2024-12-28T00:39:24Z
layerbcachevolumes.internal.linstor.linbit.com                2024-12-28T00:39:24Z
layercachevolumes.internal.linstor.linbit.com                 2024-12-28T00:39:25Z
layerdrbdresourcedefinitions.internal.linstor.linbit.com      2024-12-28T00:39:24Z
...
```

Если CR каким-то образом повреждаются, linstor-controller завершается с ошибкой и переходит в CrashLoopBackOff.
Пока pod controller падает, остальные компоненты продолжают работать.
Даже если падают satellites, drbd на узлах также продолжает работать.
Но создание и удаление volumes становится невозможным.

Эти CR плохо читаются человеком, но по ним можно понять, что отсутствует или повреждено.
Можно установить уровень логирования `TRACE`, чтобы увидеть процесс загрузки ресурсов в логах и убедиться, что проблема связана с CR.

CR database может повредиться, если linstor-controller был перезапущен во время очень долгой операции создания или удаления.
"Очень долгая" также может означать "зависшая".
Если видно, что что-то не может корректно удалиться, лучше разобраться и помочь операции завершиться, а не перезапускать controller.


## Пример логов

LINSTOR controller находится в crash loop:

```bash
# kubectl get pod -n cozy-linstor
linstor-controller-6574668cf9-kjtq5 0/1     CrashLoopBackOff 2 (25s ago)     15d
```

Просмотр логов:

```bash
# kubectl logs -n cozy-linstor linstor-controller-6574668cf9-kjtq5
...
2025-10-31 13:08:36.016 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Initializing the k8s crd database connector
2025-10-31 13:08:36.016 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Kubernetes-CRD connection URL is "k8s"
2025-10-31 13:08:37.674 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Starting service instance 'K8sCrdDatabaseService' of type K8sCrdDatabaseService
2025-10-31 13:08:37.690 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Security objects load from database is in progress
2025-10-31 13:08:37.960 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Security objects load from database completed
2025-10-31 13:08:37.961 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Core objects load from database is in progress
2025-10-31 13:08:38.446 [Main] ERROR LINSTOR/Controller/ffffff SYSTEM - Unknown error during loading data from DB [Report number 6904B4D1-00000-000000]

...
time="2025-10-31T13:08:38Z" level=fatal msg="failed to run" err="exit status 199"
```

Это указывает на поврежденную CRD database.

## Получение error report

LINSTOR controller создает внутри контейнера файл в каталоге `/var/log/linstor-controller/` с подробным stack trace.
К сожалению, его сложно увидеть, потому что он сразу удаляется при перезапуске контейнера.
Чтобы обойти это, нужно остановить Piraeus operator controller и изменить entrypoint контейнера linstor-controller.

Чтобы увидеть error report:

1.  Остановите Piraeus operator controller (уменьшите его deployment до нуля).
2.  Остановите deployment linstor-controller (уменьшите его до нуля).
3.  Измените entrypoint deployment linstor-controller, чтобы он запускал `sleep infinity`.
4.  Удалите probes, чтобы контейнер не перезапускался.
5.  Дождитесь запуска контейнера, подключитесь к нему через `exec` и запустите controller вручную.
6.  После падения controller прочитайте error report.

```bash
kubectl scale deployment -n cozy-linstor piraeus-operator-controller-manager --replicas 0
kubectl scale deployment -n cozy-linstor linstor-controller --replicas 0
kubectl edit deploy -n cozy-linstor linstor-controller
```

Откроется редактор.
Удалите целиком секции `livenessProbe`, `readinessProbe` и `startupProbe`.
Найдите секцию контейнера `linstor-controller` (основной контейнер).
В ней замените секцию `args:` на:
```yaml
command:
  - sleep
  - infinity
```
После сохранения и выхода увеличьте deployment до одной реплики и дождитесь запуска pod:

```bash
kubectl scale deployment -n cozy-linstor linstor-controller --replicas 1
```

Запустите controller изнутри контейнера:
```bash
kubectl exec -ti -n cozy-linstor deploy/linstor-controller -- bash
```

```bash
root@linstor-controller-85fd6d6496-cdhbc:/# piraeus-entry.sh startController
```

Вы увидите error report с номером report:
```
2025-10-31 13:19:46.765 [Main] ERROR LINSTOR/Controller/ffffff SYSTEM - Unknown error during loading data from DB [Report number 6904B76C-00000-000000]
```

Теперь прочитайте error report:
```bash
root@linstor-controller-85fd6d6496-cdhbc:/# ls -l /var/log/linstor-controller/
root@linstor-controller-85fd6d6496-cdhbc:/# cat /var/log/linstor-controller/ErrorReport-6904B76C-00000-000000.log
```

Пример error report:
```
ERROR REPORT 6904B76C-00000-000000

============================================================

Application:                        LINBIT? LINSTOR
Module:                             Controller
Version:                            1.31.3
Build ID:                           3734cb10b55e71a97b4c3004877e43641e820f9e
Build time:                         2025-07-10T06:00:07+00:00
Error time:                         2025-10-31 13:19:46
Node:                               linstor-controller-85fd6d6496-cdhbc
Thread:                             Main

============================================================

Reported error:
===============

Category:                           Error
Class name:                         ImplementationError
Class canonical name:               com.linbit.ImplementationError
Generated at:                       Method 'loadCoreObjects', Source file 'DatabaseLoader.java', Line #680

Error message:                      Unknown error during loading data from DB

Call backtrace:

    Method                                   Native Class:Line number
    loadCoreObjects                          N      com.linbit.linstor.dbdrivers.DatabaseLoader:680
    loadCoreObjects                          N      com.linbit.linstor.core.DbDataInitializer:169
    initialize                               N      com.linbit.linstor.core.DbDataInitializer:101
    startSystemServices                      N      com.linbit.linstor.core.ApplicationLifecycleManager:91
    start                                    N      com.linbit.linstor.core.Controller:379
    main                                     N      com.linbit.linstor.core.Controller:635

Caused by:
==========

Category:                           LinStorException
Class name:                         DatabaseException
Class canonical name:               com.linbit.linstor.dbdrivers.DatabaseException
Generated at:                       Method 'getInstance', Source file 'ObjectProtectionFactory.java', Line #89

Error message:                      ObjProt (/resources/GLD-CSXHK-006/PVC-91C1486F-CFE9-41E2-80E1-86477B187F2D) not found!

ErrorContext:


Call backtrace:

    Method                                   Native Class:Line number
    getInstance                              N      com.linbit.linstor.security.ObjectProtectionFactory:89
    getObjectProtection                      N      com.linbit.linstor.dbdrivers.AbsDatabaseDriver:288
    load                                     N      com.linbit.linstor.core.objects.ResourceDbDriver:173
    load                                     N      com.linbit.linstor.core.objects.ResourceDbDriver:47
    loadAll                                  N      com.linbit.linstor.dbdrivers.k8s.crd.K8sCrdEngine:237
    loadAll                                  N      com.linbit.linstor.dbdrivers.AbsDatabaseDriver:180
    loadCoreObjects                          N      com.linbit.linstor.dbdrivers.DatabaseLoader:444
    loadCoreObjects                          N      com.linbit.linstor.core.DbDataInitializer:169
    initialize                               N      com.linbit.linstor.core.DbDataInitializer:101
    startSystemServices                      N      com.linbit.linstor.core.ApplicationLifecycleManager:91
    start                                    N      com.linbit.linstor.core.Controller:379
    main                                     N      com.linbit.linstor.core.Controller:635


END OF ERROR REPORT.
```

Ищите сообщения вроде этого:

```console
Error message: ObjProt (/resources/GLD-CSXHK-006/PVC-91C1486F-CFE9-41E2-80E1-86477B187F2D) not found!
```

or

```console
Error message: Database entry of table LAYER_DRBD_VOLUMES could not be restored.
ErrorContext:   Details:     Primary key: LAYER_RESOURCE_ID = '4804', VLM_NR = '0'
```

Они показывают, какой ресурс отсутствует или поврежден.


## Резервная копия и анализ

Перед любыми изменениями сохраните все CR для анализа и восстановления:

```bash
kubectl get crds | grep -o ".*.internal.linstor.linbit.com" | \
  xargs kubectl get crds -ojson > crds.json

kubectl get crds | grep -o ".*.internal.linstor.linbit.com" | \
  xargs -I{} sh -xc "kubectl get {} -ojson > {}.json"

tar czvf backup-$(date +%d.%m.%Y).tgz *.json
```

У CR трудночитаемые имена, поэтому удобно скачать их все в JSON и изучать удобными инструментами на рабочей машине.


## Исправление базы данных

{{% alert color="warning" %}}
:warning: ДЕСТРУКТИВНОЕ ДЕЙСТВИЕ!

Если поврежденные CR нельзя исправить иначе, кроме удаления, можно удалить проблемные ресурсы обычным `kubectl delete`. Учитывайте,
что при удалении CR физические volumes останутся на storage nodes как orphan volumes. Они больше не будут
автоматически управляться LINSTOR. При необходимости их нужно будет очистить вручную позже.
{{% /alert %}}

### Метод 1. Использование вспомогательного скрипта

Вспомогательный скрипт `linstor-find-db.sh` можно использовать для поиска ресурсов по разным критериям:

```bash
#!/usr/bin/env bash
set -euo pipefail

layer_resource_id=""
vlm_nr=""
resource_name=""
node_name=""

for kv in "$@"; do
  k="${kv%%=*}"
  v="${kv#*=}"
  case "$k" in
    layer_resource_id) layer_resource_id="$v" ;;
    vlm_nr) vlm_nr="$v" ;;
    resource_name) resource_name="$v" ;;
    node_name) node_name="$v" ;;
    *) echo "Unknown key: $k" >&2; exit 2 ;;
  esac
done

shopt -s nullglob
files=(*.internal.linstor.linbit.com.json)
if ((${#files[@]}==0)); then
  echo "No *.internal.linstor.linbit.com.json files found" >&2
  exit 1
fi

if [[ -n "$layer_resource_id" && -n "$vlm_nr" ]]; then
  cat "${files[@]}" \
  | jq -r --arg lrid "$layer_resource_id" --arg vlnr "$vlm_nr" '
      .items[]?
      | select(.spec.layer_resource_id == ($lrid|tonumber) and .spec.vlm_nr == ($vlnr|tonumber))
      | "\(.kind).\(.apiVersion|split("/")[0])/\(.metadata.name)"
    '
  exit 0
fi

if [[ -n "$resource_name" && -n "$node_name" ]]; then
  cat "${files[@]}" \
  | jq -r --arg res "$resource_name" --arg node "$node_name" '
      .items[]?
      | select((.spec.resource_name|tostring|ascii_upcase) == ($res|tostring|ascii_upcase)
            and (.spec.node_name|tostring|ascii_upcase) == ($node|tostring|ascii_upcase))
      | "\(.kind).\(.apiVersion|split("/")[0])/\(.metadata.name)"
    '
  exit 0
fi

echo "Usage:
  $(basename "$0") layer_resource_id=NUM vlm_nr=NUM
  $(basename "$0") resource_name=NAME node_name=NAME" >&2
exit 2
```

Сохраните его как `linstor-find-db.sh`, сделайте исполняемым и используйте для поиска проблемных ресурсов.

#### Пример 1. Отсутствует ObjProt

Если ошибка говорит об отсутствующем ObjProt для конкретного ресурса:

```console
Error message: ObjProt (/resources/GLD-CSXHK-006/PVC-91C1486F-CFE9-41E2-80E1-86477B187F2D) not found!
```

Найдите все ресурсы для этого ресурса и узла:
```bash
chmod +x linstor-find-db.sh
./linstor-find-db.sh resource_name=PVC-91C1486F-CFE9-41E2-80E1-86477B187F2D node_name=GLD-CSXHK-006
```

Пример вывода:
```
LayerResourceIds.internal.linstor.linbit.com/b3e34e9fe5a79d4e8753d0ad4107d0af969d8faaefb88fbd68316950fa2a9242
LayerResourceIds.internal.linstor.linbit.com/dcbff8f66de95d7c6148b3fbb3a9934d226ffb6dfd405c8394ae5454dc87d348
Resources.internal.linstor.linbit.com/43319bec4ca2bbc21324663a9b716c3e4a7ba2607f0fa513dcc59172a1b37270
Volumes.internal.linstor.linbit.com/4ef559b8fe14b58647c99a76a2d3a11f9bbf2b413a448eaf3771777f673c0b4c
```

Удалите их все за один раз:
```bash
kubectl delete $(./linstor-find-db.sh resource_name=PVC-91C1486F-CFE9-41E2-80E1-86477B187F2D node_name=GLD-CSXHK-006)
```

#### Пример 2. Отсутствует LayerDRBD volume

Если ошибка говорит об отсутствующем LayerDRBD volume:

```console
Error message: Database entry of table LAYER_DRBD_VOLUMES could not be restored.
ErrorContext:   Details:     Primary key: LAYER_RESOURCE_ID = '4804', VLM_NR = '0'
```

Найдите ресурсы по `layer_resource_id` и `vlm_nr`:
```bash
./linstor-find-db.sh layer_resource_id=4804 vlm_nr=0
```

Пример вывода:
```
LayerStorageVolumes.internal.linstor.linbit.com/5b597f878f6bb586ddd7d7dc3bbddacbdabedf511861a411712440f66cc61a52
```

Удалите его:
```bash
kubectl delete $(./linstor-find-db.sh layer_resource_id=4804 vlm_nr=0)
```

### Итеративное исправление

После удаления проблемных ресурсов снова попробуйте запустить controller изнутри контейнера:

```bash
piraeus-entry.sh startController
```

Если он снова падает, вы получите новый error report с другим ресурсом. Повторите процесс:
1. Прочитайте error report и определите проблемный ресурс.
2. Найдите и удалите его.
3. Попробуйте снова запустить controller.

Продолжайте, пока controller не запустится успешно:

```console
2025-10-31 13:42:17.483 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Core objects load from database is in progress
2025-10-31 13:42:19.190 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Core objects load from database completed
...
2025-10-31 13:42:27.309 [Main] INFO  LINSTOR/Controller/ffffff SYSTEM - Controller initialized
```


## Перезапуск controller

После исправления CR-based database нужно вернуть deployment linstor-controller в исходное состояние.
Выйдите из контейнера и удалите измененный deployment, чтобы Piraeus operator пересоздал его:

```bash
kubectl delete deployment -n cozy-linstor linstor-controller
```

Верните piraeus operator controller:

```bash
kubectl scale deployment -n cozy-linstor piraeus-operator-controller-manager --replicas 1
```

Он выполнит reconcile deployment linstor-controller и запустит его с исходным entrypoint.

## Восстановление исходного состояния

Если что-то пошло не так и ситуация стала непонятной, можно восстановить как минимум состояние, которое было до исправления.

```bash
# получить сохраненные файлы в другом каталоге
mkdir restore; cd restore
tar xzf ../backup-*.tgz

# удалить ВСЕ CR по именам CRD, используя json-описания (при удалении CRD удаляются все CR)
kubectl delete -f crds.json
# восстановить definitions (обратите внимание на `create` вместо обычного `apply`)
kubectl create -f crds.json

# восстановить все ресурсы
kubectl get crds | grep -o ".*.internal.linstor.linbit.com" | xargs -I{} sh -xc "kubectl create -f {}.json"
```

Теперь можно начать снова.
