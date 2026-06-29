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
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.viromedia.bridge.utility.ViroEvents;

import java.util.Map;

public class VRTObjectDetectorViewManager extends SimpleViewManager<VRTObjectDetectorView> {

    public VRTObjectDetectorViewManager(ReactApplicationContext context) {
        super();
    }

    @Override
    public String getName() {
        return "VRTObjectDetectorView";
    }

    @Override
    protected VRTObjectDetectorView createViewInstance(ThemedReactContext reactContext) {
        return new VRTObjectDetectorView(reactContext);
    }

    @ReactProp(name = "model")
    public void setModel(VRTObjectDetectorView view, String model) {
        view.setModel(model);
    }

    @ReactProp(name = "mode")
    public void setMode(VRTObjectDetectorView view, String mode) {
        view.setMode(mode);
    }

    @ReactProp(name = "categories")
    public void setCategories(VRTObjectDetectorView view, ReadableArray categories) {
        view.setCategories(categories);
    }

    @ReactProp(name = "confidenceThreshold", defaultFloat = 0.4f)
    public void setConfidenceThreshold(VRTObjectDetectorView view, float threshold) {
        view.setConfidenceThreshold(threshold);
    }

    @ReactProp(name = "iouThreshold", defaultFloat = 0.45f)
    public void setIouThreshold(VRTObjectDetectorView view, float threshold) {
        view.setIouThreshold(threshold);
    }

    @ReactProp(name = "maxFPS", defaultInt = 15)
    public void setMaxFPS(VRTObjectDetectorView view, int maxFPS) {
        view.setMaxFPS(maxFPS);
    }

    @ReactProp(name = "maxDetections", defaultInt = 20)
    public void setMaxDetections(VRTObjectDetectorView view, int maxDetections) {
        view.setMaxDetections(maxDetections);
    }

    @ReactProp(name = "projectToWorld", defaultBoolean = true)
    public void setProjectToWorld(VRTObjectDetectorView view, boolean projectToWorld) {
        view.setProjectToWorld(projectToWorld);
    }

    @Override
    public Map getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of(
            ViroEvents.ON_DETECTION,
                MapBuilder.of("registrationName", ViroEvents.ON_DETECTION),
            ViroEvents.ON_DETECTOR_READY,
                MapBuilder.of("registrationName", ViroEvents.ON_DETECTOR_READY),
            ViroEvents.ON_DETECTOR_ERROR,
                MapBuilder.of("registrationName", ViroEvents.ON_DETECTOR_ERROR)
        );
    }
}
