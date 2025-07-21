package com.viromedia.bridge.fabric;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.RendererConfiguration;
import com.viro.core.ViroContext;
import com.viro.core.ViroView;
import com.viro.core.ViroViewScene;
import com.viro.core.Vector;
import com.viromedia.bridge.ReactViroPackage;
import com.viromedia.bridge.component.node.VRTScene;
import com.viromedia.bridge.module.MaterialManager;
import com.viromedia.bridge.module.PerfMonitor;
import com.viromedia.bridge.utility.ViroEvents;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * Native Android view for ViroSceneNavigator component.
 * This serves as the main container for ViroReact scenes in New Architecture.
 */
public class ViroSceneNavigatorView extends ViewGroup implements LifecycleEventListener {
    
    private static final String TAG = "ViroSceneNavigatorView";
    
    private ReactContext mReactContext;
    private Map<String, Object> mInitialScene;
    private Map<String, Object> mViroAppProps;
    
    // ViroReact Integration
    private ViroView mViroView;
    private ViroContext mViroContext;
    private boolean mGLInitialized = false;
    private boolean mViewAdded = false;
    private RendererConfiguration mRendererConfig;
    
    // Scene Management
    private int mSelectedSceneIndex = -1;
    private final ArrayList<VRTScene> mSceneArray = new ArrayList<VRTScene>();
    private boolean mHasOnExitViroCallback = false;
    
    // Scene configuration
    private boolean mAutofocus = true;
    private boolean mBloomEnabled = false;
    private boolean mShadowsEnabled = true;
    private boolean mMultisamplingEnabled = true;
    private boolean mHdrEnabled = false;
    private boolean mPbrEnabled = true;
    private boolean mVrModeEnabled = false;
    private boolean mDebug = false;
    private boolean mCanCameraTransformUpdate = false;
    
    // Camera and rendering settings
    private String mWorldAlignment = "gravity";
    private String mVideoQuality = "high";
    private int mNumberOfTrackedImages = 1;
    
