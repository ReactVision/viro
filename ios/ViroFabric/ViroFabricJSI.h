//
//  ViroFabricJSI.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridge.h>
#import <ReactCommon/RCTTurboModule.h>
#import <jsi/jsi.h>

using namespace facebook::jsi;

@class ViroFabricSceneManager;
@class ViroFabricManager;

/**
 * ViroFabricJSI provides the JSI bridge between JavaScript and native iOS code.
 * This class implements all the functions defined in NativeViro.ts and connects
 * them to the existing ViroReact iOS framework.
 */
@interface ViroFabricJSI : NSObject

/**
 * Initialize with bridge and install JSI functions
 */
- (instancetype)initWithBridge:(RCTBridge *)bridge;

/**
 * Install all JSI functions into the JavaScript runtime
 */
- (void)installJSIFunctions:(Runtime &)runtime;

/**
 * Set the scene manager instance
 */
- (void)setSceneManager:(ViroFabricSceneManager *)sceneManager;

/**
 * Set the fabric manager instance
 */
- (void)setFabricManager:(ViroFabricManager *)fabricManager;

/**
 * Cleanup JSI functions and resources
 */
- (void)cleanup;

@end
