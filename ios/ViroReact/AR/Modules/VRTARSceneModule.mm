//
//  VRTARSceneModule.mm
//  ViroReact
//
//  Created by Andy Chu on 8/9/17.
//  Copyright © 2017 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

#import <React/RCTUIManager.h>
#import <React/RCTUIManagerUtils.h>
#import <ViroKit/ViroKit.h>
#import "VRTARScene.h"
#import "VRTARSceneModule.h"
#import "VRTARSceneNavigator.h"
#import "VRTARHitTestUtil.h"
#import "VRTARAnchorNode.h"

@interface VRTARSceneModule ()
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSValue *> *storedHitResults;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *hitResultTimestamps;
@end

@implementation VRTARSceneModule
@synthesize bridge = _bridge;

static const NSTimeInterval kHitResultTimeoutSeconds = 30.0;

RCT_EXPORT_MODULE()

- (instancetype)init {
    self = [super init];
    if (self) {
        _storedHitResults = [NSMutableDictionary dictionary];
        _hitResultTimestamps = [NSMutableDictionary dictionary];
    }
    return self;
}

- (dispatch_queue_t)methodQueue {
    return RCTGetUIManagerQueue();
}

/**
 * Cleanup old hit results periodically to prevent memory leaks.
 * Removes any hit results older than kHitResultTimeoutSeconds.
 */
- (void)cleanupExpiredHitResults {
    NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
    NSMutableArray *expiredKeys = [NSMutableArray array];

    [self.hitResultTimestamps enumerateKeysAndObjectsUsingBlock:^(
        NSString *key, NSNumber *timestamp, BOOL *stop) {
        if (now - timestamp.doubleValue > kHitResultTimeoutSeconds) {
            [expiredKeys addObject:key];
        }
    }];

    for (NSString *key in expiredKeys) {
        // Clean up the stored shared_ptr
        NSValue *wrappedPtr = self.storedHitResults[key];
        if (wrappedPtr) {
            auto ptr = reinterpret_cast<std::shared_ptr<VROARHitTestResult>*>(
                wrappedPtr.pointerValue
            );
            delete ptr;
        }
        [self.storedHitResults removeObjectForKey:key];
        [self.hitResultTimestamps removeObjectForKey:key];
    }
}

/**
 * Store hit results with unique IDs and add the ID to each result dictionary.
 * This allows the results to be referenced later for anchor creation.
 */
- (NSArray *)storeHitResults:(std::vector<std::shared_ptr<VROARHitTestResult>>)results {
    [self cleanupExpiredHitResults];

    NSMutableArray *resultDicts = [NSMutableArray array];
    NSTimeInterval now = [[NSDate date] timeIntervalSince1970];

    for (auto& result : results) {
        NSString *hitResultId = [[NSUUID UUID] UUIDString];

        // Store the shared_ptr wrapped in a value holder
        auto *resultPtr = new std::shared_ptr<VROARHitTestResult>(result);
        NSValue *wrappedPtr = [NSValue valueWithPointer:resultPtr];

        self.storedHitResults[hitResultId] = wrappedPtr;
        self.hitResultTimestamps[hitResultId] = @(now);

        // Create dictionary
        NSMutableDictionary *dict = [[VRTARHitTestUtil dictForARHitResult:result] mutableCopy];
        dict[@"_hitResultId"] = hitResultId;

        [resultDicts addObject:dict];
    }

    return resultDicts;
}

/**
 * Retrieve a stored hit result by ID.
 */
- (std::shared_ptr<VROARHitTestResult>)getStoredHitResult:(NSString *)hitResultId {
    NSValue *wrappedPtr = self.storedHitResults[hitResultId];
    if (!wrappedPtr) {
        return nullptr;
    }

    auto ptr = reinterpret_cast<std::shared_ptr<VROARHitTestResult>*>(
        wrappedPtr.pointerValue
    );
    return *ptr;
}

RCT_EXPORT_METHOD(performARHitTestWithRay:(nonnull NSNumber *)viewTag
                  ray:(NSArray *)ray
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        UIView *sceneView = viewRegistry[viewTag];
        if (![sceneView isKindOfClass:[VRTARScene class]]) {
            RCTLogError(@"Invalid view returned when calling performARHitTestWithRay: expected VRTARScene, got [%@]", sceneView);
        } else if ([ray count] != 3) {
            RCTLogError(@"Invalid Ray provided for performARHitTestWithRay!");
        } else {
            VRTARScene *scene = (VRTARScene *)sceneView;
            UIView *superview = [scene superview];
            
            if (superview && [superview isKindOfClass:[VRTARSceneNavigator class]]) {
                VRTARSceneNavigator *navigator = (VRTARSceneNavigator *)superview;
                if ([navigator rootVROView]) {
                    VROViewAR *view = (VROViewAR *)[navigator rootVROView];
                    VROVector3f rayVector = VROVector3f([[ray objectAtIndex:0] floatValue],
                                                        [[ray objectAtIndex:1] floatValue],
                                                        [[ray objectAtIndex:2] floatValue]);
                    std::vector<std::shared_ptr<VROARHitTestResult>> results = [view performARHitTest:rayVector];

                    NSArray *returnArray = [self storeHitResults:results];
                    resolve(returnArray);
                }
            }
        }
    }];
}

RCT_EXPORT_METHOD(performARHitTestWithWorldPoints:(nonnull NSNumber *)viewTag
                  ray:(NSArray *)ray
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    // No-op for iOS, used only in Android
}