    public ViroSceneNavigatorView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeViroReactRenderer();
    }
    
    private void initializeViroReactRenderer() {
        Log.d(TAG, "Initializing ViroReact renderer for Fabric");
        
        // Initialize renderer configuration
        mRendererConfig = new RendererConfiguration();
        
        // Create ViroViewScene (3D scene renderer)
        mViroView = new ViroViewScene(mReactContext.getCurrentActivity(), 
            new StartupListener3DScene(this));
        
        // Add ViroView as child to render 3D content
        addView((View) mViroView);
        
        // Get ViroContext for 3D object management
        mViroContext = mViroView.getViroContext();
        
        // Set up performance monitoring
        PerfMonitor perfMonitor = mReactContext.getNativeModule(PerfMonitor.class);
        if (perfMonitor != null) {
            perfMonitor.setView(mViroView);
        }
        
        // Trigger ViroView lifecycle
        mViroView.onActivityStarted(mReactContext.getCurrentActivity());
        
        // Reload materials if needed
        MaterialManager materialManager = mReactContext.getNativeModule(MaterialManager.class);
        if (materialManager != null) {
            materialManager.reloadMaterials();
        }
        
        // Register for React lifecycle events
        mReactContext.addLifecycleEventListener(this);
        
        setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        
        setFocusable(true);
        setFocusableInTouchMode(true);
        
        Log.d(TAG, "ViroReact renderer initialized successfully");
    }
    
    private static class StartupListener3DScene implements ViroViewScene.StartupListener {
        private WeakReference<ViroSceneNavigatorView> mNavigator;

        public StartupListener3DScene(ViroSceneNavigatorView navigator) {
            mNavigator = new WeakReference<>(navigator);
        }

        @Override
        public void onSuccess() {
            final ViroSceneNavigatorView navigator = mNavigator.get();
            if (navigator == null) {
                return;
            }

            navigator.mGLInitialized = true;
            (new Handler(Looper.getMainLooper())).post(new Runnable() {
                @Override
                public void run() {
                    final ViroSceneNavigatorView sceneNav = navigator;
                    if (sceneNav != null) {
                        sceneNav.mGLInitialized = true;
                        sceneNav.onViroReactInitialized();
                    }
                }
            });
        }

        @Override
        public void onFailure(ViroViewScene.StartupError startupError, String s) {
            Log.e(TAG, "ViroViewScene startup failed: " + startupError + " - " + s);
        }
    }
    
    private void onViroReactInitialized() {
        Log.d(TAG, "ViroReact 3D renderer initialized successfully");
        
        // Apply any pending configuration
        applyRendererConfiguration();
        
        // Set initial scene if available
        if (mInitialScene != null && mSelectedSceneIndex >= 0) {
            setViroContext();
        }
    }
    
    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + l + "," + t + "," + r + "," + b + "]");
        
        // Layout ViroView to fill the entire container
        if (mViroView != null) {
            ((View) mViroView).layout(0, 0, r - l, b - t);
        }
        
        // Layout any additional child views (VRTScene components)
        for (int i = 0; i < getChildCount(); i++) {
            View child = getChildAt(i);
            if (!(child instanceof ViroView)) {
                child.layout(0, 0, r - l, b - t);
            }
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        
        // Measure child views
        for (int i = 0; i < getChildCount(); i++) {
            measureChild(getChildAt(i), widthMeasureSpec, heightMeasureSpec);
        }
    }
    
    // Props setters
    
    public void setInitialScene(@Nullable ReadableMap scene) {
        Log.d(TAG, "Setting initial scene: " + scene);
        mInitialScene = scene != null ? scene.toHashMap() : null;
        
        if (mInitialScene != null && mGLInitialized) {
            // Scene loading will be handled by child VRTScene components
            // The initial scene index will be set to 0 when scenes are added
            mSelectedSceneIndex = 0;
        }
    }
    
    public void setViroAppProps(@Nullable ReadableMap props) {
        mViroAppProps = props != null ? props.toHashMap() : null;
        Log.d(TAG, "Setting viro app props: " + mViroAppProps);
    }
    
    public void setAutofocus(boolean autofocus) {
        mAutofocus = autofocus;
        Log.d(TAG, "Setting autofocus: " + autofocus);
        // Autofocus is typically handled by camera components
    }
    
    public void setBloomEnabled(boolean enabled) {
        mBloomEnabled = enabled;
        Log.d(TAG, "Setting bloom enabled: " + enabled);
        mRendererConfig.setBloomEnabled(enabled);
        if (mViroView != null) {
            mViroView.setBloomEnabled(enabled);
        }
    }
    
    public void setShadowsEnabled(boolean enabled) {
        mShadowsEnabled = enabled;
        Log.d(TAG, "Setting shadows enabled: " + enabled);
        mRendererConfig.setShadowsEnabled(enabled);
        if (mViroView != null) {
            mViroView.setShadowsEnabled(enabled);
        }
    }
    
    public void setMultisamplingEnabled(boolean enabled) {
        mMultisamplingEnabled = enabled;
        Log.d(TAG, "Setting multisampling enabled: " + enabled);
        mRendererConfig.setMultisamplingEnabled(enabled);
        // Note: Multisampling is applied during ViroView initialization
    }
    
    public void setHdrEnabled(boolean enabled) {
        mHdrEnabled = enabled;
        Log.d(TAG, "Setting HDR enabled: " + enabled);
        mRendererConfig.setHDREnabled(enabled);
        if (mViroView != null) {
            mViroView.setHDREnabled(enabled);
        }
    }
    
    public void setPbrEnabled(boolean enabled) {
        mPbrEnabled = enabled;
        Log.d(TAG, "Setting PBR enabled: " + enabled);
        mRendererConfig.setPBREnabled(enabled);
        if (mViroView != null) {
            mViroView.setPBREnabled(enabled);
        }
    }
    
    public void setWorldAlignment(@Nullable String alignment) {
        mWorldAlignment = alignment != null ? alignment : "gravity";
        Log.d(TAG, "Setting world alignment: " + mWorldAlignment);
        // World alignment is typically handled by AR components
    }
    
    public void setVideoQuality(@Nullable String quality) {
        mVideoQuality = quality != null ? quality : "high";
        Log.d(TAG, "Setting video quality: " + mVideoQuality);
        // Video quality is handled by individual video components
    }
    
    public void setNumberOfTrackedImages(int count) {
        mNumberOfTrackedImages = count;
        Log.d(TAG, "Setting number of tracked images: " + count);
        // AR image tracking is handled by AR-specific components
    }
    
    public void setVrModeEnabled(boolean enabled) {
        mVrModeEnabled = enabled;
        Log.d(TAG, "Setting VR mode enabled: " + enabled);
        // Note: VR mode switching would require recreating ViroView
        // This implementation uses ViroViewScene for 3D content
    }
    
    public void setDebug(boolean debug) {
        mDebug = debug;
        Log.d(TAG, "Setting debug: " + debug);
        if (mViroView != null) {
            mViroView.setDebug(debug);
        }
    }
    
    public void setCanCameraTransformUpdate(boolean canUpdate) {
        mCanCameraTransformUpdate = canUpdate;
        Log.d(TAG, "Setting can camera transform update: " + canUpdate);
        // Camera transform updates are handled by camera components
    }
    
    // Scene navigation methods
    
    public void push(ReadableMap scene, ReadableMap passProps) {
        Log.d(TAG, "Pushing scene: " + scene);
        // TODO: Implement scene push in ViroReact renderer
        
        WritableMap event = Arguments.createMap();
        event.putString("scene", scene.getString("scene"));
        event.putMap("passProps", passProps);
        emitSceneNavigatorEvent("onScenePush", event);
    }
    
    public void pop() {
        Log.d(TAG, "Popping scene");
        // TODO: Implement scene pop in ViroReact renderer
        
        emitSceneNavigatorEvent("onScenePop", null);
    }
    
    public void popN(int n) {
        Log.d(TAG, "Popping " + n + " scenes");
        // TODO: Implement popN in ViroReact renderer
        
        WritableMap event = Arguments.createMap();
        event.putInt("count", n);
        emitSceneNavigatorEvent("onScenePopN", event);
    }
    
    public void replace(ReadableMap scene, ReadableMap passProps) {
        Log.d(TAG, "Replacing scene: " + scene);
        // TODO: Implement scene replace in ViroReact renderer
        
        WritableMap event = Arguments.createMap();
        event.putString("scene", scene.getString("scene"));
        event.putMap("passProps", passProps);
        emitSceneNavigatorEvent("onSceneReplace", event);
    }
    
    public void jumpToScene(ReadableMap scene, ReadableMap passProps) {
        Log.d(TAG, "Jumping to scene: " + scene);
        // TODO: Implement jumpToScene in ViroReact renderer
        
        WritableMap event = Arguments.createMap();
        event.putString("scene", scene.getString("scene"));
        event.putMap("passProps", passProps);
        emitSceneNavigatorEvent("onSceneJump", event);
    }
    
    // Event emission
    
    private void emitSceneNavigatorEvent(String eventName, @Nullable WritableMap eventData) {
        try {
            if (mReactContext != null && mReactContext.hasActiveCatalystInstance()) {
                mReactContext.getJSModule(RCTEventEmitter.class)
                    .receiveEvent(getId(), eventName, eventData);
            } else {
                Log.w(TAG, "Cannot emit event " + eventName + ": no active React context");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error emitting event " + eventName + ": " + e.getMessage(), e);
        }
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        Log.d(TAG, "onDropViewInstance called");
        
        // Clean up scene array
        for (VRTScene scene : mSceneArray) {
            scene.forceCascadeTearDown();
        }
        mSceneArray.clear();
        
        // Notify MaterialManager about renderer destruction
        if (mReactContext != null) {
            MaterialManager materialManager = mReactContext.getNativeModule(MaterialManager.class);
            if (materialManager != null) {
                materialManager.shouldReload();
            }
            
            // Unregister lifecycle listener
            mReactContext.removeLifecycleEventListener(this);
        }
        
        // Clean up ViroView
        if (mViroView != null) {
            if (mReactContext != null && mReactContext.getCurrentActivity() != null) {
                mViroView.onActivityStopped(mReactContext.getCurrentActivity());
            }
            mViroView.dispose();
            mViroView = null;
        }
        
        // Clear references
        mViroContext = null;
        mInitialScene = null;
        mViroAppProps = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroSceneNavigatorView attached to window");
        // ViroView is already started in constructor
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroSceneNavigatorView detached from window");
        // Cleanup is handled in onDropViewInstance
    }
    
    // React Lifecycle Events (LifecycleEventListener implementation)
    
    @Override
    public void onHostResume() {
        Log.d(TAG, "onHostResume");
        if (mViewAdded && mGLInitialized && mSelectedSceneIndex < mSceneArray.size() && mSelectedSceneIndex >= 0) {
            VRTScene childScene = mSceneArray.get(mSelectedSceneIndex);
            childScene.onHostResume();
        }

        if (mViroView != null && mReactContext != null && mReactContext.getCurrentActivity() != null) {
            mViroView.onActivityResumed(mReactContext.getCurrentActivity());
        }
    }

    @Override
    public void onHostPause() {
        Log.d(TAG, "onHostPause");
        if (mViewAdded && mGLInitialized && mSelectedSceneIndex < mSceneArray.size() && mSelectedSceneIndex >= 0) {
            VRTScene childScene = mSceneArray.get(mSelectedSceneIndex);
            childScene.onHostPause();
        }

        if (mViroView != null && mReactContext != null && mReactContext.getCurrentActivity() != null) {
            mViroView.onActivityPaused(mReactContext.getCurrentActivity());
        }
    }

    @Override
    public void onHostDestroy() {
        Log.d(TAG, "onHostDestroy");
        if (mReactContext != null) {
            mReactContext.removeLifecycleEventListener(this);
        }
    }
    
    // Scene Management Methods
    
    @Override
    public void addView(View child, int index) {
        if (child instanceof ViroView) {
            super.addView(child, index);
            return;
        } else if (!(child instanceof VRTScene)) {
            throw new IllegalArgumentException("Attempted to add a non-scene element [" + 
                child.getClass().getSimpleName() + "] to SceneNavigator!");
        }

        VRTScene childScene = (VRTScene) child;
        mSceneArray.add(index, childScene);
        childScene.setPlatformInformation(mViroView.getPlatform(), mViroView.getHeadset(),
                mViroView.getControllerType());
        
        // If this is the first scene or the selected scene, activate it
        if (index == mSelectedSceneIndex || mSelectedSceneIndex < 0) {
            setCurrentSceneIndex(index);
        }

        mViewAdded = true;
        super.addView(child, index);
    }
    
    private void setViroContext() {
        if (mViroView != null && mViewAdded && mGLInitialized && 
            mSelectedSceneIndex >= 0 && mSelectedSceneIndex < mSceneArray.size()) {
            VRTScene childScene = mSceneArray.get(mSelectedSceneIndex);
            childScene.setViroContext(mViroContext);
            childScene.setScene(childScene);
            childScene.setNativeRenderer(mViroView.getRenderer());
        }
    }
    
    public void setCurrentSceneIndex(int index) {
        mSelectedSceneIndex = index;
        if (index < 0 || index >= mSceneArray.size()) {
            return;
        }

        setViroContext();
        if (mViroView != null) {
            mViroView.setScene(mSceneArray.get(mSelectedSceneIndex).getNativeScene());
            mSceneArray.get(mSelectedSceneIndex).parentDidAppear();
        }
    }
    
    private void applyRendererConfiguration() {
        if (mViroView != null) {
            mViroView.setHDREnabled(mHdrEnabled);
            mViroView.setPBREnabled(mPbrEnabled);
            mViroView.setBloomEnabled(mBloomEnabled);
            mViroView.setShadowsEnabled(mShadowsEnabled);
            mViroView.setDebug(mDebug);
        }
    }
    
    public void userDidRequestExitVR() {
        if (!mHasOnExitViroCallback) {
            if (mReactContext != null && mReactContext.getCurrentActivity() != null) {
                mReactContext.getCurrentActivity().finish();
            }
            return;
        }

        // Notify JavaScript listeners
        emitSceneNavigatorEvent(ViroEvents.ON_EXIT_VIRO, null);

        // Notify Native listeners
        if (mReactContext != null) {
            Intent intent = new Intent();
            intent.setAction(ReactViroPackage.ON_EXIT_VIRO_BROADCAST);
            LocalBroadcastManager.getInstance(mReactContext.getApplicationContext()).sendBroadcast(intent);
        }
    }
    
    public void setHasOnExitViroCallback(boolean hasCallback) {
        mHasOnExitViroCallback = hasCallback;
    }
    
    // Utility methods for camera projection
    
    public Vector unprojectPoint(Vector point) {
        if (mViroView == null || mViroView.getRenderer() == null) {
            throw new IllegalStateException("Unable to invoke unprojectPoint. Renderer is not initialized");
        }
        return mViroView.getRenderer().unprojectPoint(point.x, point.y, point.z);
    }

    public Vector projectPoint(Vector point) {
        if (mViroView == null || mViroView.getRenderer() == null) {
            throw new IllegalStateException("Unable to invoke projectPoint. Renderer is not initialized");
        }
        return mViroView.getRenderer().projectPoint(point.x, point.y, point.z);
    }
    
    public void recenterTracking() {
        if (mViroView != null) {
            mViroView.recenterTracking();
        }
    }
}