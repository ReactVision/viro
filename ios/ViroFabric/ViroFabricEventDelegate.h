//
//  ViroFabricEventDelegate.h
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTBridge.h>

@class ViroFabricContainer;

/**
 * Event delegate for the Viro Fabric interop layer.
 * This class bridges events from the native Viro engine to the Fabric event system.
 * It follows the same patterns as the existing iOS VRT event delegates but integrates with the Fabric container.
 */
@interface ViroFabricEventDelegate : NSObject

/**
 * Initialize the event delegate with a container and bridge.
 */
- (instancetype)initWithContainer:(ViroFabricContainer *)container
                           bridge:(RCTBridge *)bridge
                      containerId:(NSNumber *)containerId;

/**
 * Register a callback for a specific event on a node.
 */
- (void)registerEventCallback:(NSString *)callbackId
                    eventName:(NSString *)eventName
                       nodeId:(NSString *)nodeId;

/**
 * Unregister a callback for a specific event on a node.
 */
- (void)unregisterEventCallback:(NSString *)callbackId
                      eventName:(NSString *)eventName
                         nodeId:(NSString *)nodeId;

/**
 * Emit an event to both the React Native event system and JSI callbacks.
 */
- (void)emitEvent:(NSString *)eventName
        eventData:(NSDictionary *)eventData
           nodeId:(NSString *)nodeId;

/**
 * Container-specific event methods
 */
- (void)onInitialized:(BOOL)success;
- (void)onTrackingUpdated:(NSInteger)state reason:(NSInteger)reason;

/**
 * Core interaction event methods (compatible with existing VRT patterns)
 */
- (void)onHover:(NSInteger)source
           node:(id)node
      isHovering:(BOOL)isHovering
       position:(NSArray *)position;

- (void)onClick:(NSInteger)source
           node:(id)node
     clickState:(NSInteger)clickState
       position:(NSArray *)position;

- (void)onTouch:(NSInteger)source
           node:(id)node
     touchState:(NSInteger)touchState
       touchPos:(NSArray *)touchPos;

- (void)onSwipe:(NSInteger)source
           node:(id)node
     swipeState:(NSInteger)swipeState;

- (void)onScroll:(NSInteger)source
            node:(id)node
        scrollX:(float)x
        scrollY:(float)y;

- (void)onDrag:(NSInteger)source
          node:(id)node
             x:(float)x
             y:(float)y
             z:(float)z;

- (void)onFuse:(NSInteger)source
          node:(id)node;

- (void)onPinch:(NSInteger)source
           node:(id)node
    scaleFactor:(float)scaleFactor
     pinchState:(NSInteger)pinchState;

- (void)onRotate:(NSInteger)source
            node:(id)node
rotationRadians:(float)rotationRadians
    rotateState:(NSInteger)rotateState;

- (void)onControllerStatus:(NSInteger)source
          controllerStatus:(NSInteger)controllerStatus;

- (void)onCameraARHitTest:(NSArray *)results;

- (void)onARPointCloudUpdate:(NSDictionary *)pointCloud;

- (void)onCameraTransformUpdate:(NSArray *)cameraTransform;

/**
 * Clean up resources
 */
- (void)dispose;

@end