RCT_EXPORT_METHOD(performARHitTestWithPosition:(nonnull NSNumber *)viewTag
                  position:(NSArray *)position
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        UIView *sceneView = viewRegistry[viewTag];
        if (![sceneView isKindOfClass:[VRTARScene class]]) {
            RCTLogError(@"Invalid view returned when calling performARHitTestWithPosition: expected VRTARScene, got [%@]", sceneView);
        } else if ([position count] != 3) {
            RCTLogError(@"Invalid Position provided for performARHitTestWithPosition!");
        } else {
            VRTARScene *scene = (VRTARScene *)sceneView;
            UIView *superview = [scene superview];
            if (superview && [superview isKindOfClass:[VRTARSceneNavigator class]]) {
                VRTARSceneNavigator *navigator = (VRTARSceneNavigator *)superview;
                if ([navigator rootVROView]) {
                    VROViewAR *view = (VROViewAR *)[navigator rootVROView];
                    VROVector3f targetPosition = VROVector3f([[position objectAtIndex:0] floatValue],
                                                             [[position objectAtIndex:1] floatValue],
                                                             [[position objectAtIndex:2] floatValue]);
                    NSArray *cameraOrientation = [scene cameraOrientation];
                    VROVector3f cameraPosition = VROVector3f([[cameraOrientation objectAtIndex:0] floatValue],
                                                             [[cameraOrientation objectAtIndex:1] floatValue],
                                                             [[cameraOrientation objectAtIndex:2] floatValue]);
                    std::vector<std::shared_ptr<VROARHitTestResult>> results = [view performARHitTest:(targetPosition - cameraPosition)];
                    NSArray *returnArray = [self storeHitResults:results];
                    resolve(returnArray);
                }
            }
        }
    }];
}

RCT_EXPORT_METHOD(performARHitTestWithPoint:(nonnull NSNumber *)viewTag
                  x:(int)x
                  y:(int)y
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        UIView *sceneView = viewRegistry[viewTag];
        if (![sceneView isKindOfClass:[VRTARScene class]]) {
            RCTLogError(@"Invalid view returned when calling performARHitTestWithPoint: expected VRTARScene, got [%@]", sceneView);
        } else {
            VRTARScene *scene = (VRTARScene *)sceneView;
            UIView *superview = [scene superview];
            if (superview && [superview isKindOfClass:[VRTARSceneNavigator class]]) {
                VRTARSceneNavigator *navigator = (VRTARSceneNavigator *)superview;
                if ([navigator rootVROView]) {
                    VROViewAR *view = (VROViewAR *)[navigator rootVROView];
                    std::vector<std::shared_ptr<VROARHitTestResult>> results = [view performARHitTestWithPoint:x y:y];

                    NSArray *returnArray = [self storeHitResults:results];
                    resolve(returnArray);
                }
            }
        }
    }];
}

/**
 * Create an anchored AR node from a previously stored hit test result.
 * The hit result ID comes from a prior hit test call and must be used within 30 seconds.
 */
RCT_EXPORT_METHOD(createAnchoredNodeFromHitResult:(NSString *)hitResultId
                  sceneTag:(nonnull NSNumber *)sceneTag
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {

#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 110000
    std::shared_ptr<VROARHitTestResult> hitResult = [self getStoredHitResult:hitResultId];

    if (!hitResult) {
        reject(@"HIT_RESULT_NOT_FOUND",
               @"Hit result not found or expired. Hit results are only valid for 30 seconds.",
               nil);
        return;
    }

    // Downcast to iOS-specific type
    std::shared_ptr<VROARHitTestResultiOS> iosHitResult =
        std::dynamic_pointer_cast<VROARHitTestResultiOS>(hitResult);

    if (!iosHitResult) {
        reject(@"INVALID_HIT_RESULT",
               @"Hit result is not a valid iOS hit result",
               nil);
        return;
    }

    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager,
                                        NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        UIView *sceneView = viewRegistry[sceneTag];

        if (![sceneView isKindOfClass:[VRTARScene class]]) {
            reject(@"AR_SCENE_NOT_FOUND", @"ARScene view not found or invalid", nil);
            return;
        }

        // Create anchored node (calls C++ method)
        std::shared_ptr<VROARNode> arNode = iosHitResult->createAnchoredNodeAtHitLocation();

        if (!arNode) {
            reject(@"ANCHOR_CREATION_FAILED",
                   @"Failed to create anchor. AR tracking may be limited or hit result type does not support anchors.",
                   nil);
            return;
        }

        // Generate unique ID for the node
        NSString *nodeId = [[NSUUID UUID] UUIDString];

        // Return node reference
        NSMutableDictionary *nodeRef = [NSMutableDictionary dictionary];
        nodeRef[@"nodeId"] = nodeId;
        nodeRef[@"reactTag"] = sceneTag;

        // Include anchor info if available
        if (arNode->getAnchor()) {
            auto anchor = arNode->getAnchor();
            nodeRef[@"anchorId"] = @(anchor->getId().c_str());

            // Convert transform to dictionary
            VROMatrix4f transform = anchor->getTransform();
            VROVector3f position = transform.extractTranslation();
            VROVector3f scale = transform.extractScale();
            VROQuaternion rotation = transform.extractRotation(scale);

            NSMutableDictionary *transformDict = [NSMutableDictionary dictionary];
            transformDict[@"position"] = @[@(position.x), @(position.y), @(position.z)];
            transformDict[@"rotation"] = @[@(rotation.X), @(rotation.Y), @(rotation.Z), @(rotation.W)];
            transformDict[@"scale"] = @[@(scale.x), @(scale.y), @(scale.z)];

            nodeRef[@"transform"] = transformDict;
        }

        resolve(nodeRef);
    }];
#else
    reject(@"NOT_SUPPORTED",
           @"AR anchor creation requires iOS 11.0 or later",
           nil);
#endif
}


@end
