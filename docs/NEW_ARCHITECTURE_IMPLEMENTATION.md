# React Native New Architecture Implementation for Viro

This document outlines the implementation details for supporting React Native's New Architecture (Fabric) in the Viro library.

## Overview

React Native's New Architecture introduces several key components:

1. **Fabric Renderer**: A C++ rendering system that replaces the legacy UIManager
2. **JSI (JavaScript Interface)**: A direct interface between JavaScript and native code
3. **TurboModules**: A new module system that replaces the legacy NativeModules
4. **Codegen**: A code generation tool that creates C++ interfaces from JavaScript specs

The Viro library has been updated to support these new components while maintaining backward compatibility with the legacy architecture.

## Implementation Strategy

Rather than completely rewriting the native code, we've implemented a bridge layer that connects the New Architecture components to the existing Viro implementation. This approach has several advantages:

1. **Minimal Code Changes**: We leverage the existing, well-tested Viro native code
2. **Direct JSI Communication**: We use JSI directly without relying on codegen
3. **New Architecture Only**: This implementation is designed exclusively for React Native's New Architecture

> **Note**: This library requires React Native's New Architecture to be enabled in your app. Legacy architecture is not supported.

## Key Components

### 1. ViroFabricContainer

The `ViroFabricContainer` is the main component that bridges between Fabric and the existing Viro implementation. It:

- Creates and manages the native Viro navigators (VRTSceneNavigator, VRTARSceneNavigator)
- Handles the lifecycle of Viro nodes and components
- Provides a JSI interface for JavaScript to communicate with native code
- Manages event dispatching between native and JavaScript

### 2. JSI Integration

We've implemented a robust JSI integration that:

- Provides direct access to native functions from JavaScript
- Handles type conversions between JavaScript and native types
- Supports multiple approaches to get the JSI runtime, ensuring compatibility with different React Native versions

### 3. Event Handling

Events are handled through two mechanisms:

- **Direct JSI Calls**: When the JSI runtime is available, events are dispatched directly through JSI
- **Event Emitter Fallback**: When JSI is not available, events are dispatched through the traditional RCTEventEmitter

### 4. ViroFabricManager

The `ViroFabricManager` provides a fallback mechanism for event handling when JSI is not available. It:

- Extends RCTEventEmitter to dispatch events to JavaScript
- Provides a singleton instance that can be accessed from anywhere in the native code
- Supports dynamic registration of event types

## Technical Challenges and Solutions

### 1. JSI Runtime Access

**Challenge**: Accessing the JSI runtime can be difficult as the API is not stable across React Native versions.

**Solution**: We implemented multiple approaches to get the JSI runtime:

- Through TurboModuleManager
- Through RCTCxxBridge
- Through RCTBridge+Private.h

### 2. Type Conversions

**Challenge**: Converting between JavaScript and native types can be complex, especially for nested objects.

**Solution**: We implemented comprehensive conversion functions that handle all JavaScript types and their native equivalents.

### 3. Event Dispatching

**Challenge**: Ensuring events are reliably delivered to JavaScript, even when JSI is not available.

**Solution**: We implemented a dual-approach system:

- Primary: Direct JSI calls when available
- Fallback: RCTEventEmitter when JSI is not available

### 4. Backward Compatibility

**Challenge**: Maintaining compatibility with both old and new architectures.

**Solution**: The bridge layer abstracts the differences between architectures, providing a consistent API regardless of which architecture is being used.

## Usage in JavaScript

From the JavaScript side, the API remains largely unchanged. The main difference is the use of the `ViroFabricContainer` component instead of the legacy navigators:

```jsx
import { ViroFabricContainer } from "@reactvision/react-viro/fabric";

function MyARApp() {
  return (
    <ViroFabricContainer
      arEnabled={true}
      worldAlignment="Gravity"
      onInitialized={handleInitialized}
    >
      {/* Your AR content here */}
    </ViroFabricContainer>
  );
}
```

## Future Improvements

1. **Full TurboModule Implementation**: Enhance the current bridge approach with more TurboModule features
2. **Performance Optimizations**: Further optimize the JSI integration for better performance
3. **Enhanced Type Safety**: Improve type safety through TypeScript and C++ type checking

## Important Note on Codegen

This implementation deliberately avoids using React Native's codegen system. Instead, we use direct JSI bindings to communicate between JavaScript and native code. This approach has several advantages:

1. **Independence from Codegen**: We don't rely on React Native's codegen toolchain, which can change between versions
2. **Full Control**: We have complete control over the API surface and implementation details
3. **Simplified Maintenance**: The bridge code is centralized and focused, making it easier to maintain
4. **Future-Proof**: This approach will continue to work as React Native evolves, without requiring updates to codegen specs

## Conclusion

The implementation of React Native's New Architecture in Viro provides a solid foundation for future development while maintaining compatibility with existing code. By using a bridge approach, we've minimized the risk of regressions while still benefiting from the performance improvements of the New Architecture.
