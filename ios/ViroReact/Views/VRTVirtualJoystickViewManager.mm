//
//  VRTVirtualJoystickViewManager.mm
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

#import "VRTVirtualJoystickViewManager.h"
#import "VRTVirtualJoystickView.h"

@implementation VRTVirtualJoystickViewManager

RCT_EXPORT_MODULE()

- (UIView *)view {
    return [[VRTVirtualJoystickView alloc] init];
}

// String identifying the controller in the process-wide registry.
RCT_EXPORT_VIEW_PROPERTY(controllerId, NSString *)

// "left" (default) or "right" — which stick on the controller this view drives.
RCT_EXPORT_VIEW_PROPERTY(stickSide, NSString *)

// Outer ring radius in points; the knob is clamped to this distance from
// the centre. Default 60.
RCT_EXPORT_VIEW_PROPERTY(radius, CGFloat)

// UIColor applied to both the outer ring stroke and the knob fill.
RCT_EXPORT_VIEW_PROPERTY(tintColor, UIColor)
// JS event fired on every stick move: { x: number, y: number }
RCT_EXPORT_VIEW_PROPERTY(onStickChange, RCTDirectEventBlock)

@end
