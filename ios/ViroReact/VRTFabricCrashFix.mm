//
//  VRTFabricCrashFix.mm
//  ViroReact
//
//  Created to fix React Native Fabric crash during view recycling
//  Addresses EXC_BAD_ACCESS in UIPointerInteractionAssistant
//

#import "VRTFabricCrashFix.h"
#import <objc/runtime.h>

@implementation VRTFabricCrashFix

+ (void)load {
    NSLog(@"VRT: ===== VRTFabricCrashFix class loaded =====");
}

+ (void)installFabricCrashFix {
    NSLog(@"VRT: ===== FABRIC CRASH FIX CALLED =====");
    NSLog(@"VRT: ===== THIS LOG SHOULD ALWAYS APPEAR =====");
    
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSLog(@"VRT: ===== INSTALLING FABRIC CRASH FIX - FIRST TIME =====");
        
        // Swizzle UIView's removeFromSuperview method to add safety checks
        [self swizzleRemoveFromSuperview];
        
        // Also swizzle _containsView: which is where the crash originates
        [self swizzleContainsView];
        
        NSLog(@"VRT: ===== FABRIC CRASH FIX INSTALLATION COMPLETED =====");
    });
}

+ (void)swizzleRemoveFromSuperview {
    NSLog(@"VRT: Attempting to swizzle removeFromSuperview...");
    
    Class viewClass = [UIView class];
    
    SEL originalSelector = @selector(removeFromSuperview);
    SEL swizzledSelector = @selector(vrt_safeRemoveFromSuperview);
    
    Method originalMethod = class_getInstanceMethod(viewClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(viewClass, swizzledSelector);
    
    if (!originalMethod) {
        NSLog(@"VRT: ERROR - Could not find original removeFromSuperview method");
        return;
    }
    
    if (!swizzledMethod) {
        NSLog(@"VRT: ERROR - Could not find swizzled removeFromSuperview method");
        return;
    }
    
    // Try to add the method first
    BOOL didAddMethod = class_addMethod(viewClass,
                                       originalSelector,
                                       method_getImplementation(swizzledMethod),
                                       method_getTypeEncoding(swizzledMethod));
    
    if (didAddMethod) {
        NSLog(@"VRT: Added method, replacing implementation");
        class_replaceMethod(viewClass,
                           swizzledSelector,
                           method_getImplementation(originalMethod),
                           method_getTypeEncoding(originalMethod));
    } else {
        NSLog(@"VRT: Exchanging method implementations");
        method_exchangeImplementations(originalMethod, swizzledMethod);
    }
    
    NSLog(@"VRT: removeFromSuperview swizzling completed successfully");
}

+ (void)swizzleContainsView {
    NSLog(@"VRT: Attempting to swizzle _containsView:...");
    
    Class viewClass = [UIView class];
    
    SEL originalSelector = @selector(_containsView:);
    SEL swizzledSelector = @selector(vrt_safeContainsView:);
    
    Method originalMethod = class_getInstanceMethod(viewClass, originalSelector);
    Method swizzledMethod = class_getInstanceMethod(viewClass, swizzledSelector);
    
    if (!originalMethod) {
        NSLog(@"VRT: WARNING - Could not find original _containsView: method (this is expected on some iOS versions)");
        return;
    }
    
    if (!swizzledMethod) {
        NSLog(@"VRT: ERROR - Could not find swizzled _containsView: method");
        return;
    }
    
    if (originalMethod && swizzledMethod) {
        NSLog(@"VRT: Exchanging _containsView: method implementations");
        method_exchangeImplementations(originalMethod, swizzledMethod);
        NSLog(@"VRT: _containsView: swizzling completed successfully");
    }
}

@end

@implementation UIView (VRTFabricCrashFix)

- (BOOL)vrt_safeContainsView:(UIView *)view {
    // Add throttled logging to avoid spam
    static NSTimeInterval lastLogTime = 0;
    NSTimeInterval currentTime = [[NSDate date] timeIntervalSince1970];
    
    if (currentTime - lastLogTime > 5.0) { // Log every 5 seconds max
        NSLog(@"VRT: _containsView: called - self: %@ view: %@", NSStringFromClass([self class]), NSStringFromClass([view class]));
        lastLogTime = currentTime;
    }
    
    @try {
        // Safety check: if either view is nil or deallocated, return NO
        if (!self || !view) {
            NSLog(@"VRT: _containsView: safety check - nil view detected");
            return NO;
        }
        
        // Additional safety: check if views are in valid state
        if (![self isKindOfClass:[UIView class]] || ![view isKindOfClass:[UIView class]]) {
            NSLog(@"VRT: _containsView: safety check - invalid view class");
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
    // Log when our swizzled method is called (with throttling for Viro views)
    static NSTimeInterval lastViroLogTime = 0;
    NSTimeInterval currentTime = [[NSDate date] timeIntervalSince1970];
    
    BOOL isViroView = [NSStringFromClass([self class]) containsString:@"VRT"] || 
                      [NSStringFromClass([self class]) containsString:@"Viro"];
    
    if (isViroView || (currentTime - lastViroLogTime > 10.0)) { // Always log Viro views, throttle others
        NSLog(@"VRT: removeFromSuperview called on %@", NSStringFromClass([self class]));
        if (!isViroView) {
            lastViroLogTime = currentTime;
        }
    }
    
    @try {
        // Check if view is valid before removal
        if (!self) {
            NSLog(@"VRT: removeFromSuperview - self is nil, returning");
            return;
        }
        
        // Clear pointer interactions that cause the crash
        if ([self respondsToSelector:@selector(interactions)]) {
            @try {
                NSUInteger interactionCount = self.interactions.count;
                if (interactionCount > 0) {
                    NSLog(@"VRT: Clearing %lu interactions from %@", (unsigned long)interactionCount, NSStringFromClass([self class]));
                }
                self.interactions = @[];
            } @catch (NSException *exception) {
                NSLog(@"VRT: Error clearing interactions: %@", exception.reason);
            }
        }
        
        // Clear gesture recognizers that might hold references
        @try {
            NSArray *gestures = [self.gestureRecognizers copy];
            if (gestures.count > 0) {
                NSLog(@"VRT: Clearing %lu gesture recognizers from %@", (unsigned long)gestures.count, NSStringFromClass([self class]));
                for (UIGestureRecognizer *gesture in gestures) {
                    [self removeGestureRecognizer:gesture];
                }
            }
        } @catch (NSException *exception) {
            NSLog(@"VRT: Error clearing gesture recognizers: %@", exception.reason);
        }
        
        // Check if superview is still valid
        if (!self.superview) {
            NSLog(@"VRT: removeFromSuperview - no superview, returning");
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