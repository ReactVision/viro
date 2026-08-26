//
//  VRTFabricCrashFix.mm
//  ViroReact
//
//  Created to fix React Native Fabric crash during view recycling
//  Addresses EXC_BAD_ACCESS in UIPointerInteractionAssistant
//

#import "VRTFabricCrashFix.h"
#import <objc/runtime.h>
#import <os/lock.h>

BOOL VRTIsAppleOwnedClass(Class cls) {
    static CFMutableDictionaryRef cache;
    static os_unfair_lock cacheLock = OS_UNFAIR_LOCK_INIT;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // Keys are Class objects and values are CFBoolean constants, so neither needs retaining.
        cache = CFDictionaryCreateMutable(kCFAllocatorDefault, 0, NULL, NULL);
    });

    os_unfair_lock_lock(&cacheLock);
    const void *cached = CFDictionaryGetValue(cache, (__bridge const void *)cls);
    os_unfair_lock_unlock(&cacheLock);
    if (cached != NULL) {
        return cached == (const void *)kCFBooleanTrue;
    }

    BOOL isAppleOwned = [[NSBundle bundleForClass:cls].bundleIdentifier hasPrefix:@"com.apple."];

    os_unfair_lock_lock(&cacheLock);
    CFDictionarySetValue(cache, (__bridge const void *)cls,
                         isAppleOwned ? (const void *)kCFBooleanTrue : (const void *)kCFBooleanFalse);
    os_unfair_lock_unlock(&cacheLock);

    return isAppleOwned;
}

@implementation VRTFabricCrashFix

+ (void)load {
    
}

+ (void)installFabricCrashFix {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSLog(@"[ViroMemory] VRTFabricCrashFix - ENABLED (needed to prevent crashes)");
        // Re-enabled because it's needed to prevent Fabric crashes
        [self swizzleRemoveFromSuperview];
        [self swizzleContainsView];
    });
}

+ (void)swizzleRemoveFromSuperview {
    Class viewClass = [UIView class];
    
    SEL originalSelector = @selector(removeFromSuperview);
    SEL swizzledSelector = @selector(vrt_safeRemoveFromSuperview);
    
    Method originalMethod = class_getInstanceMethod(viewClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(viewClass, swizzledSelector);
    
    if (!originalMethod) {
        return;
    }
    
    if (!swizzledMethod) {
        return;
    }
    
    // Try to add the method first
    BOOL didAddMethod = class_addMethod(viewClass,
                                       originalSelector,
                                       method_getImplementation(swizzledMethod),
                                       method_getTypeEncoding(swizzledMethod));
    
    if (didAddMethod) {
        class_replaceMethod(viewClass,
                           swizzledSelector,
                           method_getImplementation(originalMethod),
                           method_getTypeEncoding(originalMethod));
    } else {
        method_exchangeImplementations(originalMethod, swizzledMethod);
    }
}

+ (void)swizzleContainsView {
    Class viewClass = [UIView class];
    
    SEL originalSelector = @selector(_containsView:);
    SEL swizzledSelector = @selector(vrt_safeContainsView:);
    
    Method originalMethod = class_getInstanceMethod(viewClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(viewClass, swizzledSelector);
    
    if (!originalMethod) {
        return;
    }
    
    if (!swizzledMethod) {
        return;
    }
    
    if (originalMethod && swizzledMethod) {
        method_exchangeImplementations(originalMethod, swizzledMethod);
    }
}

@end

@implementation UIView (VRTFabricCrashFix)

- (BOOL)vrt_safeContainsView:(UIView *)view {
    // Add throttled logging to avoid spam
    static NSTimeInterval lastLogTime = 0;
    NSTimeInterval currentTime = [[NSDate date] timeIntervalSince1970];
    
    if (currentTime - lastLogTime > 5.0) {
        lastLogTime = currentTime;
    }
    
    @try {
        // Safety check: if either view is nil or deallocated, return NO
        if (!self || !view) {
            return NO;
        }
        
        // Additional safety: check if views are in valid state
        if (![self isKindOfClass:[UIView class]] || ![view isKindOfClass:[UIView class]]) {
            return NO;
        }
        
        // Call the original method safely
        return [self vrt_safeContainsView:view];
        
    } @catch (NSException *exception) {
        NSLog(@"VRT: Error in _containsView: %@", exception.reason);
        return NO;
    }
}

- (void)vrt_safeRemoveFromSuperview {
    @try {
        // Check if view is valid before removal
        if (!self) {
            return;
        }

        // This runs for every view in the host app, not just Viro's. Apple's frameworks re-parent
        // their own controls and need the recognizers to survive it: AVKit loses the tap that
        // toggles fullscreen video controls, and UIImagePickerController loses its shutter button.
        if (!VRTIsAppleOwnedClass([self class])) {
            // Clear pointer interactions that cause the crash
            if ([self respondsToSelector:@selector(interactions)]) {
                @try {
                    self.interactions = @[];
                } @catch (NSException *exception) {
                    NSLog(@"VRT: Error clearing interactions: %@", exception.reason);
                }
            }

            // Clear gesture recognizers that might hold references
            @try {
                NSArray *gestures = [self.gestureRecognizers copy];
                if (gestures.count > 0) {
                    for (UIGestureRecognizer *gesture in gestures) {
                        [self removeGestureRecognizer:gesture];
                    }
                }
            } @catch (NSException *exception) {
                NSLog(@"VRT: Error clearing gesture recognizers: %@", exception.reason);
            }
        }

        // Load-bearing: skipping the removal is what actually prevents the Fabric recycling crash,
        // so this must stay ahead of the call through to UIKit. See issue #324.
        if (!self.superview) {
            return; // Already removed
        }

        // Perform the actual removal
        [self vrt_safeRemoveFromSuperview]; // This calls the original method

    } @catch (NSException *exception) {
        NSLog(@"VRT: Critical error in removeFromSuperview: %@", exception.reason);
        NSLog(@"VRT: Stack trace: %@", [exception callStackSymbols]);
    }
}

@end
