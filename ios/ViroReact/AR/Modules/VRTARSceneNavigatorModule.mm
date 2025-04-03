//
//  VRTARSceneNavigatorModule.m
//  ViroReact
//
//  Created by Andy Chu on 7/25/17.
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
#import "VRTARSceneNavigatorModule.h"
#import "VRTARSceneNavigator.h"
#import <React/RCTUIManagerUtils.h>
#import "VRTUtils.h"

@implementation VRTARSceneNavigatorModule
@synthesize bridge = _bridge;

static NSString *const kVRTRecordingKeySuccess = @"success";
static NSString *const kVRTRecordingKeyUrl = @"url";
static NSString *const kVRTRecordingKeyErrorCode = @"errorCode";

RCT_EXPORT_MODULE()

- (dispatch_queue_t)methodQueue {
    return RCTGetUIManagerQueue();
}

RCT_EXPORT_METHOD(startVideoRecording:(nonnull NSNumber *)reactTag
                             fileName:(NSString *)fileName
                     saveToCameraRoll:(BOOL)saveToCameraRoll
                              callback:(RCTResponseSenderBlock)callback) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        @try {
            VRTView *view = (VRTView *)viewRegistry[reactTag];
            if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
                RCTLogError(@"Invalid view returned from registry, expecting VRTARSceneNavigator, got: %@", view);
                callback(@[@(1)]); // Error code 1: Invalid view
                return;
            }
            
            VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
            
            // Check if component is still valid
            if (!component.rootVROView) {
                RCTLogWarn(@"Cannot start video recording: AR view has been unmounted");
                callback(@[@(2)]); // Error code 2: View unmounted
                return;
            }
            
            [component startVideoRecording:fileName saveToCameraRoll:saveToCameraRoll onError:callback];
        } @catch (NSException *exception) {
            RCTLogError(@"Error starting video recording: %@", exception.reason);
            callback(@[@(3)]); // Error code 3: Exception
        }
    }];
}

RCT_EXPORT_METHOD(stopVideoRecording:(nonnull NSNumber *)reactTag
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        @try {
            VRTView *view = (VRTView *)viewRegistry[reactTag];
            if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
                reject(@"invalid_view", @"Invalid view returned from registry, expecting VRTARSceneNavigator", nil);
                return;
            }
            
            VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
            
            // Check if component is still valid
            if (!component.rootVROView) {
                NSMutableDictionary *toReturn = [NSMutableDictionary new];
                [toReturn setObject:@(NO) forKey:kVRTRecordingKeySuccess];
                [toReturn setObject:@(2) forKey:kVRTRecordingKeyErrorCode]; // Error code 2: View unmounted
                resolve(toReturn);
                return;
            }
            
            [component stopVideoRecordingWithHandler:^(BOOL success, NSURL *url, NSURL *gifPath, NSInteger errorCode) {
                NSMutableDictionary *toReturn = [NSMutableDictionary new];
                [toReturn setObject:@(success) forKey:kVRTRecordingKeySuccess];
                if (url) [toReturn setObject:[url path] forKey:kVRTRecordingKeyUrl];
                [toReturn setObject:@(errorCode) forKey:kVRTRecordingKeyErrorCode];
                resolve(toReturn);
            }];
        } @catch (NSException *exception) {
            reject(@"recording_error", [NSString stringWithFormat:@"Error stopping video recording: %@", exception.reason], nil);
        }
    }];
}

RCT_EXPORT_METHOD(takeScreenshot:(nonnull NSNumber *)reactTag
                        fileName:(NSString *)fileName
                saveToCameraRoll:(BOOL)saveToCameraRoll
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        @try {
            VRTView *view = (VRTView *)viewRegistry[reactTag];
            if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
                reject(@"invalid_view", @"Invalid view returned from registry, expecting VRTARSceneNavigator", nil);
                return;
            }
            
            VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
            
            // Check if component is still valid
            if (!component.rootVROView) {
                NSMutableDictionary *toReturn = [NSMutableDictionary new];
                [toReturn setObject:@(NO) forKey:kVRTRecordingKeySuccess];
                [toReturn setObject:@(2) forKey:kVRTRecordingKeyErrorCode]; // Error code 2: View unmounted
                resolve(toReturn);
                return;
            }
            
            [component takeScreenshot:fileName
                     saveToCameraRoll:saveToCameraRoll
                    completionHandler:^(BOOL success, NSURL *url, NSURL *gifPath, NSInteger errorCode) {
                NSMutableDictionary *toReturn = [NSMutableDictionary new];
                [toReturn setObject:@(success) forKey:kVRTRecordingKeySuccess];
                if (url) [toReturn setObject:[url path] forKey:kVRTRecordingKeyUrl];
                [toReturn setObject:@(errorCode) forKey:kVRTRecordingKeyErrorCode];
                resolve(toReturn);
            }];
        } @catch (NSException *exception) {
            reject(@"screenshot_error", [NSString stringWithFormat:@"Error taking screenshot: %@", exception.reason], nil);
        }
    }];
}

