//
//  VRTVirtualButtonViewManager.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
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

#import "VRTVirtualButtonViewManager.h"
#import "VRTVirtualButtonView.h"

@implementation VRTVirtualButtonViewManager

RCT_EXPORT_MODULE()

- (UIView *)view {
    return [[VRTVirtualButtonView alloc] init];
}

// String identifying the controller in the process-wide registry.
RCT_EXPORT_VIEW_PROPERTY(controllerId, NSString *)

// Button name: "A" | "B" | "X" | "Y" | "Z" | "L1" | "R1" | "L2" | "R2" | "Start" | "Select"
RCT_EXPORT_VIEW_PROPERTY(button, NSString *)

// Diameter of the button circle in points. Default 44.
RCT_EXPORT_VIEW_PROPERTY(size, CGFloat)

// Fill colour of the circle. Default semi-transparent white.
RCT_EXPORT_VIEW_PROPERTY(tintColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(onPressIn,  RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPressOut, RCTDirectEventBlock)

@end
