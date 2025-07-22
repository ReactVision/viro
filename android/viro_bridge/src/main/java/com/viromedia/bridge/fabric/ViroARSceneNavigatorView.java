//
//  ViroARSceneNavigatorView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.RendererConfiguration;
import com.viro.core.ViroContext;
import com.viro.core.ViroView;
import com.viro.core.ViroViewARCore;
import com.viro.core.ARScene;
import com.viro.core.Vector;
import com.viro.core.ARDeclarativeSession;
import com.viro.core.ARHitTestResult;
import com.viro.core.ARPointCloud;
import com.viro.core.ARTrackingState;
import com.viromedia.bridge.ReactViroPackage;
import com.viromedia.bridge.component.node.VRTARScene;
import com.viromedia.bridge.component.node.VRTScene;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.module.PerfMonitor;
import com.viromedia.bridge.utility.ViroEvents;
import com.viromedia.bridge.utility.ViroLog;
import com.viromedia.bridge.utility.DisplayRotationListener;
import com.viromedia.bridge.utility.ARUtils;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroARSceneNavigator component.
 * ViroARSceneNavigator provides AR scene navigation with ARCore integration,
 * supporting AR sessions, tracking, plane detection, and marker-based AR.
 */
public class ViroARSceneNavigatorView extends ViewGroup implements LifecycleEventListener {
    
    private static final String TAG = ViroLog.getTag(ViroARSceneNavigatorView.class);
    
    private ReactContext mReactContext;
    private Map<String, Object> mInitialScene;
    private Map<String, Object> mViroAppProps;
    
    // ARCore Integration
    private ViroViewARCore mViroView;
    private ViroContext mViroContext;
    private ARDeclarativeSession mARSession;
    private DisplayRotationListener mRotationListener;
    private boolean mGLInitialized = false;
    private boolean mViewAdded = false;
    private RendererConfiguration mRendererConfig;
    
    // Scene Management
    private int mSelectedSceneIndex = -1;
    private final ArrayList<VRTARScene> mSceneArray = new ArrayList<VRTARScene>();
    private boolean mHasOnExitViroCallback = false;
    
    // AR Configuration
    private boolean mAutofocusEnabled = true;
    private boolean mPlaneDetectionEnabled = true;
    private boolean mLightEstimationEnabled = true;
    private boolean mAnchorDetectionEnabled = true;
    private String mWorldAlignment = "gravity";
    private String mVideoQuality = "high";
    private int mNumberOfTrackedImages = 1;
    
    // Rendering configuration
    private boolean mBloomEnabled = false;
    private boolean mShadowsEnabled = true;
    private boolean mMultisamplingEnabled = true;
    private boolean mHdrEnabled = false;
    private boolean mPbrEnabled = true;
    private boolean mDebug = false;
    
    // AR Tracking state
    private ARTrackingState mCurrentTrackingState = ARTrackingState.UNAVAILABLE;
    private boolean mNeedsAutoFocusToggle = false;
    
    /**
     * ARCore startup listener for initialization
     */
    private static class StartupListenerARCore implements ViroViewARCore.StartupListener {
        
        private WeakReference<ViroARSceneNavigatorView> mNavigator;
        
        public StartupListenerARCore(ViroARSceneNavigatorView navigator) {
            mNavigator = new WeakReference<ViroARSceneNavigatorView>(navigator);
        }
        
        @Override
        public void onSuccess() {
            final ViroARSceneNavigatorView navigator = mNavigator.get();
            if (navigator == null) {
                return;
            }
            
            navigator.mGLInitialized = true;
            (new Handler(Looper.getMainLooper())).post(new Runnable() {
                @Override
                public void run() {
                    ViroARSceneNavigatorView nav = mNavigator.get();
                    if (nav != null) {
                        nav.mGLInitialized = true;
                        nav.setViroContext();
                        nav.setupARSession();
                    }
                }
            });
            
            if (navigator.mNeedsAutoFocusToggle) {
                navigator.setAutofocusEnabled(navigator.mAutofocusEnabled);
                navigator.mNeedsAutoFocusToggle = false;
            }
        }
        
