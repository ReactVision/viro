package com.viromedia.bridge.fabric;

import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroVRSceneNavigatorManagerDelegate;
import com.facebook.react.viewmanagers.ViroVRSceneNavigatorManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroVRSceneNavigator component in React Native New Architecture.
 * ViroVRSceneNavigator manages VR scene navigation and rendering.
 */
public class ViroVRSceneNavigatorViewManager extends ViewGroupManager<ViroVRSceneNavigatorView> implements ViroVRSceneNavigatorManagerInterface<ViroVRSceneNavigatorView> {
    
    private static final String TAG = "ViroVRSceneNavigatorViewManager";
    public static final String REACT_CLASS = "ViroVRSceneNavigator";
    
    private final ViewManagerDelegate<ViroVRSceneNavigatorView> mDelegate;
    
    public ViroVRSceneNavigatorViewManager() {
        mDelegate = new ViroVRSceneNavigatorManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroVRSceneNavigatorView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroVRSceneNavigatorView instance");
        return new ViroVRSceneNavigatorView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroVRSceneNavigatorView> getDelegate() {
        return mDelegate;
    }
    
    // VR-specific props
    
    @ReactProp(name = "vrModeEnabled", defaultBoolean = true)
    @Override
    public void setVrModeEnabled(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting VR mode enabled: " + value);
        view.setVrModeEnabled(value);
    }
    
    @ReactProp(name = "autofocus", defaultBoolean = true)
    @Override
    public void setAutofocus(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting autofocus: " + value);
        view.setAutofocus(value);
    }
    
    @ReactProp(name = "debug", defaultBoolean = false)
    @Override
    public void setDebug(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting debug: " + value);
        view.setDebug(value);
    }
    
    // Scene navigation props
    
    @ReactProp(name = "initialSceneKey")
    @Override
    public void setInitialSceneKey(ViroVRSceneNavigatorView view, @Nullable String value) {
        Log.d(TAG, "Setting initial scene key: " + value);
        view.setInitialSceneKey(value);
    }
    
    @ReactProp(name = "currentSceneIndex", defaultInt = 0)
    @Override
    public void setCurrentSceneIndex(ViroVRSceneNavigatorView view, int value) {
        Log.d(TAG, "Setting current scene index: " + value);
        view.setCurrentSceneIndex(value);
    }
    
    // Renderer settings props
    
    @ReactProp(name = "hdrEnabled", defaultBoolean = true)
    @Override
    public void setHdrEnabled(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting HDR enabled: " + value);
        view.setHdrEnabled(value);
    }
    
    @ReactProp(name = "pbrEnabled", defaultBoolean = true)
    @Override
    public void setPbrEnabled(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting PBR enabled: " + value);
        view.setPbrEnabled(value);
    }
    
    @ReactProp(name = "bloomEnabled", defaultBoolean = false)
    @Override
    public void setBloomEnabled(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting bloom enabled: " + value);
        view.setBloomEnabled(value);
    }
    
    @ReactProp(name = "shadowsEnabled", defaultBoolean = true)
    @Override
    public void setShadowsEnabled(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting shadows enabled: " + value);
        view.setShadowsEnabled(value);
    }
    
    @ReactProp(name = "multisamplingEnabled", defaultBoolean = true)
    @Override
    public void setMultisamplingEnabled(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting multisampling enabled: " + value);
        view.setMultisamplingEnabled(value);
    }
    
    // App properties props
    
    @ReactProp(name = "viroAppProps")
    @Override
    public void setViroAppProps(ViroVRSceneNavigatorView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting viro app props: " + value);
        view.setViroAppProps(value);
    }
    
    // Event handling props
    
    @ReactProp(name = "hasOnExitViroCallback", defaultBoolean = false)
    @Override
    public void setHasOnExitViroCallback(ViroVRSceneNavigatorView view, boolean value) {
        Log.d(TAG, "Setting has exit viro callback: " + value);
        view.setHasOnExitViroCallback(value);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroVRSceneNavigatorView view) {
        Log.d(TAG, "Dropping ViroVRSceneNavigatorView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
    
    // Event handling
    
    @Override
    protected void addEventEmitters(ThemedReactContext reactContext, ViroVRSceneNavigatorView view) {
        // Event emitters are handled through the view's event emission methods
    }
}