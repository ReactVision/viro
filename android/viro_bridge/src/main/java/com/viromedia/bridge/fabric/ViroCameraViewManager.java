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
import com.facebook.react.viewmanagers.ViroCameraManagerDelegate;
import com.facebook.react.viewmanagers.ViroCameraManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroCamera component in React Native New Architecture.
 * ViroCamera provides comprehensive camera control and projection management for 3D scenes
 * with support for positioning, orientation, field of view, and animation.
 */
public class ViroCameraViewManager extends ViewGroupManager<ViroCameraView> implements ViroCameraManagerInterface<ViroCameraView> {
    
    private static final String TAG = "ViroCameraViewManager";
    public static final String REACT_CLASS = "ViroCamera";
    
    private final ViewManagerDelegate<ViroCameraView> mDelegate;
    
    public ViroCameraViewManager() {
        mDelegate = new ViroCameraManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroCameraView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroCameraView instance");
        return new ViroCameraView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroCameraView> getDelegate() {
        return mDelegate;
    }
    
    // Camera Position and Orientation props
    
    @ReactProp(name = "position")
    public void setPosition(ViroCameraView view, @Nullable ReadableArray position) {
        view.setPosition(position);
    }
    
    @ReactProp(name = "rotation")
    public void setRotation(ViroCameraView view, @Nullable ReadableArray rotation) {
        view.setRotation(rotation);
    }
    
    @ReactProp(name = "fieldOfView", defaultFloat = 90.0f)
    public void setFieldOfView(ViroCameraView view, float fieldOfView) {
        view.setFieldOfView(fieldOfView);
    }
    
    // Camera Projection props
    
    @ReactProp(name = "nearClippingPlane", defaultFloat = 0.1f)
    public void setNearClippingPlane(ViroCameraView view, float nearClippingPlane) {
        view.setNearClippingPlane(nearClippingPlane);
    }
    
    @ReactProp(name = "farClippingPlane", defaultFloat = 1000.0f)
    public void setFarClippingPlane(ViroCameraView view, float farClippingPlane) {
        view.setFarClippingPlane(farClippingPlane);
    }
    
    @ReactProp(name = "projectionType")
    public void setProjectionType(ViroCameraView view, @Nullable String projectionType) {
        view.setProjectionType(projectionType);
    }
    
    @ReactProp(name = "focalLength", defaultFloat = 50.0f)
    public void setFocalLength(ViroCameraView view, float focalLength) {
        view.setFocalLength(focalLength);
    }
    
    // Camera Animation props
    
    @ReactProp(name = "animationDuration", defaultFloat = 1.0f)
    public void setAnimationDuration(ViroCameraView view, float animationDuration) {
        view.setAnimationDuration(animationDuration);
    }
    
    @ReactProp(name = "animationType")
    public void setAnimationType(ViroCameraView view, @Nullable String animationType) {
        view.setAnimationType(animationType);
    }
    
    // Camera Control props
    
    @ReactProp(name = "active", defaultBoolean = false)
    public void setActive(ViroCameraView view, boolean active) {
        view.setActive(active);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroCameraView view) {
        Log.d(TAG, "Dropping ViroCameraView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
    
    @Override
    protected void onAfterUpdateTransaction(@NonNull ViroCameraView view) {
        super.onAfterUpdateTransaction(view);
        Log.d(TAG, "Camera view transaction completed");
    }
}