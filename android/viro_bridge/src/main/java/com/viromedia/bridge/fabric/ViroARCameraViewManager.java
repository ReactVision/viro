//
//  ViroARCameraViewManager.java
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
import com.facebook.react.viewmanagers.ViroARCameraManagerDelegate;
import com.facebook.react.viewmanagers.ViroARCameraManagerInterface;
import com.facebook.soloader.SoLoader;
import com.viromedia.bridge.utility.ViroLog;

import java.util.HashMap;
import java.util.Map;

/**
 * ViewManager for ViroARCamera in React Native New Architecture (Fabric).
 * Manages the creation and configuration of ViroARCameraView instances.
 */
@ReactModule(name = ViroARCameraViewManager.REACT_CLASS)
public class ViroARCameraViewManager extends ViroNodeViewManager 
        implements ViroARCameraManagerInterface<ViroARCameraView> {

    public static final String REACT_CLASS = "ViroARCamera";
    private static final String TAG = ViroLog.getTag(ViroARCameraViewManager.class);
    
    private final ViewManagerDelegate<ViroARCameraView> mDelegate;

    static {
        SoLoader.loadLibrary("viro_renderer");
    }

    public ViroARCameraViewManager() {
        mDelegate = new ViroARCameraManagerDelegate<>(this);
    }

    @Nullable
    @Override
    protected ViewManagerDelegate<ViroARCameraView> getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected ViroARCameraView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.i(TAG, "Creating ViroARCameraView instance");
        return new ViroARCameraView(reactContext);
    }

    // AR Camera specific props from ViroARCameraManagerInterface

    @Override
    @ReactProp(name = "active", defaultBoolean = true)
    public void setActive(@NonNull ViroARCameraView view, boolean value) {
        view.setActive(value);
    }

    @Override
    @ReactProp(name = "fieldOfView")
    public void setFieldOfView(@NonNull ViroARCameraView view, @Nullable ReadableArray value) {
        view.setFieldOfView(value);
    }

    @Override
    @ReactProp(name = "onTransformUpdate")
    public void setOnTransformUpdate(@NonNull ViroARCameraView view, boolean value) {
        view.setOnTransformUpdateListener(value);
    }

    @Override
    @ReactProp(name = "onCameraTransformUpdate")
    public void setOnCameraTransformUpdate(@NonNull ViroARCameraView view, boolean value) {
        view.setOnCameraTransformUpdateListener(value);
    }

    // Commands specific to AR Camera

    @Override
    public void getCameraTransform(@NonNull ViroARCameraView view) {
        view.getCameraTransform();
    }

    @Override
    public void getCameraOrientation(@NonNull ViroARCameraView view) {
        view.getCameraOrientation();
    }

    @Override
    public void getCameraPositionAndRotation(@NonNull ViroARCameraView view) {
        view.getCameraPositionAndRotation();
    }

    // Export AR Camera specific event names
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = super.getExportedCustomDirectEventTypeConstants();
        if (events == null) {
            events = new HashMap<>();
        }
        
        // AR Camera specific events
        events.put("onCameraTransformUpdate", MapBuilder.of("registrationName", "onCameraTransformUpdate"));
        events.put("onGetCameraOrientationResult", MapBuilder.of("registrationName", "onGetCameraOrientationResult"));
        events.put("onGetCameraPositionResult", MapBuilder.of("registrationName", "onGetCameraPositionResult"));
        
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