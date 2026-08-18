---
title: "GDPR on Kubernetes: What Cozystack Provides"
linkTitle: "GDPR"
description: "Which GDPR technical measures Cozystack supplies — data residency, encryption, access control, audit and erasure — and which obligations stay with the controller."
date: 2026-08-18
type: "page"
weight: 15
---

**GDPR compliance is not a property of infrastructure.** It is a property of what an
organization does with personal data: why it holds it, on what legal basis, for how long, and
what happens when someone asks for a copy or asks to be forgotten. No platform can answer
those questions for you.

What a platform can do is supply the technical and organizational measures that Article 32
requires, and make them demonstrable. That is what this page covers, one measure at a time.

The distinction matters commercially. When a customer asks "is Cozystack GDPR compliant",
the useful answer is "here is what the platform gives you towards Article 32, and here is
what remains yours" — not a yes that falls apart under a data protection officer's first
question.

## Where the data physically lives

This is usually the first question and the easiest to answer well.

Cozystack installs on your own hardware, in a facility you choose. There is no control plane
in someone else's cloud, no telemetry pipeline that has to leave the building, and no vendor
who needs standing access in order for the platform to work. For Chapter V — transfers of
personal data to third countries — that removes the hardest part of the analysis before it
starts.

If you operate in several jurisdictions, tenants and node placement let you keep processing
in one of them rather than spreading it across all of them.

## Article 32 measures, one by one

### Encryption of personal data

Three layers, and they behave differently.

**Kubernetes secrets** are encrypted in etcd where the API server runs with
`--encryption-provider-config`. That setting comes from the Talos machine configuration
supplied at install time, so confirm it on your own cluster.

**Volumes** — the disks behind databases and virtual machines — are not encrypted unless you
ask. LINSTOR supports at-rest encryption with LUKS, enabled by creating a StorageClass with
the LUKS layer. See [Creating Encrypted Storage on LINSTOR](/docs/v1.6/storage/disk-encryption/),
and decide it at design time: converting a populated volume later means migrating the data.

**Backups** are encrypted by default. Velero uses the kopia uploader, so backup data is
written to object storage under a repository key held in the cluster.

For personal data held by the identity layer specifically, Cozystack v1.6 added an optional
encrypting proxy in front of the Keycloak database, giving column-level encryption backed by
a static key or Vault Transit. It is off until you enable it.

### Confidentiality and access control

Authentication can be centralized in Keycloak through OIDC, which puts joiners, leavers,
multi-factor authentication and password policy in one place rather than scattered across
kubeconfig files. It is not the default — a fresh cluster authenticates with a cluster
credential, which is a shared account and unsuitable for anything holding personal data.
Enable OIDC before the environment carries real data.

Authorization is scoped to the tenant, and more tightly than teams expect: a tenant user can
create databases and virtual machines through the platform API yet cannot read raw Kubernetes
secrets. Read that as least privilege at the API surface rather than as a confidentiality
boundary — a principal who can schedule workloads in a namespace can mount that namespace's
secrets into a pod.

### Separation of processing

Tenants are isolated from each other by network policies created together with the tenant,
and the isolation is enforced rather than declared. If you process personal data for several
controllers, or separate production from analytics, that separation is a platform primitive
instead of a convention.

You can verify it in a minute — start a pod in one tenant and try to reach it from another,
with a same-tenant probe as the positive control.

### Ability to restore availability after an incident

Article 32(1)(c) asks for the ability to restore access to personal data in a timely manner.
Velero ships with the platform for scheduled backups, volume snapshots and cluster state, and
restores are worth rehearsing rather than assuming — a backup nobody has restored is a hope,
not a measure.

### Regular testing of measures

Article 32(1)(d) asks for a process of testing and evaluating effectiveness. The
[CIS Benchmark](/compliance/cis-benchmark/) page shows one such test run against a live
cluster, with the failures sorted into real deviations and artifacts of the architecture.
Nothing prevents you from running it on your own schedule; the manifest is published there.

## Erasure, and the parts of it that are awkward

The right to erasure is where infrastructure and law meet uncomfortably, so it is worth being
concrete rather than reassuring.

Deleting a database row is straightforward. Deleting it from **backups** is not: backups exist
precisely so that deletions can be undone. The workable position, and the one supervisory
authorities generally accept, is documented retention: state how long backups live, ensure
erased data ages out of them within that window, and do not restore it selectively afterwards.
Cozystack does not solve this for you — but it does let you set backup retention deliberately
and point backups at storage you control.

**Audit logs** create a second version of the same problem, and it has a trap. Raising the
Kubernetes audit policy to `RequestResponse` to satisfy some other framework will write
request bodies — including personal data — into the audit log. The log then becomes a store
of personal data with its own retention and access rules. Keep sensitive resources at
`Metadata` level and split the policy by resource.

## What stays with you

No infrastructure product supplies any of the following, and a vendor implying otherwise is
worth distrusting: the lawful basis for processing, records of processing activities under
Article 30, data protection impact assessments, breach notification within 72 hours,
responses to data subject requests, the appointment of a data protection officer, or the
data processing agreement between you and your own customers.

The platform is a processor's tool. The controller's obligations remain the controller's.

## Frequently asked questions

### Is Cozystack GDPR compliant?

The question does not apply to infrastructure. An organization is compliant; a platform
supplies measures. Cozystack supplies encryption, access control, tenant separation, audit
logging, backup and restore, and full control over where data physically resides.

### Does using Cozystack avoid third-country transfer problems?

It removes the platform itself from the analysis, because Cozystack runs on your hardware and
requires no vendor access to operate. Whether your own architecture transfers data elsewhere
is a separate question about your applications and integrations.

### Is personal data encrypted at rest by default?

Kubernetes secrets and backups, yes. Volumes, no — that is an option you enable per
StorageClass, and it belongs in the design rather than in a later change.

### Who is the processor when we run Cozystack ourselves?

You are. Running open-source software on your own hardware does not introduce a processor:
there is no service, no account and no data leaving your infrastructure. If you contract an
integrator to operate the platform for you, that relationship needs its own agreement.

## Notes

This page describes Cozystack v1.6 as observed on a reference cluster in August 2026, and is
informational. It is not legal advice, not an assessment, and not a warranty that any
configuration satisfies a supervisory authority. Your installation may differ, particularly in
the Talos machine configuration that supplies several of the settings above.
