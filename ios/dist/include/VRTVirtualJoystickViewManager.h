//
//  VRTVirtualJoystickViewManager.h
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

#import <React/RCTViewManager.h>

/*
 React Native view manager for VRTVirtualJoystickView. Exposes the native
 virtual joystick to JS as the <ViroVirtualJoystick> component. See the view's
 header for the rationale on rendering natively (touch latency).
 */
@interface VRTVirtualJoystickViewManager : RCTViewManager
@end
