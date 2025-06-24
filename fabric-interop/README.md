# ViroReact Fabric Interop Layer

This directory contains the **New Architecture (Fabric) interop layer** for ViroReact. As of version 2.43.1, ViroReact **requires React Native New Architecture** to be enabled.

## 🚀 **New Architecture Required**

**IMPORTANT:** This library only works with React Native's New Architecture (Fabric). Legacy architecture support has been removed.

### **Minimum Requirements:**

- **React Native 0.76.9+**
- **New Architecture enabled** (`newArchEnabled=true`)
- **Fabric UI Manager** available at runtime

## 📦 **What's Included**

### **JavaScript Layer**

- **`NativeViro.ts`** - JSI bridge functions for direct native communication
- **`ViroGlobal.ts`** - Type-safe access to the global NativeViro object
- **`ViroFabricContainer.tsx`** - Main container component for Fabric
- **`components/`** - All 42+ ViroReact components updated for New Architecture

### **Native iOS Implementation**

- **`ViroFabricJSI.h/.mm`** - JSI bridge implementation
- **`ViroFabricContainer.mm`** - iOS Fabric container
- **`ViroFabricSceneManager.mm`** - Scene lifecycle management
- **`ViroFabricManager.mm`** - Event handling system
- **`ViroFabric.podspec`** - CocoaPods specification

### **Native Android Implementation**

- **`ViroFabricContainerJSI.cpp`** - JSI bridge with JNI
- **`ViroFabricContainer.java`** - Android Fabric container
- **`ViroFabricSceneManager.java`** - Scene lifecycle management
- **`build.gradle`** - Android build configuration
- **`CMakeLists.txt`** - C++ build configuration

## 🔧 **Setup Instructions**

### **1. Enable New Architecture**

#### **Android:**

Add to `android/gradle.properties`:

```properties
newArchEnabled=true
```

#### **iOS:**

Add to `ios/.xcode.env`:

```bash
export RCT_NEW_ARCH_ENABLED=1
```

### **2. Install Dependencies**

```bash
npm install @reactvision/react-viro
cd ios && pod install
```

### **3. Usage**

```typescript
import { ViroARScene, ViroBox } from '@reactvision/react-viro';

// Components automatically use the Fabric implementation
function MyARScene() {
  return (
    <ViroARScene>
      <ViroBox position={[0, 0, -1]} />
    </ViroARScene>
  );
}
```

## 🏗️ **Architecture Overview**

### **Component Flow:**

```
React Component → ViroFabricContainer → JSI Bridge → Native ViroReact
```

### **Event Flow:**

```
Native Event → JSI Callback → JavaScript Handler → React Component
```

### **Memory Management:**

- Automatic cleanup on component unmount
- Scene lifecycle management
- Memory monitoring and optimization

## 🔍 **Key Features**

### **✅ Performance Benefits**

- **Direct JSI communication** - No bridge serialization overhead
- **Individual property updates** - Only changed properties are sent
- **Optimized rendering** - Fabric's concurrent rendering support

### **✅ Developer Experience**

- **Zero breaking changes** - Existing ViroReact code works unchanged
- **Enhanced debugging** - Better error messages and logging
- **Type safety** - Complete TypeScript support

### **✅ Future-Proof**

- **New Architecture first** - Aligned with React Native's direction
- **Fabric optimized** - Built specifically for the new renderer
- **Maintainable** - Single implementation path

## 📋 **Component Support**

All ViroReact components are supported:

### **Basic Components**

- ViroNode, ViroScene, ViroARScene, ViroFlexView

### **3D Primitives**

- ViroBox, ViroSphere, Viro3DObject, ViroGeometry, ViroQuad, ViroPolygon, ViroPolyline, ViroSurface

### **2D Components**

- ViroText, ViroImage, ViroVideo, ViroAnimatedImage

### **360 Components**

- Viro360Image, Viro360Video, ViroSkyBox

### **Lighting**

- ViroAmbientLight, ViroDirectionalLight, ViroSpotLight, ViroOmniLight, ViroLightingEnvironment

### **Audio**

- ViroSound, ViroSoundField, ViroSpatialSound

### **Interactive**

- ViroButton, ViroController, ViroSpinner

### **Effects**

- ViroParticleEmitter, ViroAnimatedComponent, ViroMaterialVideo

### **Scene Navigators**

- ViroSceneNavigator, ViroVRSceneNavigator, ViroARSceneNavigator, Viro3DSceneNavigator

### **AR Components**

- ViroARCamera, ViroARPlane, ViroARPlaneSelector, ViroARImageMarker, ViroARObjectMarker

## 🛠️ **Build Configuration**

### **Package.json Integration**

The main package now points directly to fabric-interop:

```json
{
  "main": "fabric-interop/dist/index.js",
  "types": "fabric-interop/dist/index.d.ts"
}
```

### **Expo Plugin Support**

The Expo plugin automatically:

- Validates New Architecture is enabled
- Configures native dependencies
- Sets up proper build flags

### **Metro Configuration**

No special Metro configuration required - the fabric-interop layer is automatically used.

## 🔧 **Troubleshooting**

### **"New Architecture not detected" Error**

**Solution:** Ensure New Architecture is properly enabled:

1. Check `android/gradle.properties` has `newArchEnabled=true`
2. Check `ios/.xcode.env` has `export RCT_NEW_ARCH_ENABLED=1`
3. Clean and rebuild your project

### **"ViroFabricContainerView not available" Error**

**Solution:** The native module wasn't properly linked:

1. Run `cd ios && pod install`
2. For Android, ensure the module is in `settings.gradle`
3. Clean and rebuild

### **JSI Functions Not Available**

**Solution:** The JSI bridge wasn't initialized:

1. Ensure ViroFabricContainer is rendered
2. Check that New Architecture is actually enabled
3. Verify React Native version is 0.76.9+

## 📚 **API Reference**

### **Core Functions**

- `createNode(nodeId, nodeType, props)` - Create a new Viro node
- `updateNode(nodeId, props)` - Update node properties
- `deleteNode(nodeId)` - Remove a node
- `addChild(parentId, childId)` - Add child to parent
- `removeChild(parentId, childId)` - Remove child from parent

### **Scene Management**

- `createScene(sceneId, sceneType, props)` - Create a new scene
- `activateScene(sceneId)` - Activate a scene
- `destroyScene(sceneId)` - Destroy a scene
- `getSceneState(sceneId)` - Get scene state

### **Event Handling**

- `registerEventListener(nodeId, eventName, callback)` - Register event handler
- `unregisterEventListener(nodeId, eventName, callbackId)` - Remove event handler

### **Memory Management**

- `getMemoryStats()` - Get current memory usage
- `performMemoryCleanup()` - Force memory cleanup

## 🤝 **Contributing**

When contributing to the fabric-interop layer:

1. **Test both platforms** - Ensure changes work on iOS and Android
2. **Maintain API compatibility** - Don't break existing ViroReact code
3. **Update documentation** - Keep this README current
4. **Add TypeScript types** - Ensure type safety
5. **Test memory management** - Verify no leaks are introduced

## 📄 **License**

MIT License - see the main project LICENSE file.

---

**ViroReact Fabric Interop** - Bringing ViroReact into the New Architecture era! 🚀
