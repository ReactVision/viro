//
//  ViroARObjectMarkerViewManager.java
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
import com.facebook.react.viewmanagers.ViroARObjectMarkerManagerDelegate;
import com.facebook.react.viewmanagers.ViroARObjectMarkerManagerInterface;
import com.facebook.soloader.SoLoader;
import com.viromedia.bridge.utility.ViroLog;

import java.util.HashMap;
import java.util.Map;

/**
 * ViewManager for ViroARObjectMarker in React Native New Architecture (Fabric).
 * Manages the creation and configuration of ViroARObjectMarkerView instances.
 */
@ReactModule(name = ViroARObjectMarkerViewManager.REACT_CLASS)
public class ViroARObjectMarkerViewManager extends ViroNodeViewManager 
        implements ViroARObjectMarkerManagerInterface<ViroARObjectMarkerView> {

    public static final String REACT_CLASS = "ViroARObjectMarker";
    private static final String TAG = ViroLog.getTag(ViroARObjectMarkerViewManager.class);
    
    private final ViewManagerDelegate<ViroARObjectMarkerView> mDelegate;

    static {
        SoLoader.loadLibrary("viro_renderer");
    }

    public ViroARObjectMarkerViewManager() {
        mDelegate = new ViroARObjectMarkerManagerDelegate<>(this);
    }

    @Nullable
    @Override
    protected ViewManagerDelegate<ViroARObjectMarkerView> getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected ViroARObjectMarkerView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.i(TAG, "Creating ViroARObjectMarkerView instance");
        return new ViroARObjectMarkerView(reactContext);
    }

    // AR Object Marker specific props from ViroARObjectMarkerManagerInterface

    @Override
    @ReactProp(name = "target")
    public void setTarget(@NonNull ViroARObjectMarkerView view, @Nullable String value) {
        view.setTarget(value);
    }

    @Override
    @ReactProp(name = "pauseUpdates", defaultBoolean = false)
    public void setPauseUpdates(@NonNull ViroARObjectMarkerView view, boolean value) {
        view.setPauseUpdates(value);
    }

    @Override
    @ReactProp(name = "ignoreEventHandling", defaultBoolean = false)
    public void setIgnoreEventHandling(@NonNull ViroARObjectMarkerView view, boolean value) {
        view.setIgnoreEventHandling(value);
    }

    @Override
    @ReactProp(name = "onAnchorFound")
    public void setOnAnchorFound(@NonNull ViroARObjectMarkerView view, boolean value) {
        view.setOnAnchorFoundListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorUpdated")
    public void setOnAnchorUpdated(@NonNull ViroARObjectMarkerView view, boolean value) {
        view.setOnAnchorUpdatedListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorRemoved")
    public void setOnAnchorRemoved(@NonNull ViroARObjectMarkerView view, boolean value) {
        view.setOnAnchorRemovedListener(value);
    }

    // Commands specific to AR Object Marker

    @Override
    public void reset(@NonNull ViroARObjectMarkerView view) {
        view.reset();
    }

    @Override
    public void getTargetInfo(@NonNull ViroARObjectMarkerView view) {
        view.getTargetInfo();
    }

    // Export AR Object Marker specific event names
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = super.getExportedCustomDirectEventTypeConstants();
        if (events == null) {
            events = new HashMap<>();
        }
        
        // AR Object Marker specific events
        events.put("onAnchorFound", MapBuilder.of("registrationName", "onAnchorFound"));
        events.put("onAnchorUpdated", MapBuilder.of("registrationName", "onAnchorUpdated"));
        events.put("onAnchorRemoved", MapBuilder.of("registrationName", "onAnchorRemoved"));
        events.put("onObjectMarkerReset", MapBuilder.of("registrationName", "onObjectMarkerReset"));
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