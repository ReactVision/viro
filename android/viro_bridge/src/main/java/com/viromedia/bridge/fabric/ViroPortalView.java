//
//  ViroPortalView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.Node;
import com.viro.core.Portal;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroPortal component.
 * ViroPortal provides advanced spatial portals for AR/VR scene transitions
 * with comprehensive portal management, passable interaction, and scene navigation.
 */
public class ViroPortalView extends View {
    
    private static final String TAG = "ViroPortalView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Portal mPortalJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    // Portal-specific properties
    private boolean mPassable = false;
    private Vector mPortalScale = new Vector(1.0f, 1.0f, 1.0f);
    private String mPortalEnterCompletionAction = "push";
    private String mPortalExitCompletionAction = "pop";
    private String mDestinationSceneKey;
    private ReadableMap mPortalStyle;
    
    // Transform properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotationPivot;
    private Vector mScalePivot;
    
    // Visibility and interaction
    private boolean mVisible = true;
    private float mOpacity = 1.0f;
    private int mRenderingOrder = 0;
    private boolean mIgnoreEventHandling = false;
    private String mDragType;
    
    // Physics and animation
    private ReadableMap mPhysicsBody;
    private boolean mHighAccuracyEvents = false;
    private ReadableMap mAnimation;
    
    // Portal state
    private boolean mIsActive = false;
    private boolean mIsEntering = false;
    private boolean mIsExiting = false;
    
    public ViroPortalView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroPortalView initialized with ViroReact Portal integration");
        
