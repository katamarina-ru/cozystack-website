---
title: "Frequently asked questions"
linkTitle: "FAQ"
description: "Flux and the GitOps Toolkit frequently asked questions."
weight: 144
---

{{% alert title="Troubleshooting" %}}
Troubleshooting advice can be found on our [Troubleshooting Cheatsheet](/docs/troubleshooting/).
{{% /alert %}}

## General questions

### Bundles

#### How to overwrite parameters for specific components

You might want to overwrite specific options for the components.
To achieve this, you must specify values in JSON or YAML format using the values-<component> option.

For example, if you want to overwrite `k8sServiceHost` and `k8sServicePort` for cilium,
take a look at its [values.yaml](https://github.com/aenix-io/cozystack/blob/238061efbc0da61d60068f5de31d6eaa35c4d994/packages/system/cilium/values.yaml#L18-L19) file.

Then specify these options in the `values-cilium` section of your Cozystack configuration, as shown below:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cozystack
  namespace: cozy-system
data:
  bundle-name: "distro-full"
  ipv4-pod-cidr: "10.244.0.0/16"
  ipv4-svc-cidr: "10.96.0.0/16"
  values-cilium: |
    cilium:
      k8sServiceHost: 11.22.33.44
      k8sServicePort: 6443
```

#### How to disable some components from bundle

Sometimes you may need to disable specific components within a bundle.
To do this, use the `bundle-disable` option and provide a comma-separated list of the components you want to disable. For example:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cozystack
  namespace: cozy-system
data:
  bundle-name: "paas-full"
  bundle-disable: "linstor,dashboard"
  ipv4-pod-cidr: "10.244.0.0/16"
  ipv4-svc-cidr: "10.96.0.0/16"
```

{{% alert color="warning" %}}
:warning: Disabling components using this option will not remove them if they are already installed. To remove them, you must delete the Helm release manually using the `kubectl delete hr -n <namespace> <component>` command.
{{% /alert %}}
