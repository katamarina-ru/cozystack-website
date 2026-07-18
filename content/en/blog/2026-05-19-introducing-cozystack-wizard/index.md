---
title: "Представляем /cozystack:wizard — управляемый установщик Cozystack"
slug: introducing-cozystack-wizard
date: 2026-05-19
author: "Timur Tukaev"
description: "/cozystack:wizard — это новый управляемый установщик, который оркестрирует полное развёртывание Cozystack от начала до конца на Talos, Ubuntu и существующих кластерах — решает проблемы cert-SAN в облаках за NAT, подготовку ZFS, гонки при регистрации LINSTOR и многое другое."
images:
  - "cozystack-wizard.png"
article_types:
  - announcement
topics:
  - platform
  - install
---

![Cozystack wizard](cozystack-wizard.png)

Мы выпустили **`/cozystack:wizard`** — управляемый установщик Cozystack.

Укажите `Talos`, `Ubuntu` или `Existing`, и он оркестрирует всю цепочку от начала до конца. Он решает проблемы cert-SAN в облаках за NAT (OCI, GCP, AWS), подготовку ZFS на Talos, гонки при регистрации LINSTOR и десяток других ловушек, на которые мы наткнулись при тестировании реальной установки.

Вариант Boot-to-Talos тоже работает: если узлы уже загрузились на базовом Talos, мастер обновляет их до образа, настроенного под Cozystack. Сквозной путь проверен на кластере из 3 узлов OCI Talos.

## Ломающее изменение: объединение плагинов

Мы объединили пять плагинов в два — `cozystack` и `linstor` — и переименовали навыки. Если у вас были старые плагины, удалите предыдущие и установите заново:

```bash
/plugin install cozystack@cozystack-claude-plugins
/plugin install linstor@cozystack-claude-plugins
```

Затем выполните:

```bash
/cozystack:wizard
```

## Попробуйте и поделитесь отзывом

Мастер призван провести вас от чистого набора узлов (или существующего кластера) до работающего Cozystack без ручного разбора длинного хвоста граничных случаев. Мы провели нагрузочное тестирование на приведённых выше конфигурациях, но чем больше окружений он увидит, тем лучше становится.

Пожалуйста, попробуйте и расскажите нам, что сработало, что сломалось и что показалось непонятным.

---

## Присоединяйтесь к сообществу

- GitHub: [github.com/cozystack/cozystack](https://github.com/cozystack/cozystack)
- Сообщество в Telegram: [t.me/cozystack](https://t.me/cozystack/)
- Cozystack в Kubernetes Slack: [#cozystack](https://kubernetes.slack.com/archives/C06L3CPRVN1) (нужно приглашение? [slack.kubernetes.io](https://slack.kubernetes.io))
- Календарь встреч сообщества: [cozystack.io/community](https://cozystack.io/community/)