RCT_EXPORT_METHOD(resetARSession:(nonnull NSNumber *)reactTag
                  resetTracking:(BOOL)resetTracking
                  removeAnchors:(BOOL)removeAnchors) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        VRTView *view = (VRTView *)viewRegistry[reactTag];
        if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting VRTARSceneNavigator, got: %@", view);
        } else {
            @try {
                VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
                VROViewAR *arView = (VROViewAR *)[component rootVROView];
                
                // Check if view and AR session are still valid
                if (!arView) {
                    RCTLogWarn(@"Cannot reset AR session: AR view is nil");
                    return;
                }
                
                std::shared_ptr<VROARSession> arSession = arView.getARSession;
                if (!arSession) {
                    RCTLogWarn(@"Cannot reset AR session: AR session is nil");
                    return;
                }
                
                // Reset the session safely
                arSession->resetSession(resetTracking, removeAnchors);
            } @catch (NSException *exception) {
                RCTLogError(@"Error resetting AR session: %@", exception.reason);
            }
        }
    }];
}

RCT_EXPORT_METHOD(setWorldOrigin:(nonnull NSNumber *)reactTag
                     worldOrigin:(NSDictionary *)worldOrigin) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        VRTView *view = (VRTView *)viewRegistry[reactTag];
        if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting VRTARSceneNavigator, got: %@", view);
        } else {
            @try {
                VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
                VROViewAR *arView = (VROViewAR *)[component rootVROView];
                
                // Check if view is still valid
                if (!arView) {
                    RCTLogWarn(@"Cannot set world origin: AR view is nil");
                    return;
                }
                
                std::shared_ptr<VROARSession> session = [arView getARSession];
                if (!session) {
                    RCTLogWarn(@"Cannot set world origin: AR session is nil");
                    return;
                }
                
                NSArray *posArray = [worldOrigin objectForKey:@"position"];
                NSArray *rotArray = [worldOrigin objectForKey:@"rotation"];
                
                VROMatrix4f originMatrix;
                if (posArray) {
                    if ([posArray count] == 3) {
                        float positionValues[3];
                        populateFloatArrayFromNSArray(posArray, positionValues, 3);
                        originMatrix.translate({positionValues[0], positionValues[1], positionValues[2]});
                    } else {
                        RCTLogError(@"[Viro] worldOrigin position requires 3 values");
                    }
                }
                
                if (rotArray) {
                    if ([rotArray count] == 3) {
                        float rotationValues[3];
                        populateFloatArrayFromNSArray(rotArray, rotationValues, 3);
                        originMatrix.rotateX(toRadians(rotationValues[0]));
                        originMatrix.rotateY(toRadians(rotationValues[1]));
                        originMatrix.rotateZ(toRadians(rotationValues[2]));
                    } else {
                        RCTLogError(@"[Viro] worldOrigin rotation requires 3 values");
                    }
                }
                
                session->setWorldOrigin(originMatrix);
            } @catch (NSException *exception) {
                RCTLogError(@"Error setting world origin: %@", exception.reason);
            }
        }
    }];
}


//take 3d position and convert to 2d screen position.
RCT_EXPORT_METHOD(project:(nonnull NSNumber *)reactTag
                  position:(NSArray<NSNumber *> *)position
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        @try {
            // Validate input parameters
            if (!position || position.count != 3) {
                reject(@"invalid_position", @"Position must be an array of 3 numbers", nil);
                return;
            }
            
            VROVector3f pos = VROVector3f([[position objectAtIndex:0] floatValue],
                                          [[position objectAtIndex:1] floatValue],
                                          [[position objectAtIndex:2] floatValue]);
            
            VRTView *view = (VRTView *)viewRegistry[reactTag];
            if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
                reject(@"invalid_view", @"Invalid view returned from registry, expecting VRTARSceneNavigator", nil);
                return;
            }
            
            VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
            
            // Check if component is still valid
            if (!component.rootVROView) {
                reject(@"invalid_state", @"AR view has been unmounted", nil);
                return;
            }
            
            VROVector3f projectedPoint = [component projectPoint:pos];
            resolve(@{
                @"screenPosition" : @[@(projectedPoint.x), @(projectedPoint.y)]
            });
        } @catch (NSException *exception) {
            reject(@"projection_error", [NSString stringWithFormat:@"Error projecting point: %@", exception.reason], nil);
        }
    }];
}

// take 2d screen position and project into 3d
RCT_EXPORT_METHOD(unproject:(nonnull NSNumber *)reactTag
                  position:(NSArray<NSNumber *> *)position
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        @try {
            // Validate input parameters
            if (!position || position.count != 3) {
                reject(@"invalid_position", @"Position must be an array of 3 numbers", nil);
                return;
            }
            
            VROVector3f pos = VROVector3f([[position objectAtIndex:0] floatValue],
                                          [[position objectAtIndex:1] floatValue],
                                          [[position objectAtIndex:2] floatValue]);
            
            VRTView *view = (VRTView *)viewRegistry[reactTag];
            if (![view isKindOfClass:[VRTARSceneNavigator class]]) {
                reject(@"invalid_view", @"Invalid view returned from registry, expecting VRTARSceneNavigator", nil);
                return;
            }
            
            VRTARSceneNavigator *component = (VRTARSceneNavigator *)view;
            
            // Check if component is still valid
            if (!component.rootVROView) {
                reject(@"invalid_state", @"AR view has been unmounted", nil);
                return;
            }
            
            VROVector3f unprojectedPoint = [component unprojectPoint:pos];
            resolve(@{
                @"position" : @[@(unprojectedPoint.x), @(unprojectedPoint.y), @(unprojectedPoint.z)]
            });
        } @catch (NSException *exception) {
            reject(@"unprojection_error", [NSString stringWithFormat:@"Error unprojecting point: %@", exception.reason], nil);
        }
    }];
}

@end
