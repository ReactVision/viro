//
//  VRTVirtualJoystickView.h
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
 Native virtual-joystick view. Renders an outer ring and a draggable knob; on
 touch, the knob follows the finger clamped to the outer ring, and the resulting
 normalised stick position is written directly to a VROInputState bound to
 a string controllerId (via VROVirtualControllerRegistry, defined in virocore).

 Drawing in native UIKit (instead of via React Native <View>) is intentional:
 touch events bypass the JS bridge entirely and update the input state on the
 main thread synchronously. Latency from finger move to readable stick value
 is single-digit milliseconds, vs. 50–80 ms when routing through RN's async
 event path.

 Used by VRTVirtualJoystickViewManager to expose this view to React Native as
 the <ViroVirtualJoystick> component.

 Properties (settable from JavaScript via the manager's RCT_EXPORT_VIEW_PROPERTY
 declarations):
   - controllerId : string. Identifies which VROInputState to write to in the
                    process-wide VROVirtualControllerRegistry. Multiple
                    adapters (this view, a future MFi-gamepad adapter, a tilt
                    adapter) can all write to the same id; consumers read the
                    aggregated state.
   - stickSide    : "left" (default) or "right". Determines whether deflections
                    update stickL or stickR on the input state.
   - radius       : CGFloat, default 60.0. Outer-ring radius in points; the
                    knob is clamped to this distance from the centre.
   - tintColor    : UIColor. Default semi-transparent white. Applies to both
                    ring stroke and knob fill.
 */
@interface VRTVirtualJoystickView : UIView

@property (nonatomic, copy)   NSString *controllerId;
@property (nonatomic, copy)   NSString *stickSide;       // @"left" | @"right"
@property (nonatomic, assign) CGFloat   radius;
@property (nonatomic, strong) UIColor  *tintColor;
// JS callback fired on every stick move: { x: number, y: number } in [-1, 1]
@property (nonatomic, copy)   RCTDirectEventBlock onStickChange;

@end
