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
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.ARScene;
import com.viro.core.ViroMediaRecorder;
import com.viro.core.ViroView;
import com.viro.core.ViroViewOpenXR;

/**
 * React Native native module for Meta Quest / OpenXR-specific operations.
 * Registered automatically when {@link com.viromedia.bridge.ReactViroPackage} is
 * initialised with {@code ViroPlatform.QUEST}.
 *
 * JS usage (via NativeModules.VRModuleOpenXR):
 *   recenterTracking(viewTag)
 *   setPassthroughEnabled(viewTag, enabled)  // Week 4
 *   takeScreenshot(viewTag, fileName, saveToCameraRoll) → {success, url, errorCode}
 *   startVideoRecording(viewTag, fileName, saveToCameraRoll, onError(errorCode))
 *   stopVideoRecording(viewTag) → {success, url, errorCode}
 */
@ReactModule(name = "VRModuleOpenXR")
public class VRModuleOpenXR extends ReactContextBaseJavaModule {

    // Watermark, file, gallery and permission handling, shared with the AR
    // navigator's capture methods (ARSceneNavigatorModule).
    private final MediaCapture mCapture;

    public VRModuleOpenXR(ReactApplicationContext context) {
        super(context);
        mCapture = new MediaCapture(context);
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
    /**
     * CL-H: co-location for Quest, published or joined.
     *
     * This lives here rather than on {@code ARSceneNavigatorModule} because that module
     * resolves its view as a {@code VRTARSceneNavigator} and rejects anything else —
     * and on Quest the VRActivity hosts a {@code VRTVRSceneNavigator}. Same native call
     * underneath; the only thing that differs is which view knows how to reach it.
     *
     * Resolves rather than rejects on failure. A frame source reads {@code success} and
     * turns a false into a {@code ViroFrameOutcome}, so a rejected promise would be an
     * exception for something the caller already handles as a value.
     */
    @ReactMethod
    public void rvCreateSharedFrame(final int sceneNavTag, final String groupId, final Promise promise) {
        sharedFrameOp(sceneNavTag, groupId, false, promise);
    }

    /** CL-H: recover the frame another headset published to {@code groupId}. */
    @ReactMethod
    public void rvJoinSharedFrame(final int sceneNavTag, final String groupId, final Promise promise) {
        sharedFrameOp(sceneNavTag, groupId, true, promise);
    }

    private static void resolveFailure(Promise promise, String error) {
        WritableMap r = Arguments.createMap();
        r.putBoolean("success", false);
        r.putString("error", error);
        promise.resolve(r);
    }

    private void sharedFrameOp(final int sceneNavTag, final String groupId,
                               final boolean joining, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            resolveFailure(promise, "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTVRSceneNavigator)) {
                        resolveFailure(promise, "Invalid view type — this call is for the Quest VR navigator");
                        return;
                    }
                    ARScene.RvSharedFrameCallback cb = (success, frameId, transformCsv, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (success) {
                            r.putString("frameId", frameId);
                            r.putString("transform", transformCsv);
                        } else {
                            r.putString("error", error);
                        }
                        promise.resolve(r);
                    };
                    if (joining) ((VRTVRSceneNavigator) view).rvJoinSharedFrame(groupId, cb);
                    else         ((VRTVRSceneNavigator) view).rvCreateSharedFrame(groupId, cb);
                } catch (Exception e) {
                    resolveFailure(promise, e.getMessage());
                }
            }
        });
    }

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

    /**
     * Style the passthrough layer. opacity ∈ [0,1]; edge[RGBA] is the edge
     * highlight colour (alpha 0 disables the edge effect).
     */
    @ReactMethod
    public void setPassthroughStyle(final int sceneNavTag, final float opacity,
                                    final float edgeR, final float edgeG,
                                    final float edgeB, final float edgeA) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) view).setPassthroughStyle(opacity, edgeR, edgeG, edgeB, edgeA);
                }
            }
        });
    }

    // ------------------------------------------------------------------------
    // Screen capture
    //
    // The same three calls, arguments and results as VRTARSceneNavigatorModule,
    // which cannot serve them here: it resolves its view as a VRTARSceneNavigator,
    // and VRActivity hosts a VRTVRSceneNavigator. The frame comes from the
    // renderer's ViroMediaRecorder, which ViroViewOpenXR sizes to one eye's
    // swapchain image, so a capture is the left eye rather than a stereo pair.
    // Passthrough is composited by the OS beneath the projection layer, so a
    // capture of a mixed-reality scene holds the virtual content only.
    //
    // Failures resolve (or reach onError) with a code rather than rejecting:
    //   6 (UNSUPPORTED_PLATFORM_ERROR) — no such view, or not an OpenXR view.
    //   7 (NOT_READY_ERROR) — the XR session has no swapchains yet; retry once
    //     the scene is rendering.
    // Otherwise the codes are ViroMediaRecorder.Error's, as on AR.
    // ------------------------------------------------------------------------

    private interface RecorderTask {
        void run(ViroMediaRecorder recorder);
    }

    private interface CaptureFailure {
        void fail(int errorCode);
    }

    /** Resolves the Quest navigator's recorder on the UI thread, or reports why not. */
    private void withRecorder(final int sceneNavTag, final RecorderTask task,
                              final CaptureFailure failure) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            failure.fail(MediaCapture.UNSUPPORTED_PLATFORM_ERROR);
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                ViroMediaRecorder recorder;
                try {
                    View view = viewResolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRTVRSceneNavigator)) {
                        failure.fail(MediaCapture.UNSUPPORTED_PLATFORM_ERROR);
                        return;
                    }
                    ViroView viroView = ((VRTVRSceneNavigator) view).getViroView();
                    if (!(viroView instanceof ViroViewOpenXR)) {
                        failure.fail(MediaCapture.UNSUPPORTED_PLATFORM_ERROR);
                        return;
                    }
                    // Null until the XR session has created its swapchains.
                    recorder = viroView.getRecorder();
                } catch (Exception e) {
                    failure.fail(MediaCapture.UNSUPPORTED_PLATFORM_ERROR);
                    return;
                }
                if (recorder == null) {
                    failure.fail(MediaCapture.NOT_READY_ERROR);
                    return;
                }
                task.run(recorder);
            }
        });
    }

    /**
     * Captures the next rendered frame (left eye) to {@code fileName}.jpg in
     * app-specific storage, and to the gallery as well when
     * {@code saveToCameraRoll}. Resolves {@code {success, url, errorCode}}.
     */
    @ReactMethod
    public void takeScreenshot(final int sceneNavTag, final String fileName,
                               final boolean saveToCameraRoll, final Promise promise) {
        withRecorder(sceneNavTag, recorder -> recorder.takeScreenShotAsync(
                new ViroMediaRecorder.ScreenshotFinishListener() {
                    @Override
                    public void onSuccess(android.graphics.Bitmap bitmap, String filePath) {
                        mCapture.resolveScreenshot(bitmap, fileName, saveToCameraRoll, promise);
                    }

                    @Override
                    public void onError(ViroMediaRecorder.Error error) {
                        promise.resolve(MediaCapture.failure(error.toInt()));
                    }
                }),
                errorCode -> promise.resolve(MediaCapture.failure(errorCode)));
    }

    /**
     * Starts recording the rendered frames (left eye) and the microphone. A
     * failure, at start or later, reaches {@code reactErrorDelegate} with a code.
     */
    @ReactMethod
    public void startVideoRecording(final int sceneNavTag, final String fileName,
                                    final boolean saveToCameraRoll, final Callback reactErrorDelegate) {
        withRecorder(sceneNavTag,
                recorder -> mCapture.startVideoRecording(recorder, fileName, saveToCameraRoll, reactErrorDelegate),
                errorCode -> reactErrorDelegate.invoke(errorCode));
    }

    /** Stops the recording and resolves {@code {success, url, errorCode}}. */
    @ReactMethod
    public void stopVideoRecording(final int sceneNavTag, final Promise promise) {
        withRecorder(sceneNavTag,
                recorder -> mCapture.stopVideoRecording(recorder, promise),
                errorCode -> promise.resolve(MediaCapture.failure(errorCode)));
    }
}
