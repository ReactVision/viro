//
//  ViroFabricManager.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTBridge.h>

@interface ViroFabricManager : RCTEventEmitter <RCTBridgeModule>

// Singleton method to get the shared instance
+ (instancetype)sharedInstance;

/**
 * Sends an event to JavaScript with the given name and body.
 * This method ensures the event is dispatched on the main thread.
 *
 * @param name The name of the event
 * @param body The body of the event
 */
- (void)sendEventWithName:(NSString *)name body:(NSDictionary *)body;

@end
