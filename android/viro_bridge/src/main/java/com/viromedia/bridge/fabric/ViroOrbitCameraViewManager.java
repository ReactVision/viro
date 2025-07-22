//
//  ViroOrbitCameraViewManager.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

/**
 * ViewManager for ViroOrbitCamera component
 * Manages the creation and configuration of ViroOrbitCameraView instances
 */
public class ViroOrbitCameraViewManager extends SimpleViewManager<ViroOrbitCameraView> {

    public static final String REACT_CLASS = "ViroOrbitCamera";

    @Override
    @NonNull
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    @NonNull
    public ViroOrbitCameraView createViewInstance(@NonNull ThemedReactContext context) {
        return new ViroOrbitCameraView(context);
    }

    @Override
    public void onDropViewInstance(ViroOrbitCameraView view) {
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }

    // Camera properties
    
    @ReactProp(name = "position")
    public void setPosition(ViroOrbitCameraView view, @Nullable ReadableArray position) {
        view.setPosition(position);
    }

    @ReactProp(name = "focalPoint")
    public void setFocalPoint(ViroOrbitCameraView view, @Nullable ReadableArray focalPoint) {
        view.setFocalPoint(focalPoint);
    }

    @ReactProp(name = "active", defaultBoolean = false)
    public void setActive(ViroOrbitCameraView view, boolean active) {
        view.setActive(active);
    }

    @ReactProp(name = "fieldOfView", defaultFloat = 60.0f)
    public void setFieldOfView(ViroOrbitCameraView view, float fieldOfView) {
        view.setFieldOfView(fieldOfView);
    }

    // Orbit properties

    @ReactProp(name = "orbitRadius", defaultFloat = 5.0f)
    public void setOrbitRadius(ViroOrbitCameraView view, float orbitRadius) {
        view.setOrbitRadius(orbitRadius);
    }

    @ReactProp(name = "orbitAngleHorizontal", defaultFloat = 0.0f)
    public void setOrbitAngleHorizontal(ViroOrbitCameraView view, float orbitAngleHorizontal) {
        view.setOrbitAngleHorizontal(orbitAngleHorizontal);
    }

    @ReactProp(name = "orbitAngleVertical", defaultFloat = 0.0f)
    public void setOrbitAngleVertical(ViroOrbitCameraView view, float orbitAngleVertical) {
        view.setOrbitAngleVertical(orbitAngleVertical);
    }

    @ReactProp(name = "orbitSpeed", defaultFloat = 1.0f)
    public void setOrbitSpeed(ViroOrbitCameraView view, float orbitSpeed) {
        view.setOrbitSpeed(orbitSpeed);
    }

    @ReactProp(name = "autoOrbit", defaultBoolean = false)
    public void setAutoOrbit(ViroOrbitCameraView view, boolean autoOrbit) {
        view.setAutoOrbit(autoOrbit);
    }

    @ReactProp(name = "orbitDirection")
    public void setOrbitDirection(ViroOrbitCameraView view, @Nullable String orbitDirection) {
        view.setOrbitDirection(orbitDirection);
    }

    @ReactProp(name = "orbitDuration", defaultFloat = 10.0f)
    public void setOrbitDuration(ViroOrbitCameraView view, float orbitDuration) {
        view.setOrbitDuration(orbitDuration);
    }

    // Animation properties

    @ReactProp(name = "animation")
    public void setAnimation(ViroOrbitCameraView view, @Nullable ReadableMap animation) {
        view.setAnimation(animation);
    }

    // Transform properties

    @ReactProp(name = "rotation")
    public void setRotation(ViroOrbitCameraView view, @Nullable ReadableArray rotation) {
        view.setRotation(rotation);
    }

    @ReactProp(name = "scale")
    public void setScale(ViroOrbitCameraView view, @Nullable ReadableArray scale) {
        view.setScale(scale);
    }

    // Visibility and interaction

    @ReactProp(name = "visible", defaultBoolean = true)
    public void setVisible(ViroOrbitCameraView view, boolean visible) {
        view.setVisible(visible);
    }

    @ReactProp(name = "opacity", defaultFloat = 1.0f)
    public void setOpacity(ViroOrbitCameraView view, float opacity) {
        view.setOpacity(opacity);
    }

    @ReactProp(name = "renderingOrder", defaultInt = 0)
    public void setRenderingOrder(ViroOrbitCameraView view, int renderingOrder) {
        view.setRenderingOrder(renderingOrder);
    }

    // Event handling

    @ReactProp(name = "onOrbitStart", defaultBoolean = false)
    public void setOnOrbitStart(ViroOrbitCameraView view, boolean onOrbitStart) {
        view.setOnOrbitStart(onOrbitStart);
    }

    @ReactProp(name = "onOrbitStop", defaultBoolean = false)
    public void setOnOrbitStop(ViroOrbitCameraView view, boolean onOrbitStop) {
        view.setOnOrbitStop(onOrbitStop);
    }

    @ReactProp(name = "onPositionChange", defaultBoolean = false)
    public void setOnPositionChange(ViroOrbitCameraView view, boolean onPositionChange) {
        view.setOnPositionChange(onPositionChange);
    }

    @ReactProp(name = "onCameraActivated", defaultBoolean = false)
    public void setOnCameraActivated(ViroOrbitCameraView view, boolean onCameraActivated) {
        view.setOnCameraActivated(onCameraActivated);
    }

    @ReactProp(name = "onCameraDeactivated", defaultBoolean = false)
    public void setOnCameraDeactivated(ViroOrbitCameraView view, boolean onCameraDeactivated) {
        view.setOnCameraDeactivated(onCameraDeactivated);
    }

    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
            .put("onOrbitStart", MapBuilder.of("registrationName", "onOrbitStart"))
            .put("onOrbitStop", MapBuilder.of("registrationName", "onOrbitStop"))
            .put("onPositionChange", MapBuilder.of("registrationName", "onPositionChange"))
            .put("onCameraActivated", MapBuilder.of("registrationName", "onCameraActivated"))
            .put("onCameraDeactivated", MapBuilder.of("registrationName", "onCameraDeactivated"))
            .build();
    }

    @Override
    public void receiveCommand(@NonNull ViroOrbitCameraView view, String commandName, @Nullable ReadableArray args) {
        super.receiveCommand(view, commandName, args);
        
        switch (commandName) {
            case "startOrbit":
                view.startOrbitAnimation();
                break;
            case "stopOrbit":
                view.stopOrbitAnimation();
                break;
            case "pauseOrbit":
                view.pauseOrbitAnimation();
                break;
            case "resumeOrbit":
                view.resumeOrbitAnimation();
                break;
            case "activateCamera":
                view.activateCamera();
                break;
            case "deactivateCamera":
                view.deactivateCamera();
                break;
        }
    }
}