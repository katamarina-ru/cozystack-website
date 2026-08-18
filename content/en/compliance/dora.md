---
title: "DORA Readiness on Kubernetes with Cozystack"
linkTitle: "DORA"
description: "How Cozystack supports the EU Digital Operational Resilience Act: resilience, backup and restore, incident evidence, ICT third-party risk and exit strategy."
date: 2026-08-18
type: "page"
weight: 25
---

**DORA is a regulation about how a financial entity manages ICT risk, not a test a platform
can pass.** It asks who owns the risk, how incidents are detected and reported, how resilience
is tested, and — the part that decides most platform conversations — how dependent the entity
is on any single ICT provider.

That last point is where the choice of platform genuinely matters, and where an open-source
platform running on your own hardware changes the shape of the answer rather than just adding
a checkbox.

The Digital Operational Resilience Act applies to banks, insurers, payment institutions,
crypto-asset providers and their critical ICT suppliers across the EU, and has applied since
January 2025.

## The part that actually depends on the platform

DORA devotes a whole chapter to ICT third-party risk: register of information, contractual
requirements, concentration risk, exit strategies, and the right to audit. Regulators care
about it because a financial entity that cannot leave a provider has no real control over its
own resilience.

Three properties matter here, and they are structural rather than features.

**The source is open, under Apache 2.0.** Contractual continuity does not depend on one
vendor's survival, and the code can be audited by you or by a third party without asking
permission.

**It runs on your own hardware.** No control plane in someone else's account, no vendor with
standing access required for the platform to function, no dependency on an external service
being up. What you host, you control — which is exactly the language a resilience assessment
speaks.

**Exit is possible in practice, not only on paper.** Workloads are Kubernetes objects and
virtual machines in standard formats; there is no proprietary encapsulation to unwind. An exit
plan you can rehearse is worth more to a regulator than a clause promising cooperation.

None of this exempts you from having a register of information, an exit strategy document, or
contracts that meet Article 30. It makes those documents easier to write truthfully.

## Resilience: what the platform provides

DORA expects ICT systems to withstand and recover from disruption, and to be tested against
that expectation rather than assumed to meet it.

**Redundant storage by default.** Volumes are replicated across nodes with DRBD through
LINSTOR, so the loss of a node does not mean the loss of a volume. No separate storage array
is required for this.

**Live migration.** Virtual machines move between nodes without shutdown, which turns planned
maintenance from an outage into an operation.

**Declared state, continuously reconciled.** Machines and services are described as
manifests, and the platform works to keep reality matching the description. Kill a workload
directly and it comes back, because the description did not change.

**Stretched clusters across locations.** Multi-datacenter topologies are a normal deployment
shape rather than an exotic one, which matters when your resilience requirements name
geographic separation.

Be precise about what is *not* provided: there is no automated failover of a virtual machine
after an unplanned node loss equivalent to a dedicated HA product. Node health handling and
restart policy exist and can be composed into one, but this is configuration and rehearsal
work, not a switch.

## Backup, restore and the evidence that they work

Velero ships with the platform for scheduled backups, volume snapshots, virtual machine
backups and cluster state, and backup data is encrypted in object storage by default through
the kopia uploader.

The regulation's emphasis is not on having backups but on being able to restore. Rehearse the
restore, record how long it took, and keep that record — a restore time you measured is
evidence, a restore time you estimated is not.

## Detection, logging and incident evidence

DORA requires incidents to be detected, classified and — for major ones — reported to the
competent authority on a short clock. That works only if the underlying record exists.

The platform ships metrics collection, log aggregation, alerting and dashboards, and the
Kubernetes API server writes an audit log under a policy you supply. Two things to set
deliberately: retention, because defaults are shorter than a financial regulator will expect,
and the audit policy itself, per resource. Do not raise everything to full request and
response capture — that writes secrets and personal data into the log, creating a new problem
under GDPR while solving an old one here.

Security advisories for the platform are published openly, including assessments of
vulnerabilities that turn out not to affect it. That public record is directly usable in the
threat-intelligence and vulnerability-management parts of an ICT risk framework.

## Testing

DORA expects a programme of resilience testing, and for significant entities, threat-led
penetration testing.

Nothing in the platform obstructs it, and two things help. A tenant gives you an isolated
place to run destructive tests against a realistic copy rather than against production. And
because environments are described as manifests, the environment under test can be recreated
exactly, which is what makes a test result meaningful the second time.

The [CIS Benchmark](/compliance/cis-benchmark/) page shows one such test executed against a
live cluster, together with the reasoning that turns a raw report into something an assessor
can use.

## What stays with you

Governance sits with the management body and cannot be delegated to a supplier: the ICT risk
framework, the register of information, incident classification and reporting within the
regulation's deadlines, the digital operational resilience testing programme, contractual
arrangements with providers, and the exit strategy itself.

A platform can make each of those cheaper to satisfy. It cannot hold them.

## Frequently asked questions

### Is Cozystack DORA compliant?

The question does not apply to a platform. Financial entities are subject to DORA; platforms
are part of the ICT estate those entities manage. Cozystack contributes replication, live
migration, backup and restore, observability, audit logging and — most usefully for Chapter V
— an architecture with no vendor dependency to unwind.

### Does running on our own hardware remove ICT third-party risk?

It removes the platform vendor from the critical path, which is the largest single component
of that risk in most assessments. Hardware suppliers, datacenter operators and any integrator
you contract remain third parties and belong in the register.

### What about the right to audit?

The source code is public, and every claim on these compliance pages can be verified against
your own cluster with the commands published alongside it. Where you contract an operator,
audit rights belong in that contract.

### Can we test failure scenarios safely?

Yes. Run them in a dedicated tenant, isolated by network policy from everything else, and
recreate the environment from manifests between runs.

## Notes

This page describes Cozystack v1.6 as observed on a reference cluster in August 2026 and is
informational. It is not legal advice, not an assessment, and not a statement that any
configuration satisfies a competent authority. Regulation (EU) 2022/2554 applies to defined
categories of financial entity and their critical ICT providers; whether it applies to you,
and in what capacity, is a question for your own counsel.
