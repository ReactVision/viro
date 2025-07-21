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

import com.viro.core.EventDelegate;
import com.viro.core.LightingEnvironment;
import com.viro.core.Node;
import com.viro.core.PortalScene;
import com.viro.core.PostProcessEffect;
import com.viro.core.Scene;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroPortalScene component.
 * ViroPortalScene represents the 3D scene content that is revealed through a ViroPortal
 * with comprehensive scene management, lighting environment, and post-processing effects.
 */
public class ViroPortalSceneView extends ViewGroup {
    
    private static final String TAG = "ViroPortalSceneView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private PortalScene mPortalSceneJni;
    private Scene mSceneJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Portal scene-specific properties
    private boolean mPassable = false;
    
    // Transform properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotationPivot;
    private Vector mScalePivot;
    private List<String> mTransformBehaviors;
    
    // Visibility and interaction
    private boolean mVisible = true;
    private float mOpacity = 1.0f;
    private int mRenderingOrder = 0;
    private boolean mIgnoreEventHandling = false;
    private String mDragType;
    
    // Physics and animation
    private Map<String, Object> mPhysicsBody;
    private boolean mHighAccuracyEvents = false;
    private Map<String, Object> mAnimation;
    
    // Scene lighting and effects
    private Map<String, Object> mLightingEnvironment;
    private List<String> mPostProcessEffects;
    
    public ViroPortalSceneView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroReact portal scene with default properties");
        
        // Create ViroReact Node for the portal scene
        mNodeJni = new Node();
        
        // Create PortalScene with initial properties
        mPortalSceneJni = new PortalScene(mViroContext);
        
        // Create Scene for portal scene content
        mSceneJni = new Scene(mViroContext);
        
        // Configure initial portal scene properties
        applyPortalSceneProperties();
        
