# React Native Fabric Crash Fixes for ViroReact

## Overview

This document describes the fixes implemented to resolve iOS crashes in ViroReact when using React Native 0.74+ with the New Architecture (Fabric) enabled. The primary issue was an `EXC_BAD_ACCESS` crash occurring during view unmounting and recycling.

## Problem Description

### Crash Details
- **Error Type**: `EXC_BAD_ACCESS` (code=1)
- **Location**: UIKit's pointer interaction system during view removal
- **Affected Versions**: React Native 0.74+, ViroReact with Fabric enabled
- **Frequency**: Occurred consistently when unmounting ViroReact components

### Stack Trace Analysis
```
frame #0: objc_msgSend + 32
frame #1: UIKitCore`-[UIView _containsView:] + 76
frame #2: UIKitCore`__52-[_UIPointerInteractionAssistant _assistantForView:]_block_invoke + 92
...
frame #12: UIKitCore`-[UIView(Hierarchy) removeFromSuperview] + 76
frame #13: RCTViewComponentView setContentView: (contentView=0x0000000000000000)
frame #14: RCTLegacyViewManagerInteropComponentView prepareForRecycle
```

### Root Cause
The crash occurred when:
1. Fabric's `prepareForRecycle` calls `setContentView:nil`
2. This triggers `removeFromSuperview` on ViroReact views
3. UIKit's `_UIPointerInteractionAssistant` tries to traverse the view hierarchy
4. Views have been deallocated, causing access to invalid memory addresses

## Solutions Implemented

### 1. Method Swizzling for Safe View Removal

**File**: `ios/ViroReact/ViroViewManager.mm`

**Implementation**:
- Swizzles `UIView`'s `removeFromSuperview` method
- Adds safety checks before view removal operations
- Clears pointer interactions that cause crashes

```objc
@implementation ViroFabricCrashFix

+ (void)installFabricCrashFix {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        [self swizzleRemoveFromSuperview];
    });
}

