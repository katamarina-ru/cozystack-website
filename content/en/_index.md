---
title: "Русскоязычное сообщество проекта Cozystack (свободной облачной платформы на базе Kubernetes)"
description: > 
  Сайт посвящен лучшим практикам использования Cozystack для создания собственного облака или предоставления экономичных сред разработки с учетом локальных особенностей пользователей из СНГ.

  Платформа Cozystack позволяет превратить набор bare-metal серверов в интеллектуальную систему с простым REST API для легкого развертывания кластеров Kubernetes, баз данных как услуги (DBaaS), виртуальных машин, балансировщиков нагрузки, сервисов HTTP-кэширования и других служб.

  Официальный сайт проекта (CNCF): https://cozystack.io/
taglines:
  - Локализованная документация
  - Соответствие регуляторам в РФ и СНГ
  - Русскоговорящее сообщество
use_cases:
  - title: Hosting and cloud providers
    situation: >
      You sell VPS. Customers now ask for managed Kubernetes, databases and
      object storage, and building each service yourself is a roadmap you
      never finish.
    outcome: >
      One platform that turns your existing hardware into a catalogue:
      isolated tenants, self-service provisioning, and a Kubernetes-native
      API your billing can drive.
    link: /docs/guides/use-cases/public-cloud/
    link_text: Building a public cloud
  - title: Teams leaving VMware
    situation: >
      Perpetual licences are gone, renewal quotas arrived, and the VMs still
      have to run somewhere you control.
    outcome: >
      Virtual machines and containers on the same cluster, on your own
      servers, with live migration and replicated storage — and the migration
      path is a tool, not a rewrite.
    link: /docs/guides/use-cases/private-cloud/
    link_text: Building a private cloud
  - title: Platform teams
    situation: >
      Developers open tickets for a database, a cluster or an environment,
      and the platform team is the bottleneck for all of it.
    outcome: >
      Developers request what they need as Kubernetes resources and get it in
      minutes, inside quotas you set, without an account on anyone's cloud.
    link: /docs/guides/use-cases/kubernetes-distribution/
    link_text: As a Kubernetes distribution
  - title: Universities and research
    situation: >
      Every group wants its own cluster and a share of the GPUs, and nobody
      wants to administer either.
    outcome: >
      A real isolated cluster per group or per course on shared hardware, GPU
      allocation between them, and an environment that can be recreated from
      a repository next term.
  - title: Public sector and regulated industries
    situation: >
      The data cannot leave your jurisdiction, and an external control plane
      is not something you are allowed to depend on.
    outcome: >
      The whole platform runs on your own hardware with no external SaaS in
      the control path, and every component is open source you can audit.
  - title: Telecom and edge
    situation: >
      Network functions still arrive as virtual machines while everything
      new arrives as containers, and they end up on separate stacks.
    outcome: >
      Both on one platform, with the networking the dataplane needs, from a
      central site out to small edge clusters.
benefits:
  - title: API-first подход
    icon: fas fa-code
    description: >
      Cozystack основан на Kubernetes и предполагает тесное взаимодействие с его API. Платформа не стремится полностью скрыть все элементы за красивым UI или какими-либо кастомизациями. Вместо этого она предоставляет стандартный интерфейс и обучает пользователей работе с базовыми примитивами.
  - title: Стандартизация и унификация
    icon: fas fa-certificate
    description: >
      Все компоненты платформы основаны на проверенных инструментах и технологиях с открытым исходным кодом, которые широко известны в индустрии. Мы стремимся использовать наиболее устоявшиеся и проверенные подходы, делая всю платформу очень простой и избегая привязки к поставщику (vendor lock-in).
  - title: Сотрудничество, а не конкуренция
    icon: fas fa-handshake
    description: >
     Мы гордимся нашим сообществом и тесно взаимодействуем с проектами вокруг него. Если мы создаем функцию платформы, которая может быть полезна в upstream-проекте, мы предпочитаем внести вклад в этот проект, а не удерживать ее внутри платформы.
