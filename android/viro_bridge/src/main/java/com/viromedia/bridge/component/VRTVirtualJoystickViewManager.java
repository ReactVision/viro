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

package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.viromedia.bridge.utility.ViroEvents;
import java.util.Map;

public class VRTVirtualJoystickViewManager extends SimpleViewManager<VRTVirtualJoystickView> {

    public VRTVirtualJoystickViewManager(ReactApplicationContext context) {
        super();
    }

    @Override
    public String getName() {
        return "VRTVirtualJoystickView";
    }

    @Override
    protected VRTVirtualJoystickView createViewInstance(ThemedReactContext reactContext) {
        return new VRTVirtualJoystickView(reactContext);
    }

    @ReactProp(name = "controllerId")
    public void setControllerId(VRTVirtualJoystickView view, String controllerId) {
        view.setControllerId(controllerId);
    }

    @ReactProp(name = "stickSide")
    public void setStickSide(VRTVirtualJoystickView view, String stickSide) {
        view.setStickSide(stickSide);
    }

    @ReactProp(name = "radius", defaultFloat = 60f)
    public void setRadius(VRTVirtualJoystickView view, float radius) {
        view.setRadius(radius);
    }

    @ReactProp(name = "tintColor", customType = "Color")
    public void setTintColor(VRTVirtualJoystickView view, Integer color) {
        if (color != null) {
            view.setTintColor(color);
        }
    }

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of(
            ViroEvents.ON_STICK_CHANGE, MapBuilder.of("registrationName", ViroEvents.ON_STICK_CHANGE)
        );
    }
}
