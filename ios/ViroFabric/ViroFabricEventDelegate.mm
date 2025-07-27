//
//  ViroFabricEventDelegate.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroFabricEventDelegate.h"
#import "ViroFabricContainer.h"
#import "ViroFabricEvents.h"
#import "ViroFabricManager.h"
#import <React/RCTLog.h>

@interface ViroFabricEventDelegate ()

@property (nonatomic, weak) ViroFabricContainer *container;
@property (nonatomic, weak) RCTBridge *bridge;
@property (nonatomic, strong) NSNumber *containerId;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSString *> *eventCallbacks;

@end

@implementation ViroFabricEventDelegate

- (instancetype)initWithContainer:(ViroFabricContainer *)container
                           bridge:(RCTBridge *)bridge
                      containerId:(NSNumber *)containerId {
    self = [super init];
    if (self) {
        _container = container;
        _bridge = bridge;
        _containerId = containerId;
        _eventCallbacks = [[NSMutableDictionary alloc] init];
    }
    return self;
}

#pragma mark - Event Callback Management

- (void)registerEventCallback:(NSString *)callbackId
                    eventName:(NSString *)eventName
                       nodeId:(NSString *)nodeId {
    NSString *key = [NSString stringWithFormat:@"%@:%@", nodeId, eventName];
    self.eventCallbacks[key] = callbackId;
    RCTLogInfo(@"[ViroFabricEventDelegate] Registered event callback: %@ -> %@", key, callbackId);
}

- (void)unregisterEventCallback:(NSString *)callbackId
                      eventName:(NSString *)eventName
                         nodeId:(NSString *)nodeId {
    NSString *key = [NSString stringWithFormat:@"%@:%@", nodeId, eventName];
    [self.eventCallbacks removeObjectForKey:key];
    RCTLogInfo(@"[ViroFabricEventDelegate] Unregistered event callback: %@", key);
}

#pragma mark - Event Emission

- (void)emitEvent:(NSString *)eventName
        eventData:(NSDictionary *)eventData
           nodeId:(NSString *)nodeId {
    
    // Emit to React Native event system
    if (self.bridge && self.containerId) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [[ViroFabricManager sharedInstance] sendEventWithName:eventName body:@{
                @"target": self.containerId,
                @"eventData": eventData ?: @{}
            }];
        });
    }
    
    // Emit to JSI callback if registered
    if (nodeId) {
        NSString *key = [NSString stringWithFormat:@"%@:%@", nodeId, eventName];
        NSString *callbackId = self.eventCallbacks[key];
        if (callbackId && self.container) {
            [self.container dispatchEventToJS:callbackId withData:eventData];
        }
    }
}

#pragma mark - Container-Specific Events

- (void)onInitialized:(BOOL)success {
    NSDictionary *eventData = @{
        @"success": @(success)
    };
    [self emitEvent:ViroFabricEventOnInitialized eventData:eventData nodeId:nil];
}

- (void)onTrackingUpdated:(NSInteger)state reason:(NSInteger)reason {
    NSDictionary *eventData = @{
        @"state": @(state),
        @"reason": @(reason)
    };
    
    // Emit both the legacy event and the Fabric-specific event
    [self emitEvent:ViroFabricEventOnTrackingUpdated eventData:eventData nodeId:nil];
    [self emitEvent:ViroFabricEventOnTrackingUpdatedFabric eventData:eventData nodeId:nil];
}

#pragma mark - Core Interaction Events

- (void)onHover:(NSInteger)source
           node:(id)node
      isHovering:(BOOL)isHovering
       position:(NSArray *)position {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"isHovering": @(isHovering),
        @"position": position ?: @[@0, @0, @0]
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnHover eventData:eventData nodeId:nodeId];
}

- (void)onClick:(NSInteger)source
           node:(id)node
     clickState:(NSInteger)clickState
       position:(NSArray *)position {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"clickState": @(clickState),
        @"position": position ?: @[@0, @0, @0]
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnClick eventData:eventData nodeId:nodeId];
}

- (void)onTouch:(NSInteger)source
           node:(id)node
     touchState:(NSInteger)touchState
       touchPos:(NSArray *)touchPos {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"touchState": @(touchState),
        @"touchPos": touchPos ?: @[@0, @0]
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnTouch eventData:eventData nodeId:nodeId];
}

