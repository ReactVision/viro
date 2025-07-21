package com.viromedia.bridge.fabric;

import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroPortalSceneManagerDelegate;
import com.facebook.react.viewmanagers.ViroPortalSceneManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroPortalScene component in React Native New Architecture.
 * ViroPortalScene represents the 3D scene content that is revealed through a ViroPortal.
 */
public class ViroPortalSceneViewManager extends ViewGroupManager<ViroPortalSceneView> implements ViroPortalSceneManagerInterface<ViroPortalSceneView> {
    
    private static final String TAG = "ViroPortalSceneViewManager";
    public static final String REACT_CLASS = "ViroPortalScene";
    
    private final ViewManagerDelegate<ViroPortalSceneView> mDelegate;
    
    public ViroPortalSceneViewManager() {
        mDelegate = new ViroPortalSceneManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroPortalSceneView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroPortalSceneView instance");
        return new ViroPortalSceneView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroPortalSceneView> getDelegate() {
        return mDelegate;
    }
    
    // Portal scene-specific props
    
    @ReactProp(name = "passable", defaultBoolean = false)
    @Override
    public void setPassable(ViroPortalSceneView view, boolean value) {
        Log.d(TAG, "Setting passable: " + value);
        view.setPassable(value);
    }
    
    // Transform props
    
    @ReactProp(name = "position")
    @Override
    public void setPosition(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting position: " + value);
        view.setPosition(value);
    }
    
    @ReactProp(name = "scale")
    @Override
    public void setScale(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting scale: " + value);
        view.setScale(value);
    }
    
    @ReactProp(name = "rotation")
    @Override
    public void setRotation(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting rotation: " + value);
        view.setRotation(value);
    }
    
    @ReactProp(name = "rotationPivot")
    @Override
    public void setRotationPivot(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting rotation pivot: " + value);
        view.setRotationPivot(value);
    }
    
    @ReactProp(name = "scalePivot")
    @Override
    public void setScalePivot(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting scale pivot: " + value);
        view.setScalePivot(value);
    }
    
    @ReactProp(name = "transformBehaviors")
    @Override
    public void setTransformBehaviors(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting transform behaviors: " + value);
        view.setTransformBehaviors(value);
    }
    
    // Visibility and interaction props
    
    @ReactProp(name = "visible", defaultBoolean = true)
    @Override
    public void setVisible(ViroPortalSceneView view, boolean value) {
        Log.d(TAG, "Setting visible: " + value);
        view.setVisible(value);
    }
    
    @ReactProp(name = "opacity", defaultFloat = 1.0f)
    @Override
    public void setOpacity(ViroPortalSceneView view, float value) {
        Log.d(TAG, "Setting opacity: " + value);
        view.setOpacity(value);
    }
    
    @ReactProp(name = "renderingOrder", defaultInt = 0)
    @Override
    public void setRenderingOrder(ViroPortalSceneView view, int value) {
        Log.d(TAG, "Setting rendering order: " + value);
        view.setRenderingOrder(value);
    }
    
    @ReactProp(name = "ignoreEventHandling", defaultBoolean = false)
    @Override
    public void setIgnoreEventHandling(ViroPortalSceneView view, boolean value) {
        Log.d(TAG, "Setting ignore event handling: " + value);
        view.setIgnoreEventHandling(value);
    }
    
    @ReactProp(name = "dragType")
    @Override
    public void setDragType(ViroPortalSceneView view, @Nullable String value) {
        Log.d(TAG, "Setting drag type: " + value);
        view.setDragType(value);
    }
    
    // Physics props
    
    @ReactProp(name = "physicsBody")
    @Override
    public void setPhysicsBody(ViroPortalSceneView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting physics body: " + value);
        view.setPhysicsBody(value);
    }
    
    @ReactProp(name = "highAccuracyEvents", defaultBoolean = false)
    @Override
    public void setHighAccuracyEvents(ViroPortalSceneView view, boolean value) {
        Log.d(TAG, "Setting high accuracy events: " + value);
        view.setHighAccuracyEvents(value);
    }
    
    // Animation props
    
    @ReactProp(name = "animation")
    @Override
    public void setAnimation(ViroPortalSceneView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting animation: " + value);
        view.setAnimation(value);
    }
    
    // Scene lighting props
    
    @ReactProp(name = "lightingEnvironment")
    @Override
    public void setLightingEnvironment(ViroPortalSceneView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting lighting environment: " + value);
        view.setLightingEnvironment(value);
    }
    
    @ReactProp(name = "postProcessEffects")
    @Override
    public void setPostProcessEffects(ViroPortalSceneView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting post process effects: " + value);
        view.setPostProcessEffects(value);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroPortalSceneView view) {
        Log.d(TAG, "Dropping ViroPortalSceneView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
}