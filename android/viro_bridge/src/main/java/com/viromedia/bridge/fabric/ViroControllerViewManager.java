package com.viromedia.bridge.fabric;

import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroControllerManagerDelegate;
import com.facebook.react.viewmanagers.ViroControllerManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroController component in React Native New Architecture.
 * ViroController handles VR/AR controller input and interactions.
 */
public class ViroControllerViewManager extends SimpleViewManager<ViroControllerView> implements ViroControllerManagerInterface<ViroControllerView> {
    
    private static final String TAG = "ViroControllerViewManager";
    public static final String REACT_CLASS = "ViroController";
    
    private final ViewManagerDelegate<ViroControllerView> mDelegate;
    
    public ViroControllerViewManager() {
        mDelegate = new ViroControllerManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroControllerView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroControllerView instance");
        return new ViroControllerView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroControllerView> getDelegate() {
        return mDelegate;
    }
    
    // Controller visibility props
    
    @ReactProp(name = "reticleVisibility", defaultBoolean = true)
    @Override
    public void setReticleVisibility(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting reticle visibility: " + value);
        view.setReticleVisibility(value);
    }
    
    @ReactProp(name = "controllerVisibility", defaultBoolean = true)
    @Override
    public void setControllerVisibility(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting controller visibility: " + value);
        view.setControllerVisibility(value);
    }
    
    // Input capability props
    
    @ReactProp(name = "canClick", defaultBoolean = false)
    @Override
    public void setCanClick(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can click: " + value);
        view.setCanClick(value);
    }
    
    @ReactProp(name = "canTouch", defaultBoolean = false)
    @Override
    public void setCanTouch(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can touch: " + value);
        view.setCanTouch(value);
    }
    
    @ReactProp(name = "canScroll", defaultBoolean = false)
    @Override
    public void setCanScroll(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can scroll: " + value);
        view.setCanScroll(value);
    }
    
    @ReactProp(name = "canSwipe", defaultBoolean = false)
    @Override
    public void setCanSwipe(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can swipe: " + value);
        view.setCanSwipe(value);
    }
    
    @ReactProp(name = "canDrag", defaultBoolean = false)
    @Override
    public void setCanDrag(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can drag: " + value);
        view.setCanDrag(value);
    }
    
    @ReactProp(name = "canPinch", defaultBoolean = false)
    @Override
    public void setCanPinch(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can pinch: " + value);
        view.setCanPinch(value);
    }
    
    @ReactProp(name = "canRotate", defaultBoolean = false)
    @Override
    public void setCanRotate(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can rotate: " + value);
        view.setCanRotate(value);
    }
    
    @ReactProp(name = "canFuse", defaultBoolean = false)
    @Override
    public void setCanFuse(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can fuse: " + value);
        view.setCanFuse(value);
    }
    
    @ReactProp(name = "canGetControllerStatus", defaultBoolean = false)
    @Override
    public void setCanGetControllerStatus(ViroControllerView view, boolean value) {
        Log.d(TAG, "Setting can get controller status: " + value);
        view.setCanGetControllerStatus(value);
    }
    
    // Fuse props
    
    @ReactProp(name = "timeToFuse", defaultFloat = 2.0f)
    @Override
    public void setTimeToFuse(ViroControllerView view, float value) {
        Log.d(TAG, "Setting time to fuse: " + value);
        view.setTimeToFuse(value);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroControllerView view) {
        Log.d(TAG, "Dropping ViroControllerView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
    
    // Event handling
    
    @Override
    protected void addEventEmitters(ThemedReactContext reactContext, ViroControllerView view) {
        // Event emitters are handled through the view's event emission methods
    }
}