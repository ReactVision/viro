package com.viromedia.bridge.fabric;

import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroLightingEnvironmentManagerDelegate;
import com.facebook.react.viewmanagers.ViroLightingEnvironmentManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroLightingEnvironment component in React Native New Architecture.
 * ViroLightingEnvironment provides HDR environment lighting for realistic scene illumination.
 */
public class ViroLightingEnvironmentViewManager extends SimpleViewManager<ViroLightingEnvironmentView> implements ViroLightingEnvironmentManagerInterface<ViroLightingEnvironmentView> {
    
    private static final String TAG = "ViroLightingEnvironmentViewManager";
    public static final String REACT_CLASS = "ViroLightingEnvironment";
    
    private final ViewManagerDelegate<ViroLightingEnvironmentView> mDelegate;
    
    public ViroLightingEnvironmentViewManager() {
        mDelegate = new ViroLightingEnvironmentManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroLightingEnvironmentView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroLightingEnvironmentView instance");
        return new ViroLightingEnvironmentView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroLightingEnvironmentView> getDelegate() {
        return mDelegate;
    }
    
    // Lighting environment props
    
    @ReactProp(name = "source")
    @Override
    public void setSource(ViroLightingEnvironmentView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting source: " + value);
        view.setSource(value);
    }
    
    @ReactProp(name = "intensity", defaultFloat = 1.0f)
    @Override
    public void setIntensity(ViroLightingEnvironmentView view, float value) {
        Log.d(TAG, "Setting intensity: " + value);
        view.setIntensity(value);
    }
    
    @ReactProp(name = "rotation", defaultFloat = 0.0f)
    @Override
    public void setRotation(ViroLightingEnvironmentView view, float value) {
        Log.d(TAG, "Setting rotation: " + value);
        view.setRotation(value);
    }
    
    // IBL (Image-Based Lighting) props
    
    @ReactProp(name = "enableImageBasedLighting", defaultBoolean = true)
    @Override
    public void setEnableImageBasedLighting(ViroLightingEnvironmentView view, boolean value) {
        Log.d(TAG, "Setting enable IBL: " + value);
        view.setEnableImageBasedLighting(value);
    }
    
    @ReactProp(name = "diffuseIntensity", defaultFloat = 1.0f)
    @Override
    public void setDiffuseIntensity(ViroLightingEnvironmentView view, float value) {
        Log.d(TAG, "Setting diffuse intensity: " + value);
        view.setDiffuseIntensity(value);
    }
    
    @ReactProp(name = "specularIntensity", defaultFloat = 1.0f)
    @Override
    public void setSpecularIntensity(ViroLightingEnvironmentView view, float value) {
        Log.d(TAG, "Setting specular intensity: " + value);
        view.setSpecularIntensity(value);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroLightingEnvironmentView view) {
        Log.d(TAG, "Dropping ViroLightingEnvironmentView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
    
    // Event handling
    
    @Override
    protected void addEventEmitters(ThemedReactContext reactContext, ViroLightingEnvironmentView view) {
        // Event emitters are handled through the view's event emission methods
    }
}