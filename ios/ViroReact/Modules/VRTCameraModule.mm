//
//  VRTCameraModule.m
//  ViroReact
//
//  Created by Raj Advani on 1/26/17.
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
#import "VRTCameraModule.h"
#import "VRTCamera.h"
#import "VRTScene.h"
#import <React/RCTUIManagerUtils.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

typedef void (^VRTSceneBlock)(VRTScene *scene);

@implementation VRTCameraModule

@synthesize bridge = _bridge;
// Same lookup as VRTARSceneNavigatorModule: under the new architecture the
// NSDictionary the legacy RCTUIManager block hands out never holds
// interop-mounted views, and a scene's children can report their mount before
// Fabric has mounted the scene. RCTViewRegistry returns the interop wrapper,
// hence the paper-view unwrap.
//
// Only the scene is looked up here. The camera is named by tag and the scene
// attaches it itself, now if it is in the tree and otherwise as it joins: a
// camera inserted between its siblings is held back by React Native's legacy
// interop until the scene next updates, which can be long after any lookup
// here would have given up (see -[VRTScene activeCameraTag]). ViroScene sends
// the same tag as a prop; these methods remain for callers of the module.
@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;

static const int kVRTSceneLookupMaxFrames = 60;

RCT_EXPORT_MODULE()

- (dispatch_queue_t)methodQueue {
    return RCTGetUIManagerQueue();
}

static UIView *VRTViewForTag(RCTViewRegistry *viewRegistry, NSNumber *tag) {
    return RCTPaperViewOrCurrentView([viewRegistry viewForReactTag:tag]);
}

// Waits up to about a second of frames for the scene to resolve, since JS can
// ask before Fabric has mounted it. With retry off, a miss is dropped at once:
// a scene that is being removed may already be gone.
- (void)withScene:(NSNumber *)sceneTag
            retry:(BOOL)retry
          attempt:(int)attempt
           action:(NSString *)action
            block:(VRTSceneBlock)block {
    RCTViewRegistry *registry = self.viewRegistry_DEPRECATED;
    if (registry == nil) {
        RCTLogWarn(@"[Viro] viewRegistry_DEPRECATED is nil, cannot %@ camera on scene %@", action, sceneTag);
        return;
    }
    __weak __typeof(self) weakSelf = self;
    [registry addUIBlock:^(RCTViewRegistry *viewRegistry) {
        UIView *sceneView = VRTViewForTag(viewRegistry, sceneTag);
        if ([sceneView isKindOfClass:[VRTScene class]]) {
            block((VRTScene *)sceneView);
            return;
        }
        if (!retry) {
            return;
        }
        if (attempt < kVRTSceneLookupMaxFrames) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(16 * NSEC_PER_MSEC)),
                           dispatch_get_main_queue(), ^{
                [weakSelf withScene:sceneTag retry:retry attempt:attempt + 1 action:action block:block];
            });
            return;
        }
        RCTLogError(@"Invalid view returned when %@ camera after %d frames: expected VRTScene, got [%@]",
                    action, attempt, sceneView);
    }];
}

RCT_EXPORT_METHOD(getCameraOrientation:(nonnull NSNumber *)reactTag
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    RCTViewRegistry *registry = self.viewRegistry_DEPRECATED;
    if (registry == nil) {
        reject(@"invalid_view", @"viewRegistry_DEPRECATED is nil", nil);
        return;
    }
    [registry addUIBlock:^(RCTViewRegistry *viewRegistry) {
        UIView *view = VRTViewForTag(viewRegistry, reactTag);
        if (![view isKindOfClass:[VRTScene class]]) {
            RCTLogError(@"Invalid view returned from registry, expecting VRTScene, got: %@", view);
            reject(@"invalid_view", @"Invalid view returned from registry, expecting VRTScene", nil);
        } else {
            resolve(((VRTScene *)view).cameraOrientation);
        }
    }];
}

RCT_EXPORT_METHOD(setSceneCamera:(nonnull NSNumber *)sceneTag camera:(nonnull NSNumber *)cameraTag) {
    [self withScene:sceneTag retry:YES attempt:0 action:@"setting" block:^(VRTScene *scene) {
        scene.activeCameraTag = cameraTag;
    }];
}

RCT_EXPORT_METHOD(removeSceneCamera:(nonnull NSNumber *)sceneTag camera:(nonnull NSNumber *)cameraTag) {
    [self withScene:sceneTag retry:NO attempt:0 action:@"removing" block:^(VRTScene *scene) {
        // Only the camera the scene was last asked for can take it back to the default camera.
        if ([scene.activeCameraTag isEqual:cameraTag]) {
            scene.activeCameraTag = nil;
        }
    }];
}

@end
