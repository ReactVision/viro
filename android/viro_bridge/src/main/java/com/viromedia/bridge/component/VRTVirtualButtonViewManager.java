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

public class VRTVirtualButtonViewManager extends SimpleViewManager<VRTVirtualButtonView> {

    public VRTVirtualButtonViewManager(ReactApplicationContext context) {
        super();
    }

    @Override
    public String getName() {
        return "VRTVirtualButtonView";
    }

    @Override
    protected VRTVirtualButtonView createViewInstance(ThemedReactContext reactContext) {
        return new VRTVirtualButtonView(reactContext);
    }

    @ReactProp(name = "controllerId")
    public void setControllerId(VRTVirtualButtonView view, String controllerId) {
        view.setControllerId(controllerId);
    }

    @ReactProp(name = "button")
    public void setButton(VRTVirtualButtonView view, String button) {
        view.setButton(button);
    }

    @ReactProp(name = "size", defaultFloat = 44f)
    public void setSize(VRTVirtualButtonView view, float size) {
        view.setSize(size);
    }

    @ReactProp(name = "tintColor", customType = "Color")
    public void setTintColor(VRTVirtualButtonView view, Integer color) {
        if (color != null) {
            view.setTintColor(color);
        }
    }

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of(
            ViroEvents.ON_PRESS_IN,  MapBuilder.of("registrationName", ViroEvents.ON_PRESS_IN),
            ViroEvents.ON_PRESS_OUT, MapBuilder.of("registrationName", ViroEvents.ON_PRESS_OUT)
        );
    }
}
