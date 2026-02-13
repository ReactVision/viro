//  Copyright © 2017 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package com.viromedia.bridge.component;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.viro.core.ARAnchor;
import com.viro.core.ARNode;
import com.viro.core.ARScene;
import com.viro.core.ViroViewARCore;
import com.viro.core.ViroView;
import com.viromedia.bridge.ReactViroPackage;
import com.viromedia.bridge.component.node.VRTARScene;
import com.viromedia.bridge.module.ARSceneNavigatorModule;
import com.viromedia.bridge.utility.ARUtils;
import com.viromedia.bridge.utility.DisplayRotationListener;

import java.lang.ref.WeakReference;

/**
 * ARSceneNavigator manages the various AR scenes that a Viro App can navigate between.
 */
public class VRTARSceneNavigator extends VRT3DSceneNavigator {

    private DisplayRotationListener mRotationListener;
    private boolean mAutoFocusEnabled = false;
    private boolean mNeedsAutoFocusToggle = false;
    private ARScene.OcclusionMode mOcclusionMode = ARScene.OcclusionMode.DISABLED;
    private boolean mNeedsOcclusionModeToggle = false;

    // Pending configuration for features that may be set before session is ready
    private boolean mSemanticModeEnabled = false;
    private boolean mNeedsSemanticModeToggle = false;
    private boolean mGeospatialModeEnabled = false;
    private boolean mNeedsGeospatialModeToggle = false;

    // Track if we were detached from window (for tab switching detection)
    // This is separate from VRTComponent's mDetached which tracks React tree detachment
    private boolean mWasDetachedFromWindow = false;

    private static class StartupListenerARCore implements ViroViewARCore.StartupListener {

        private WeakReference<VRTARSceneNavigator> mNavigator;

        public StartupListenerARCore(VRTARSceneNavigator navigator) {
            mNavigator = new WeakReference<VRTARSceneNavigator>(navigator);
        }

        @Override
        public void onSuccess() {
            final VRTARSceneNavigator navigator = mNavigator.get();
            final WeakReference<VRTARSceneNavigator> navigatorWeakReference =
                    new WeakReference<VRTARSceneNavigator>(navigator);

            if (navigator == null) {
                return;
            }

            navigator.mGLInitialized = true;
            (new Handler(Looper.getMainLooper())).post(new Runnable() {
                @Override
                public void run() {
                    VRTARSceneNavigator nav = navigatorWeakReference.get();
                    if (nav != null) {
                        nav.mGLInitialized = true;
                        nav.setViroContext();
                    }
                }
            });

            if (navigator.mNeedsAutoFocusToggle) {
                navigator.setAutoFocusEnabled(navigator.mAutoFocusEnabled);
                navigator.mNeedsAutoFocusToggle = false;
            }

            // Apply pending occlusion mode configuration
            if (navigator.mNeedsOcclusionModeToggle) {
                navigator.applyOcclusionMode();
                navigator.mNeedsOcclusionModeToggle = false;
            }

            // Apply pending semantic mode configuration
            if (navigator.mNeedsSemanticModeToggle) {
                navigator.applySemanticModeEnabled();
                navigator.mNeedsSemanticModeToggle = false;
            }

            // Apply pending geospatial mode configuration
            if (navigator.mNeedsGeospatialModeToggle) {
                navigator.applyGeospatialModeEnabled();
                navigator.mNeedsGeospatialModeToggle = false;
            }

            // Apply pending world mesh configuration
            if (navigator.mNeedsWorldMeshToggle) {
                navigator.applyWorldMeshEnabled();
                navigator.mNeedsWorldMeshToggle = false;
            }
        }

        @Override
        public void onFailure(ViroViewARCore.StartupError error, String errorMessage) {
            Log.e("Viro", "onRendererFailed [error: " + error + "], message [" + errorMessage + "]");
            // No-op
        }
    }

