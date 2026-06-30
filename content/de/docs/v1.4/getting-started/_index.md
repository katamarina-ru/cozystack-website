---
title: "Erste Schritte mit Cozystack: Private Cloud von Grund auf bereitstellen"
linkTitle: "Erste Schritte"
description: "Machen Sie Ihre ersten Schritte, betreiben Sie ein Homelab und bauen Sie einen PoC mit Cozystack."
weight: 10
aliases:
  - /docs/v1.4/get-started
source_digest: "sha256:<en-source-hash>"
translation_status: current
l10n: mt
---

Dieses Tutorial führt Sie durch Ihre erste Bereitstellung eines Cozystack-Clusters.
Unterwegs lernen Sie zentrale Konzepte kennen, nutzen Cozystack über das Dashboard und die CLI
und erhalten einen funktionierenden Proof of Concept.

Das Tutorial ist in mehrere Schritte unterteilt.
Schließen Sie jeden Schritt ab, bevor Sie mit dem nächsten beginnen:

| Schritt                                                                           | Beschreibung                                                                                                                   |
|-----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| [Voraussetzungen: Infrastruktur und Tools vorbereiten]({{% ref "requirements" %}}) | Bereiten Sie die Infrastruktur vor und installieren Sie die erforderlichen CLI-Tools, bevor Sie dieses Tutorial starten.       |
| 1. [Talos Linux installieren]({{% ref "install-talos" %}})                        | Installieren Sie eine Cozystack-spezifische Distribution von Talos Linux mit [`boot-to-talos`][btt] – wohl die einfachste Methode. |
| 2. [Kubernetes-Cluster installieren und bootstrappen]({{% ref "install-kubernetes" %}}) | Bootstrappen Sie einen Kubernetes-Cluster mit [Talm][talm], dem für Cozystack entwickelten Talos-Konfigurationswerkzeug.       |
| 3. [Cozystack installieren und konfigurieren]({{% ref "install-cozystack" %}})    | Installieren Sie Cozystack, erhalten Sie administrativen Zugriff, nehmen Sie die Grundkonfiguration vor und öffnen Sie das Cozystack-Dashboard. |
| 4. [Tenant für Benutzer und Teams erstellen]({{% ref "create-tenant" %}})         | Erstellen Sie einen Benutzer-Tenant – die Grundlage von RBAC in Cozystack – und greifen Sie über Dashboard und Cozystack-API darauf zu. |
| 5. [Managed Applications bereitstellen]({{% ref "deploy-app" %}})                 | Nutzen Sie Cozystack: Stellen Sie eine virtuelle Maschine, eine Managed Application und einen Tenant-Kubernetes-Cluster bereit. |

[btt]: https://github.com/cozystack/boot-to-talos
[talm]: https://github.com/cozystack/talm
