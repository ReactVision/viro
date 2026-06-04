// Copyright © 2026 ReactVision. All rights reserved.
package com.viromedia.bridge.component;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.viromedia.bridge.component.node.VRTNodeManager;
import com.viromedia.bridge.utility.ViroEvents;
import java.util.Map;

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

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        Map events = super.getExportedCustomDirectEventTypeConstants();
        if (events == null) events = MapBuilder.builder().build();
        events.put(ViroEvents.ON_UPDATE,       MapBuilder.of("registrationName", ViroEvents.ON_UPDATE));
        events.put(ViroEvents.ON_LATE_UPDATE,  MapBuilder.of("registrationName", ViroEvents.ON_LATE_UPDATE));
        events.put(ViroEvents.ON_FIXED_UPDATE, MapBuilder.of("registrationName", ViroEvents.ON_FIXED_UPDATE));
        return events;
    }
}
