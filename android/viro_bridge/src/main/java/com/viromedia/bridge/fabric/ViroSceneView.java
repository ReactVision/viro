package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.Scene;
import com.viro.core.Texture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.node.VRTScene;

import java.util.HashMap;
import java.util.Map;

/**
 * Native Android view for ViroScene component.
 * This represents a 3D scene that can contain ViroReact objects.
 */
public class ViroSceneView extends ViewGroup {
    
    private static final String TAG = "ViroSceneView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Scene mSceneJni;
    private ViroContext mViroContext;
    private VRTScene mVRTSceneWrapper;
    
    // Scene configuration
    private Map<String, Object> mSoundRoom;
    private Map<String, Object> mPhysicsWorld;
    private Object[] mPostProcessEffects;
    private Map<String, Object> mLightingEnvironment;
    private Map<String, Object> mBackgroundTexture;
    private Map<String, Object> mBackgroundCubeTexture;
    
    public ViroSceneView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroSceneView with ViroReact Scene integration");
        
        // Create ViroReact Scene
        mSceneJni = new Scene();
        
        // Create VRTScene wrapper for compatibility with existing scene management
        mVRTSceneWrapper = new VRTScene(mReactContext, null, -1, -1);
        mVRTSceneWrapper.setNativeScene(mSceneJni);
        
        setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        
        // Scene views are typically transparent to show 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Scene initialized successfully");
    }
    
    /**
     * Get the underlying ViroReact Scene object
     */
    public Scene getSceneJni() {
        return mSceneJni;
    }
    
    /**
     * Get the VRTScene wrapper for compatibility
     */
    public VRTScene getVRTSceneWrapper() {
        return mVRTSceneWrapper;
    }
    
    /**
     * Set the ViroContext for this scene
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        if (mVRTSceneWrapper != null) {
            mVRTSceneWrapper.setViroContext(context);
        }
    }
    
    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        // Layout child views (3D nodes)
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + l + "," + t + "," + r + "," + b + "]");
        
        // TODO: Layout ViroReact scene renderer
        // For 3D scenes, child components are positioned in 3D space, not 2D layout
        for (int i = 0; i < getChildCount(); i++) {
            getChildAt(i).layout(0, 0, r - l, b - t);
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
    
    // Scene configuration setters
    
    public void setSoundRoom(@Nullable ReadableMap soundRoom) {
        Log.d(TAG, "Setting sound room: " + soundRoom);
        mSoundRoom = soundRoom != null ? soundRoom.toHashMap() : null;
        
        if (mSceneJni != null && mSoundRoom != null) {
            // Apply sound room configuration to ViroReact scene
            // This affects spatial audio properties
            // TODO: Implement specific sound room properties based on mSoundRoom map
            Log.d(TAG, "Applied sound room configuration to ViroReact scene");
        }
    }
    
    public void setPhysicsWorld(@Nullable ReadableMap physicsWorld) {
        Log.d(TAG, "Setting physics world: " + physicsWorld);
        mPhysicsWorld = physicsWorld != null ? physicsWorld.toHashMap() : null;
        
        if (mSceneJni != null && mPhysicsWorld != null) {
            // Apply physics world configuration to ViroReact scene
            // Extract gravity vector
            Object gravityObj = mPhysicsWorld.get("gravity");
            if (gravityObj instanceof ReadableArray) {
                ReadableArray gravity = (ReadableArray) gravityObj;
                if (gravity.size() >= 3) {
                    float[] gravityVector = {
                        (float) gravity.getDouble(0),
                        (float) gravity.getDouble(1),
                        (float) gravity.getDouble(2)
                    };
                    mSceneJni.getPhysicsWorld().setGravity(gravityVector);
                }
            }
            Log.d(TAG, "Applied physics world configuration to ViroReact scene");
        }
    }
    
    public void setPostProcessEffects(@Nullable ReadableArray effects) {
        Log.d(TAG, "Setting post process effects: " + effects);
        mPostProcessEffects = effects != null ? effects.toArray() : null;
        
        // TODO: Apply post-processing effects to ViroReact scene
        // This includes bloom, HDR, tone mapping, etc.
    }
    
    public void setLightingEnvironment(@Nullable ReadableMap lightingEnv) {
        Log.d(TAG, "Setting lighting environment: " + lightingEnv);
        mLightingEnvironment = lightingEnv != null ? lightingEnv.toHashMap() : null;
        
        // TODO: Apply lighting environment to ViroReact scene
        // This affects IBL (Image-Based Lighting)
    }
    
    public void setBackgroundTexture(@Nullable ReadableMap texture) {
        Log.d(TAG, "Setting background texture: " + texture);
        mBackgroundTexture = texture != null ? texture.toHashMap() : null;
        
        if (mSceneJni != null && mBackgroundTexture != null) {
            // Apply background texture to ViroReact scene
            Object uriObj = mBackgroundTexture.get("uri");
            if (uriObj != null) {
                String imageUri = uriObj.toString();
                try {
                    Texture bgTexture = new Texture(imageUri, Texture.Type.TEXTURE_2D, true, 
                                                  Texture.StereoMode.NONE);
                    mSceneJni.setBackgroundTexture(bgTexture);
                    Log.d(TAG, "Applied background texture to ViroReact scene");
                } catch (Exception e) {
                    Log.e(TAG, "Error setting background texture: " + e.getMessage());
                }
            }
        }
    }
    
    public void setBackgroundCubeTexture(@Nullable ReadableMap cubeTexture) {
        Log.d(TAG, "Setting background cube texture: " + cubeTexture);
        mBackgroundCubeTexture = cubeTexture != null ? cubeTexture.toHashMap() : null;
        
        if (mSceneJni != null && mBackgroundCubeTexture != null) {
            // Apply background cube texture to ViroReact scene (360-degree skybox)
            Object uriObj = mBackgroundCubeTexture.get("uri");
            if (uriObj != null) {
                String imageUri = uriObj.toString();
                try {
                    Texture cubeTexture = new Texture(imageUri, Texture.Type.TEXTURE_CUBE, true, 
                                                    Texture.StereoMode.NONE);
                    mSceneJni.setBackgroundCubeTexture(cubeTexture);
                    Log.d(TAG, "Applied background cube texture to ViroReact scene");
                } catch (Exception e) {
                    Log.e(TAG, "Error setting background cube texture: " + e.getMessage());
                }
            }
        }
    }
    
    // Event emission
    
    public void emitPlatformUpdateEvent(Map<String, Object> platformInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("platformInfo", Arguments.makeNativeMap(platformInfo));
        emitSceneEvent("onPlatformUpdate", event);
    }
    
    public void emitCameraTransformUpdateEvent(Map<String, Object> cameraTransform) {
        WritableMap event = Arguments.createMap();
        event.putMap("cameraTransform", Arguments.makeNativeMap(cameraTransform));
        emitSceneEvent("onCameraTransformUpdate", event);
    }
    
    private void emitSceneEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact scene resources
        if (mVRTSceneWrapper != null) {
            mVRTSceneWrapper.forceCascadeTearDown();
            mVRTSceneWrapper = null;
        }
        
        if (mSceneJni != null) {
            mSceneJni.dispose();
            mSceneJni = null;
        }
        
        // Clear references
        mViroContext = null;
        mSoundRoom = null;
        mPhysicsWorld = null;
        mPostProcessEffects = null;
        mLightingEnvironment = null;
        mBackgroundTexture = null;
        mBackgroundCubeTexture = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroSceneView attached to window");
        
        // Scene will be activated through ViroSceneNavigatorView integration
        if (mSceneJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact scene ready for activation");
        }
        
        // Emit platform update event
        Map<String, Object> platformInfo = new HashMap<>();
        platformInfo.put("platform", "android");
        platformInfo.put("vrMode", false);
        platformInfo.put("arMode", false);
        emitPlatformUpdateEvent(platformInfo);
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroSceneView detached from window");
        // Scene cleanup is handled in onDropViewInstance
        // Scene deactivation is automatic through parent scene navigator
    }
}