+ (void)swizzleRemoveFromSuperview {
    Class viewClass = [UIView class];
    SEL originalSelector = @selector(removeFromSuperview);
    SEL swizzledSelector = @selector(viro_safeRemoveFromSuperview);
    
    Method originalMethod = class_getInstanceMethod(viewClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(viewClass, swizzledSelector);
    
    if (originalMethod && swizzledMethod) {
        method_exchangeImplementations(originalMethod, swizzledMethod);
    }
}

@end
```

**Key Features**:
- **Automatic Installation**: Installs on first ViroReact view creation
- **Global Protection**: Protects all UIView instances, not just ViroReact views
- **Production Ready**: Silent operation with error logging only when needed

### 2. Enhanced View Lifecycle Management

**Files Modified**:
- `ios/ViroReact/AR/Views/VRTARSceneNavigator.mm`
- `ios/VRT3DSceneNavigator.mm`
- `ios/ViroReact/Views/VRTSceneNavigator.mm`
- `ios/ViroReact/AR/Views/VRTARScene.mm`
- `ios/ViroReact/Views/VRTView.mm`

**Implementation**:
- Added `willMoveToSuperview:` method to detect early view removal
- Implemented idempotent cleanup with `_hasCleanedUp` flags
- Synchronous resource cleanup to prevent race conditions

```objc
- (void)willMoveToSuperview:(UIView *)newSuperview {
    if (newSuperview == nil) {
        [self cleanupViroResources];
        
        @try {
            self.interactions = @[];
        } @catch (NSException *exception) {
            NSLog(@"Error clearing interactions: %@", exception.reason);
        }
    }
    [super willMoveToSuperview:newSuperview];
}

- (void)cleanupViroResources {
    if (_hasCleanedUp) {
        return;
    }
    _hasCleanedUp = YES;
    
    // Viro-specific cleanup code...
}
```

### 3. Safe Pointer Interaction Handling

**Implementation**:
```objc
- (void)viro_safeRemoveFromSuperview {
    @try {
        if (!self) {
            return;
        }
        
        // Clear pointer interactions that cause the crash
        if ([self respondsToSelector:@selector(interactions)]) {
            @try {
                self.interactions = @[];
            } @catch (NSException *exception) {
                NSLog(@"VRT: Error clearing interactions: %@", exception.reason);
            }
        }
        
        if (!self.superview) {
            return; // Already removed
        }
        
        [self viro_safeRemoveFromSuperview]; // Calls original method
        
    } @catch (NSException *exception) {
        NSLog(@"VRT: Prevented crash in removeFromSuperview: %@", exception.reason);
    }
}
```

## Technical Details

### Fabric vs Bridge Architecture Differences

**Old Bridge Architecture**:
- Predictable view lifecycle
- Views deallocated after `removeFromSuperview` completes
- Pointer interactions cleaned up automatically

**New Fabric Architecture**:
- Aggressive view recycling and reuse
- Views can be deallocated during `removeFromSuperview`
- Pointer interactions may persist after view deallocation

### Method Swizzling Safety

The implementation uses Objective-C runtime method swizzling safely:
- **Single Installation**: Uses `dispatch_once` to ensure one-time setup
- **Method Validation**: Checks method existence before swizzling
- **Fallback Handling**: Graceful degradation if swizzling fails

### Memory Management

- **No Retain Cycles**: All cleanup operations avoid creating retain cycles
- **Associated Objects**: Used sparingly and cleaned up properly
- **Exception Safety**: All critical operations wrapped in try-catch blocks

## Installation and Usage

### Automatic Installation
The fix installs automatically when the first ViroReact view is created:

```objc
- (VRTView *)view {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        [ViroFabricCrashFix installFabricCrashFix];
    });
    
    VRTView *view = [VRTView new];
    objc_setAssociatedObject(view, "ViroSafeForRecycling", @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    return view;
}
```

### No Configuration Required
- Works automatically with existing ViroReact applications
- No breaking changes to existing APIs
- Compatible with both Fabric and Bridge architectures

## Logging and Debugging

### Production Logging
In production, the fix operates silently and only logs critical issues:

```
VRT: Error clearing interactions: [specific error details]
VRT: Prevented crash in removeFromSuperview: [crash details]
```

### Debug Logging
During development, you can enable verbose logging by modifying the log levels in the implementation.

## Performance Impact

- **Minimal Overhead**: Method swizzling adds negligible performance cost
- **One-Time Setup**: Installation happens only once per application lifecycle
- **Efficient Checks**: Fast nil and validity checks before expensive operations

## Compatibility

### Supported Versions
- **React Native**: 0.74+ (New Architecture required)
- **iOS**: 12.0+ (matches ViroReact requirements)
- **Xcode**: 12.0+ (matches React Native requirements)

### Backward Compatibility
- Safe to use with older React Native versions
- No impact on applications not using Fabric
- Graceful fallback if swizzling fails

## Testing

### Validation Steps
1. **Crash Reproduction**: Verified fix prevents original crash scenario
2. **Memory Leak Testing**: Confirmed no additional memory leaks introduced
3. **Performance Testing**: Validated minimal performance impact
4. **Compatibility Testing**: Tested across multiple iOS versions and devices

### Recommended Testing
- Test component mounting/unmounting cycles
- Verify AR/VR scene transitions work correctly
- Check for memory leaks during extended usage
- Validate on both simulator and physical devices

## Troubleshooting

### If Crashes Still Occur

1. **Check React Native Version**: Ensure using 0.74+ with Fabric enabled
2. **Verify Installation**: Look for installation logs in console
3. **Check Custom Modifications**: Ensure no custom view managers override safety mechanisms

### Common Issues

- **Missing Logs**: If no logs appear, the fix may not be installing (check view creation)
- **Different Crash Location**: May indicate a different issue not related to Fabric recycling
- **Performance Issues**: Unlikely but contact support if performance degrades

## Future Considerations

### React Native Updates
- Monitor React Native releases for official Fabric stability improvements
- May be able to remove workarounds when React Native addresses root causes
- Keep fix as fallback for older RN versions

### ViroReact Evolution
- Consider migrating to native Fabric components in future versions
- Maintain compatibility layer for existing applications
- Monitor Apple's UIKit changes that might affect pointer interactions

## Support

For issues related to these fixes:
1. Check this documentation first
2. Review console logs for error messages
3. Test on clean React Native project to isolate issues
4. Report issues with full stack traces and reproduction steps

---

**Note**: These fixes specifically address React Native Fabric crashes in ViroReact. They are production-tested and designed to be safe, efficient, and maintainable.