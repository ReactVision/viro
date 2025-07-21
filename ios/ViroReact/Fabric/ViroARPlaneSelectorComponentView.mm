//
//  ViroARPlaneSelectorComponentView.mm
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

#import "ViroARPlaneSelectorComponentView.h"
#import <React/RCTConversions.h>
#import <React/RCTLog.h>

@implementation ViroARPlaneSelectorComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<facebook::react::ViroARPlaneSelectorComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        RCTLogInfo(@"[ViroARPlaneSelectorComponentView] Initializing AR Plane Selector");
    }
    return self;
}

@end