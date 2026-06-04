//
//  VRTVirtualButtonView.h
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

#import <UIKit/UIKit.h>
#import <React/RCTComponent.h>

/*
 Native virtual-button view. Renders a filled circle with a label; on touch-down
 it writes setButton(idx, true) to a VROInputState from VROVirtualControllerRegistry,
 and on touch-up / cancel writes setButton(idx, false).

 Touch is handled directly on the main thread — no JS bridge round-trip, so
 latency from finger to readable button state is single-digit milliseconds.

 Used by VRTVirtualButtonViewManager to expose <ViroVirtualButton> to React Native.

 Properties:
   - controllerId : string. Registry id (e.g. "p1").
   - button       : "A" | "B" | "X" | "Y" | "Z" | "L1" | "R1" | "L2" | "R2"
                    | "Start" | "Select". Maps to VROInputState::DefaultButton indices.
   - size         : CGFloat, default 44. Diameter of the button circle in points.
   - tintColor    : UIColor. Default semi-transparent white.
 */
@interface VRTVirtualButtonView : UIView

@property (nonatomic, copy)   NSString *controllerId;
@property (nonatomic, copy)   NSString *button;       // e.g. @"A"
@property (nonatomic, assign) CGFloat   size;
@property (nonatomic, strong) UIColor  *tintColor;
@property (nonatomic, copy)   RCTDirectEventBlock onPressIn;
@property (nonatomic, copy)   RCTDirectEventBlock onPressOut;

@end
