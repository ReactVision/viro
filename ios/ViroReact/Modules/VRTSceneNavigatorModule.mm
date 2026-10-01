//
//  VRTSceneNavigatorModule.m
//  ViroReact
//
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

#import "VRTSceneNavigatorModule.h"
#import "VRTSceneNavigator.h"
#import "VRTViewLookup.h"

@implementation VRTSceneNavigatorModule
@synthesize bridge = _bridge;
@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;

RCT_EXPORT_MODULE()

- (dispatch_queue_t)methodQueue {
    return RCTGetUIManagerQueue();
}

RCT_EXPORT_METHOD(requestExitVr:(nonnull NSNumber *)sceneNavTag) {
    VRTWithViewForTag(self.viewRegistry_DEPRECATED, sceneNavTag, [VRTSceneNavigator class], ^(UIView *resolvedView) {
        NSLog(@"User Exit VR VRTSceneNav Module RCT_EXPORT_METHOD");
        
        UIView *sceneNavigator = resolvedView;
        
        if (![sceneNavigator isKindOfClass:[VRTSceneNavigator class]]) {
            RCTLogError(@"Invalid view returned when requestingExitVR: expected VRTSceneNavigator, got [%@]", sceneNavigator);
        }
        else {
            NSLog(@"User Exit VR VRTSceneNav Module");
            VRTSceneNavigator *nav = (VRTSceneNavigator *)sceneNavigator;
            [nav userDidRequestExitVR];
        }
    });
}

RCT_EXPORT_METHOD(recenterTracking:(nonnull NSNumber *)sceneNavTag) {
    VRTWithViewForTag(self.viewRegistry_DEPRECATED, sceneNavTag, [VRTSceneNavigator class], ^(UIView *resolvedView) {
        UIView *sceneNavigator = (UIView *)resolvedView;
        
        if (![sceneNavigator isKindOfClass:[VRTSceneNavigator class]]) {
            RCTLogError(@"Invalid view returned when recenterTracking: expected VRTSceneNavigator, got [%@]", sceneNavigator);
        }
        else {
            NSLog(@"Viro - recentering tracking.");
            VRTSceneNavigator *nav = (VRTSceneNavigator *)sceneNavigator;
            [nav recenterTracking];
        }
    });
}

//take 3d position and convert to 2d screen position.
RCT_EXPORT_METHOD(project:(nonnull NSNumber *)reactTag
                  position:(NSArray<NSNumber *> *)position
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    VRTWithViewForTag(self.viewRegistry_DEPRECATED, reactTag, [VRTSceneNavigator class], ^(UIView *resolvedView) {

        VROVector3f pos = VROVector3f([[position objectAtIndex:0] floatValue],
                                      [[position objectAtIndex:1] floatValue],
                                      [[position objectAtIndex:2] floatValue]);

        VRTView *view = (VRTView *)resolvedView;
        if (![view isKindOfClass:[VRTSceneNavigator class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting VRTSceneNavigator, got: %@", view);
        } else {
            VRTSceneNavigator *component = (VRTSceneNavigator *)view;
            VROVector3f projectedPoint = [component projectPoint:pos];
            resolve(@{
                      @"screenPosition" : @[@(projectedPoint.x), @(projectedPoint.y)]});
            }
    });
}

// take 2d screen position and project into 3d
RCT_EXPORT_METHOD(unproject:(nonnull NSNumber *)reactTag
                  position:(NSArray<NSNumber *> *)position
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    VRTWithViewForTag(self.viewRegistry_DEPRECATED, reactTag, [VRTSceneNavigator class], ^(UIView *resolvedView) {

        VROVector3f pos = VROVector3f([[position objectAtIndex:0] floatValue],
                    [[position objectAtIndex:1] floatValue],
                    [[position objectAtIndex:2] floatValue]);

        VRTView *view = (VRTView *)resolvedView;
        if (![view isKindOfClass:[VRTSceneNavigator class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting VRTSceneNavigator, got: %@", view);
        } else {
            VRTSceneNavigator *component = (VRTSceneNavigator *)view;
            VROVector3f projectedPoint = [component unprojectPoint:pos];
            resolve(@{
                      @"position" : @[@(projectedPoint.x), @(projectedPoint.y), @(projectedPoint.z)]});
        }
    });
}
                    
@end
