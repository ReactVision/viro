//
//  VRTScene.h
//  React
//
//  Created by Vik Advani on 12/11/15.
//  Copyright © 2015 Viro Media. All rights reserved.
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

#import <Foundation/Foundation.h>
#import <React/RCTBridge.h>
#import "VRTNode.h"
#import "VRTCamera.h"

@interface VRTScene : VRTNode<VROSceneDelegateProtocol>

@property (nonatomic, assign) BOOL recticleEnabled;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onPlatformUpdateViro;
@property (nonatomic, copy) NSDictionary *physicsWorld;
@property (nonatomic, readwrite) std::shared_ptr<VROSceneControllerDelegateiOS> delegate;
@property (nonatomic, readwrite) std::shared_ptr<VROSceneController> sceneController;
@property (nonatomic, copy, nullable) NSArray<NSString *> *postProcessEffects;
@property (nonatomic, assign) BOOL toneMappingEnabled;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onCameraTransformUpdateViro;
@property (nonatomic, assign) BOOL canCameraTransformUpdate;

/*
 The React tag of the camera this scene has been asked to draw from, or nil for the scene's
 default camera. JS sets it through the `activeCameraTag` prop (VRTCameraModule sets it too).

 The camera's view may not be in the tree when the tag arrives. React Native's legacy interop
 holds back a child inserted anywhere but at the end of its parent until that parent next
 updates, and a tag that is a prop of the scene makes the scene update, so by the time the
 setter runs a camera queued on the scene has been inserted. A camera queued deeper, or one
 that arrives for any other reason later, is attached by -cameraDidJoinScene: when it joins
 the tree. Until the requested camera arrives the scene keeps drawing from the camera it has.
 */
@property (nonatomic, copy, nullable) NSNumber *activeCameraTag;

- (instancetype)initWithBridge:(RCTBridge *)bridge;
- (void) initSceneController;

- (std::shared_ptr<VROSceneController>)sceneController;
- (NSArray<NSNumber *> *)cameraOrientation;

- (void)setView:(id <VROView>)view;
- (id<VROView>)getVROView;
- (void)setCamera:(VRTCamera *)camera;
- (void)removeCamera:(VRTCamera *)camera;
// Called by a VRTCamera as it joins this scene's tree. Attaches it if it is the requested camera.
- (void)cameraDidJoinScene:(VRTCamera *)camera;
- (void)setSoundRoom:(NSDictionary *)soundRoom;

@end
