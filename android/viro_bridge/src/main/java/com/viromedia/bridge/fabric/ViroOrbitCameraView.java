//
//  ViroOrbitCameraView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.Camera;
import com.viro.core.EventDelegate;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.Animation;
import com.viro.core.AnimationTransaction;
import com.viro.core.VROVector3f;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.List;
import java.util.ArrayList;

/**
 * Native Android view for ViroOrbitCamera component.
 * ViroOrbitCamera provides comprehensive orbit camera functionality with ViroReact 3D integration,
 * supporting orbital movement around focal points, camera controls, animation systems, and 3D positioning.
 */
public class ViroOrbitCameraView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroOrbitCameraView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Camera mCameraJni;
    private Node mTargetNodeJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Animation system
    private AnimationTransaction mAnimationTransaction;
    private List<Animation> mActiveAnimations = new ArrayList<>();
    private boolean mAnimationsEnabled = true;
    private Handler mOrbitAnimationHandler;
    private Runnable mOrbitAnimationRunnable;
    private boolean mIsAnimating = false;
    private long mLastAnimationTime = 0;
    
    // Camera properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 5.0f);
    private Vector mFocalPoint = new Vector(0.0f, 0.0f, 0.0f);
    private boolean mActive = false;
    private float mFieldOfView = 60.0f;
    
    // Orbit properties
    private float mOrbitRadius = 5.0f;
    private float mOrbitAngleHorizontal = 0.0f;
    private float mOrbitAngleVertical = 0.0f;
    private float mOrbitSpeed = 1.0f;
    
    // Animation properties
    private ReadableMap mAnimation;
    private boolean mAutoOrbit = false;
    private String mOrbitDirection = "clockwise";
    private float mOrbitDuration = 10.0f;
    private boolean mOrbitLoop = true;
    
    // Camera configuration
    private float mNearPlane = 0.01f;
    private float mFarPlane = 1000.0f;
    private String mProjectionType = "perspective"; // "perspective", "orthographic"
    
    // Transform properties
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotationPivot;
    private Vector mScalePivot;
    private ReadableArray mTransformBehaviors;
    
    // Visibility and interaction
    private boolean mVisible = true;
    private float mOpacity = 1.0f;
    private int mRenderingOrder = 0;
    private boolean mIgnoreEventHandling = false;
    private String mDragType;
    
    // Lighting properties
    private int mLightReceivingBitMask = 1;
    private int mShadowCastingBitMask = 1;
    
    // Physics and animation
    private ReadableMap mPhysicsBody;
    private boolean mHighAccuracyEvents = false;
    private String mViroTag;
    
    // Event handling flags
    private boolean mOnHover = false;
    private boolean mOnClick = false;
    private boolean mOnTouch = false;
    private boolean mOnDrag = false;
    private boolean mOnPinch = false;
    private boolean mOnRotate = false;
    private boolean mOnFuse = false;
    private boolean mOnCollision = false;
    
    // Orbit camera event handling flags
    private boolean mOnOrbitStart = false;
    private boolean mOnOrbitStop = false;
    private boolean mOnPositionChange = false;
    private boolean mOnCameraActivated = false;
    private boolean mOnCameraDeactivated = false;
    
    // Internal state
    private boolean mCameraDirty = true;
    private boolean mOrbitDirty = true;
    private boolean mPositionDirty = true;
    
    public ViroOrbitCameraView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroOrbitCameraView initialized with ViroReact 3D Orbit Camera integration");
        
        initializeOrbitCamera();
    }
    
    private void initializeOrbitCamera() {
        ViroLog.debug(TAG, "Initializing ViroReact orbit camera with default properties");
        
        // Create ViroReact Node for the orbit camera
        mNodeJni = new Node();
        
        // Create ViroReact Camera
        mCameraJni = new Camera();
        
        // Create target node for focal point
        mTargetNodeJni = new Node();
        
        // Configure initial camera properties
        applyCameraProperties();
        
        // Attach camera to node
        mNodeJni.setCamera(mCameraJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Create animation system
        mAnimationTransaction = new AnimationTransaction();
        
        // Initialize animation handler
        mOrbitAnimationHandler = new Handler(Looper.getMainLooper());
        
        // Calculate initial orbit radius
        mOrbitRadius = calculateDistance(mPosition, mFocalPoint);
        
        // Orbit camera views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Orbit Camera initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroOrbitCameraView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroOrbitCameraView> mOrbitCameraView;
        
        public VRTComponentWrapper(ViroOrbitCameraView cameraView) {
            super(cameraView.getContext(), null, -1, -1, cameraView.mReactContext);
            mOrbitCameraView = new WeakReference<>(cameraView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroOrbitCameraView cameraView = mOrbitCameraView.get();
            if (cameraView != null) {
                cameraView.emitOrbitCameraEvent(eventName, eventData);
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
     * Get the underlying ViroReact Camera object
     */
    public Camera getCameraJni() {
        return mCameraJni;
    }
    
    /**
     * Get the target node for the focal point
     */
    public Node getTargetNodeJni() {
        return mTargetNodeJni;
    }
    
    /**
     * Set the ViroContext for this orbit camera
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate camera components with ViroContext if needed
        if (mCameraJni != null) {
            mCameraJni.dispose();
            mCameraJni = new Camera();
            applyCameraProperties();
            if (mNodeJni != null) {
                mNodeJni.setCamera(mCameraJni);
            }
        }
    }
    
    // Property setters
    
    public void setPosition(@Nullable ReadableArray position) {
        ViroLog.debug(TAG, "Setting position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                mPosition = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing position: " + e.getMessage());
                mPosition = new Vector(0.0f, 0.0f, 5.0f);
            }
        } else {
            mPosition = new Vector(0.0f, 0.0f, 5.0f);
        }
        
        // Recalculate orbit radius
        mOrbitRadius = calculateDistance(mPosition, mFocalPoint);
        mPositionDirty = true;
        updateCameraPosition();
    }
    
    public void setFocalPoint(@Nullable ReadableArray focalPoint) {
        ViroLog.debug(TAG, "Setting focal point: " + focalPoint);
        
        if (focalPoint != null && focalPoint.size() >= 3) {
            try {
                float x = (float) focalPoint.getDouble(0);
                float y = (float) focalPoint.getDouble(1);
                float z = (float) focalPoint.getDouble(2);
                mFocalPoint = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing focal point: " + e.getMessage());
                mFocalPoint = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mFocalPoint = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        if (mTargetNodeJni != null) {
            mTargetNodeJni.setPosition(mFocalPoint);
        }
        
        // Recalculate orbit radius
        mOrbitRadius = calculateDistance(mPosition, mFocalPoint);
        mPositionDirty = true;
        updateCameraPosition();
    }
    
    public void setActive(boolean active) {
        ViroLog.debug(TAG, "Setting active: " + active);
        mActive = active;
        
        if (active) {
            activateCamera();
        } else {
            deactivateCamera();
        }
    }
    
    public void setFieldOfView(float fieldOfView) {
        ViroLog.debug(TAG, "Setting field of view: " + fieldOfView);
        mFieldOfView = Math.max(1.0f, Math.min(179.0f, fieldOfView));
        mCameraDirty = true;
        applyCameraProperties();
    }
    
    public void setOrbitRadius(float orbitRadius) {
        ViroLog.debug(TAG, "Setting orbit radius: " + orbitRadius);
        mOrbitRadius = Math.max(0.1f, orbitRadius);
        mOrbitDirty = true;
        updateCameraPosition();
    }
    
    public void setOrbitAngleHorizontal(float orbitAngleHorizontal) {
        ViroLog.debug(TAG, "Setting orbit angle horizontal: " + orbitAngleHorizontal);
        mOrbitAngleHorizontal = orbitAngleHorizontal;
        mOrbitDirty = true;
        updateCameraPosition();
    }
    
    public void setOrbitAngleVertical(float orbitAngleVertical) {
        ViroLog.debug(TAG, "Setting orbit angle vertical: " + orbitAngleVertical);
        mOrbitAngleVertical = Math.max(-89.0f, Math.min(89.0f, orbitAngleVertical));
        mOrbitDirty = true;
        updateCameraPosition();
    }
    
    public void setOrbitSpeed(float orbitSpeed) {
        ViroLog.debug(TAG, "Setting orbit speed: " + orbitSpeed);
        mOrbitSpeed = Math.max(0.1f, Math.min(10.0f, orbitSpeed));
        
        // Restart animation if currently animating
        if (mIsAnimating) {
            stopOrbitAnimation();
            startOrbitAnimation();
        }
    }
    
    public void setAutoOrbit(boolean autoOrbit) {
        ViroLog.debug(TAG, "Setting auto orbit: " + autoOrbit);
        mAutoOrbit = autoOrbit;
        
        if (autoOrbit) {
            startOrbitAnimation();
        } else {
            stopOrbitAnimation();
        }
    }
    
    public void setOrbitDirection(@Nullable String orbitDirection) {
        ViroLog.debug(TAG, "Setting orbit direction: " + orbitDirection);
        mOrbitDirection = orbitDirection != null ? orbitDirection : "clockwise";
        
        // Restart animation if currently animating
        if (mIsAnimating) {
            stopOrbitAnimation();
            startOrbitAnimation();
        }
    }
    
    public void setOrbitDuration(float orbitDuration) {
        ViroLog.debug(TAG, "Setting orbit duration: " + orbitDuration);
        mOrbitDuration = Math.max(1.0f, Math.min(60.0f, orbitDuration));
        
        // Restart animation if currently animating
        if (mIsAnimating) {
            stopOrbitAnimation();
            startOrbitAnimation();
        }
    }
    
    public void setAnimation(@Nullable ReadableMap animation) {
        ViroLog.debug(TAG, "Setting animation: " + animation);
        mAnimation = animation;
        // Animation handling would be implemented here
    }
    
    // Transform setters
    
    public void setRotation(@Nullable ReadableArray rotation) {
        ViroLog.debug(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0));
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                mRotation = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing rotation: " + e.getMessage());
                mRotation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mRotation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }
    
    public void setScale(@Nullable ReadableArray scale) {
        ViroLog.debug(TAG, "Setting scale: " + scale);
        
        if (scale != null && scale.size() >= 3) {
            try {
                float x = (float) scale.getDouble(0);
                float y = (float) scale.getDouble(1);
                float z = (float) scale.getDouble(2);
                mScale = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing scale: " + e.getMessage());
                mScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applyTransformProperties();
    }
    
    // Visibility and interaction setters
    
    public void setVisible(boolean visible) {
        ViroLog.debug(TAG, "Setting visible: " + visible);
        mVisible = visible;
        
        if (mNodeJni != null) {
            mNodeJni.setVisible(visible);
        }
        setVisibility(visible ? VISIBLE : INVISIBLE);
    }
    
    public void setOpacity(float opacity) {
        ViroLog.debug(TAG, "Setting opacity: " + opacity);
        mOpacity = opacity;
        
        if (mNodeJni != null) {
            mNodeJni.setOpacity(opacity);
        }
        setAlpha(opacity);
    }
    
    public void setRenderingOrder(int renderingOrder) {
        ViroLog.debug(TAG, "Setting rendering order: " + renderingOrder);
        mRenderingOrder = renderingOrder;
        
        if (mNodeJni != null) {
            mNodeJni.setRenderingOrder(renderingOrder);
        }
    }
    
    // Event handling setters
    
    public void setOnOrbitStart(boolean onOrbitStart) {
        ViroLog.debug(TAG, "Setting on orbit start: " + onOrbitStart);
        mOnOrbitStart = onOrbitStart;
    }
    
    public void setOnOrbitStop(boolean onOrbitStop) {
        ViroLog.debug(TAG, "Setting on orbit stop: " + onOrbitStop);
        mOnOrbitStop = onOrbitStop;
    }
    
    public void setOnPositionChange(boolean onPositionChange) {
        ViroLog.debug(TAG, "Setting on position change: " + onPositionChange);
        mOnPositionChange = onPositionChange;
    }
    
    public void setOnCameraActivated(boolean onCameraActivated) {
        ViroLog.debug(TAG, "Setting on camera activated: " + onCameraActivated);
        mOnCameraActivated = onCameraActivated;
    }
    
    public void setOnCameraDeactivated(boolean onCameraDeactivated) {
        ViroLog.debug(TAG, "Setting on camera deactivated: " + onCameraDeactivated);
        mOnCameraDeactivated = onCameraDeactivated;
    }
    
    // ViroReact-specific methods
    
    private void applyCameraProperties() {
        if (mCameraJni != null) {
            ViroLog.debug(TAG, "Applying camera properties to ViroReact Camera");
            
            // Apply field of view
            mCameraJni.setFieldOfView(mFieldOfView);
            
            // Apply near and far planes
            mCameraJni.setNearClippingPlane(mNearPlane);
            mCameraJni.setFarClippingPlane(mFarPlane);
            
            // Set projection type
            if ("orthographic".equals(mProjectionType)) {
                mCameraJni.setOrthographicProjection(true);
            } else {
                mCameraJni.setOrthographicProjection(false);
            }
            
            ViroLog.debug(TAG, "Camera properties applied successfully");
        }
    }
    
    private void applyTransformProperties() {
        if (mNodeJni != null) {
            ViroLog.debug(TAG, "Applying transform properties to ViroReact Node");
            
            // Apply rotation and scale to the node (position is managed by orbit system)
            mNodeJni.setRotation(mRotation);
            mNodeJni.setScale(mScale);
            
            // Apply pivot points if set
            if (mRotationPivot != null) {
                mNodeJni.setRotationPivot(mRotationPivot);
            }
            if (mScalePivot != null) {
                mNodeJni.setScalePivot(mScalePivot);
            }
            
            ViroLog.debug(TAG, "Transform properties applied successfully");
        }
    }
    
    private void updateCameraPosition() {
        if (mOrbitDirty || mPositionDirty) {
            ViroLog.debug(TAG, "Updating camera position based on orbit parameters");
            
            // Calculate orbit position based on angles and radius
            float horizontalRadians = (float) Math.toRadians(mOrbitAngleHorizontal);
            float verticalRadians = (float) Math.toRadians(mOrbitAngleVertical);
            
            float x = mFocalPoint.x + mOrbitRadius * (float) Math.sin(horizontalRadians) * (float) Math.cos(verticalRadians);
            float y = mFocalPoint.y + mOrbitRadius * (float) Math.sin(verticalRadians);
            float z = mFocalPoint.z + mOrbitRadius * (float) Math.cos(horizontalRadians) * (float) Math.cos(verticalRadians);
            
            mPosition = new Vector(x, y, z);
            
            if (mNodeJni != null) {
                mNodeJni.setPosition(mPosition);
            }
            
            // Always look at the focal point
            lookAtTarget();
            
            if (mOnPositionChange) {
                WritableMap eventData = createPositionEventData();
                emitOrbitCameraEvent("onPositionChange", eventData);
            }
            
            mOrbitDirty = false;
            mPositionDirty = false;
            ViroLog.debug(TAG, "Camera position updated successfully");
        }
    }
    
    private void lookAtTarget() {
        if (mNodeJni != null) {
            ViroLog.debug(TAG, "Setting camera to look at focal point");
            
            // Calculate look-at direction
            Vector direction = new Vector(
                mFocalPoint.x - mPosition.x,
                mFocalPoint.y - mPosition.y,
                mFocalPoint.z - mPosition.z
            );
            
            // Normalize direction vector
            float length = (float) Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
            if (length > 0) {
                direction = new Vector(direction.x / length, direction.y / length, direction.z / length);
            }
            
            // Set camera to look at target using ViroReact look-at functionality
            mNodeJni.setLookAt(mFocalPoint);
        }
    }
    
    // Camera Control Methods
    
    public void activateCamera() {
        ViroLog.debug(TAG, "Activating ViroReact orbit camera");
        
        // TODO: Set this camera as active in ViroReact scene
        // This will need to integrate with the existing ViroReact camera system
        
        updateCameraPosition();
        lookAtTarget();
        
        if (mOnCameraActivated) {
            WritableMap eventData = Arguments.createMap();
            emitOrbitCameraEvent("onCameraActivated", eventData);
        }
    }
    
    public void deactivateCamera() {
        ViroLog.debug(TAG, "Deactivating ViroReact orbit camera");
        
        // Stop any ongoing animations
        stopOrbitAnimation();
        
        // TODO: Remove this camera as active in ViroReact scene
        
        if (mOnCameraDeactivated) {
            WritableMap eventData = Arguments.createMap();
            emitOrbitCameraEvent("onCameraDeactivated", eventData);
        }
    }
    
    public void startOrbitAnimation() {
        if (mIsAnimating || !mAnimationsEnabled) {
            return;
        }
        
        ViroLog.debug(TAG, "Starting orbit animation with ViroReact Animation system");
        mIsAnimating = true;
        mLastAnimationTime = System.currentTimeMillis();
        
        // Create orbit animation runnable
        mOrbitAnimationRunnable = new Runnable() {
            @Override
            public void run() {
                updateOrbitAnimation();
                if (mIsAnimating) {
                    mOrbitAnimationHandler.postDelayed(this, 16); // ~60fps
                }
            }
        };
        
        mOrbitAnimationHandler.post(mOrbitAnimationRunnable);
        
        if (mOnOrbitStart) {
            WritableMap eventData = Arguments.createMap();
            emitOrbitCameraEvent("onOrbitStart", eventData);
        }
    }
    
    public void stopOrbitAnimation() {
        if (!mIsAnimating) {
            return;
        }
        
        ViroLog.debug(TAG, "Stopping orbit animation");
        mIsAnimating = false;
        
        if (mOrbitAnimationHandler != null && mOrbitAnimationRunnable != null) {
            mOrbitAnimationHandler.removeCallbacks(mOrbitAnimationRunnable);
        }
        
        if (mOnOrbitStop) {
            WritableMap eventData = Arguments.createMap();
            emitOrbitCameraEvent("onOrbitStop", eventData);
        }
    }
    
    public void pauseOrbitAnimation() {
        if (mIsAnimating) {
            ViroLog.debug(TAG, "Pausing orbit animation");
            if (mOrbitAnimationHandler != null && mOrbitAnimationRunnable != null) {
                mOrbitAnimationHandler.removeCallbacks(mOrbitAnimationRunnable);
            }
        }
    }
    
    public void resumeOrbitAnimation() {
        if (mIsAnimating) {
            ViroLog.debug(TAG, "Resuming orbit animation");
            mLastAnimationTime = System.currentTimeMillis();
            if (mOrbitAnimationHandler != null && mOrbitAnimationRunnable != null) {
                mOrbitAnimationHandler.post(mOrbitAnimationRunnable);
            }
        }
    }
    
    private void updateOrbitAnimation() {
        long currentTime = System.currentTimeMillis();
        float deltaTime = (currentTime - mLastAnimationTime) / 1000.0f;
        mLastAnimationTime = currentTime;
        
        // Update horizontal angle based on orbit speed
        float angleSpeed = "clockwise".equals(mOrbitDirection) ? mOrbitSpeed : -mOrbitSpeed;
        float degreesPerSecond = 360.0f / mOrbitDuration; // Complete orbit in mOrbitDuration seconds
        mOrbitAngleHorizontal += angleSpeed * degreesPerSecond * deltaTime;
        
        // Keep angle in 0-360 range
        while (mOrbitAngleHorizontal >= 360.0f) {
            mOrbitAngleHorizontal -= 360.0f;
        }
        while (mOrbitAngleHorizontal < 0.0f) {
            mOrbitAngleHorizontal += 360.0f;
        }
        
        mOrbitDirty = true;
        updateCameraPosition();
    }
    
    // Helper methods
    
    private float calculateDistance(Vector point1, Vector point2) {
        float dx = point1.x - point2.x;
        float dy = point1.y - point2.y;
        float dz = point1.z - point2.z;
        return (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    private WritableMap createPositionEventData() {
        WritableMap eventData = Arguments.createMap();
        
        // Current position
        WritableMap positionMap = Arguments.createMap();
        positionMap.putDouble("x", mPosition.x);
        positionMap.putDouble("y", mPosition.y);
        positionMap.putDouble("z", mPosition.z);
        eventData.putMap("position", positionMap);
        
        // Focal point
        WritableMap focalPointMap = Arguments.createMap();
        focalPointMap.putDouble("x", mFocalPoint.x);
        focalPointMap.putDouble("y", mFocalPoint.y);
        focalPointMap.putDouble("z", mFocalPoint.z);
        eventData.putMap("focalPoint", focalPointMap);
        
        // Orbit parameters
        eventData.putDouble("orbitRadius", mOrbitRadius);
        eventData.putDouble("orbitAngleHorizontal", mOrbitAngleHorizontal);
        eventData.putDouble("orbitAngleVertical", mOrbitAngleVertical);
        
        return eventData;
    }
    
    /**
     * Emit orbit camera events for ViroReact integration
     */
    public void emitOrbitCameraEvent(String eventName, @Nullable WritableMap eventData) {
        try {
            if (mReactContext != null && mReactContext.hasActiveCatalystInstance()) {
                mReactContext.getJSModule(RCTEventEmitter.class)
                    .receiveEvent(getId(), eventName, eventData);
            } else {
                ViroLog.warn(TAG, "Cannot emit event " + eventName + ": no active React context");
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error emitting event " + eventName + ": " + e.getMessage());
        }
    }
    
    // State Information
    public boolean isActive() {
        return mActive;
    }
    
    public boolean isAnimating() {
        return mIsAnimating;
    }
    
    public Vector getCurrentPosition() {
        return mPosition;
    }
    
    public Vector getFocalPoint() {
        return mFocalPoint;
    }
    
    public float getOrbitRadius() {
        return mOrbitRadius;
    }
    
    public float getOrbitAngleHorizontal() {
        return mOrbitAngleHorizontal;
    }
    
    public float getOrbitAngleVertical() {
        return mOrbitAngleVertical;
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop all animations
        stopOrbitAnimation();
        
        // Clean up ViroReact orbit camera resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setCamera(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mCameraJni != null) {
            mCameraJni.dispose();
            mCameraJni = null;
        }
        
        if (mTargetNodeJni != null) {
            mTargetNodeJni.dispose();
            mTargetNodeJni = null;
        }
        
        // Dispose animation system
        if (mAnimationTransaction != null) {
            mAnimationTransaction.finish();
            mAnimationTransaction = null;
        }
        
        // Clear animations
        mActiveAnimations.clear();
        
        // Clean up animation handler
        if (mOrbitAnimationHandler != null) {
            mOrbitAnimationHandler.removeCallbacksAndMessages(null);
            mOrbitAnimationHandler = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mTransformBehaviors = null;
        mPhysicsBody = null;
        mAnimation = null;
        mOrbitAnimationRunnable = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroOrbitCameraView attached to window");
        
        // Orbit camera will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mCameraJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact orbit camera ready for scene attachment");
        }
        
        // Ensure camera properties are applied
        applyCameraProperties();
        applyTransformProperties();
        
        // Update camera position if dirty
        if (mCameraDirty || mOrbitDirty || mPositionDirty) {
            updateCameraPosition();
        }
        
        // Start auto orbit if enabled
        if (mAutoOrbit) {
            startOrbitAnimation();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroOrbitCameraView detached from window");
        
        // Stop animations when detached
        stopOrbitAnimation();
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public Vector getPosition() { return mPosition; }
    public boolean isVisible() { return mVisible; }
    public float getFieldOfView() { return mFieldOfView; }
    public float getOrbitSpeed() { return mOrbitSpeed; }
    public boolean isAutoOrbit() { return mAutoOrbit; }
    public String getOrbitDirection() { return mOrbitDirection; }
    public float getOrbitDuration() { return mOrbitDuration; }
    public float getNearPlane() { return mNearPlane; }
    public float getFarPlane() { return mFarPlane; }
    public String getProjectionType() { return mProjectionType; }
    public Vector getRotation() { return mRotation; }
    public Vector getScale() { return mScale; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public boolean isCameraDirty() { return mCameraDirty; }
    public boolean isOrbitDirty() { return mOrbitDirty; }
    public boolean isPositionDirty() { return mPositionDirty; }
}