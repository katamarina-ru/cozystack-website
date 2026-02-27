---
title: Backup and Recovery
linkTitle: Backup and Recovery
description: "How to create and manage backups in your Kubernetes cluster using BackupJobs and Plans."
weight: 40
aliases:
  - /docs/v1/guides/backups
---

Cluster backup **strategies** and **BackupClasses** are configured by cluster administrators. If your tenant does not have a BackupClass yet, ask your administrator to follow the [Velero Backup Configuration]({{% ref "/docs/v1/operations/services/velero-backup-configuration" %}}) guide to set up storage, strategies, and BackupClasses.

This guide is for **tenant users**: how to run one-off and scheduled backups using existing BackupClasses, check backup status, and where to look for restore options.

Cozystack uses [Velero](https://velero.io/docs/v1.17/) under the hood. Backups and restores run in the `cozy-velero` namespace (management cluster) or the equivalent namespace in your tenant cluster, depending on your setup.

## Prerequisites

- The Velero add-on is enabled for your cluster (by an administrator).
- At least one **BackupClass** is available for your tenant or namespace (provided by an administrator).
- `kubectl` and kubeconfig for the cluster you are backing up.

## 1. List available BackupClasses

BackupClasses define where and how backups are stored. You can only use those that administrators have created and made available to you.
Check available BackupClass **names**, and use in the next steps when creating a BackupJob or Plan.

```bash
kubectl get backupclasses
NAME                   AGE
velero                 14m     
```

## 2. Create a one-off backup (BackupJob)

Use a **BackupJob** when you want to run a backup once (for example, before a risky change).

Example BackupJob for VMInstance:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: my-manual-backup
  namespace: tenant-root
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMInstance
    name: vm1
  backupClassName: velero
```

Apply and check status:

```bash
kubectl apply -f backupjob.yaml
kubectl get backupjobs -n tenant-root
kubectl describe backupjob my-manual-backup -n tenant-root
```

## 3. Create scheduled backups (Plan)

Use a **Plan** to run backups on a schedule (e.g. daily or every 6 hours).

Example:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: Plan
metadata:
  name: my-backup-plan
  namespace: tenant-root
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMInstance
    name: vm1
  backupClassName: velero
  schedule: "0 */6 * * *"   # Every 6 hours (cron)
```

Apply and check:

```bash
kubectl apply -f plan.yaml
kubectl get plans -n tenant-root
kubectl describe plan my-backup-plan -n tenant-root
kubectl get backups.velero.io -n tenant-root
```

## 4. Check backup status

- **BackupJobs**: `kubectl get backupjobs -n tenant-root` and `kubectl describe backupjob <name> -n tenant-root`
- **Plans**: `kubectl get plans -n tenant-root` and `kubectl describe plan <name> -n tenant-root`
- **Velero backups**: `kubectl get backups.velero.io -n tenant-root`
