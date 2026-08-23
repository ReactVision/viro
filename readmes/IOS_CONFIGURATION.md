# iOS Configuration Options

This guide covers the iOS-specific configuration options available in the `@reactvision/react-viro` Expo plugin.

## Table of Contents

- [Framework Linkage](#framework-linkage)
- [ARCore SDK (Optional)](#arcore-sdk-optional)
- [Configuration Examples](#configuration-examples)
- [Runtime Feature Detection](#runtime-feature-detection)
- [Configuration Reference](#configuration-reference)

---

## Framework Linkage

The `iosLinkage` option controls how iOS frameworks are linked in your app.

```json
{
  "expo": {
    "plugins": [
      ["@reactvision/react-viro", {
        "iosLinkage": "static"
      }]
    ]
  }
}
```

| Value | Description |
|-------|-------------|
| `"static"` | Static frameworks. Faster launch time, single binary. |
| `"dynamic"` | Dynamic frameworks. Required when using ARCore SDK. |
| *(not set)* | Uses project default. |

> **Note:** If ARCore is included (via `ios.includeARCore` or cloud/geospatial providers), `iosLinkage` is automatically set to `"dynamic"` regardless of your configuration.

---

## ARCore SDK (Optional)

ViroReact is built with **optional ARCore support** via weak linking. This means you can choose whether to include ARCore features in your app, allowing you to optimize for app size when ARCore features aren't needed.

### How Weak Linking Works

When you enable ARCore in your app configuration, the Expo plugin:
1. Adds ARCore pods to your `Podfile`
2. Automatically inserts a `post_install` hook that converts ARCore framework links from strong to weak
3. This makes ARCore **runtime-optional** even when the pods are included in your build

This allows you to:
- Build app variants with/without ARCore from the same source
- Use App Store features like on-demand resources
- Have ARCore degrade gracefully if frameworks are unavailable

### Without ARCore (Smaller App Size)

```json
{
  "expo": {
    "plugins": [
      ["@reactvision/react-viro", {
        "iosLinkage": "static"
      }]
    ]
  }
}
```

**What works:**
- Basic AR features (plane detection, hit testing, etc.)
- Image tracking
- Object tracking
- All VR features

**What's disabled:**
- Cloud Anchors (shared AR experiences)
- Geospatial API (location-based AR)
- Scene Semantics (ML-based scene understanding)

**Benefits:**
- ~15-20MB smaller app binary
- Faster build times
- No Google Cloud API key required

### With ARCore (Full Features)

To enable all ARCore features, set `ios.includeARCore` to `true`:

```json
{
  "expo": {
    "plugins": [
      ["@reactvision/react-viro", {
        "ios": {
          "includeARCore": true
        },
        "googleCloudApiKey": "YOUR_GOOGLE_CLOUD_API_KEY"
      }]
    ]
  }
}
```

**What's enabled:**
- Cloud Anchors for shared AR experiences
- Geospatial API for location-based AR
- Scene Semantics for ML-based scene understanding

**Requirements:**
- Dynamic framework linkage (set automatically)
- Google Cloud API key with ARCore API enabled
- Larger app binary

### With Specific ARCore Features

Instead of using `ios.includeARCore`, you can enable specific providers which will automatically include the necessary ARCore pods:

```json
{
  "expo": {
    "plugins": [
      ["@reactvision/react-viro", {
        "cloudAnchorProvider": "arcore",
        "geospatialAnchorProvider": "arcore",
        "googleCloudApiKey": "YOUR_GOOGLE_CLOUD_API_KEY"
      }]
    ]
  }
}
```

This approach:
- Automatically includes ARCore SDK
- Sets up required Info.plist entries
- Configures location permissions (for Geospatial)

---

## Configuration Examples

### Minimal Setup (No ARCore)

Best for apps that only need basic AR features:

```json
{
  "expo": {
    "name": "MyARApp",
    "plugins": [
      ["@reactvision/react-viro", {
        "iosLinkage": "static"
      }]
    ]
  }
}
```

### Cloud Anchors Only

For shared AR experiences without geospatial features:

```json
{
  "expo": {
    "name": "MyARApp",
    "plugins": [
      ["@reactvision/react-viro", {
        "cloudAnchorProvider": "arcore",
        "googleCloudApiKey": "AIza..."
      }]
    ]
  }
}
```

### Full ARCore Features

Complete setup with all ARCore capabilities:

```json
{
  "expo": {
    "name": "MyARApp",
    "plugins": [
      ["@reactvision/react-viro", {
        "ios": {
          "includeARCore": true,
          "cameraUsagePermission": "This app uses the camera for AR experiences",
          "locationUsagePermission": "This app uses your location for AR experiences"
        },
        "cloudAnchorProvider": "arcore",
        "geospatialAnchorProvider": "arcore",
        "googleCloudApiKey": "AIza..."
      }]
    ]
  }
}
```

### Custom Permissions

Customize the permission messages shown to users:

```json
{
  "expo": {
    "plugins": [
      ["@reactvision/react-viro", {
        "ios": {
          "cameraUsagePermission": "We need camera access to show AR content",
          "microphoneUsagePermission": "We need microphone access for voice commands",
          "photosPermission": "We need photo access to save AR screenshots",
          "savePhotosPermission": "We need permission to save AR screenshots",
          "locationUsagePermission": "We need location for geospatial AR features"
        }
      }]
    ]
  }
}
```

---

## Runtime Feature Detection

ARCore features gracefully degrade when the SDK is not included. You can check availability at runtime:

```typescript
// Cloud Anchors and Geospatial features will return
// isAvailable = false if ARCore pods are not included.
// Your app should handle this gracefully.

// Example: Check before using cloud anchors
const handleCloudAnchor = async () => {
  try {
    // Attempt to use cloud anchor feature
    // Will fail gracefully if ARCore not available
  } catch (error) {
    console.log('Cloud Anchors not available');
  }
};
```

---

## Configuration Reference

### Top-Level Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `iosLinkage` | `"static"` \| `"dynamic"` | *(project default)* | Framework linking type |
| `cloudAnchorProvider` | `"none"` \| `"arcore"` | `"none"` | Cloud anchor provider (auto-enables ARCore) |
| `geospatialAnchorProvider` | `"none"` \| `"arcore"` | `"none"` | Geospatial provider (auto-enables ARCore) |
| `googleCloudApiKey` | `string` | — | Google Cloud API key (required for ARCore features) |

### iOS-Specific Options (`ios.*`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeARCore` | `boolean` | `false` | Explicitly include ARCore SDK pods |
| `cameraUsagePermission` | `string` | `"Allow $(PRODUCT_NAME) to use your camera"` | Camera permission message |
| `microphoneUsagePermission` | `string` | `"Allow $(PRODUCT_NAME) to use your microphone"` | Microphone permission message |
| `photosPermission` | `string` | `"Allow $(PRODUCT_NAME) to access your photos"` | Photo library read permission |
| `savePhotosPermission` | `string` | `"Allow $(PRODUCT_NAME) to save photos"` | Photo library write permission |
| `locationUsagePermission` | `string` | `"Allow $(PRODUCT_NAME) to use your location for AR experiences"` | Location permission message |

---

## Troubleshooting

### "Framework not found ARCore"

This error occurs when ARCore features are used but the SDK is not included. Either:
1. Set `ios.includeARCore: true`
2. Or set `cloudAnchorProvider: "arcore"` or `geospatialAnchorProvider: "arcore"`

### Verifying Weak Linking is Working

After running `npx expo prebuild` or `npx pod-install`, you can verify weak linking is properly configured:

```bash
# Check your app target's xcconfig for weak framework flags
cat ios/Pods/Target\ Support\ Files/Pods-YourApp/Pods-YourApp.debug.xcconfig | grep ARCore
```

You should see `-weak_framework` instead of `-framework` for all ARCore frameworks:
```
OTHER_LDFLAGS = ... -weak_framework "ARCoreBase" -weak_framework "ARCoreCloudAnchors" ...
```

If you see strong `-framework` flags instead, the post_install hook may not be executing properly.

### Testing Runtime Weak Linking

To verify ARCore is truly optional at runtime:
1. Build your app with ARCore enabled
2. Check that `ViroARSceneNavigator` initializes successfully
3. ARCore features should report `isAvailable = false` if you manually remove ARCore frameworks from the bundle (advanced testing only)

### Pod Install Fails with UTF-8 Error

If you see "invalid byte sequence in UTF-8" during `pod install`, convert binary plists to XML:

```bash
cd ios/Pods
find . -name "Info.plist" -exec plutil -convert xml1 {} \;
```

### Dynamic Framework Required

If you see errors about framework linkage when using ARCore, ensure you're not forcing static linkage:

```json
{
  "plugins": [
    ["@reactvision/react-viro", {
      "ios": { "includeARCore": true }
      // Don't set iosLinkage: "static" when using ARCore
    }]
  ]
}
```

---

## See Also

- [Installation Guide](./INSTALL.md)
- [ARCore Cloud Anchors Documentation](https://developers.google.com/ar/develop/cloud-anchors)
- [ARCore Geospatial API Documentation](https://developers.google.com/ar/develop/geospatial)