features:
  - title: Простота установки
    icon: fas fa-wrench
    description: >
      С помощью [talos-bootstrap](https://github.com/cozystack/talos-bootstrap/) мы предоставляем максимально простой метод установки, позволяющий развернуть Cozystack с использованием методов PXE или ISO на серверах в физическом дата-центре. Использование неизменяемой (immutable) ОС помогает поддерживать целостность системы и гарантировать, что все работает как ожидается.
  - title: Простота интеграции
    icon: fas fa-plug
    description: >
      Мы предоставляем нативный Kubernetes RESTful API, широко признанный за свою декларативность. Поэтому для интеграции с вашим биллингом достаточно настроить вашу систему на отправку определенного YAML-манифеста, описывающего желаемый сервис, в Kubernetes API. Cozystack сделает всю остальную работу за вас.
  - title: Простота расширения
    icon: fas fa-up-right-and-down-left-from-center
    description: >
      Каждый пакет в платформе состоит из набора YAML-файлов. Таким образом, каждый, кто знаком с примитивами Kubernetes, может изменять или расширять платформу. Надежная доставка пакетов обеспечивается FluxCD — известным и широко используемым инструментом.
  - title: Высокая производительность, низкие накладные расходы
    icon: fas fa-gauge-high
    description: >
      Мы заботимся о производительности. Именно поэтому мы применяем самые высокопроизводительные технологии, балансируя между стабильностью и функциональностью. Более того, наша уникальная модель тенантов позволяет эффективно распределять облачные ресурсы для control plane, обеспечивая экономическую эффективность и необходимый уровень безопасности.
  - title: Встроенный мониторинг и алерты
    icon: fas fa-area-chart
    description: >
      Каждый экземпляр каждого сервиса сопровождается набором предварительно настроенных дашбордов и алертов. Вы можете создавать отдельные центры мониторинга для каждого тенанта или объединять их в один.
  - title: Встроенный UI для управления приложениями
    icon: fas fa-window-maximize
    description: >
      Хотя основная цель платформы — предоставить красивый API, в ней также есть дашборд для развертывания приложений. Web UI облегчает быстрое погружение в платформу и предоставляет визуальную демонстрацию ее возможностей.
---

<div class="hero-gitops">
  {{% blocks/hero title="Русскоязычное сообщество проекта Cozystack (свободной облачной платформы на базе Kubernetes)" color="primary"
  height="auto" link_title="Начать" link_url="/docs/v1.6/getting-started/" %}}
  
  Сайт посвящен лучшим практикам использования Cozystack для создания собственного облака или предоставления экономичных сред разработки с учетом локальных особенностей пользователей из СНГ.

  Платформа Cozystack позволяет превратить набор bare-metal серверов в интеллектуальную систему с простым REST API для легкого развертывания кластеров Kubernetes, баз данных как услуги (DBaaS), виртуальных машин, балансировщиков нагрузки, сервисов HTTP-кэширования и других служб.

  Официальный сайт проекта (CNCF): https://cozystack.io/

  {{% /blocks/hero %}}

  <div class="lead-flux">
  {{< blocks/lead >}}
  {{< /blocks/lead >}}
  </div>
</div>

<!-- Screenshot Gallery -->
{{< home/screenshot-gallery >}}

<!-- Live Demo -->
<div class="section-live-demo">
{{< blocks/lead color="primary" >}}
<br>
<h2 class="section-label">Протестируйте UI-консоль без установки</h2>
<p class="live-demo-lead">Реальная панель управления Cozystack, работающая полностью в вашем браузере - без кластера, без регистрации, без настройки. Просматривайте маркетплейс, открывайте управляемые сервисы, кликайте по консоли. Это настоящий интерфейс, просто с демо-данными.</p>
<div class="live-demo-cta"><a class="btn btn-lg btn-primary" href="/demo/">Открыть демо &rarr;</a></div>
{{< /blocks/lead >}}
</div>

<!-- Who it is for -->

{{< home/use-cases >}}

<!-- Benefits & Features -->

{{< home/benefits >}}

{{< home/features >}}

<!-- Community -->
<div class="section-community">
  {{< blocks/lead color="dark" >}}
  <h2 class="section-label">
    Ресурсы и Сообщество
  </h2>

  <p>Мы глубоко признательны нашему сообществу за постоянную поддержку и вклад в развитие Cozystack.<br/> Присоединяйтесь к нашему сообществу и станьте частью нашего пути.</p>

  {{< /blocks/lead >}}

  <div class="subsection-community-row">
  {{< blocks/section color="dark" type="community-row">}}

    {{< home/community icon="fab fa-slack" title="Сайт проекта" >}}
    Официальный сайт проекта Cozystack от CNCF: <a target="_blank" href="https://cozystack.io/">https://cozystack.io/</a>. Здесь идет работа в рамках глобального сообщества.

  {{< /home/community >}}
  
    {{< home/community icon="fab fa-github" title="GitHub Discussions" >}}
    <a target="_blank" href="https://github.com/cozystack/cozystack/discussions">Присоединяйтесь к обсуждению в GitHub Discussions</a>. Здесь происходит все, что связано с Cozystack: от спецификаций и планирования функций до демонстраций.

  {{< /home/community >}}

    {{< home/community icon="fa fa-paper-plane" title="RU-чат Telegram" >}}
    У нас также большое сообщество в Telegram. Присоединяйтесь к групповому чату <a target="_blank" href="https://t.me/cozystack_ru/">@cozystack_ru</a>, чтобы общаться с другими пользователями, задавать вопросы и быть в курсе последних новостей и разработок.
    {{< /home/community >}}

  {{< /blocks/section >}}
  </div>

</div>
