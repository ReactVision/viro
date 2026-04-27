// Copyright © 2026 ReactVision. All rights reserved.
// MIT License — see LICENSE file.

package com.viromedia.bridge.module;

import android.view.View;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.UIManagerHelper;
import com.viromedia.bridge.component.VRT3DSceneNavigator;
import com.viromedia.bridge.component.VRTVRSceneNavigator;

/**
 * React Native native module for Meta Quest / OpenXR-specific operations.
 * Registered automatically when {@link com.viromedia.bridge.ReactViroPackage} is
 * initialised with {@code ViroPlatform.QUEST}.
 *
 * JS usage (via NativeModules.VRModuleOpenXR):
 *   recenterTracking(viewTag)
 *   setPassthroughEnabled(viewTag, enabled)  // Week 4
 */
@ReactModule(name = "VRModuleOpenXR")
public class VRModuleOpenXR extends ReactContextBaseJavaModule {

    public VRModuleOpenXR(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }

    @Override
    public String getName() {
        return "VRModuleOpenXR";
    }

    /**
     * Recenters the VR tracking origin to the current head pose.
     * Equivalent to pressing the Meta button to re-orient the view.
     *
     * @param sceneNavTag React tag of the ViroVRSceneNavigator view.
     */
    @ReactMethod
    public void recenterTracking(final int sceneNavTag) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRT3DSceneNavigator) {
                    ((VRT3DSceneNavigator) view).recenterTracking();
                }
            }
        });
    }

    /**
     * Toggle mixed-reality passthrough mode (Quest 3 / Quest Pro only).
     * On Quest 3 the camera feed is shown in full colour behind virtual content.
     * No-op on devices that do not support XR_FB_passthrough.
     *
     * @param sceneNavTag React tag of the ViroVRSceneNavigator view.
     * @param enabled     {@code true} to show passthrough; {@code false} for fully virtual.
     */
    @ReactMethod
    public void setPassthroughEnabled(final int sceneNavTag, final boolean enabled) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) view).setPassthroughEnabled(enabled);
                }
            }
        });
    }
}
