//
//  VRTCameraTextureModule.java
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Licensed under the MIT license. See LICENSE file for details.

package com.viromedia.bridge.module;

import android.view.View;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.bridge.UIManager;
import com.viro.core.CameraTexture;
import com.viromedia.bridge.component.VRTCameraTexture;

/**
 * NativeModule that exposes capturePhoto / startRecording / stopRecording to JavaScript.
 *
 * Methods find the VRTCameraTexture view by its React tag using the Fabric UIManager
 * (same pattern as ARSceneNavigatorModule) and delegate to CameraTexture's capture API.
 *
 * Response map keys (mirrors ARSceneNavigatorModule conventions):
 *   success  : boolean
 *   url      : string  — absolute path of the written file
 *   error    : string  — present only on failure
 */
@ReactModule(name = "VRTCameraTextureModule")
public class VRTCameraTextureModule extends ReactContextBaseJavaModule {

    private static final String KEY_SUCCESS = "success";
    private static final String KEY_URL     = "url";
    private static final String KEY_ERROR   = "error";

    public VRTCameraTextureModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "VRTCameraTextureModule";
    }

    // -----------------------------------------------------------------------
    // Photo capture
    // -----------------------------------------------------------------------

    /**
     * @param reactTag   React view tag of the VRTCameraTexture component.
     * @param outputPath Absolute path for the JPEG. Pass null to use a cache-dir default.
     */
    @ReactMethod
    public void capturePhoto(final int reactTag, final String outputPath, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), reactTag);
        if (uiManager == null) {
            rejectPromise(promise, "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(viewResolver -> {
            View view = viewResolver.resolveView(reactTag);
            if (!(view instanceof VRTCameraTexture)) {
                throw new IllegalViewOperationException(
                    "capturePhoto: expected VRTCameraTexture, got " + view);
            }
            ((VRTCameraTexture) view).capturePhoto(outputPath, new CameraTexture.CaptureCallback() {
                @Override public void onSuccess(String path) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean(KEY_SUCCESS, true);
                    result.putString(KEY_URL, path);
                    promise.resolve(result);
                }
                @Override public void onError(String error) {
                    rejectPromise(promise, error);
                }
            });
        });
    }

    // -----------------------------------------------------------------------
    // Video recording
    // -----------------------------------------------------------------------

    /**
     * @param reactTag   React view tag of the VRTCameraTexture component.
     * @param outputPath Absolute path for the MP4. Pass null to use a cache-dir default.
     */
    @ReactMethod
    public void startRecording(final int reactTag, final String outputPath, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), reactTag);
        if (uiManager == null) {
            rejectPromise(promise, "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(viewResolver -> {
            View view = viewResolver.resolveView(reactTag);
            if (!(view instanceof VRTCameraTexture)) {
                throw new IllegalViewOperationException(
                    "startRecording: expected VRTCameraTexture, got " + view);
            }
            ((VRTCameraTexture) view).startRecording(outputPath, new CameraTexture.CaptureCallback() {
                @Override public void onSuccess(String path) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean(KEY_SUCCESS, true);
                    result.putString(KEY_URL, path);
                    promise.resolve(result);
                }
                @Override public void onError(String error) {
                    rejectPromise(promise, error);
                }
            });
        });
    }

    @ReactMethod
    public void stopRecording(final int reactTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), reactTag);
        if (uiManager == null) {
            rejectPromise(promise, "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(viewResolver -> {
            View view = viewResolver.resolveView(reactTag);
            if (!(view instanceof VRTCameraTexture)) {
                throw new IllegalViewOperationException(
                    "stopRecording: expected VRTCameraTexture, got " + view);
            }
            ((VRTCameraTexture) view).stopRecording(new CameraTexture.CaptureCallback() {
                @Override public void onSuccess(String path) {
                    WritableMap result = Arguments.createMap();
                    result.putBoolean(KEY_SUCCESS, true);
                    result.putString(KEY_URL, path);
                    promise.resolve(result);
                }
                @Override public void onError(String error) {
                    rejectPromise(promise, error);
                }
            });
        });
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void rejectPromise(Promise promise, String error) {
        WritableMap result = Arguments.createMap();
        result.putBoolean(KEY_SUCCESS, false);
        result.putString(KEY_ERROR, error);
        promise.resolve(result);   // resolve with error map — mirrors ARSceneNavigatorModule
    }
}
