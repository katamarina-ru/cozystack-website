---
title: Backup and Recovery
linkTitle: Backup and Recovery
description: "How to create and manage backups of VMInstance and VMDisk resources using BackupJobs and Plans."
weight: 40
aliases:
  - /docs/v1/guides/backups
  - /docs/v1/kubernetes/backup-and-recovery
---

Cluster backup **strategies** and **BackupClasses** are configured by cluster administrators. If your tenant does not have a BackupClass yet, ask your administrator to follow the [Velero Backup Configuration]({{% ref "/docs/v1/operations/services/velero-backup-configuration" %}}) guide to set up storage, strategies, and BackupClasses.

This guide covers backing up and restoring **VMInstance** and **VMDisk** resources as a tenant user: running one-off and scheduled backups, checking backup status, and restoring from a backup using RestoreJobs.

Cozystack uses [Velero](https://velero.io/docs/v1.17/) under the hood for backup storage and volume snapshots.

## Prerequisites

- The Velero add-on is enabled for your cluster (by an administrator).
- At least one **BackupClass** is available for your tenant namespace (provided by an administrator).
- `kubectl` and kubeconfig for the cluster you are backing up.

## List available BackupClasses

BackupClasses define where and how backups are stored. You can only use those that administrators have created.

```bash
kubectl get backupclasses
```

Example output:

```
NAME     AGE
velero   14m
```

Use the BackupClass name when creating a BackupJob or Plan.

## Back up a VMInstance

A VMInstance backup captures the VM configuration and all attached VMDisk volumes.

### One-off backup

Use a **BackupJob** when you want to run a backup once — for example, before a risky change.

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: my-vm-backup
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMInstance
    name: my-vm
  backupClassName: velero
```

Apply it and watch the status:

```bash
kubectl apply -f backupjob.yaml
kubectl get backupjobs -n tenant-user
kubectl describe backupjob my-vm-backup -n tenant-user
```

When the BackupJob completes successfully, it creates a **Backup** object with the same name (`my-vm-backup`). You will use that name when restoring.

### Scheduled backup

Use a **Plan** to run backups on a schedule.

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: Plan
metadata:
  name: my-vm-daily
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMInstance
    name: my-vm
  backupClassName: velero
  schedule:
    cron: "0 2 * * *"   # Every day at 02:00
```

Apply it and check:

```bash
kubectl apply -f plan.yaml
kubectl get plans -n tenant-user
kubectl describe plan my-vm-daily -n tenant-user
```

Each scheduled run creates a BackupJob (and, on success, a Backup object) named after the Plan with a timestamp suffix.

## Back up a VMDisk

You can back up a VMDisk independently — for example, to capture a specific disk without the VM configuration.

{{% alert color="info" %}}
The BackupClass must include a strategy for `VMDisk`. Ask your administrator to add one if it is missing (see [Velero Backup Configuration]({{% ref "/docs/v1/operations/services/velero-backup-configuration" %}})).
{{% /alert %}}

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: BackupJob
metadata:
  name: my-disk-backup
  namespace: tenant-user
spec:
  applicationRef:
    apiGroup: apps.cozystack.io
    kind: VMDisk
    name: my-disk
  backupClassName: velero
```

Apply and check status:

```bash
kubectl apply -f backupjob-disk.yaml
kubectl get backupjobs -n tenant-user
kubectl describe backupjob my-disk-backup -n tenant-user
```

## Check backup status

List all BackupJobs in a namespace:

```bash
kubectl get backupjobs -n tenant-user
```

Describe a specific BackupJob to see phase and any errors:

```bash
kubectl describe backupjob my-vm-backup -n tenant-user
```

List the Backup objects that were produced (one per completed BackupJob):

```bash
kubectl get backups -n tenant-user
```

List BackupJobs created by a Plan:

```bash
kubectl get backupjobs -n tenant-user -l backups.cozystack.io/plan=my-vm-daily
```

## Restore a VMInstance in place

An in-place restore updates the existing VMInstance configuration from a backup. Use this when you want to roll back a running VM to a previous state.

{{% alert color="warning" %}}
Velero skips existing DataVolumes during restore to avoid overwriting live data. If you need to restore the actual disk contents from the backup, delete the DataVolumes before creating the RestoreJob. Use the disk names from the VMInstance spec to find them:

```bash
# List disk names for the VM
kubectl get vminstance my-vm -n tenant-user -o jsonpath='{.spec.disks[*].name}'

# Delete the corresponding DataVolumes (one per disk, prefixed with vm-disk-)
kubectl delete datavolume vm-disk-<disk-name> -n tenant-user
```

The RestoreJob will then recreate the DataVolumes and download disk data from the backup storage.
{{% /alert %}}

First, find the Backup object you want to restore from:

```bash
kubectl get backups -n tenant-user
```

Example output:

```
NAME            AGE
my-vm-backup    2h
```

Create a RestoreJob referencing that Backup:

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: restore-my-vm
  namespace: tenant-user
spec:
  backupRef:
    name: my-vm-backup
```

Apply it and check progress:

```bash
kubectl apply -f restorejob.yaml
kubectl get restorejobs -n tenant-user
kubectl describe restorejob restore-my-vm -n tenant-user
```

The RestoreJob goes through `Pending` → `Running` → `Succeeded` (or `Failed`). On success, the VMInstance and its VMDisks are restored to the state captured in the backup.

If you want to restore into a **different** VMInstance, add `targetApplicationRef` to the spec pointing at that application.

## Restore a VMDisk in place

To restore only a VMDisk without touching the VM configuration.

{{% alert color="warning" %}}
Velero skips an existing DataVolume during restore. To restore the actual disk contents from the backup, delete the DataVolume first:

```bash
kubectl delete datavolume vm-disk-my-disk -n tenant-user
```

The RestoreJob will then recreate it and download disk data from the backup storage.
{{% /alert %}}

```bash
kubectl get backups -n tenant-user
```

```yaml
apiVersion: backups.cozystack.io/v1alpha1
kind: RestoreJob
metadata:
  name: restore-my-disk
  namespace: tenant-user
spec:
  backupRef:
    name: my-disk-backup
```

Apply and check:

```bash
kubectl apply -f restorejob-disk.yaml
kubectl get restorejobs -n tenant-user
kubectl describe restorejob restore-my-disk -n tenant-user
```

## Troubleshooting

If a BackupJob or RestoreJob ends in `Failed` phase, check the `message` field in its status:

```bash
kubectl get backupjob my-vm-backup -n tenant-user -o jsonpath='{.status.message}'
kubectl get restorejob restore-my-vm -n tenant-user -o jsonpath='{.status.message}'
```

For lower-level details, check the Velero logs in the management cluster:

```bash
kubectl logs -n cozy-velero -l app.kubernetes.io/name=velero --tail=100
```
