---
title: "Building a Windows Golden Image with Packer"
linkTitle: "Windows Golden Images"
description: "How to build a customized Windows Server golden image (pre-installed software, autologon, RDP) with Packer and register it in Cozystack as a reusable VM image."
weight: 55
---

[Running Windows VMs]({{% ref "windows.md" %}}) shows how to boot and install a Windows VM by hand (including the Virtio drivers). This guide is the automated counterpart: it bakes a Windows Server install plus your software and configuration into **one reusable image** with [Packer](https://www.packer.io/), so every VM clones from a prepared disk instead of being installed from scratch.

The [Golden Images]({{% ref "vm-image.md" %}}) guide covers *named* images cached from an HTTP(S) URL — the `vm-default-images` collection and custom entries added with `cdi_golden_image_create.sh`. That model fits cloud images that already exist as a single downloadable disk (most Linux cloud images do). A customized Windows image cannot be expressed as a plain download URL, so you build it with Packer against the KubeVirt builder, capture the configured disk, and register that disk instead.

## When to use this

- The image needs software or configuration baked in (an application, Office, drivers, autologon), so a bare cloud-image URL will not do.
- An installer is interactive or licensed and cannot be scripted end-to-end.
- You want one prepared Windows disk that many VMs clone from, instead of re-installing per VM.

For a bare, unmodified base that *is* reachable by URL, prefer the simpler [`vm-default-images`]({{% ref "vm-image.md" %}}) path instead.

## Prerequisites

- `packer`, plus the **KubeVirt builder plugin**. It is a community plugin (not published by HashiCorp), so `packer init` cannot fetch it — install the binary manually and run `packer build` directly.
- A `KUBECONFIG` pointing at the target cluster, with access to a tenant namespace (e.g. `tenant-root`).
- The Windows installation ISO staged as a DataVolume so the builder can boot from it. A minimal DataVolume manifest referencing the ISO source is enough:

```bash
kubectl apply -f win2022-iso-dv.yaml
```

## Build outline

Your Packer project holds the build definition (`.pkr.hcl`), an unattended-install answer file (`autounattend.xml`), and the guest-provisioning scripts. In outline:

1. Stage the Windows Server ISO as a DataVolume (step above).
2. Run the build — it boots the VM from the ISO via the unattended-install answer file, then provisions the guest (software, RDP, no-sleep, autologon):

```bash
export KUBECONFIG=/path/to/kubeconfig
export PKR_VAR_build_password='<throwaway-build-password>'   # must match the answer file
packer build .
```

3. **Interactive software step (if any).** Installers that are not silent cannot be scripted. RDP into the running VM (autologon gives you a logged-in desktop), install the software through its GUI, verify it, then sign out.
4. A final hardening provisioner reverts the build-time WinRM/RDP relaxations (turns basic/unencrypted auth off, drops the temporary firewall rule, re-enables NLA) and strips any baked autologon password, so none of the build-time weakening ships in the golden.
5. Capture the configured VM disk as the golden.

{{% alert title="Never bake credentials or licences" color="warning" %}}

The build-time Administrator/WinRM password is a throwaway placeholder in the answer file — change it per build and reset it at deploy. The autologon password is not baked: inject it at deploy time or use Sysinternals `Autologon.exe` (which stores it as an encrypted LSA secret). Any application credentials are entered by hand in the running VM, never committed to the image or to Git.

{{% /alert %}}

{{% alert title="Sysprep on evaluation media" color="warning" %}}

On the Windows Server evaluation ISO, `sysprep /generalize` can crash (`spopk.dll`). If it does, capture the golden **without** generalize — but then clones share the same SID and computer name, which is acceptable only for a single VM; assign a unique name per clone if you run several. A purchased licence and non-evaluation media are required for production use.

{{% /alert %}}

## Register the image in Cozystack

Once you have a captured Windows disk, make it reusable one of two ways:

- **As a cloneable `vm-disk` (recommended for customized disks).** Keep the captured disk as a reference `VMDisk`, then create each VM from a **copy-clone** of it — see [Cloneable Virtual Machines]({{% ref "cloneable-vms.md" %}}). Use `cloneType: copy` (not snapshot) so each VM gets an independent disk. This is the right choice for a customized Windows image, whose disk is not a single public URL.
- **As a `vm-default-images` collection entry.** This path caches an image from a public HTTP(S) URL — see [Golden Images]({{% ref "vm-image.md" %}}). It suits a *bare* base image reachable by URL, not a customized captured disk.

## Create and access the VM

Create a `VMInstance` from a copy-clone of the reference disk:

```bash
kubectl -n tenant-root create -f- <<EOF
apiVersion: apps.cozystack.io/v1alpha1
kind: VMInstance
metadata:
  name: windows
spec:
  disks:
  - name: windows
EOF
```

Access the desktop over VNC or an RDP port-forward:

```bash
virtctl vnc vm-instance-windows -n tenant-root
# or forward RDP (3389) and connect with an RDP client
```

Autologon lands you on a ready desktop.

{{% alert title="Stopping the VM" color="info" %}}

Stop a Windows VM built this way with `virtctl stop --force` — a graceful ACPI stop does not always work reliably on it.

{{% /alert %}}
