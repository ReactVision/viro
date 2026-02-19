//
//  VRTARSceneNavigatorManager.mm
//  ViroReact
//
//  Created by Andy Chu on 6/12/17.
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
#import <ViroKit/ViroKit.h>
#import "VRTARSceneNavigatorManager.h"
#import "VRTARSceneNavigator.h"
#import "VRTFabricCrashFix.h"

@implementation VRTARSceneNavigatorManager

RCT_EXPORT_MODULE()

RCT_EXPORT_VIEW_PROPERTY(currentSceneIndex, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(worldAlignment, NSString)
RCT_EXPORT_VIEW_PROPERTY(autofocus, BOOL)
RCT_EXPORT_VIEW_PROPERTY(videoQuality, NSString)
RCT_EXPORT_VIEW_PROPERTY(numberOfTrackedImages, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(hdrEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(pbrEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(bloomEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(shadowsEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(multisamplingEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(occlusionMode, NSString)
RCT_EXPORT_VIEW_PROPERTY(depthEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(depthDebugEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(cloudAnchorProvider, NSString)
RCT_EXPORT_VIEW_PROPERTY(geospatialAnchorProvider, NSString)
RCT_EXPORT_VIEW_PROPERTY(worldMeshEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(worldMeshConfig, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(onWorldMeshUpdated, RCTDirectEventBlock)

- (VRTARSceneNavigator *)view
{
    // Install crash fix for Fabric view recycling (protects all Viro components except ARSceneNavigator)
    // ARSceneNavigator uses +shouldBeRecycled to disable recycling entirely (too heavy at 700MB+)
    [VRTFabricCrashFix installFabricCrashFix];

    return [[VRTARSceneNavigator alloc] initWithBridge:self.bridge];
}

#ifdef RCT_NEW_ARCH_ENABLED
// Fabric-specific: Force invalidation when view is removed
- (void)invalidateView:(UIView *)view
{
    if ([view isKindOfClass:[VRTARSceneNavigator class]]) {
        VRTARSceneNavigator *navigator = (VRTARSceneNavigator *)view;
        [navigator invalidate];
        [navigator cleanupViroResources];
    }
}
#endif

@end
