//
//  ViroARImageMarkerViewManager.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroARImageMarkerManagerDelegate;
import com.facebook.react.viewmanagers.ViroARImageMarkerManagerInterface;
import com.facebook.soloader.SoLoader;
import com.viromedia.bridge.utility.ViroLog;

import java.util.HashMap;
import java.util.Map;

/**
 * ViewManager for ViroARImageMarker in React Native New Architecture (Fabric).
 * Manages the creation and configuration of ViroARImageMarkerView instances.
 */
@ReactModule(name = ViroARImageMarkerViewManager.REACT_CLASS)
public class ViroARImageMarkerViewManager extends ViroNodeViewManager 
        implements ViroARImageMarkerManagerInterface<ViroARImageMarkerView> {

    public static final String REACT_CLASS = "ViroARImageMarker";
    private static final String TAG = ViroLog.getTag(ViroARImageMarkerViewManager.class);
    
    private final ViewManagerDelegate<ViroARImageMarkerView> mDelegate;

    static {
        SoLoader.loadLibrary("viro_renderer");
    }

    public ViroARImageMarkerViewManager() {
        mDelegate = new ViroARImageMarkerManagerDelegate<>(this);
    }

    @Nullable
    @Override
    protected ViewManagerDelegate<ViroARImageMarkerView> getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected ViroARImageMarkerView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.i(TAG, "Creating ViroARImageMarkerView instance");
        return new ViroARImageMarkerView(reactContext);
    }

    // AR Image Marker specific props from ViroARImageMarkerManagerInterface

    @Override
    @ReactProp(name = "target")
    public void setTarget(@NonNull ViroARImageMarkerView view, @Nullable String value) {
        view.setTarget(value);
    }

    @Override
    @ReactProp(name = "pauseUpdates", defaultBoolean = false)
    public void setPauseUpdates(@NonNull ViroARImageMarkerView view, boolean value) {
        view.setPauseUpdates(value);
    }

    @Override
    @ReactProp(name = "ignoreEventHandling", defaultBoolean = false)
    public void setIgnoreEventHandling(@NonNull ViroARImageMarkerView view, boolean value) {
        view.setIgnoreEventHandling(value);
    }

    @Override
    @ReactProp(name = "onAnchorFound")
    public void setOnAnchorFound(@NonNull ViroARImageMarkerView view, boolean value) {
        view.setOnAnchorFoundListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorUpdated")
    public void setOnAnchorUpdated(@NonNull ViroARImageMarkerView view, boolean value) {
        view.setOnAnchorUpdatedListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorRemoved")
    public void setOnAnchorRemoved(@NonNull ViroARImageMarkerView view, boolean value) {
        view.setOnAnchorRemovedListener(value);
    }

    // Commands specific to AR Image Marker

    @Override
    public void reset(@NonNull ViroARImageMarkerView view) {
        view.reset();
    }

    @Override
    public void getTargetInfo(@NonNull ViroARImageMarkerView view) {
        view.getTargetInfo();
    }

    // Export AR Image Marker specific event names
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = super.getExportedCustomDirectEventTypeConstants();
        if (events == null) {
            events = new HashMap<>();
        }
        
        // AR Image Marker specific events
        events.put("onAnchorFound", MapBuilder.of("registrationName", "onAnchorFound"));
        events.put("onAnchorUpdated", MapBuilder.of("registrationName", "onAnchorUpdated"));
        events.put("onAnchorRemoved", MapBuilder.of("registrationName", "onAnchorRemoved"));
        events.put("onImageMarkerReset", MapBuilder.of("registrationName", "onImageMarkerReset"));
        events.put("onGetTargetInfoResult", MapBuilder.of("registrationName", "onGetTargetInfoResult"));
        
        return events;
    }

    // Helper class for building event maps
    private static class MapBuilder {
        public static Map<String, Object> of(String key, Object value) {
            Map<String, Object> map = new HashMap<>();
            map.put(key, value);
            return map;
        }
    }
}