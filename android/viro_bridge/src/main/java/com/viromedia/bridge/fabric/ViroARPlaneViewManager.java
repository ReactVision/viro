//
//  ViroARPlaneViewManager.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroARPlaneManagerDelegate;
import com.facebook.react.viewmanagers.ViroARPlaneManagerInterface;
import com.facebook.soloader.SoLoader;
import com.viromedia.bridge.utility.ViroLog;

import java.util.HashMap;
import java.util.Map;

/**
 * ViewManager for ViroARPlane in React Native New Architecture (Fabric).
 * Manages the creation and configuration of ViroARPlaneView instances.
 */
@ReactModule(name = ViroARPlaneViewManager.REACT_CLASS)
public class ViroARPlaneViewManager extends ViroNodeViewManager 
        implements ViroARPlaneManagerInterface<ViroARPlaneView> {

    public static final String REACT_CLASS = "ViroARPlane";
    private static final String TAG = ViroLog.getTag(ViroARPlaneViewManager.class);
    
    private final ViewManagerDelegate<ViroARPlaneView> mDelegate;

    static {
        SoLoader.loadLibrary("viro_renderer");
    }

    public ViroARPlaneViewManager() {
        mDelegate = new ViroARPlaneManagerDelegate<>(this);
    }

    @Nullable
    @Override
    protected ViewManagerDelegate<ViroARPlaneView> getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected ViroARPlaneView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.i(TAG, "Creating ViroARPlaneView instance");
        return new ViroARPlaneView(reactContext);
    }

    // AR Plane specific props from ViroARPlaneManagerInterface

    @Override
    @ReactProp(name = "minWidth", defaultFloat = 0.1f)
    public void setMinWidth(@NonNull ViroARPlaneView view, float value) {
        view.setMinWidth(value);
    }

    @Override
    @ReactProp(name = "minHeight", defaultFloat = 0.1f)
    public void setMinHeight(@NonNull ViroARPlaneView view, float value) {
        view.setMinHeight(value);
    }

    @Override
    @ReactProp(name = "alignment")
    public void setAlignment(@NonNull ViroARPlaneView view, @Nullable String value) {
        view.setAlignment(value);
    }

    @Override
    @ReactProp(name = "anchorId")
    public void setAnchorId(@NonNull ViroARPlaneView view, @Nullable String value) {
        view.setAnchorId(value);
    }

    @Override
    @ReactProp(name = "pauseUpdates", defaultBoolean = false)
    public void setPauseUpdates(@NonNull ViroARPlaneView view, boolean value) {
        view.setPauseUpdates(value);
    }

    @Override
    @ReactProp(name = "ignoreEventHandling", defaultBoolean = false)
    public void setIgnoreEventHandling(@NonNull ViroARPlaneView view, boolean value) {
        view.setIgnoreEventHandling(value);
    }

    @Override
    @ReactProp(name = "onAnchorFound")
    public void setOnAnchorFound(@NonNull ViroARPlaneView view, boolean value) {
        view.setOnAnchorFoundListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorUpdated")
    public void setOnAnchorUpdated(@NonNull ViroARPlaneView view, boolean value) {
        view.setOnAnchorUpdatedListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorRemoved")
    public void setOnAnchorRemoved(@NonNull ViroARPlaneView view, boolean value) {
        view.setOnAnchorRemovedListener(value);
    }

    // Commands specific to AR Plane

    @Override
    public void reset(@NonNull ViroARPlaneView view) {
        view.reset();
    }

    @Override
    public void getPlaneInfo(@NonNull ViroARPlaneView view) {
        view.getPlaneInfo();
    }

    // Export AR Plane specific event names
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = super.getExportedCustomDirectEventTypeConstants();
        if (events == null) {
            events = new HashMap<>();
        }
        
        // AR Plane specific events
        events.put("onAnchorFound", MapBuilder.of("registrationName", "onAnchorFound"));
        events.put("onAnchorUpdated", MapBuilder.of("registrationName", "onAnchorUpdated"));
        events.put("onAnchorRemoved", MapBuilder.of("registrationName", "onAnchorRemoved"));
        events.put("onPlaneReset", MapBuilder.of("registrationName", "onPlaneReset"));
        events.put("onGetPlaneInfoResult", MapBuilder.of("registrationName", "onGetPlaneInfoResult"));
        
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