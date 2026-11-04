//
//  VRTOrbitCamera.m
//  React
//
//  Created by Raj Advani on 10/5/16.
//  Copyright © 2016 Viro Media. All rights reserved.
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

#import "VRTOrbitCamera.h"
#import "VRTUtils.h"

static NSArray *const kDefaultOrbitFocalPoint = @[@0, @0, @0];

@implementation VRTOrbitCamera

@synthesize focalPoint = _focalPoint;

- (instancetype)initWithBridge:(RCTBridge *)bridge {
    self = [super initWithBridge:bridge];
    if (self) {
        self.focalPoint = kDefaultOrbitFocalPoint;
        self.nodeCamera->setRotationType(VROCameraRotationType::Orbit);
    }
    
    return self;
}

- (void)setFocalPoint:(NSArray<NSNumber *> *)focal {
    _focalPoint = [focal copy];
    [self updateOrbitFocalPoint];
}

- (void)setPosition:(NSArray<NSNumber *> *)position {
    [super setPosition:position];
    [self updateOrbitFocalPoint];
}

// The renderer adds the camera root node's world position, where VRTCamera puts
// `position`, to the orbit focal point. Passing the focal point relative to
// `position` keeps it a world point, as Android's bridge treats it.
- (void)updateOrbitFocalPoint {
    // focalPoint is optional: without one the renderer keeps its own, and a
    // position alone must not hand it an unset point.
    if (_focalPoint.count < 3) {
        return;
    }
    float focal[3];
    float position[3] = {0, 0, 0};
    populateFloatArrayFromNSArray(_focalPoint, focal, 3);
    if (self.position) {
        populateFloatArrayFromNSArray(self.position, position, 3);
    }
    self.nodeCamera->setOrbitFocalPoint({focal[0] - position[0],
                                         focal[1] - position[1],
                                         focal[2] - position[2]});
}

- (VROCameraRotationType)rotationType {
    return VROCameraRotationType::Orbit;
}

@end
