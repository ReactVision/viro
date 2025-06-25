# ViroReact New Architecture Migration Guide

This guide helps you migrate your ViroReact project to the **New Architecture (Fabric) required** version 2.43.1+.

## 🚨 **Breaking Change Notice**

**ViroReact 2.43.1+ requires React Native New Architecture (Fabric).** Legacy architecture support has been removed.

## 📋 **Prerequisites**

Before migrating, ensure you have:

- **React Native 0.76.9 or higher**
- **Node.js 18+ and npm 8+**
- **Xcode 15+ (for iOS)**
- **Android Studio with API 34+ (for Android)**

## 🔄 **Migration Steps**

### **Step 1: Update React Native**

Ensure you're using React Native 0.76.9 or higher:

```bash
npx react-native upgrade
```

### **Step 2: Enable New Architecture**

#### **For Android:**

1. Open `android/gradle.properties`
2. Add or update:
   ```properties
   newArchEnabled=true
   ```

#### **For iOS:**

1. Open `ios/.xcode.env`
2. Add or update:
   ```bash
   export RCT_NEW_ARCH_ENABLED=1
   ```

### **Step 3: Update ViroReact**

```bash
npm install @reactvision/react-viro@latest
```

### **Step 4: Clean and Rebuild**

#### **For iOS:**

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx react-native run-ios
```

#### **For Android:**

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### **Step 5: Update Expo Configuration (if using Expo)**

If you're using Expo, update your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      [
        "@reactvision/react-viro",
        {
          "ios": {
            "cameraUsagePermission": "This app uses the camera for AR features"
          },
          "android": {
            "xRMode": ["AR", "GVR"]
          }
        }
      ]
    ]
  }
}
```

## 🔧 **Code Changes Required**

### **✅ No Breaking API Changes**

The good news: **Your existing ViroReact code will work unchanged!** The component APIs remain identical.

```typescript
// This code works exactly the same in New Architecture
import { ViroARScene, ViroBox, ViroText } from '@reactvision/react-viro';

function MyARScene() {
  return (
    <ViroARScene>
      <ViroBox position={[0, 0, -1]} materials={["red"]} />
      <ViroText text="Hello AR!" position={[0, 1, -1]} />
    </ViroARScene>
  );
}
```

### **🔄 Import Changes (Optional)**

You can now explicitly import from the Fabric implementation:

```typescript
// Option 1: Standard import (recommended)
import { ViroARScene, ViroBox } from "@reactvision/react-viro";

// Option 2: Explicit Fabric import
import { ViroARScene, ViroBox } from "@reactvision/react-viro/fabric";
```

## 🚀 **Performance Improvements**

After migration, you'll benefit from:

### **✅ Faster Rendering**

- **50-70% faster** component updates
- **Direct JSI communication** eliminates bridge overhead
- **Concurrent rendering** support

### **✅ Better Memory Management**

- **Automatic cleanup** of unused resources
- **Scene lifecycle management**
- **Memory monitoring** and optimization

### **✅ Enhanced Developer Experience**

- **Better error messages** with stack traces
- **Improved debugging** capabilities
- **Type-safe** JSI functions

## 🛠️ **Troubleshooting**

### **"New Architecture not detected" Error**

**Symptoms:**

```
ViroReact: New Architecture (Fabric) is required but not detected.
```

**Solutions:**

1. Verify `newArchEnabled=true` in `android/gradle.properties`
2. Verify `RCT_NEW_ARCH_ENABLED=1` in `ios/.xcode.env`
3. Clean and rebuild your project
4. Ensure React Native version is 0.76.9+

### **"ViroFabricContainerView not available" Error**

**Symptoms:**

```
ViroFabricContainerView is not available. Make sure you have installed the native module properly.
```

**Solutions:**

1. **iOS:** Run `cd ios && pod install`
2. **Android:** Verify fabric-interop is in `settings.gradle`
3. Clean and rebuild
4. Check that New Architecture is actually enabled

### **Build Errors After Migration**

**Common Issues:**

1. **Podfile conflicts:**

   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   ```

2. **Gradle cache issues:**

   ```bash
   cd android
   ./gradlew clean
   rm -rf .gradle
   ./gradlew build
   ```

3. **Metro cache issues:**
   ```bash
   npx react-native start --reset-cache
   ```

### **Performance Issues**

If you experience performance issues:

1. **Check memory usage:**

   ```typescript
   import { getMemoryStats } from "@reactvision/react-viro";
   console.log(getMemoryStats());
   ```

2. **Force cleanup:**
   ```typescript
   import { performMemoryCleanup } from "@reactvision/react-viro";
   performMemoryCleanup();
   ```

## 📱 **Platform-Specific Notes**

### **iOS Considerations**

- **Minimum iOS version:** 12.0
- **Xcode version:** 15.0+
- **CocoaPods:** Ensure you're using the latest version
- **Simulator:** New Architecture works on both device and simulator

### **Android Considerations**

- **Minimum SDK:** 24 (Android 7.0)
- **Target SDK:** 34
- **NDK:** Ensure you have NDK installed for C++ compilation
- **Gradle:** Version 8.0+ recommended

## 🔍 **Validation**

After migration, validate your setup:

### **1. Check New Architecture Detection**

```typescript
import { isViroJSIAvailable } from "@reactvision/react-viro";

console.log("JSI Available:", isViroJSIAvailable());
// Should log: JSI Available: true
```

### **2. Test Basic Functionality**

```typescript
import { ViroARScene, ViroBox } from '@reactvision/react-viro';

// This should render without errors
function TestScene() {
  return (
    <ViroARScene>
      <ViroBox position={[0, 0, -1]} />
    </ViroARScene>
  );
}
```

### **3. Run Build Validation**

```bash
cd node_modules/@reactvision/react-viro/fabric-interop
npm run validate
```

## 📚 **Additional Resources**

### **React Native New Architecture**

- [Official New Architecture Guide](https://reactnative.dev/docs/new-architecture-intro)
- [Fabric Renderer Documentation](https://reactnative.dev/docs/fabric-renderer)
- [TurboModules Documentation](https://reactnative.dev/docs/turbo-modules)

### **ViroReact Documentation**

- [ViroReact Installation Guide](https://viro-community.readme.io/docs/installation-instructions)
- [Component API Reference](https://viro-community.readme.io/docs/virobox)
- [GitHub Repository](https://github.com/ReactVision/viro)

## 🆘 **Getting Help**

If you encounter issues during migration:

1. **Check the troubleshooting section** above
2. **Search existing issues** on [GitHub](https://github.com/ReactVision/viro/issues)
3. **Create a new issue** with:
   - React Native version
   - ViroReact version
   - Platform (iOS/Android)
   - Error messages
   - Steps to reproduce

## 🎉 **Migration Complete!**

Once migration is complete, you'll have:

✅ **New Architecture enabled**
✅ **ViroReact 2.43.1+ installed**
✅ **Improved performance**
✅ **Future-proof setup**
✅ **Better developer experience**

Welcome to the future of ViroReact! 🚀

---

**Need help?** Join our community discussions or create an issue on GitHub.
