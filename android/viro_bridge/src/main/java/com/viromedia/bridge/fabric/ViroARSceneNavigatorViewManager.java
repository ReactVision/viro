//
//  ViroARSceneNavigatorViewManager.java
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
import com.facebook.react.viewmanagers.ViroARSceneNavigatorManagerDelegate;
import com.facebook.react.viewmanagers.ViroARSceneNavigatorManagerInterface;
import com.facebook.soloader.SoLoader;
import com.viromedia.bridge.utility.ViroLog;

import java.util.HashMap;
import java.util.Map;

/**
 * ViewManager for ViroARSceneNavigator in React Native New Architecture (Fabric).
 * Manages the creation and configuration of ViroARSceneNavigatorView instances.
 */
@ReactModule(name = ViroARSceneNavigatorViewManager.REACT_CLASS)
public class ViroARSceneNavigatorViewManager extends ViroViewGroupManager<ViroARSceneNavigatorView> 
        implements ViroARSceneNavigatorManagerInterface<ViroARSceneNavigatorView> {

    public static final String REACT_CLASS = "ViroARSceneNavigator";
    private static final String TAG = ViroLog.getTag(ViroARSceneNavigatorViewManager.class);
    
    private final ViewManagerDelegate<ViroARSceneNavigatorView> mDelegate;

    static {
        SoLoader.loadLibrary("viro_renderer");
    }

    public ViroARSceneNavigatorViewManager() {
        mDelegate = new ViroARSceneNavigatorManagerDelegate<>(this);
    }

    @Nullable
    @Override
    protected ViewManagerDelegate<ViroARSceneNavigatorView> getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected ViroARSceneNavigatorView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.i(TAG, "Creating ViroARSceneNavigatorView instance");
        return new ViroARSceneNavigatorView(reactContext);
    }

    // Props from ViroARSceneNavigatorManagerInterface

    @Override
    @ReactProp(name = "initialScene")
    public void setInitialScene(@NonNull ViroARSceneNavigatorView view, @Nullable ReadableMap value) {
        view.setInitialScene(value);
    }

    @Override
    @ReactProp(name = "viroAppProps")
    public void setViroAppProps(@NonNull ViroARSceneNavigatorView view, @Nullable ReadableMap value) {
        view.setViroAppProps(value);
    }

    @Override
    @ReactProp(name = "autofocus")
    public void setAutofocus(@NonNull ViroARSceneNavigatorView view, boolean value) {
        view.setAutofocusEnabled(value);
    }

    @Override
    @ReactProp(name = "worldAlignment")
    public void setWorldAlignment(@NonNull ViroARSceneNavigatorView view, @Nullable String value) {
        view.setWorldAlignment(value);
    }

    @Override
    @ReactProp(name = "videoQuality") 
    public void setVideoQuality(@NonNull ViroARSceneNavigatorView view, @Nullable String value) {
        view.setVideoQuality(value);
    }

    @Override
    @ReactProp(name = "numberOfTrackedImages")
    public void setNumberOfTrackedImages(@NonNull ViroARSceneNavigatorView view, int value) {
        view.setNumberOfTrackedImages(value);
    }

    @Override
    @ReactProp(name = "bloomEnabled")
    public void setBloomEnabled(@NonNull ViroARSceneNavigatorView view, boolean value) {
        view.setBloomEnabled(value);
    }

    @Override
    @ReactProp(name = "hdrEnabled")
    public void setHdrEnabled(@NonNull ViroARSceneNavigatorView view, boolean value) {
        view.setHdrEnabled(value);
    }

    @Override
    @ReactProp(name = "pbrEnabled")
    public void setPbrEnabled(@NonNull ViroARSceneNavigatorView view, boolean value) {
        view.setPbrEnabled(value);
    }

    @Override
    @ReactProp(name = "shadowsEnabled")
    public void setShadowsEnabled(@NonNull ViroARSceneNavigatorView view, boolean value) {
        view.setShadowsEnabled(value);
    }

    @Override
    @ReactProp(name = "multisamplingEnabled")
    public void setMultisamplingEnabled(@NonNull ViroARSceneNavigatorView view, boolean value) {
        view.setMultisamplingEnabled(value);
    }

    // Commands

    @Override
    public void pushScene(@NonNull ViroARSceneNavigatorView view, ReadableMap scene, ReadableMap appProps) {
        if (scene != null) {
            view.pushScene(scene.toHashMap(), appProps != null ? appProps.toHashMap() : null);
        }
    }

    @Override
    public void popScene(@NonNull ViroARSceneNavigatorView view) {
        view.popScene();
    }

    @Override
    public void jumpToScene(@NonNull ViroARSceneNavigatorView view, double sceneIndex) {
        view.jumpToScene((int) sceneIndex);
    }

    @Override
    public void replaceScene(@NonNull ViroARSceneNavigatorView view, ReadableMap scene, ReadableMap appProps) {
        if (scene != null) {
            view.replaceScene(scene.toHashMap(), appProps != null ? appProps.toHashMap() : null);
        }
    }

    @Override
    public void performARHitTest(@NonNull ViroARSceneNavigatorView view, double x, double y, ReadableArray types) {
        view.performARHitTest((float) x, (float) y, types);
    }

    @Override
    public void resetARSession(@NonNull ViroARSceneNavigatorView view) {
        view.resetARSession();
    }

    // Export event names
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = new HashMap<>();
        
        events.put("onExitViro", MapBuilder.of("registrationName", "onExitViro"));
        events.put("onPushScene", MapBuilder.of("registrationName", "onPushScene"));
        events.put("onPopScene", MapBuilder.of("registrationName", "onPopScene"));
        events.put("onJumpToScene", MapBuilder.of("registrationName", "onJumpToScene"));
        events.put("onReplaceScene", MapBuilder.of("registrationName", "onReplaceScene"));
        events.put("onTrackingUpdated", MapBuilder.of("registrationName", "onTrackingUpdated"));
        events.put("onPointCloudUpdate", MapBuilder.of("registrationName", "onPointCloudUpdate"));
        events.put("onARHitTestResults", MapBuilder.of("registrationName", "onARHitTestResults"));
        
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