---
title: "White Labeling"
linkTitle: "White Labeling"
description: "Customize branding elements in the Cozystack Dashboard and Keycloak authentication pages"
weight: 50
---

White labeling allows you to replace default Cozystack branding with your own logos, text, and colors across the Dashboard UI and Keycloak authentication pages.

## Overview

Branding is configured through the `branding` field in the Platform Package (`spec.components.platform.values.branding`). The configuration propagates automatically to:

- **Dashboard**: logo, page title, footer text, favicon, and tenant identifier
- **Keycloak**: realm display name on authentication pages

## Configuration

Edit your Platform Package to add or update the `branding` section:

```yaml
apiVersion: cozystack.io/v1alpha1
kind: Package
metadata:
  name: cozystack.cozystack-platform
  namespace: cozy-system
spec:
  variant: isp-full
  components:
    platform:
      values:
        branding:
          # Dashboard branding
          titleText: "My Company Dashboard"
          footerText: "My Company Platform"
          tenantText: "Production v1.0"
          logoText: ""
          logoSvg: "<base64-encoded SVG>"
          iconSvg: "<base64-encoded SVG>"
          # Keycloak branding
          brandName: "My Company"
          brandHtmlName: "<div style='font-weight:bold;'>My Company</div>"
```

Apply the changes:

```bash
kubectl apply --filename platform-package.yaml
```

## Configuration Fields

### Dashboard Fields

| Field | Default | Description |
| --- | --- | --- |
| `titleText` | `Cozystack Dashboard` | Browser tab title and Dashboard header text. |
| `footerText` | `Cozystack` | Text displayed in the Dashboard footer. |
| `tenantText` | Platform version string | Version or tenant identifier displayed in the Dashboard. |
| `logoText` | `""` (empty) | Alternative text-based logo. Used when SVG logo is not provided. |
| `logoSvg` | Cozystack logo (base64) | Base64-encoded SVG logo displayed in the Dashboard header. |
| `iconSvg` | Cozystack icon (base64) | Base64-encoded SVG icon used as the browser favicon. |

### Keycloak Fields

| Field | Default | Description |
| --- | --- | --- |
| `brandName` | Not set | Plain text realm name displayed in the Keycloak browser tab. |
| `brandHtmlName` | Not set | HTML-formatted realm name displayed on Keycloak login pages. Supports inline HTML/CSS for styled branding. |

## Preparing SVG Logos

### Theme-Aware SVG Variables

The Dashboard supports template variables in SVG content that adapt to light and dark themes:

- `{token.colorText}` — replaced at runtime with the current theme's text color

Example SVG using theme-aware variables:

```xml
<svg width="150" height="30" viewBox="0 0 150 30" fill="none"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M10 5h30v20H10z" fill={token.colorText} />
  <text x="50" y="20" fill={token.colorText}>My Company</text>
</svg>
```

### Converting SVG to Base64

Encode your SVG files to base64 strings:

```bash
# Linux
base64 --wrap=0 logo.svg

# macOS
base64 --input logo.svg
```

### Example Workflow

```bash
# Encode logos
LOGO_B64=$(base64 --input logo.svg)
ICON_B64=$(base64 --input icon.svg)

# Patch the Platform Package
kubectl patch package cozystack.cozystack-platform \
  --namespace cozy-system \
  --type merge \
  --patch "{
    \"spec\": {
      \"components\": {
        \"platform\": {
          \"values\": {
            \"branding\": {
              \"logoSvg\": \"$LOGO_B64\",
              \"iconSvg\": \"$ICON_B64\"
            }
          }
        }
      }
    }
  }"
```

## Verification

After applying changes, verify that branding is correctly configured:

1. **Check the Platform Package**:

   ```bash
   kubectl get package cozystack.cozystack-platform \
     --namespace cozy-system \
     --output jsonpath='{.spec.components.platform.values.branding}' | jq .
   ```

2. **Dashboard**: open the Dashboard URL and verify the logo, title, footer, and favicon.

3. **Keycloak**: open the Keycloak login page and verify the realm display name.

{{< note >}}
You may need to hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or clear browser cache to see updated branding.
{{< /note >}}

## Migration from v0

In Cozystack v0, branding was configured via a standalone `cozystack-branding` ConfigMap in the `cozy-system` namespace. In v1, this ConfigMap is no longer used. The [migration script](/docs/v1/operations/upgrades/) automatically converts the old ConfigMap values into the Platform Package `branding` field.

If you previously used the ConfigMap approach, no manual migration is needed — the upgrade process handles it automatically.
