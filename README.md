# cozystack-website для РФ и СНГ

Веб-сайт и документация, размещенная на Cozystack.ru

## Предварительные проверки
```bash
go version
hugo version
```

## Установка go

Вам понадобится Go версии 1.14 или выше для запуска сайта.
[Инструкция по установке](https://go.dev/doc/install)

```bash
 wget https://go.dev/dl/go1.24.2.linux-amd64.tar.gz -P /tmp
 rm -rf /usr/bin/go && sudo tar -C /usr/local -xzf /tmp/go1.24.2.linux-amd64.tar.gz
 export PATH=$PATH:/usr/local/go/bin
 go version
```

## Установка hugo

Обязательно скачайте расширенную (extended) версию Hugo со страницы релизов на GitHub. Бинарный файл, установленный через пакетный менеджер вашей операционной системы, может (и, скорее всего, будет) работать некорректно.

```bash
brew install hugo
```

## Запуск docs

```bash
hugo serve
```
