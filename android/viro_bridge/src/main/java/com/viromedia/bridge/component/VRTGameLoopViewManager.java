// Copyright © 2026 ReactVision. All rights reserved.
package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.viromedia.bridge.component.node.VRTNodeManager;

public class VRTGameLoopViewManager extends VRTNodeManager<VRTGameLoopView> {

    public VRTGameLoopViewManager(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "VRTGameLoopView";
    }

    @Override
    protected VRTGameLoopView createViewInstance(ThemedReactContext reactContext) {
        return new VRTGameLoopView(reactContext);
    }

    @ReactProp(name = "fixedHz", defaultFloat = 0.f)
    public void setFixedHz(VRTGameLoopView view, float hz) {
        view.setFixedHz(hz);
    }
}