    public VRTARSceneNavigator(ReactContext context) {
        super(context, ReactViroPackage.ViroPlatform.AR);
        final  WeakReference<VRTARSceneNavigator> weakSceneARRef = new WeakReference<VRTARSceneNavigator>(this);
        mRotationListener = new DisplayRotationListener(context) {
            @Override
            public void onDisplayRotationChanged(int rotation) {
                VRTARSceneNavigator navigator = weakSceneARRef.get();
                if (navigator != null) {
                    ViroViewARCore view = navigator.getARView();
                    if (view != null) {
                        view.setCameraRotation(rotation);
                    }
                }
            }
        };
        mRotationListener.enable();
    }

    /*
     Override the parent method to use the ViroARView.
     */
    @Override
    protected ViroView createViroView(ReactContext reactContext) {
        return new ViroViewARCore(reactContext.getCurrentActivity(),
                new StartupListenerARCore(this));
    }

    @Override
    public void addView(View child, int index) {
        // This view only accepts ARScene and VrView children!
        if (!(child instanceof VRTARScene) && !(child instanceof ViroView)) {
            throw new IllegalArgumentException("Attempted to add a non-ARScene element ["
                    + child.getClass().getSimpleName() + "] to ARSceneNavigator!");
        }
        super.addView(child, index);

        // Apply current occlusion mode to newly added ARScenes
        if (child instanceof VRTARScene) {
            ((VRTARScene) child).setOcclusionMode(mOcclusionMode);
        }
    }

    public ViroViewARCore getARView() {
        return (ViroViewARCore) mViroView;
    }

    public void resetARSession() {
        ViroViewARCore arView = getARView();
        // No-op for now.
    }

    @Override
    protected void onAttachedToWindow() {
        android.util.Log.i(TAG, "=== onAttachedToWindow START ===");
        android.util.Log.i(TAG, "  mWasDetachedFromWindow: " + mWasDetachedFromWindow);
        android.util.Log.i(TAG, "  mViroView: " + (mViroView != null ? "NOT NULL" : "NULL"));

        // Detect tab switch scenario: we were detached before and ViroView was disposed
        if (mWasDetachedFromWindow && mViroView == null) {
            android.util.Log.i(TAG, "  TAB SWITCH DETECTED - Emitting event to React");

            // Emit event to React side to trigger remount
            emitTabSwitchEvent();

            // Reset flag
            mWasDetachedFromWindow = false;

            // Don't call super - React will remount us with a fresh key
            android.util.Log.i(TAG, "=== onAttachedToWindow END (waiting for React remount) ===");
            return;
        }

        // Normal attach (first time or after resume without disposal)
        super.onAttachedToWindow();

        // Re-enable rotation listener when view is reattached
        if (mRotationListener != null) {
            mRotationListener.enable();
            android.util.Log.i(TAG, "  Rotation listener enabled");
        }

        android.util.Log.i(TAG, "=== onAttachedToWindow END (normal) ===");
    }

    @Override
    protected void onDetachedFromWindow() {
        android.util.Log.i(TAG, "=== onDetachedFromWindow START ===");
        android.util.Log.i(TAG, "  mViroView: " + (mViroView != null ? "NOT NULL" : "NULL"));

        // Mark that we were detached - used to detect tab switches
        mWasDetachedFromWindow = true;

        // Disable rotation listener
        if (mRotationListener != null) {
            mRotationListener.disable();
            android.util.Log.i(TAG, "  Rotation listener disabled");
        }

        // Pause AR session before disposal
        ViroViewARCore arView = getARView();
        if (arView != null) {
            android.app.Activity activity = mReactContext.getCurrentActivity();
            if (activity != null) {
                android.util.Log.i(TAG, "  Pausing AR session");
                arView.onActivityPaused(activity);
                arView.onActivityStopped(activity);
            }
        }

        // Call parent to dispose ViroView normally
        // This is correct for both tab switching and component unmount
        super.onDetachedFromWindow();

        android.util.Log.i(TAG, "=== onDetachedFromWindow END ===");
    }

    /**
     * Emit an event to the React side indicating a tab switch was detected.
     * The React component will listen for this event and trigger a remount.
     */
    private void emitTabSwitchEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("type", "tabSwitch");

