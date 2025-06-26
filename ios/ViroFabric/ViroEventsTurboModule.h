//
//  ViroEventsTurboModule.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "ViroEventsTurboModuleSpec.h"
@interface ViroEventsTurboModule : RCTEventEmitter <NativeViroEventsSpec>
#else
@interface ViroEventsTurboModule : RCTEventEmitter <RCTBridgeModule>
#endif

// Singleton access for JSI integration
+ (instancetype)sharedInstance;

// Event emission methods
- (void)emitJSICallback:(NSString *)callbackId eventData:(NSDictionary *)eventData;
- (void)emitNodeEvent:(NSString *)nodeId eventName:(NSString *)eventName eventData:(NSDictionary *)eventData;
- (void)emitSceneEvent:(NSString *)sceneId eventName:(NSString *)eventName eventData:(NSDictionary *)eventData;

// Utility methods
- (BOOL)isEventSystemReady;
- (NSInteger)getActiveListenerCount;

@end
