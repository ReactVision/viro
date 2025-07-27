//
//  VRTFabricCrashFix.h
//  ViroReact
//
//  Created to fix React Native Fabric crash during view recycling
//  Addresses EXC_BAD_ACCESS in UIPointerInteractionAssistant
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface VRTFabricCrashFix : NSObject

+ (void)installFabricCrashFix;

@end