        @Override
        public void onFailure(ViroViewARCore.StartupError error, String errorMessage) {
            final ViroARSceneNavigatorView navigator = mNavigator.get();
            if (navigator == null) {
                return;
            }
            
            ViroLog.e(TAG, "ViroViewARCore startup failure: " + errorMessage);
            navigator.emitEvent("onExitViro", Arguments.createMap());
        }
    }
    
    public ViroARSceneNavigatorView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        mReactContext.addLifecycleEventListener(this);
        
        ViroLog.i(TAG, "Initializing ViroARSceneNavigatorView");
        
        // Initialize renderer configuration
        initRendererConfig();
        
        // Setup display rotation listener
        mRotationListener = new DisplayRotationListener(context);
    }
    
    private void initRendererConfig() {
        mRendererConfig = new RendererConfiguration();
        mRendererConfig.setEnableMultisampling(mMultisamplingEnabled);
        mRendererConfig.setEnableHDR(mHdrEnabled);
        mRendererConfig.setEnablePBR(mPbrEnabled);
        mRendererConfig.setEnableBloom(mBloomEnabled);
        mRendererConfig.setEnableShadows(mShadowsEnabled);
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.i(TAG, "onAttachedToWindow");
        
        if (mViroView == null) {
            mViroView = new ViroViewARCore(mReactContext, new StartupListenerARCore(this), mRendererConfig);
            addView(mViroView);
            mViewAdded = true;
        }
        
        if (mRotationListener != null) {
            mRotationListener.enable();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.i(TAG, "onDetachedFromWindow");
        
        if (mRotationListener != null) {
            mRotationListener.disable();
        }
        
        cleanupARSession();
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);
        
        if (mViroView != null) {
            mViroView.layout(0, 0, right - left, bottom - top);
        }
    }
    
    /**
     * Set up the AR session with configuration
     */
    private void setupARSession() {
        if (mViroContext == null || mViroView == null) {
            return;
        }
        
        ViroLog.i(TAG, "Setting up AR session");
        
        // Create AR declarative session
        mARSession = new ARDeclarativeSession();
        mARSession.setAutofocusEnabled(mAutofocusEnabled);
        mARSession.setPlaneDetectionEnabled(mPlaneDetectionEnabled);
        mARSession.setLightEstimationEnabled(mLightEstimationEnabled);
        mARSession.setAnchorDetectionEnabled(mAnchorDetectionEnabled);
        
        // Set tracking state listener
        mARSession.setTrackingStateListener(new ARDeclarativeSession.TrackingStateListener() {
            @Override
            public void onTrackingUpdated(ARTrackingState state, ARTrackingState.Reason reason) {
                mCurrentTrackingState = state;
                emitTrackingStateEvent(state, reason);
            }
        });
        
        // Set point cloud listener
        mARSession.setPointCloudListener(new ARDeclarativeSession.PointCloudListener() {
            @Override
            public void onPointCloudUpdated(ARPointCloud pointCloud) {
                emitPointCloudEvent(pointCloud);
            }
        });
        
        // Set the AR session on the ViroView
        mViroView.setARSession(mARSession);
    }
    
    /**
     * Clean up AR session resources
     */
    private void cleanupARSession() {
        if (mARSession != null) {
            mARSession.pause();
            mARSession = null;
        }
    }
    
    /**
     * Set the ViroContext after GL initialization
     */
    private void setViroContext() {
        if (mViroView != null) {
            mViroContext = mViroView.getViroContext();
            
            // Notify all existing scenes of the context
            for (VRTARScene scene : mSceneArray) {
                scene.setViroContext(mViroContext);
            }
            
            // Set initial scene if provided
            if (mInitialScene != null) {
                pushScene(mInitialScene, mViroAppProps);
            }
        }
    }
    
    /**
     * Navigate to a new AR scene
     */
    public void pushScene(@NonNull Map<String, Object> sceneMap, @Nullable Map<String, Object> appProps) {
        if (!mGLInitialized) {
            mInitialScene = sceneMap;
            mViroAppProps = appProps;
            return;
        }
        
        VRTARScene newScene = createARScene(sceneMap);
        if (newScene != null) {
            mSceneArray.add(newScene);
            mSelectedSceneIndex = mSceneArray.size() - 1;
            
            if (mViroContext != null) {
                newScene.setViroContext(mViroContext);
                mViroView.setScene(newScene.getARSceneJni());
            }
            
            emitSceneNavigationEvent("onPushScene", mSelectedSceneIndex);
        }
    }
    
    /**
     * Pop the current AR scene
     */
    public void popScene() {
        if (mSelectedSceneIndex > 0) {
            mSceneArray.remove(mSelectedSceneIndex);
            mSelectedSceneIndex--;
            
            VRTARScene currentScene = mSceneArray.get(mSelectedSceneIndex);
            if (currentScene != null && mViroView != null) {
                mViroView.setScene(currentScene.getARSceneJni());
            }
            
            emitSceneNavigationEvent("onPopScene", mSelectedSceneIndex);
        }
    }
    
    /**
     * Jump to a specific AR scene
     */
    public void jumpToScene(int sceneIndex) {
        if (sceneIndex >= 0 && sceneIndex < mSceneArray.size()) {
            mSelectedSceneIndex = sceneIndex;
            
            VRTARScene currentScene = mSceneArray.get(mSelectedSceneIndex);
            if (currentScene != null && mViroView != null) {
                mViroView.setScene(currentScene.getARSceneJni());
            }
            
            emitSceneNavigationEvent("onJumpToScene", mSelectedSceneIndex);
        }
    }
    
    /**
     * Replace the current AR scene
     */
    public void replaceScene(@NonNull Map<String, Object> sceneMap, @Nullable Map<String, Object> appProps) {
        if (!mGLInitialized) {
            mInitialScene = sceneMap;
            mViroAppProps = appProps;
            return;
        }
        
        VRTARScene newScene = createARScene(sceneMap);
        if (newScene != null && mSelectedSceneIndex >= 0) {
            mSceneArray.set(mSelectedSceneIndex, newScene);
            
            if (mViroContext != null) {
                newScene.setViroContext(mViroContext);
                mViroView.setScene(newScene.getARSceneJni());
            }
            
            emitSceneNavigationEvent("onReplaceScene", mSelectedSceneIndex);
        }
    }
    
    /**
     * Perform AR hit test
     */
    public void performARHitTest(float x, float y, ReadableArray types) {
        if (mViroView == null || mARSession == null) {
            return;
        }
        
        List<ARHitTestResult> results = mViroView.performARHitTest(x, y);
        emitHitTestResults(results);
    }
    
    /**
     * Reset AR session
     */
    public void resetARSession() {
        if (mARSession != null) {
            mARSession.resetSession();
        }
    }
    
    /**
     * Create an AR scene from a scene map
     */
    @Nullable
    private VRTARScene createARScene(Map<String, Object> sceneMap) {
        if (sceneMap == null) {
            return null;
        }
        
        try {
            // Create new VRTARScene instance
            VRTARScene scene = new VRTARScene(mReactContext);
            
            // Configure scene properties if provided
            if (sceneMap.containsKey("displayPointCloud")) {
                scene.setDisplayPointCloud((Boolean) sceneMap.get("displayPointCloud"));
            }
            
            if (sceneMap.containsKey("pointCloudScale")) {
                // Handle point cloud scale configuration
                Object scaleObj = sceneMap.get("pointCloudScale");
                if (scaleObj instanceof List) {
                    List<?> scaleList = (List<?>) scaleObj;
                    if (scaleList.size() >= 3) {
                        Vector scale = new Vector(
                            ((Number) scaleList.get(0)).floatValue(),
                            ((Number) scaleList.get(1)).floatValue(),
                            ((Number) scaleList.get(2)).floatValue()
                        );
                        scene.setPointCloudScale(scale);
                    }
                }
            }
            
            return scene;
        } catch (Exception e) {
            ViroLog.e(TAG, "Failed to create AR scene: " + e.getMessage());
            return null;
        }
    }
    
    // Property setters for New Architecture
    
    public void setInitialScene(@Nullable ReadableMap scene) {
        if (scene != null) {
            mInitialScene = scene.toHashMap();
        }
    }
    
    public void setViroAppProps(@Nullable ReadableMap props) {
        if (props != null) {
            mViroAppProps = props.toHashMap();
        }
    }
    
    public void setAutofocusEnabled(boolean enabled) {
        mAutofocusEnabled = enabled;
        if (mARSession != null) {
            mARSession.setAutofocusEnabled(enabled);
        } else {
            mNeedsAutoFocusToggle = true;
        }
    }
    
    public void setWorldAlignment(@Nullable String alignment) {
        if (alignment != null) {
            mWorldAlignment = alignment;
        }
    }
    
    public void setVideoQuality(@Nullable String quality) {
        if (quality != null) {
            mVideoQuality = quality;
        }
    }
    
    public void setNumberOfTrackedImages(int number) {
        mNumberOfTrackedImages = number;
    }
    
    public void setBloomEnabled(boolean enabled) {
        mBloomEnabled = enabled;
        if (mRendererConfig != null) {
            mRendererConfig.setEnableBloom(enabled);
        }
    }
    
    public void setHdrEnabled(boolean enabled) {
        mHdrEnabled = enabled;
        if (mRendererConfig != null) {
            mRendererConfig.setEnableHDR(enabled);
        }
    }
    
    public void setPbrEnabled(boolean enabled) {
        mPbrEnabled = enabled;
        if (mRendererConfig != null) {
            mRendererConfig.setEnablePBR(enabled);
        }
    }
    
    public void setShadowsEnabled(boolean enabled) {
        mShadowsEnabled = enabled;
        if (mRendererConfig != null) {
            mRendererConfig.setEnableShadows(enabled);
        }
    }
    
    public void setMultisamplingEnabled(boolean enabled) {
        mMultisamplingEnabled = enabled;
        if (mRendererConfig != null) {
            mRendererConfig.setEnableMultisampling(enabled);
        }
    }
    
    // Event emission helpers
    
    private void emitEvent(@NonNull String eventName, @NonNull WritableMap eventData) {
        mReactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
            getId(),
            eventName,
            eventData
        );
    }
    
    private void emitSceneNavigationEvent(@NonNull String eventName, int sceneIndex) {
        WritableMap event = Arguments.createMap();
        event.putInt("sceneIndex", sceneIndex);
        emitEvent(eventName, event);
    }
    
    private void emitTrackingStateEvent(ARTrackingState state, ARTrackingState.Reason reason) {
        WritableMap event = Arguments.createMap();
        event.putString("state", state.toString());
        event.putString("reason", reason.toString());
        emitEvent("onTrackingUpdated", event);
    }
    
    private void emitPointCloudEvent(ARPointCloud pointCloud) {
        WritableMap event = Arguments.createMap();
        // Convert point cloud data to React Native format
        emitEvent("onPointCloudUpdate", event);
    }
    
    private void emitHitTestResults(List<ARHitTestResult> results) {
        WritableMap event = Arguments.createMap();
        // Convert hit test results to React Native format
        emitEvent("onARHitTestResults", event);
    }
    
    // Lifecycle methods
    
    @Override
    public void onHostResume() {
        if (mViroView != null) {
            mViroView.onActivityResumed(mReactContext.getCurrentActivity());
        }
        if (mARSession != null) {
            mARSession.resume();
        }
    }
    
    @Override
    public void onHostPause() {
        if (mViroView != null) {
            mViroView.onActivityPaused(mReactContext.getCurrentActivity());
        }
        if (mARSession != null) {
            mARSession.pause();
        }
    }
    
    @Override
    public void onHostDestroy() {
        cleanupARSession();
        if (mViroView != null) {
            mViroView.onActivityDestroyed(mReactContext.getCurrentActivity());
        }
    }
}