- (void)onSwipe:(NSInteger)source
           node:(id)node
     swipeState:(NSInteger)swipeState {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"swipeState": @(swipeState)
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnSwipe eventData:eventData nodeId:nodeId];
}

- (void)onScroll:(NSInteger)source
            node:(id)node
        scrollX:(float)x
        scrollY:(float)y {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"scrollPos": @[@(x), @(y)]
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnScroll eventData:eventData nodeId:nodeId];
}

- (void)onDrag:(NSInteger)source
          node:(id)node
             x:(float)x
             y:(float)y
             z:(float)z {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"dragToPos": @[@(x), @(y), @(z)]
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnDrag eventData:eventData nodeId:nodeId];
}

- (void)onFuse:(NSInteger)source
          node:(id)node {
    
    NSDictionary *eventData = @{
        @"source": @(source)
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnFuse eventData:eventData nodeId:nodeId];
}

- (void)onPinch:(NSInteger)source
           node:(id)node
    scaleFactor:(float)scaleFactor
     pinchState:(NSInteger)pinchState {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"scaleFactor": @(scaleFactor),
        @"pinchState": @(pinchState)
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnPinch eventData:eventData nodeId:nodeId];
}

- (void)onRotate:(NSInteger)source
            node:(id)node
rotationRadians:(float)rotationRadians
    rotateState:(NSInteger)rotateState {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"rotationFactor": @(rotationRadians * 180.0 / M_PI), // Convert to degrees
        @"rotateState": @(rotateState)
    };
    
    NSString *nodeId = [self getNodeId:node];
    [self emitEvent:ViroFabricEventOnRotate eventData:eventData nodeId:nodeId];
}

- (void)onControllerStatus:(NSInteger)source
          controllerStatus:(NSInteger)controllerStatus {
    
    NSDictionary *eventData = @{
        @"source": @(source),
        @"controllerStatus": @(controllerStatus)
    };
    
    [self emitEvent:ViroFabricEventOnControllerStatus eventData:eventData nodeId:nil];
}

#pragma mark - AR Events

- (void)onCameraARHitTest:(NSArray *)results {
    // Get camera position asynchronously (similar to Android implementation)
    if (self.container) {
        [self.container getCameraPositionAsync:^(NSArray *cameraOrientation) {
            NSDictionary *eventData = @{
                @"hitTestResults": results ?: @[],
                @"cameraOrientation": cameraOrientation ?: @[]
            };
            
            [self emitEvent:ViroFabricEventOnCameraARHitTest eventData:eventData nodeId:nil];
        }];
    }
}

- (void)onARPointCloudUpdate:(NSDictionary *)pointCloud {
    NSDictionary *eventData = @{
        @"pointCloud": pointCloud ?: @{}
    };
    
    [self emitEvent:ViroFabricEventOnARPointCloudUpdate eventData:eventData nodeId:nil];
}

- (void)onCameraTransformUpdate:(NSArray *)cameraTransform {
    NSDictionary *eventData = @{
        @"cameraTransform": cameraTransform ?: @[]
    };
    
    // Emit both the legacy event and the Fabric-specific event
    [self emitEvent:ViroFabricEventOnCameraTransformUpdate eventData:eventData nodeId:nil];
    [self emitEvent:ViroFabricEventOnCameraTransformUpdateFabric eventData:eventData nodeId:nil];
}

#pragma mark - Helper Methods

- (NSString *)getNodeId:(id)node {
    // Try to get a unique identifier from the node
    // This would depend on the actual VRT node implementation
    if ([node respondsToSelector:@selector(reactTag)]) {
        NSNumber *reactTag = [node performSelector:@selector(reactTag)];
        return [reactTag stringValue];
    } else if ([node respondsToSelector:@selector(tag)]) {
        NSNumber *tag = [node performSelector:@selector(tag)];
        return [tag stringValue];
    } else if ([node respondsToSelector:@selector(description)]) {
        // Fallback to object description
        return [NSString stringWithFormat:@"%p", node];
    }
    return nil;
}

#pragma mark - Cleanup

- (void)dispose {
    [self.eventCallbacks removeAllObjects];
    self.container = nil;
    self.bridge = nil;
    self.containerId = nil;
}

@end