        // Attach portal scene to node
        mNodeJni.setPortalScene(mPortalSceneJni);
        mPortalSceneJni.setScene(mSceneJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        
        // Portal scene views are typically transparent containers for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact PortalScene initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroPortalSceneView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroPortalSceneView> mPortalSceneView;
        
        public VRTComponentWrapper(ViroPortalSceneView portalSceneView) {
            super(portalSceneView.getContext(), null, -1, -1, portalSceneView.mReactContext);
            mPortalSceneView = new WeakReference<>(portalSceneView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroPortalSceneView portalSceneView = mPortalSceneView.get();
            if (portalSceneView != null) {
                portalSceneView.emitPortalSceneEvent(eventName, eventData);
            }
        }
    }
    
    /**
     * Get the underlying ViroReact Node object
     */
    public Node getNodeJni() {
        return mNodeJni;
    }
    
    /**
     * Get the underlying ViroReact PortalScene object
     */
    public PortalScene getPortalSceneJni() {
        return mPortalSceneJni;
    }
    
    /**
     * Get the underlying ViroReact Scene object
     */
    public Scene getSceneJni() {
        return mSceneJni;
    }
    
    /**
     * Set the ViroContext for this portal scene
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate portal scene with ViroContext if needed
        if (mPortalSceneJni != null) {
            mPortalSceneJni.dispose();
            mPortalSceneJni = new PortalScene(mViroContext);
            mSceneJni.dispose();
            mSceneJni = new Scene(mViroContext);
            applyPortalSceneProperties();
            if (mNodeJni != null) {
                mNodeJni.setPortalScene(mPortalSceneJni);
                mPortalSceneJni.setScene(mSceneJni);
            }
        }
    }
    
    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        // Layout child views (3D objects in the portal scene)
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + l + "," + t + "," + r + "," + b + "]");
        
        // For 3D portal scenes, positioning is handled by 3D transforms, not 2D layout
        // Layout child views to fill the entire container
        for (int i = 0; i < getChildCount(); i++) {
            android.view.View child = getChildAt(i);
            child.layout(0, 0, r - l, b - t);
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
    
    // Portal scene-specific setters
    
    public void setPassable(boolean passable) {
        Log.d(TAG, "Setting passable: " + passable);
        mPassable = passable;
        
        if (mPortalSceneJni != null) {
            mPortalSceneJni.setPassable(passable);
        }
    }
    
    // Transform setters
    
    public void setPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                mPosition = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing position: " + e.getMessage());
                mPosition = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mPosition = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }
    
    public void setScale(@Nullable ReadableArray scale) {
        Log.d(TAG, "Setting scale: " + scale);
        
        if (scale != null && scale.size() >= 3) {
            try {
                float x = (float) scale.getDouble(0);
                float y = (float) scale.getDouble(1);
                float z = (float) scale.getDouble(2);
                mScale = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing scale: " + e.getMessage());
                mScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applyTransformProperties();
    }
    
    public void setRotation(@Nullable ReadableArray rotation) {
        Log.d(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0)); // Convert to radians
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                mRotation = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing rotation: " + e.getMessage());
                mRotation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mRotation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }
    
    public void setRotationPivot(@Nullable ReadableArray rotationPivot) {
        Log.d(TAG, "Setting rotation pivot: " + rotationPivot);
        
        if (rotationPivot != null && rotationPivot.size() >= 3) {
            try {
                float x = (float) rotationPivot.getDouble(0);
                float y = (float) rotationPivot.getDouble(1);
                float z = (float) rotationPivot.getDouble(2);
                mRotationPivot = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing rotation pivot: " + e.getMessage());
                mRotationPivot = null;
            }
        } else {
            mRotationPivot = null;
        }
        
        applyTransformProperties();
    }
    
    public void setScalePivot(@Nullable ReadableArray scalePivot) {
        Log.d(TAG, "Setting scale pivot: " + scalePivot);
        
        if (scalePivot != null && scalePivot.size() >= 3) {
            try {
                float x = (float) scalePivot.getDouble(0);
                float y = (float) scalePivot.getDouble(1);
                float z = (float) scalePivot.getDouble(2);
                mScalePivot = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing scale pivot: " + e.getMessage());
                mScalePivot = null;
            }
        } else {
            mScalePivot = null;
        }
        
        applyTransformProperties();
    }
    
    public void setTransformBehaviors(@Nullable ReadableArray transformBehaviors) {
        Log.d(TAG, "Setting transform behaviors: " + transformBehaviors);
        
        if (transformBehaviors != null) {
            mTransformBehaviors = new ArrayList<>();
            for (int i = 0; i < transformBehaviors.size(); i++) {
                String behavior = transformBehaviors.getString(i);
                if (behavior != null) {
                    mTransformBehaviors.add(behavior);
                }
            }
        } else {
            mTransformBehaviors = null;
        }
        
        if (mNodeJni != null && mTransformBehaviors != null) {
            mNodeJni.setTransformBehaviors(mTransformBehaviors);
        }
    }
    
    // Visibility and interaction setters
    
    public void setVisible(boolean visible) {
        Log.d(TAG, "Setting visible: " + visible);
        mVisible = visible;
        
        if (mNodeJni != null) {
            mNodeJni.setVisible(visible);
        }
        setVisibility(visible ? VISIBLE : INVISIBLE);
    }
    
    public void setOpacity(float opacity) {
        Log.d(TAG, "Setting opacity: " + opacity);
        mOpacity = opacity;
        
        if (mNodeJni != null) {
            mNodeJni.setOpacity(opacity);
        }
        setAlpha(opacity);
    }
    
    public void setRenderingOrder(int renderingOrder) {
        Log.d(TAG, "Setting rendering order: " + renderingOrder);
        mRenderingOrder = renderingOrder;
        
        if (mNodeJni != null) {
            mNodeJni.setRenderingOrder(renderingOrder);
        }
    }
    
    public void setIgnoreEventHandling(boolean ignoreEventHandling) {
        Log.d(TAG, "Setting ignore event handling: " + ignoreEventHandling);
        mIgnoreEventHandling = ignoreEventHandling;
        
        if (mNodeJni != null) {
            mNodeJni.setIgnoreEventHandling(ignoreEventHandling);
        }
    }
    
    public void setDragType(@Nullable String dragType) {
        Log.d(TAG, "Setting drag type: " + dragType);
        mDragType = dragType;
        
        if (mNodeJni != null && dragType != null) {
            Node.DragType type = getDragTypeEnum(dragType);
            mNodeJni.setDragType(type);
        }
    }
    
    // Physics and animation setters
    
    public void setPhysicsBody(@Nullable ReadableMap physicsBody) {
        Log.d(TAG, "Setting physics body: " + physicsBody);
        mPhysicsBody = physicsBody != null ? physicsBody.toHashMap() : null;
        
        if (mNodeJni != null && mPhysicsBody != null) {
            applyPhysicsBody();
        }
    }
    
    public void setHighAccuracyEvents(boolean highAccuracyEvents) {
        Log.d(TAG, "Setting high accuracy events: " + highAccuracyEvents);
        mHighAccuracyEvents = highAccuracyEvents;
        
        if (mNodeJni != null) {
            mNodeJni.setHighAccuracyEvents(highAccuracyEvents);
        }
    }
    
    public void setAnimation(@Nullable ReadableMap animation) {
        Log.d(TAG, "Setting animation: " + animation);
        mAnimation = animation != null ? animation.toHashMap() : null;
        
        if (mNodeJni != null && mAnimation != null) {
            applyAnimation();
        }
    }
    
    // Scene lighting and effects setters
    
    public void setLightingEnvironment(@Nullable ReadableMap lightingEnvironment) {
        Log.d(TAG, "Setting lighting environment: " + lightingEnvironment);
        mLightingEnvironment = lightingEnvironment != null ? lightingEnvironment.toHashMap() : null;
        
        if (mSceneJni != null && mLightingEnvironment != null) {
            applyLightingEnvironment();
        }
    }
    
    public void setPostProcessEffects(@Nullable ReadableArray postProcessEffects) {
        if (postProcessEffects != null) {
            mPostProcessEffects = new ArrayList<>();
            for (int i = 0; i < postProcessEffects.size(); i++) {
                String effect = postProcessEffects.getString(i);
                if (effect != null) {
                    mPostProcessEffects.add(effect);
                }
            }
        } else {
            mPostProcessEffects = null;
        }
        Log.d(TAG, "Setting post process effects: " + mPostProcessEffects);
        
        if (mSceneJni != null && mPostProcessEffects != null) {
            applyPostProcessEffects();
        }
    }
    
    // Event emission
    
    public void emitSceneLoadStartEvent() {
        WritableMap event = Arguments.createMap();
        emitPortalSceneEvent("onSceneLoadStart", event);
    }
    
    public void emitSceneLoadEndEvent(Map<String, Object> sceneInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("sceneInfo", Arguments.makeNativeMap(sceneInfo));
        emitPortalSceneEvent("onSceneLoadEnd", event);
    }
    
    public void emitSceneLoadErrorEvent(Map<String, Object> errorInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("errorInfo", Arguments.makeNativeMap(errorInfo));
        emitPortalSceneEvent("onSceneLoadError", event);
    }
    
    public void emitClickEvent(Map<String, Object> clickInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("clickInfo", Arguments.makeNativeMap(clickInfo));
        emitPortalSceneEvent("onClick", event);
    }
    
    public void emitHoverEvent(Map<String, Object> hoverInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("hoverInfo", Arguments.makeNativeMap(hoverInfo));
        emitPortalSceneEvent("onHover", event);
    }
    
    public void emitDragEvent(Map<String, Object> dragInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("dragInfo", Arguments.makeNativeMap(dragInfo));
        emitPortalSceneEvent("onDrag", event);
    }
    
    public void emitTransformUpdateEvent(Map<String, Object> transformInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("transformInfo", Arguments.makeNativeMap(transformInfo));
        emitPortalSceneEvent("onTransformUpdate", event);
    }
    
    private void emitPortalSceneEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    // Helper Methods
    private void applyPortalSceneProperties() {
        if (mPortalSceneJni != null) {
            Log.d(TAG, "Applying portal scene properties to ViroReact PortalScene");
            
            // Apply portal-specific properties
            mPortalSceneJni.setPassable(mPassable);
            
            // Apply lighting environment and effects if set
            if (mLightingEnvironment != null) {
                applyLightingEnvironment();
            }
            if (mPostProcessEffects != null) {
                applyPostProcessEffects();
            }
            
            Log.d(TAG, "Portal scene properties applied successfully");
        }
    }
    
    private void applyTransformProperties() {
        if (mNodeJni != null) {
            Log.d(TAG, "Applying transform properties to ViroReact Node");
            
            // Apply position, rotation, and scale to the node
            mNodeJni.setPosition(mPosition);
            mNodeJni.setRotation(mRotation);
            mNodeJni.setScale(mScale);
            
            // Apply pivot points if set
            if (mRotationPivot != null) {
                mNodeJni.setRotationPivot(mRotationPivot);
            }
            if (mScalePivot != null) {
                mNodeJni.setScalePivot(mScalePivot);
            }
            
            Log.d(TAG, "Transform properties applied successfully");
        }
    }
    
    private void applyPhysicsBody() {
        if (mNodeJni != null && mPhysicsBody != null) {
            Log.d(TAG, "Applying physics body configuration");
            
            if (mPhysicsBody.containsKey("type")) {
                String type = (String) mPhysicsBody.get("type");
                Node.PhysicsBodyType physicsType = getPhysicsBodyTypeEnum(type);
                mNodeJni.setPhysicsBodyType(physicsType);
            }
            
            if (mPhysicsBody.containsKey("mass")) {
                float mass = ((Number) mPhysicsBody.get("mass")).floatValue();
                mNodeJni.setPhysicsBodyMass(mass);
            }
            
            Log.d(TAG, "Physics body applied successfully");
        }
    }
    
    private void applyAnimation() {
        if (mNodeJni != null && mAnimation != null) {
            Log.d(TAG, "Applying animation configuration");
            
            if (mAnimation.containsKey("name")) {
                String name = (String) mAnimation.get("name");
                mNodeJni.setAnimationName(name);
            }
            
            if (mAnimation.containsKey("duration")) {
                float duration = ((Number) mAnimation.get("duration")).floatValue();
                mNodeJni.setAnimationDuration(duration);
            }
            
            if (mAnimation.containsKey("loop")) {
                boolean loop = (Boolean) mAnimation.get("loop");
                mNodeJni.setAnimationLoop(loop);
            }
            
            Log.d(TAG, "Animation applied successfully");
        }
    }
    
    private void applyLightingEnvironment() {
        if (mSceneJni != null && mLightingEnvironment != null) {
            Log.d(TAG, "Applying lighting environment to portal scene");
            
            // Create lighting environment object
            LightingEnvironment lightingEnv = new LightingEnvironment(mViroContext);
            
            if (mLightingEnvironment.containsKey("source")) {
                Map<String, Object> source = (Map<String, Object>) mLightingEnvironment.get("source");
                if (source != null && source.containsKey("uri")) {
                    String uri = (String) source.get("uri");
                    lightingEnv.setEnvironmentImageURI(uri);
                }
            }
            
            if (mLightingEnvironment.containsKey("intensity")) {
                float intensity = ((Number) mLightingEnvironment.get("intensity")).floatValue();
                lightingEnv.setIntensity(intensity);
            }
            
            mSceneJni.setLightingEnvironment(lightingEnv);
            Log.d(TAG, "Lighting environment applied successfully");
        }
    }
    
    private void applyPostProcessEffects() {
        if (mSceneJni != null && mPostProcessEffects != null) {
            Log.d(TAG, "Applying post process effects to portal scene");
            
            List<PostProcessEffect> effects = new ArrayList<>();
            for (String effectName : mPostProcessEffects) {
                PostProcessEffect effect = getPostProcessEffectEnum(effectName);
                if (effect != null) {
                    effects.add(effect);
                }
            }
            
            mSceneJni.setPostProcessEffects(effects);
            Log.d(TAG, "Post process effects applied successfully");
        }
    }
    
    // Helper methods to convert string properties to enum values
    private Node.DragType getDragTypeEnum(String dragType) {
        switch (dragType.toLowerCase()) {
            case "fixed_distance":
                return Node.DragType.FIXED_DISTANCE;
            case "fixed_distance_origin":
                return Node.DragType.FIXED_DISTANCE_ORIGIN;
            case "fixed_to_world":
                return Node.DragType.FIXED_TO_WORLD;
            default:
            case "fixed_to_plane":
                return Node.DragType.FIXED_TO_PLANE;
        }
    }
    
    private Node.PhysicsBodyType getPhysicsBodyTypeEnum(String type) {
        switch (type.toLowerCase()) {
            case "kinematic":
                return Node.PhysicsBodyType.KINEMATIC;
            case "static":
                return Node.PhysicsBodyType.STATIC;
            default:
            case "dynamic":
                return Node.PhysicsBodyType.DYNAMIC;
        }
    }
    
    private PostProcessEffect getPostProcessEffectEnum(String effectName) {
        switch (effectName.toLowerCase()) {
            case "fxaa":
                return PostProcessEffect.FXAA;
            case "msaa":
                return PostProcessEffect.MSAA;
            case "bloom":
                return PostProcessEffect.BLOOM;
            case "motionblur":
                return PostProcessEffect.MOTION_BLUR;
            default:
                return null;
        }
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        Log.d(TAG, "onDropViewInstance called");
        
        // Clean up ViroReact portal scene resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setPortalScene(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mPortalSceneJni != null) {
            mPortalSceneJni.dispose();
            mPortalSceneJni = null;
        }
        
        if (mSceneJni != null) {
            mSceneJni.dispose();
            mSceneJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mTransformBehaviors = null;
        mPhysicsBody = null;
        mAnimation = null;
        mLightingEnvironment = null;
        mPostProcessEffects = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroPortalSceneView attached to window");
        
        // Portal scene will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mPortalSceneJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact portal scene ready for scene attachment");
        }
        
        // Ensure portal scene properties are applied
        applyPortalSceneProperties();
        applyTransformProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroPortalSceneView detached from window");
        
        // Portal scene cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public boolean isPassable() { return mPassable; }
    public Vector getPosition() { return mPosition; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public Vector getRotationPivot() { return mRotationPivot; }
    public Vector getScalePivot() { return mScalePivot; }
    public boolean isVisible() { return mVisible; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public boolean isIgnoreEventHandling() { return mIgnoreEventHandling; }
    public String getDragType() { return mDragType; }
    public boolean isHighAccuracyEvents() { return mHighAccuracyEvents; }
    public Map<String, Object> getPhysicsBody() { return mPhysicsBody; }
    public Map<String, Object> getAnimation() { return mAnimation; }
    public Map<String, Object> getLightingEnvironment() { return mLightingEnvironment; }
    public List<String> getPostProcessEffects() { return mPostProcessEffects; }
}