//
//  VRTFabricCrashFix.h
//  ViroReact
//
//  Created to fix React Native Fabric crash during view recycling
//  Addresses EXC_BAD_ACCESS in UIPointerInteractionAssistant
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

/// YES when cls belongs to an Apple framework. The crash mitigation swizzles UIView itself, so it
/// runs for every view in the host app; this tells it which views it must leave alone. Cached, as
/// the answer never changes for a class and removeFromSuperview is a hot path.
BOOL VRTIsAppleOwnedClass(Class cls);

@interface VRTFabricCrashFix : NSObject

+ (void)installFabricCrashFix;

@end