        initializePortal();
    }
    
    private void initializePortal() {
        Log.d(TAG, "Initializing ViroReact portal with default properties");
        
        // Create ViroReact Node for the portal
        mNodeJni = new Node();
        
        // Create Portal with initial properties
        mPortalJni = new Portal(mViroContext);
        
        // Configure initial portal properties
        applyPortalProperties();
        
        // Attach portal to node
        mNodeJni.setGeometry(mPortalJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Portal views are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Portal initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroPortalView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroPortalView> mPortalView;
        
        public VRTComponentWrapper(ViroPortalView portalView) {
            super(portalView.getContext(), null, -1, -1, portalView.mReactContext);
            mPortalView = new WeakReference<>(portalView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroPortalView portalView = mPortalView.get();
            if (portalView != null) {
                portalView.emitPortalEvent(eventName, eventData);
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
     * Get the underlying ViroReact Portal object
     */
    public Portal getPortalJni() {
        return mPortalJni;
    }
    
    /**
     * Set the ViroContext for this portal
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate portal with ViroContext if needed
        if (mPortalJni != null) {
            mPortalJni.dispose();
            mPortalJni = new Portal(mViroContext);
            applyPortalProperties();
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mPortalJni);
            }
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // Portals don't have traditional dimensions
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Portal layout is handled by 3D transforms and portal navigation
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Portal-specific setters
    
    public void setPassable(boolean passable) {
        Log.d(TAG, "Setting passable: " + passable);
        mPassable = passable;
        
        if (mPortalJni != null) {
            mPortalJni.setPassable(passable);
        }
    }
    
    public void setPortalScale(@Nullable ReadableArray portalScale) {
        Log.d(TAG, "Setting portal scale: " + portalScale);
        
        if (portalScale != null && portalScale.size() >= 3) {
            try {
                float x = (float) portalScale.getDouble(0);
                float y = (float) portalScale.getDouble(1);
                float z = (float) portalScale.getDouble(2);
                mPortalScale = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing portal scale: " + e.getMessage());
                mPortalScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mPortalScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        if (mPortalJni != null) {
            mPortalJni.setScale(mPortalScale);
        }
    }
    
    public void setPortalEnterCompletionAction(@Nullable String action) {
        Log.d(TAG, "Setting portal enter completion action: " + action);
        mPortalEnterCompletionAction = action != null ? action : "push";
        
        if (mPortalJni != null) {
            Portal.TransitionAction enterAction = getTransitionActionEnum(mPortalEnterCompletionAction);
            mPortalJni.setEnterAction(enterAction);
        }
    }
    
    public void setPortalExitCompletionAction(@Nullable String action) {
        Log.d(TAG, "Setting portal exit completion action: " + action);
        mPortalExitCompletionAction = action != null ? action : "pop";
        
        if (mPortalJni != null) {
            Portal.TransitionAction exitAction = getTransitionActionEnum(mPortalExitCompletionAction);
            mPortalJni.setExitAction(exitAction);
        }
    }
    
    public void setDestinationSceneKey(@Nullable String destinationSceneKey) {
        Log.d(TAG, "Setting destination scene key: " + destinationSceneKey);
        mDestinationSceneKey = destinationSceneKey;
        
        if (mPortalJni != null && destinationSceneKey != null) {
            mPortalJni.setDestinationScene(destinationSceneKey);
        }
    }
    
    public void setPortalStyle(@Nullable ReadableMap portalStyle) {
        Log.d(TAG, "Setting portal style: " + portalStyle);
        mPortalStyle = portalStyle;
        
        if (mPortalJni != null && portalStyle != null) {
            applyPortalStyle();
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
        
        if (mNodeJni != null && transformBehaviors != null) {
            List<String> behaviors = new ArrayList<>();
            for (int i = 0; i < transformBehaviors.size(); i++) {
                String behavior = transformBehaviors.getString(i);
                if (behavior != null) {
                    behaviors.add(behavior);
                }
            }
            mNodeJni.setTransformBehaviors(behaviors);
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
        mPhysicsBody = physicsBody;
        
        if (mNodeJni != null && physicsBody != null) {
            // Apply physics body configuration to the portal node
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
        mAnimation = animation;
        
        if (mNodeJni != null && animation != null) {
            // Apply animation configuration to the portal node
            applyAnimation();
        }
    }
    
    // Portal Control Methods
    public void activatePortal() {
        Log.d(TAG, "Activating portal");
        
        if (mPortalJni != null) {
            mPortalJni.setActive(true);
            mIsActive = true;
        }
        
        emitPortalActivateEvent();
    }
    
    public void deactivatePortal() {
        Log.d(TAG, "Deactivating portal");
        
        if (mPortalJni != null) {
            mPortalJni.setActive(false);
            mIsActive = false;
        }
        
        emitPortalDeactivateEvent();
    }
    
    public void enterPortal() {
        Log.d(TAG, "Entering portal");
        
        if (mPortalJni != null && mIsActive) {
            mPortalJni.enterPortal();
            mIsEntering = true;
        }
        
        emitPortalEnterEvent();
    }
    
    public void exitPortal() {
        Log.d(TAG, "Exiting portal");
        
        if (mPortalJni != null) {
            mPortalJni.exitPortal();
            mIsExiting = true;
        }
        
        emitPortalExitEvent();
    }
    
    // Helper Methods
    private void applyPortalProperties() {
        if (mPortalJni != null) {
            Log.d(TAG, "Applying portal properties to ViroReact Portal");
            
            // Apply portal-specific properties
            mPortalJni.setPassable(mPassable);
            mPortalJni.setScale(mPortalScale);
            
            // Apply transition actions
            Portal.TransitionAction enterAction = getTransitionActionEnum(mPortalEnterCompletionAction);
            Portal.TransitionAction exitAction = getTransitionActionEnum(mPortalExitCompletionAction);
            mPortalJni.setEnterAction(enterAction);
            mPortalJni.setExitAction(exitAction);
            
            // Apply destination scene if set
            if (mDestinationSceneKey != null) {
                mPortalJni.setDestinationScene(mDestinationSceneKey);
            }
            
            // Apply portal style if set
            if (mPortalStyle != null) {
                applyPortalStyle();
            }
            
            Log.d(TAG, "Portal properties applied successfully");
        }
    }
    
    private void applyPortalStyle() {
        if (mPortalJni != null && mPortalStyle != null) {
            Log.d(TAG, "Applying portal style properties");
            
            // Apply style properties like border, glow, etc.
            if (mPortalStyle.hasKey("borderWidth")) {
                float borderWidth = (float) mPortalStyle.getDouble("borderWidth");
                mPortalJni.setBorderWidth(borderWidth);
            }
            
            if (mPortalStyle.hasKey("borderColor")) {
                ReadableArray color = mPortalStyle.getArray("borderColor");
                if (color != null && color.size() >= 3) {
                    float r = (float) color.getDouble(0);
                    float g = (float) color.getDouble(1);
                    float b = (float) color.getDouble(2);
                    mPortalJni.setBorderColor(r, g, b);
                }
            }
            
            if (mPortalStyle.hasKey("glowIntensity")) {
                float glowIntensity = (float) mPortalStyle.getDouble("glowIntensity");
                mPortalJni.setGlowIntensity(glowIntensity);
            }
            
            Log.d(TAG, "Portal style applied successfully");
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
            
            // Apply physics properties from the physics body map
            if (mPhysicsBody.hasKey("type")) {
                String type = mPhysicsBody.getString("type");
                Node.PhysicsBodyType physicsType = getPhysicsBodyTypeEnum(type);
                mNodeJni.setPhysicsBodyType(physicsType);
            }
            
            if (mPhysicsBody.hasKey("mass")) {
                float mass = (float) mPhysicsBody.getDouble("mass");
                mNodeJni.setPhysicsBodyMass(mass);
            }
            
            Log.d(TAG, "Physics body applied successfully");
        }
    }
    
    private void applyAnimation() {
        if (mNodeJni != null && mAnimation != null) {
            Log.d(TAG, "Applying animation configuration");
            
            // Apply animation properties from the animation map
            if (mAnimation.hasKey("name")) {
                String name = mAnimation.getString("name");
                mNodeJni.setAnimationName(name);
            }
            
            if (mAnimation.hasKey("duration")) {
                float duration = (float) mAnimation.getDouble("duration");
                mNodeJni.setAnimationDuration(duration);
            }
            
            if (mAnimation.hasKey("loop")) {
                boolean loop = mAnimation.getBoolean("loop");
                mNodeJni.setAnimationLoop(loop);
            }
            
            Log.d(TAG, "Animation applied successfully");
        }
    }
    
    // Helper methods to convert string properties to enum values
    private Portal.TransitionAction getTransitionActionEnum(String action) {
        switch (action.toLowerCase()) {
            case "pop":
                return Portal.TransitionAction.POP;
            case "replace":
                return Portal.TransitionAction.REPLACE;
            default:
            case "push":
                return Portal.TransitionAction.PUSH;
        }
    }
    
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
    
    // Event Emission
    private void emitPortalActivateEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "activate");
        emitPortalEvent("onPortalActivate", event);
    }
    
    private void emitPortalDeactivateEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "deactivate");
        emitPortalEvent("onPortalDeactivate", event);
    }
    
    private void emitPortalEnterEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "enter");
        event.putString("destinationScene", mDestinationSceneKey);
        emitPortalEvent("onPortalEnter", event);
    }
    
    private void emitPortalExitEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "exit");
        emitPortalEvent("onPortalExit", event);
    }
    
    private void emitClickEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "click");
        emitPortalEvent("onClick", event);
    }
    
    private void emitHoverEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "hover");
        emitPortalEvent("onHover", event);
    }
    
    private void emitDragEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "drag");
        emitPortalEvent("onDrag", event);
    }
    
    private void emitTransformUpdateEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroPortal");
        event.putString("action", "transformUpdate");
        
        // Add current position
        WritableMap positionMap = Arguments.createMap();
        positionMap.putDouble("x", mPosition.x);
        positionMap.putDouble("y", mPosition.y);
        positionMap.putDouble("z", mPosition.z);
        event.putMap("position", positionMap);
        
        // Add current rotation (convert back to degrees)
        WritableMap rotationMap = Arguments.createMap();
        rotationMap.putDouble("x", Math.toDegrees(mRotation.x));
        rotationMap.putDouble("y", Math.toDegrees(mRotation.y));
        rotationMap.putDouble("z", Math.toDegrees(mRotation.z));
        event.putMap("rotation", rotationMap);
        
        emitPortalEvent("onTransformUpdate", event);
    }
    
    private void emitPortalEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Deactivate portal if it's active
        if (mIsActive) {
            deactivatePortal();
        }
        
        // Clean up ViroReact portal resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setGeometry(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mPortalJni != null) {
            mPortalJni.dispose();
            mPortalJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mPhysicsBody = null;
        mAnimation = null;
        mPortalStyle = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroPortalView attached to window");
        
        // Portal will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mPortalJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact portal ready for scene attachment");
        }
        
        // Ensure portal properties are applied
        applyPortalProperties();
        applyTransformProperties();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroPortalView detached from window");
        
        // Portal cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }

    // Getters for current values (useful for debugging and testing)
    public boolean isPassable() { return mPassable; }
    public Vector getPortalScale() { return mPortalScale; }
    public String getPortalEnterCompletionAction() { return mPortalEnterCompletionAction; }
    public String getPortalExitCompletionAction() { return mPortalExitCompletionAction; }
    public String getDestinationSceneKey() { return mDestinationSceneKey; }
    public Vector getPosition() { return mPosition; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public boolean isVisible() { return mVisible; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public boolean isIgnoreEventHandling() { return mIgnoreEventHandling; }
    public String getDragType() { return mDragType; }
    public boolean isHighAccuracyEvents() { return mHighAccuracyEvents; }
    public boolean isActive() { return mIsActive; }
    public boolean isEntering() { return mIsEntering; }
    public boolean isExiting() { return mIsExiting; }
}