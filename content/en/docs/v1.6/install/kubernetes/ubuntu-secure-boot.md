---
title: "Ubuntu Secure Boot: предварительные требования для DRBD"
linkTitle: "Ubuntu + Secure Boot"
description: "Подготовка узлов Ubuntu LTS с включённым UEFI Secure Boot для установки Cozystack без Talos путём предварительной установки drbd-dkms из PPA LINBIT"
weight: 52
---

Эта страница описывает единственное предварительное требование для установки Cozystack на узлы Ubuntu, где включён UEFI Secure Boot. Если ваши узлы работают на Talos Linux или Ubuntu с отключённым Secure Boot, вы можете пропустить эту страницу — стандартный процесс piraeus-operator справляется с этими случаями.

## Почему это необходимо

Cozystack использует [LINSTOR](https://linbit.com/linstor/) для реплицированного блочного хранения, который зависит от модуля ядра DRBD 9.x. piraeus-operator, поставляемый с Cozystack, по умолчанию **компилирует DRBD из исходников на каждом узле во время выполнения** и загружает модуль через `insmod`.

На узлах, где включён UEFI Secure Boot, подсистема блокировки ядра (lockdown) отклоняет неподписанные модули при загрузке:

```text
insmod: ERROR: could not insert module ./drbd.ko: Key was rejected by service
```

(Перед этим может также появиться строка `chcon: can't apply partial context to unlabeled file './drbd.ko'`, если образ загрузчика устанавливает `LB_SELINUX_AS` — это предупреждение безобидно и не связано со сбоем загрузки.)

Скомпилированные файлы `.ko` не подписаны никаким ключом, которому доверяет узел, поэтому `init_module()` завершается с ошибкой. Pod satellite linstor никогда не достигает состояния `Ready`, и хранение Cozystack остаётся неработоспособным.

Это распространённая ситуация при установке Ubuntu на «железо» и на облачных SKU, поставляемых с включённым Secure Boot. Стандартные образы облачных ВМ на AWS, GCP и Azure обычно поставляются без принудительного включения Secure Boot, и стандартный процесс piraeus-operator работает как есть.

Это руководство касается только Ubuntu LTS. У Debian 12 та же проблема с неподписанным модулем DRBD при Secure Boot, но LINBIT не публикует PPA для Debian — операторам придётся использовать apt-зеркало клиентского портала LINBIT или собирать и подписывать drbd-dkms вручную. Процессы для RHEL/SUSE (управляемые LINBIT RPM-репозитории с заранее подписанными kmod) не рассматриваются в этом руководстве.

## Рекомендуемое решение: предварительная установка drbd-dkms на узле

Установите пакет `drbd-dkms`, опубликованный LINBIT, на каждом узле **до** развёртывания Cozystack, затем добавьте drop-in-файл modprobe.d с `usermode_helper=disabled` и замаскируйте сервис `drbd.service` на стороне узла. Минимальные облачные образы Ubuntu не поставляются с `add-apt-repository`; сначала установите `software-properties-common`, если он отсутствует. Полный процесс на каждом узле:

1. Добавьте PPA LINBIT, установите `drbd-dkms`. Пакет проходит через стандартный конвейер Ubuntu `shim-signed` + dkms:
   - При первой установке dkms, если MOK ещё не существует, postinst-скрипт `shim-signed` в Ubuntu генерирует персональную для узла пару ключей подписи в `/var/lib/shim-signed/mok/MOK.priv` и `/var/lib/shim-signed/mok/MOK.der` (на них указывают `/etc/dkms/framework.conf` как `mok_signing_key` / `mok_certificate`).
   - dkms компилирует модуль под текущее ядро и подписывает только что собранный `.ko` этим ключом.
   - Во время `apt-get install` debconf запрашивает у оператора пароль для регистрации ключа; соответствующий публичный ключ добавляется в очередь на регистрацию MOK через `mokutil --import`. **Если установка выполняется неинтерактивно** (`DEBIAN_FRONTEND=noninteractive`), запрос пропускается, и оператору нужно вручную выполнить `mokutil --import /var/lib/shim-signed/mok/MOK.der` после установки.
2. Запишите `/etc/modprobe.d/cozystack-drbd.conf` с содержимым `options drbd usermode_helper=disabled`. DaemonSet piraeus-operator устанавливает `LB_FAIL_IF_USERMODE_HELPER_NOT_DISABLED=yes` для загрузчика, поэтому загрузчик завершается с ошибкой при загрузке модуля на узле без этого параметра (см. [строку 332 `entry.sh`](https://github.com/LINBIT/drbd/blob/8c279459a32823b495a2649fc6dafc9fdfac1c7f/docker/entry.sh#L332) в LINBIT/drbd и связанные переменные окружения в [satellite daemonset](https://github.com/piraeusdatastore/piraeus-operator/blob/3bf3e75a142f69534609a6323c88db29150047a2/pkg/resources/satellite/satellite/daemonset.yaml) piraeus-operator).
3. `systemctl mask drbd.service`. `drbd-utils` попадает на узел транзитивно как жёсткая зависимость apt пакета `drbd-dkms` и содержит unit `drbd.service`, который при случайном включении будет конфликтовать с satellite-контейнером piraeus-operator.
4. Запишите `/etc/modules-load.d/cozystack-drbd.conf` с содержимым `drbd`, чтобы `systemd-modules-load.service` загружал модуль при каждой загрузке системы. Без этого файла узел зависит от того, что (если вообще что-то) прописано в `modules-load.d` пакетом `drbd-utils`, а это отличалось между релизами — явное указание устраняет неопределённость и соответствует пути, который записывает сопутствующий Ansible playbook.
5. **Перезагрузите каждый узел и подтвердите регистрацию MOK в консоли shim** (Enroll MOK → View key → Continue → введите пароль, заданный на шаге 1 при запросе debconf, или через `mokutil --import`). Требуется одна перезагрузка на узел, чтобы оператор прошёл через MOK Manager shim. Этот шаг невозможно автоматизировать — так устроен UEFI Secure Boot.
6. После регистрации ядро начинает доверять ключу подписи, и собранный dkms модуль DRBD загружается с нужным параметром.

Когда на узле загружен DRBD 9.x с `usermode_helper=disabled`, загрузчик piraeus-operator обнаруживает загруженный на узле модуль при старте Pod и корректно завершается без попытки собственной компиляции и `insmod`. Дополнительная настройка на стороне оператора не требуется.

{{% alert color="warning" %}}
**Регистрация MOK интерактивна и выполняется для каждого узла отдельно**. Оператору нужно получить доступ к консоли (физической, IPMI или KVM) каждого узла при следующей перезагрузке и пройти через MOK Manager shim. Обходного решения на уровне Kubernetes не существует — подпись модулей ядра при Secure Boot является вопросом прошивки узла.
{{% /alert %}}

Ручную процедуру для каждого узла см. ниже. Автоматизация добавляется в [`cozystack/ansible-cozystack` (PR #39)](https://github.com/cozystack/ansible-cozystack/pull/39); v1.6 поставляется только с ручным путём, так как автоматизация ещё не попала в тегированный релиз коллекции.

## Ручной путь

Для операторов, не использующих Ansible, эквивалентные шаги на каждом узле Ubuntu LTS следующие:

```bash
# 1. Установить add-apt-repository (отсутствует на минимальных облачных образах).
sudo apt-get update
sudo apt-get install --yes software-properties-common

# 2. Добавить PPA LINBIT и установить drbd-dkms. Во время установки debconf
#    запросит одноразовый пароль для регистрации MOK — выберите любой
#    пароль, который сможете повторно ввести в консоли shim после перезагрузки.
sudo add-apt-repository --yes ppa:linbit/linbit-drbd9-stack
sudo apt-get install --yes drbd-dkms

# 3. Настроить требуемый параметр модуля.
sudo tee /etc/modprobe.d/cozystack-drbd.conf <<'EOF'
options drbd usermode_helper=disabled
EOF

# 4. Замаскировать drbd.service на узле, чтобы он не конфликтовал с piraeus-operator.
sudo systemctl mask drbd.service

# 5. Обеспечить загрузку модуля при старте. Собственная запись пакета drbd-utils
#    в /lib/modules-load.d/ отличалась между релизами; явная запись в /etc/
#    переопределяет всё, что находится в /lib/, и устраняет неопределённость.
echo drbd | sudo tee /etc/modules-load.d/cozystack-drbd.conf

# 6. Перезагрузка. В меню MOK Manager shim выберите:
#    Enroll MOK -> View key -> Continue -> Yes -> введите пароль,
#    который вы задали при запросе debconf на шаге 2.
sudo reboot
```

После перезагрузки убедитесь, что модуль загружен с нужным параметром:

```bash
cat /sys/module/drbd/parameters/usermode_helper
# ожидается: disabled
```

Затем развёртывайте Cozystack как обычно. Загрузчик piraeus-operator обнаружит загруженный на узле DRBD и корректно завершится.

## Что происходит при развёртывании

Когда satellite Pod piraeus-operator запускается на узле, его initContainer `drbd-module-loader` выполняет [`entry.sh` из LINBIT/drbd](https://github.com/LINBIT/drbd/blob/master/docker/entry.sh). Строки 328–339 пропускают путь компиляции и `insmod`, если DRBD уже загружен на узле:

```sh
if grep -q '^drbd ' /proc/modules; then
    echo "DRBD module is already loaded"
    [[ $LB_FAIL_IF_USERMODE_HELPER_NOT_DISABLED == yes ]] \
        && ! grep -qw disabled /sys/module/drbd/parameters/usermode_helper \
        && die "..."
    drbd_matches_min_version "$LB_DRBD_MIN_LOADED_VERSION" || die "..."
    exit 0
fi
```

Проверяются два условия:

1. Модуль должен быть загружен с `usermode_helper=disabled`. Об этом заботится приведённый выше drop-in modprobe.d.
2. Загруженная версия должна удовлетворять `LB_DRBD_MIN_LOADED_VERSION`. DaemonSet piraeus-operator устанавливает его в `9`. `drbd-dkms` от LINBIT поставляет DRBD 9.x, поэтому это выполняется автоматически.

Оба условия выполнены → `exit 0` → Pod satellite продолжает работу. Никаких изменений на стороне piraeus-operator или LinstorSatelliteConfiguration не требуется.

## Альтернативы

- **Talos Linux** ([руководство]({{% ref "/docs/v1.6/guides/talos" %}})) поставляет заранее подписанные модули DRBD в своих системных расширениях и не имеет ни одной из этих проблем. Рекомендуется для новых развёртываний, где не требуется собственный дистрибутив Linux.
- **Отключить Secure Boot** в UEFI-прошивке узла. В этом случае стандартный путь компиляции внутри кластера работает без изменений. Операционно нежелательно для инфраструктур, где Secure Boot является частью базовой политики безопасности, но это допустимый запасной вариант.
- **Собрать и подписать drbd-dkms вручную** с использованием собственного корпоративного CA. Именно так уже поступают производственные среды с собственной инфраструктурой подписи MOK / shim; это выходит за рамки данного руководства.

## Устранение неполадок

**`modprobe drbd` возвращает `Key was rejected by service` после установки dkms** — сгенерированный dkms ключ MOK поставлен в очередь, но ещё не зарегистрирован. Перезагрузите узел и подтвердите регистрацию в консоли shim (Enroll MOK → View key → Continue → пароль dkms). Повторите modprobe.

**`cat /sys/module/drbd/parameters/usermode_helper` не равен `disabled`** — drop-in modprobe.d отсутствует, либо модуль был загружен до того, как он был записан. Выполните `sudo rmmod drbd && sudo modprobe drbd` после того, как drop-in будет на месте, либо перезагрузите узел.

**Pod загрузчика piraeus-operator выводит в логах `Could not load DRBD kernel modules`** даже после установки на узле — проверьте `LB_DRBD_MIN_LOADED_VERSION` через `kubectl --namespace cozy-linstor describe pod --selector app.kubernetes.io/component=linstor-satellite` и `cat /proc/drbd` на узле. Модуль на узле должен быть не ниже минимальной требуемой версии загрузчика (`9` согласно daemonset piraeus-operator). PPA LINBIT поставляет `drbd-dkms` версии 9.x, поэтому это редко является проблемой.

**Ubuntu 26.04+ или промежуточные релизы (Oracular 24.10, Plucky 25.04)** — PPA LINBIT публикует `drbd-dkms` только для тех серий LTS, которые LINBIT поддерживает актуальными. Проверьте [страницу деталей PPA](https://launchpad.net/~linbit/+archive/ubuntu/linbit-drbd9-stack) для текущего списка серий. На неподдерживаемых релизах добавление PPA завершается ошибкой 404 при получении файла Release. Соберите и подпишите drbd-dkms вручную, понизьте версию до поддерживаемого LTS или подождите, пока LINBIT опубликует пакет для вашего релиза.
