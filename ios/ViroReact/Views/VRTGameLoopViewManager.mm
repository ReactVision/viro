//  VRTGameLoopViewManager.mm
//  Copyright © 2026 ReactVision. All rights reserved.

#import "VRTGameLoopViewManager.h"
#import "VRTGameLoopView.h"

@implementation VRTGameLoopViewManager

RCT_EXPORT_MODULE()

- (UIView *)view {
    return [[VRTGameLoopView alloc] initWithBridge:self.bridge];
}

RCT_EXPORT_VIEW_PROPERTY(onUpdate,      RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onLateUpdate,  RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onFixedUpdate, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(fixedHz,       float)

@end