        try {
            mReactContext
                .getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onTabSwitch", event);
            android.util.Log.i(TAG, "  Tab switch event emitted to React");
        } catch (Exception e) {
            android.util.Log.e(TAG, "  Failed to emit tab switch event: " + e.getMessage());
        }
    }

    public void dispose() {
        // Clear the window detachment flag since this is a permanent disposal
        mWasDetachedFromWindow = false;

        // Disable rotation listener
        if (mRotationListener != null) {
            mRotationListener.disable();
            mRotationListener = null;
        }

        // The parent's onDetachedFromWindow() will be called by the view system
        // when the component is actually removed, so we don't need to call it here
    }

    public void setAutoFocusEnabled(boolean enabled) {
        mAutoFocusEnabled = enabled;
        if (mGLInitialized) {
            ((ViroViewARCore)mViroView).setCameraAutoFocusEnabled(mAutoFocusEnabled);
        } else {
            mNeedsAutoFocusToggle = true;
        }
    }

    public void setOcclusionMode(String mode) {
        android.util.Log.i(TAG, "[OCCLUSION] setOcclusionMode called with mode string: '" + mode + "'");
        mOcclusionMode = ARScene.OcclusionMode.DISABLED;
        if (mode != null) {
            String modeLower = mode.toLowerCase();
            android.util.Log.i(TAG, "[OCCLUSION] mode.toLowerCase(): '" + modeLower + "'");
            switch (modeLower) {
                case "depthbased":
                    mOcclusionMode = ARScene.OcclusionMode.DEPTH_BASED;
                    android.util.Log.i(TAG, "[OCCLUSION] Set to DEPTH_BASED");
                    break;
                case "peopleonly":
                    mOcclusionMode = ARScene.OcclusionMode.PEOPLE_ONLY;
                    android.util.Log.i(TAG, "[OCCLUSION] Set to PEOPLE_ONLY");
                    break;
                case "disabled":
                default:
                    mOcclusionMode = ARScene.OcclusionMode.DISABLED;
                    android.util.Log.i(TAG, "[OCCLUSION] Set to DISABLED (matched case: '" + modeLower + "')");
                    break;
            }
        } else {
            android.util.Log.i(TAG, "[OCCLUSION] mode was NULL, using DISABLED");
        }
        android.util.Log.i(TAG, "[OCCLUSION] Final mOcclusionMode: " + mOcclusionMode + ", mGLInitialized: " + mGLInitialized);
        // If GL is initialized, apply immediately; otherwise queue for later
        if (mGLInitialized) {
            applyOcclusionMode();
        } else {
            mNeedsOcclusionModeToggle = true;
        }
    }

    /**
     * Apply occlusion mode to all existing ARScenes.
     * Called either immediately when GL is ready, or deferred via onSuccess callback.
     */
    private void applyOcclusionMode() {
        android.util.Log.i(TAG, "[OCCLUSION] applyOcclusionMode: applying mode " + mOcclusionMode + " to " + getChildCount() + " children");
        for (int i = 0; i < getChildCount(); i++) {
            View child = getChildAt(i);
            if (child instanceof VRTARScene) {
                android.util.Log.i(TAG, "[OCCLUSION] applyOcclusionMode: applying to VRTARScene child " + i);
                ((VRTARScene) child).setOcclusionMode(mOcclusionMode);
            }
        }
    }

    /**
     * Get the current occlusion mode. Used when adding new scenes so they
     * inherit the navigator's occlusion setting.
     */
    public ARScene.OcclusionMode getOcclusionMode() {
        return mOcclusionMode;
    }

    // Cloud Anchor Support

    private String mCloudAnchorProvider = "none";
    private static final String TAG = "ViroAR";

    public void setCloudAnchorProvider(String provider) {
        mCloudAnchorProvider = provider != null ? provider.toLowerCase() : "none";

        Log.i(TAG, "Setting cloud anchor provider: " + mCloudAnchorProvider);

        if ("arcore".equals(mCloudAnchorProvider)) {
            Log.i(TAG, "ARCore Cloud Anchors provider enabled");

            // Check if API key is configured in AndroidManifest
            try {
                android.content.pm.ApplicationInfo ai = getContext().getPackageManager()
                    .getApplicationInfo(getContext().getPackageName(), android.content.pm.PackageManager.GET_META_DATA);
                if (ai.metaData != null) {
                    String apiKey = ai.metaData.getString("com.google.android.ar.API_KEY");
                    if (apiKey != null && !apiKey.isEmpty()) {
                        Log.i(TAG, "ARCore API key found in AndroidManifest.xml (length: " + apiKey.length() + ")");
                    } else {
                        Log.w(TAG, "WARNING: com.google.android.ar.API_KEY not found in AndroidManifest.xml. Cloud anchors will not work!");
                    }
                } else {
                    Log.w(TAG, "WARNING: No meta-data found in AndroidManifest.xml. Cloud anchors may not work!");
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not check for ARCore API key: " + e.getMessage());
            }
        } else {
            Log.i(TAG, "Cloud Anchors disabled");
        }
    }

    /**
     * Get the current ARScene from the active VRTARScene child.
     */
    private ARScene getCurrentARScene() {
        VRTARScene currentScene = null;
        for (int i = 0; i < getChildCount(); i++) {
            View child = getChildAt(i);
            if (child instanceof VRTARScene) {
                currentScene = (VRTARScene) child;
                break;
            }
        }
        if (currentScene != null) {
            return (ARScene) currentScene.getNativeScene();
        }
        return null;
    }

    public void hostCloudAnchor(String anchorId, int ttlDays,
                                ARSceneNavigatorModule.CloudAnchorCallback callback) {
        if (!"arcore".equals(mCloudAnchorProvider)) {
            callback.onFailure("Cloud anchor provider not configured. Set cloudAnchorProvider='arcore' to enable.",
                               "ErrorInternal");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onFailure("AR scene not available", "ErrorInternal");
            return;
        }

        // Host the anchor using ARCore's cloud anchor API
        // The native layer handles anchor lookup by ID
        arScene.hostCloudAnchorById(anchorId, ttlDays, new ARScene.CloudAnchorHostListener() {
            @Override
            public void onSuccess(ARAnchor cloudAnchor, ARNode arNode) {
                // Get the cloud anchor ID from the returned anchor
                callback.onSuccess(cloudAnchor.getCloudAnchorId());
            }

            @Override
            public void onFailure(String error) {
                callback.onFailure(error, "ErrorInternal");
            }
        });
    }

    public void resolveCloudAnchor(String cloudAnchorId,
                                   ARSceneNavigatorModule.CloudAnchorResolveCallback callback) {
        if (!"arcore".equals(mCloudAnchorProvider)) {
            callback.onFailure("Cloud anchor provider not configured. Set cloudAnchorProvider='arcore' to enable.",
                               "ErrorInternal");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onFailure("AR scene not available", "ErrorInternal");
            return;
        }

        // Resolve the cloud anchor
        arScene.resolveCloudAnchor(cloudAnchorId, new ARScene.CloudAnchorResolveListener() {
            @Override
            public void onSuccess(ARAnchor anchor, ARNode arNode) {
                // Convert anchor to WritableMap using ARUtils
                WritableMap anchorData = ARUtils.mapFromARAnchor(anchor);
                callback.onSuccess(anchorData);
            }

            @Override
            public void onFailure(String error) {
                callback.onFailure(error, "ErrorInternal");
            }
        });
    }

    public void cancelCloudAnchorOperations() {
        // ARCore doesn't have explicit cancel - operations will just time out
        // This is a placeholder for future implementation if needed
    }

    // ========================================================================
    // Geospatial API Support
    // ========================================================================

    private String mGeospatialAnchorProvider = "none";

    public void setGeospatialAnchorProvider(String provider) {
        mGeospatialAnchorProvider = provider != null ? provider.toLowerCase() : "none";

        Log.i(TAG, "Setting geospatial anchor provider: " + mGeospatialAnchorProvider);

        if ("arcore".equals(mGeospatialAnchorProvider)) {
            Log.i(TAG, "ARCore Geospatial provider enabled");

            // Check if API key is configured in AndroidManifest
            try {
                android.content.pm.ApplicationInfo ai = getContext().getPackageManager()
                    .getApplicationInfo(getContext().getPackageName(), android.content.pm.PackageManager.GET_META_DATA);
                if (ai.metaData != null) {
                    String apiKey = ai.metaData.getString("com.google.android.ar.API_KEY");
                    if (apiKey != null && !apiKey.isEmpty()) {
                        Log.i(TAG, "ARCore API key found in AndroidManifest.xml (length: " + apiKey.length() + ")");
                    } else {
                        Log.w(TAG, "WARNING: com.google.android.ar.API_KEY not found in AndroidManifest.xml. Geospatial features will not work!");
                    }
                } else {
                    Log.w(TAG, "WARNING: No meta-data found in AndroidManifest.xml. Geospatial features may not work!");
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not check for ARCore API key: " + e.getMessage());
            }
        } else {
            Log.i(TAG, "Geospatial provider disabled");
        }
    }

    public boolean isGeospatialModeSupported() {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            return false;
        }
        return arScene.isGeospatialModeSupported();
    }

    public void setGeospatialModeEnabled(boolean enabled) {
        mGeospatialModeEnabled = enabled;
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            // Queue for later when scene becomes available
            mNeedsGeospatialModeToggle = true;
            Log.i(TAG, "Geospatial mode queued for later: " + (enabled ? "enabled" : "disabled"));
            return;
        }
        applyGeospatialModeEnabled();
    }

    private void applyGeospatialModeEnabled() {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            Log.w(TAG, "Cannot apply geospatial mode: AR scene not available");
            return;
        }
        arScene.setGeospatialModeEnabled(mGeospatialModeEnabled);
        Log.i(TAG, "Geospatial mode applied: " + (mGeospatialModeEnabled ? "enabled" : "disabled"));
    }

    public String getEarthTrackingState() {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            return "Stopped";
        }
        ARScene.EarthTrackingState state = arScene.getEarthTrackingState();
        switch (state) {
            case ENABLED:
                return "Enabled";
            case PAUSED:
                return "Paused";
            case STOPPED:
            default:
                return "Stopped";
        }
    }

    public void getCameraGeospatialPose(ARSceneNavigatorModule.GeospatialPoseCallback callback) {
        if (!"arcore".equals(mGeospatialAnchorProvider)) {
            callback.onFailure("Geospatial provider not configured. Set geospatialAnchorProvider='arcore' to enable.");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onFailure("AR scene not available");
            return;
        }

        arScene.getCameraGeospatialPose(new ARScene.GeospatialPoseListener() {
            @Override
            public void onSuccess(ARScene.GeospatialPose pose) {
                callback.onSuccess(pose);
            }

            @Override
            public void onFailure(String error) {
                callback.onFailure(error);
            }
        });
    }

    public void checkVPSAvailability(double latitude, double longitude,
                                      ARSceneNavigatorModule.VPSAvailabilityCallback callback) {
        if (!"arcore".equals(mGeospatialAnchorProvider)) {
            callback.onResult("Unknown");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onResult("Unknown");
            return;
        }

        arScene.checkVPSAvailability(latitude, longitude, new ARScene.VPSAvailabilityListener() {
            @Override
            public void onResult(ARScene.VPSAvailability availability) {
                switch (availability) {
                    case AVAILABLE:
                        callback.onResult("Available");
                        break;
                    case UNAVAILABLE:
                        callback.onResult("Unavailable");
                        break;
                    default:
                        callback.onResult("Unknown");
                        break;
                }
            }
        });
    }

    public void createGeospatialAnchor(double latitude, double longitude, double altitude,
                                        float[] quaternion,
                                        ARSceneNavigatorModule.GeospatialAnchorCallback callback) {
        if (!"arcore".equals(mGeospatialAnchorProvider)) {
            callback.onFailure("Geospatial provider not configured. Set geospatialAnchorProvider='arcore' to enable.");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onFailure("AR scene not available");
            return;
        }

        arScene.createGeospatialAnchor(latitude, longitude, altitude, quaternion,
            new ARScene.GeospatialAnchorListener() {
                @Override
                public void onSuccess(ARScene.GeospatialAnchor anchor) {
                    callback.onSuccess(anchor);
                }

                @Override
                public void onFailure(String error) {
                    callback.onFailure(error);
                }
            });
    }

    public void createTerrainAnchor(double latitude, double longitude, double altitudeAboveTerrain,
                                     float[] quaternion,
                                     ARSceneNavigatorModule.GeospatialAnchorCallback callback) {
        if (!"arcore".equals(mGeospatialAnchorProvider)) {
            callback.onFailure("Geospatial provider not configured. Set geospatialAnchorProvider='arcore' to enable.");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onFailure("AR scene not available");
            return;
        }

        arScene.createTerrainAnchor(latitude, longitude, altitudeAboveTerrain, quaternion,
            new ARScene.GeospatialAnchorListener() {
                @Override
                public void onSuccess(ARScene.GeospatialAnchor anchor) {
                    callback.onSuccess(anchor);
                }

                @Override
                public void onFailure(String error) {
                    callback.onFailure(error);
                }
            });
    }

    public void createRooftopAnchor(double latitude, double longitude, double altitudeAboveRooftop,
                                     float[] quaternion,
                                     ARSceneNavigatorModule.GeospatialAnchorCallback callback) {
        if (!"arcore".equals(mGeospatialAnchorProvider)) {
            callback.onFailure("Geospatial provider not configured. Set geospatialAnchorProvider='arcore' to enable.");
            return;
        }

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            callback.onFailure("AR scene not available");
            return;
        }

        arScene.createRooftopAnchor(latitude, longitude, altitudeAboveRooftop, quaternion,
            new ARScene.GeospatialAnchorListener() {
                @Override
                public void onSuccess(ARScene.GeospatialAnchor anchor) {
                    callback.onSuccess(anchor);
                }

                @Override
                public void onFailure(String error) {
                    callback.onFailure(error);
                }
            });
    }

    public void removeGeospatialAnchor(String anchorId) {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            return;
        }
        arScene.removeGeospatialAnchor(anchorId);
    }

    // ========================================================================
    // World Mesh API Support
    // ========================================================================

    private boolean mWorldMeshEnabled = false;
    private boolean mNeedsWorldMeshToggle = false;
    private int mWorldMeshStride = 4;
    private float mWorldMeshMinConfidence = 0.3f;
    private float mWorldMeshMaxDepth = 5.0f;
    private double mWorldMeshUpdateIntervalMs = 100.0;
    private double mWorldMeshPersistenceMs = 500.0;
    private float mWorldMeshFriction = 0.5f;
    private float mWorldMeshRestitution = 0.3f;
    private String mWorldMeshCollisionTag = "world";
    private boolean mWorldMeshDebugDrawEnabled = false;

    public void setWorldMeshEnabled(boolean enabled) {
        mWorldMeshEnabled = enabled;
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            mNeedsWorldMeshToggle = true;
            Log.i(TAG, "World mesh mode queued for later: " + (enabled ? "enabled" : "disabled"));
            return;
        }
        applyWorldMeshEnabled();
    }

    public void setWorldMeshConfig(com.facebook.react.bridge.ReadableMap config) {
        if (config == null) {
            return;
        }

        if (config.hasKey("stride")) {
            mWorldMeshStride = config.getInt("stride");
        }
        if (config.hasKey("minConfidence")) {
            mWorldMeshMinConfidence = (float) config.getDouble("minConfidence");
        }
        if (config.hasKey("maxDepth")) {
            mWorldMeshMaxDepth = (float) config.getDouble("maxDepth");
        }
        if (config.hasKey("updateIntervalMs")) {
            mWorldMeshUpdateIntervalMs = config.getDouble("updateIntervalMs");
        }
        if (config.hasKey("meshPersistenceMs")) {
            mWorldMeshPersistenceMs = config.getDouble("meshPersistenceMs");
        }
        if (config.hasKey("friction")) {
            mWorldMeshFriction = (float) config.getDouble("friction");
        }
        if (config.hasKey("restitution")) {
            mWorldMeshRestitution = (float) config.getDouble("restitution");
        }
        if (config.hasKey("collisionTag")) {
            mWorldMeshCollisionTag = config.getString("collisionTag");
        }
        if (config.hasKey("debugDrawEnabled")) {
            mWorldMeshDebugDrawEnabled = config.getBoolean("debugDrawEnabled");
        }

        // Apply to ARScene if available
        ARScene arScene = getCurrentARScene();
        if (arScene != null) {
            arScene.setWorldMeshConfig(
                mWorldMeshStride,
                mWorldMeshMinConfidence,
                mWorldMeshMaxDepth,
                mWorldMeshUpdateIntervalMs,
                mWorldMeshPersistenceMs,
                mWorldMeshFriction,
                mWorldMeshRestitution,
                mWorldMeshCollisionTag,
                mWorldMeshDebugDrawEnabled
            );
        }
    }

    private void applyWorldMeshEnabled() {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            Log.w(TAG, "Cannot apply world mesh: AR scene not available");
            return;
        }

        // Apply config first
        arScene.setWorldMeshConfig(
            mWorldMeshStride,
            mWorldMeshMinConfidence,
            mWorldMeshMaxDepth,
            mWorldMeshUpdateIntervalMs,
            mWorldMeshPersistenceMs,
            mWorldMeshFriction,
            mWorldMeshRestitution,
            mWorldMeshCollisionTag,
            mWorldMeshDebugDrawEnabled
        );

        // Then enable/disable
        arScene.setWorldMeshEnabled(mWorldMeshEnabled);
        mNeedsWorldMeshToggle = false;
        Log.i(TAG, "World mesh applied: " + (mWorldMeshEnabled ? "enabled" : "disabled"));
    }

    // ========================================================================
    // Scene Semantics API Support
    // ========================================================================

    public boolean isSemanticModeSupported() {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            return false;
        }
        return arScene.isSemanticModeSupported();
    }

    public void setSemanticModeEnabled(boolean enabled) {
        mSemanticModeEnabled = enabled;
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            // Queue for later when scene becomes available
            mNeedsSemanticModeToggle = true;
            Log.i(TAG, "Scene Semantics mode queued for later: " + (enabled ? "enabled" : "disabled"));
            return;
        }
        applySemanticModeEnabled();
    }

    private void applySemanticModeEnabled() {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            Log.w(TAG, "Cannot apply semantic mode: AR scene not available");
            return;
        }
        arScene.setSemanticModeEnabled(mSemanticModeEnabled);
        Log.i(TAG, "Scene Semantics mode applied: " + (mSemanticModeEnabled ? "enabled" : "disabled"));
    }

    /**
     * Get the fraction of pixels for each semantic label in the current frame.
     * Returns a map with label names as keys and fractions (0.0-1.0) as values.
     */
    public WritableMap getSemanticLabelFractions() {
        WritableMap fractions = Arguments.createMap();

        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            return fractions;
        }

        // Get fractions for all semantic labels
        String[] labels = {"unlabeled", "sky", "building", "tree", "road",
                           "sidewalk", "terrain", "structure", "object",
                           "vehicle", "person", "water"};

        for (int i = 0; i < labels.length; i++) {
            float fraction = arScene.getSemanticLabelFraction(i);
            fractions.putDouble(labels[i], fraction);
        }

        return fractions;
    }

    /**
     * Get the fraction of pixels for a specific semantic label.
     * @param label The semantic label name (e.g., "sky", "building", "road")
     * @return The fraction of pixels with that label (0.0-1.0)
     */
    public float getSemanticLabelFraction(String label) {
        ARScene arScene = getCurrentARScene();
        if (arScene == null) {
            return 0.0f;
        }

        int labelIndex = getLabelIndexFromName(label);
        if (labelIndex < 0) {
            Log.w(TAG, "Unknown semantic label: " + label);
            return 0.0f;
        }

        return arScene.getSemanticLabelFraction(labelIndex);
    }

    /**
     * Convert a semantic label name to its index.
     */
    private int getLabelIndexFromName(String label) {
        if (label == null) return -1;

        switch (label.toLowerCase()) {
            case "unlabeled": return 0;
            case "sky": return 1;
            case "building": return 2;
            case "tree": return 3;
            case "road": return 4;
            case "sidewalk": return 5;
            case "terrain": return 6;
            case "structure": return 7;
            case "object": return 8;
            case "vehicle": return 9;
            case "person": return 10;
            case "water": return 11;
            default: return -1;
        }
    }
}
