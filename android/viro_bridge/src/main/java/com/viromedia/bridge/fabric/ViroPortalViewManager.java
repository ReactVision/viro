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
import com.facebook.react.viewmanagers.ViroPortalManagerDelegate;
import com.facebook.react.viewmanagers.ViroPortalManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroPortal component in React Native New Architecture.
 * ViroPortal enables creation of portals in AR/VR scenes that transport users to different scenes.
 */
public class ViroPortalViewManager extends ViewGroupManager<ViroPortalView> implements ViroPortalManagerInterface<ViroPortalView> {
    
    private static final String TAG = "ViroPortalViewManager";
    public static final String REACT_CLASS = "ViroPortal";
    
    private final ViewManagerDelegate<ViroPortalView> mDelegate;
    
    public ViroPortalViewManager() {
        mDelegate = new ViroPortalManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroPortalView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroPortalView instance");
        return new ViroPortalView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroPortalView> getDelegate() {
        return mDelegate;
    }
    
    // Portal-specific props
    
    @ReactProp(name = "passable", defaultBoolean = false)
    @Override
    public void setPassable(ViroPortalView view, boolean value) {
        Log.d(TAG, "Setting passable: " + value);
        view.setPassable(value);
    }
    
    @ReactProp(name = "portalScale")
    @Override
    public void setPortalScale(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting portal scale: " + value);
        view.setPortalScale(value);
    }
    
    // Portal transition actions
    
    @ReactProp(name = "portalEnterCompletionAction")
    @Override
    public void setPortalEnterCompletionAction(ViroPortalView view, @Nullable String value) {
        Log.d(TAG, "Setting portal enter completion action: " + value);
        view.setPortalEnterCompletionAction(value);
    }
    
    @ReactProp(name = "portalExitCompletionAction")
    @Override
    public void setPortalExitCompletionAction(ViroPortalView view, @Nullable String value) {
        Log.d(TAG, "Setting portal exit completion action: " + value);
        view.setPortalExitCompletionAction(value);
    }
    
    // Common transform props (inherited from ViroNode)
    
    @ReactProp(name = "position")
    @Override
    public void setPosition(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting position: " + value);
        view.setPosition(value);
    }
    
    @ReactProp(name = "scale")
    @Override
    public void setScale(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting scale: " + value);
        view.setScale(value);
    }
    
    @ReactProp(name = "rotation")
    @Override
    public void setRotation(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting rotation: " + value);
        view.setRotation(value);
    }
    
    @ReactProp(name = "rotationPivot")
    @Override
    public void setRotationPivot(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting rotation pivot: " + value);
        view.setRotationPivot(value);
    }
    
    @ReactProp(name = "scalePivot")
    @Override
    public void setScalePivot(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting scale pivot: " + value);
        view.setScalePivot(value);
    }
    
    // Visibility and interaction props
    
    @ReactProp(name = "visible", defaultBoolean = true)
    @Override
    public void setVisible(ViroPortalView view, boolean value) {
        Log.d(TAG, "Setting visible: " + value);
        view.setVisible(value);
    }
    
    @ReactProp(name = "opacity", defaultFloat = 1.0f)
    @Override
    public void setOpacity(ViroPortalView view, float value) {
        Log.d(TAG, "Setting opacity: " + value);
        view.setOpacity(value);
    }
    
    @ReactProp(name = "renderingOrder", defaultInt = 0)
    @Override
    public void setRenderingOrder(ViroPortalView view, int value) {
        Log.d(TAG, "Setting rendering order: " + value);
        view.setRenderingOrder(value);
    }
    
    @ReactProp(name = "ignoreEventHandling", defaultBoolean = false)
    @Override
    public void setIgnoreEventHandling(ViroPortalView view, boolean value) {
        Log.d(TAG, "Setting ignore event handling: " + value);
        view.setIgnoreEventHandling(value);
    }
    
    @ReactProp(name = "dragType")
    @Override
    public void setDragType(ViroPortalView view, @Nullable String value) {
        Log.d(TAG, "Setting drag type: " + value);
        view.setDragType(value);
    }
    
    @ReactProp(name = "transformBehaviors")
    @Override
    public void setTransformBehaviors(ViroPortalView view, @Nullable ReadableArray value) {
        Log.d(TAG, "Setting transform behaviors: " + value);
        view.setTransformBehaviors(value);
    }
    
    // Physics props
    
    @ReactProp(name = "physicsBody")
    @Override
    public void setPhysicsBody(ViroPortalView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting physics body: " + value);
        view.setPhysicsBody(value);
    }
    
    @ReactProp(name = "highAccuracyEvents", defaultBoolean = false)
    @Override
    public void setHighAccuracyEvents(ViroPortalView view, boolean value) {
        Log.d(TAG, "Setting high accuracy events: " + value);
        view.setHighAccuracyEvents(value);
    }
    
    // Animation props
    
    @ReactProp(name = "animation")
    @Override
    public void setAnimation(ViroPortalView view, @Nullable ReadableMap value) {
        Log.d(TAG, "Setting animation: " + value);
        view.setAnimation(value);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroPortalView view) {
        Log.d(TAG, "Dropping ViroPortalView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
}