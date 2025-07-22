//
//  ViroARSceneViewManager.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroARSceneManagerDelegate;
import com.facebook.react.viewmanagers.ViroARSceneManagerInterface;
import com.facebook.soloader.SoLoader;
import com.viromedia.bridge.fabric.ViroSceneViewManager;
import com.viromedia.bridge.utility.ViroLog;

import java.util.HashMap;
import java.util.Map;

/**
 * ViewManager for ViroARScene in React Native New Architecture (Fabric).
 * Manages the creation and configuration of ViroARSceneView instances.
 */
@ReactModule(name = ViroARSceneViewManager.REACT_CLASS)
public class ViroARSceneViewManager extends ViroSceneViewManager 
        implements ViroARSceneManagerInterface<ViroARSceneView> {

    public static final String REACT_CLASS = "ViroARScene";
    private static final String TAG = ViroLog.getTag(ViroARSceneViewManager.class);
    
    private final ViewManagerDelegate<ViroARSceneView> mDelegate;

    static {
        SoLoader.loadLibrary("viro_renderer");
    }

    public ViroARSceneViewManager() {
        mDelegate = new ViroARSceneManagerDelegate<>(this);
    }

    @Nullable
    @Override
    protected ViewManagerDelegate<ViroARSceneView> getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected ViroARSceneView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.i(TAG, "Creating ViroARSceneView instance");
        return new ViroARSceneView(reactContext);
    }

    // AR-specific props from ViroARSceneManagerInterface

    @Override
    @ReactProp(name = "displayPointCloud")
    public void setDisplayPointCloud(@NonNull ViroARSceneView view, boolean value) {
        view.setDisplayPointCloud(value);
    }

    @Override
    @ReactProp(name = "pointCloudScale")
    public void setPointCloudScale(@NonNull ViroARSceneView view, @Nullable ReadableArray value) {
        view.setPointCloudScale(value);
    }

    @Override
    @ReactProp(name = "pointCloudMaxPoints")
    public void setPointCloudMaxPoints(@NonNull ViroARSceneView view, int value) {
        view.setPointCloudMaxPoints(value);
    }

    @Override
    @ReactProp(name = "onARInitialized")
    public void setOnARInitialized(@NonNull ViroARSceneView view, boolean value) {
        view.setOnARInitializedListener(value);
    }

    @Override
    @ReactProp(name = "onTrackingUpdated")
    public void setOnTrackingUpdated(@NonNull ViroARSceneView view, boolean value) {
        view.setOnTrackingUpdatedListener(value);
    }

    @Override
    @ReactProp(name = "onAmbientLightUpdate")
    public void setOnAmbientLightUpdate(@NonNull ViroARSceneView view, boolean value) {
        view.setOnAmbientLightUpdateListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorFound")
    public void setOnAnchorFound(@NonNull ViroARSceneView view, boolean value) {
        view.setOnAnchorFoundListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorUpdated")
    public void setOnAnchorUpdated(@NonNull ViroARSceneView view, boolean value) {
        view.setOnAnchorUpdatedListener(value);
    }

    @Override
    @ReactProp(name = "onAnchorRemoved")
    public void setOnAnchorRemoved(@NonNull ViroARSceneView view, boolean value) {
        view.setOnAnchorRemovedListener(value);
    }

    // Commands specific to AR Scene

    @Override
    public void loadARImageDatabase(@NonNull ViroARSceneView view, ReadableMap database) {
        if (database != null) {
            view.loadARImageDatabase(database);
        }
    }

    @Override
    public void detachAnchor(@NonNull ViroARSceneView view, String anchorId) {
        if (anchorId != null) {
            view.detachAnchor(anchorId);
        }
    }

    @Override
    public void getAnchors(@NonNull ViroARSceneView view) {
        view.getAnchors();
    }

    @Override
    public void resetARSession(@NonNull ViroARSceneView view) {
        view.resetARSession();
    }

    // Export AR-specific event names
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = super.getExportedCustomDirectEventTypeConstants();
        
        // AR-specific events
        events.put("onARInitialized", MapBuilder.of("registrationName", "onARInitialized"));
        events.put("onTrackingUpdated", MapBuilder.of("registrationName", "onTrackingUpdated"));
        events.put("onAmbientLightUpdate", MapBuilder.of("registrationName", "onAmbientLightUpdate"));
        events.put("onAnchorFound", MapBuilder.of("registrationName", "onAnchorFound"));
        events.put("onAnchorUpdated", MapBuilder.of("registrationName", "onAnchorUpdated"));
        events.put("onAnchorRemoved", MapBuilder.of("registrationName", "onAnchorRemoved"));
        events.put("onGetAnchorsResult", MapBuilder.of("registrationName", "onGetAnchorsResult"));
        events.put("onARSessionReset", MapBuilder.of("registrationName", "onARSessionReset"));
        
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