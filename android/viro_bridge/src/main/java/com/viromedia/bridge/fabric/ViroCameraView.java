//
//  ViroCameraView.java
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
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.Camera;
import com.viro.core.EventDelegate;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroCamera component.
 * ViroCamera provides comprehensive camera control and projection management for 3D scenes
 * with support for positioning, orientation, field of view, and animation.
 */
public class ViroCameraView extends View {
    
    private static final String TAG = "ViroCameraView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Camera mCameraJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    // Camera position and orientation
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private float mFieldOfView = 90.0f; // degrees

    // Camera projection
    private float mNearClippingPlane = 0.1f;
    private float mFarClippingPlane = 1000.0f;
    private String mProjectionType = "perspective";
    private float mFocalLength = 50.0f; // mm

    // Camera animation and controls
    private float mAnimationDuration = 1.0f; // seconds
    private String mAnimationType = "easeIn";

    // Camera settings
    private boolean mActive = false;

    public ViroCameraView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroCameraView initialized with ViroReact Camera integration");
        
        initializeCamera();
    }

    private void initializeCamera() {
        Log.d(TAG, "Initializing ViroReact camera with default properties");
        
        // Create ViroReact Node for the camera
        mNodeJni = new Node();
        
        // Create Camera with initial properties
        mCameraJni = new Camera();
        
        // Configure initial camera properties
        applyCameraProperties();
        
        // Attach camera to node
        mNodeJni.setCamera(mCameraJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Camera views are typically transparent (no visual representation)
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Camera initialized successfully");
    }

    /**
     * Wrapper class to make ViroCameraView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroCameraView> mCameraView;
        
        public VRTComponentWrapper(ViroCameraView cameraView) {
            super(cameraView.getContext(), null, -1, -1, cameraView.mReactContext);
            mCameraView = new WeakReference<>(cameraView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroCameraView cameraView = mCameraView.get();
            if (cameraView != null) {
                cameraView.emitCameraEvent(eventName, eventData);
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
     * Set the ViroContext for this camera
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
        if (mActive) {
            activateCamera();
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // Cameras don't have visual dimensions
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Camera layout is handled by 3D transforms, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Camera Position and Orientation Properties
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
        
        applyCameraTransform();
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
        
        applyCameraTransform();
    }

    public void setFieldOfView(float fieldOfView) {
        Log.d(TAG, "Setting field of view: " + fieldOfView);
        mFieldOfView = fieldOfView;
        applyCameraProjection();
    }

    // Camera Projection Properties
    public void setNearClippingPlane(float nearClippingPlane) {
        Log.d(TAG, "Setting near clipping plane: " + nearClippingPlane);
        mNearClippingPlane = nearClippingPlane;
        applyCameraProjection();
    }

    public void setFarClippingPlane(float farClippingPlane) {
        Log.d(TAG, "Setting far clipping plane: " + farClippingPlane);
        mFarClippingPlane = farClippingPlane;
        applyCameraProjection();
    }

    public void setProjectionType(@Nullable String projectionType) {
        Log.d(TAG, "Setting projection type: " + projectionType);
        mProjectionType = projectionType != null ? projectionType : "perspective";
        applyCameraProjection();
    }

    public void setFocalLength(float focalLength) {
        Log.d(TAG, "Setting focal length: " + focalLength);
        mFocalLength = focalLength;
        applyCameraProjection();
    }

    // Camera Animation Properties
    public void setAnimationDuration(float animationDuration) {
        Log.d(TAG, "Setting animation duration: " + animationDuration);
        mAnimationDuration = animationDuration;
    }

    public void setAnimationType(@Nullable String animationType) {
        Log.d(TAG, "Setting animation type: " + animationType);
        mAnimationType = animationType != null ? animationType : "easeIn";
    }

    // Camera Control Properties
    public void setActive(boolean active) {
        Log.d(TAG, "Setting camera active: " + active);
        mActive = active;
        
        if (active) {
            activateCamera();
        } else {
            deactivateCamera();
        }
    }

    // Helper Methods
    private void applyCameraProperties() {
        if (mCameraJni != null) {
            Log.d(TAG, "Applying camera properties to ViroReact Camera");
            
            // Apply projection properties
            applyCameraProjection();
            
            // Apply transform properties
            applyCameraTransform();
            
            Log.d(TAG, "Camera properties applied successfully");
        }
    }

    private void applyCameraProjection() {
        if (mCameraJni != null) {
            Log.d(TAG, "Applying camera projection properties");
            
            // Convert field of view from degrees to radians
            float fovRadians = (float) Math.toRadians(mFieldOfView);
            
            // Set projection type
            if ("orthographic".equals(mProjectionType)) {
                mCameraJni.setProjectionType(Camera.ProjectionType.ORTHOGRAPHIC);
                // For orthographic projection, field of view is treated as zoom factor
                mCameraJni.setOrthographicSize(mFieldOfView);
            } else {
                mCameraJni.setProjectionType(Camera.ProjectionType.PERSPECTIVE);
                mCameraJni.setFieldOfView(fovRadians);
            }
            
            // Set clipping planes
            mCameraJni.setNearClippingPlane(mNearClippingPlane);
            mCameraJni.setFarClippingPlane(mFarClippingPlane);
            
            // Set focal length for perspective calculations
            mCameraJni.setFocalLength(mFocalLength);
            
            Log.d(TAG, "Camera projection applied: FOV=" + mFieldOfView + "°, Near=" + mNearClippingPlane + ", Far=" + mFarClippingPlane);
        }
    }

    private void applyCameraTransform() {
        if (mNodeJni != null) {
            Log.d(TAG, "Applying camera transform properties");
            
            // Apply position and rotation to the camera node
            mNodeJni.setPosition(mPosition);
            mNodeJni.setRotation(mRotation);
            
            Log.d(TAG, "Camera transform applied: Position=" + mPosition + ", Rotation=" + mRotation);
        }
    }

    private void activateCamera() {
        if (mCameraJni != null && mViroContext != null) {
            Log.d(TAG, "Activating camera");
            
            // Set this camera as the active scene camera
            mViroContext.setCamera(mCameraJni);
            
            // Emit camera mount event
            emitCameraDidMountEvent();
            
            Log.d(TAG, "Camera activated successfully");
        }
    }

    private void deactivateCamera() {
        if (mCameraJni != null && mViroContext != null) {
            Log.d(TAG, "Deactivating camera");
            
            // Remove this camera as the active scene camera (revert to default)
            mViroContext.setCamera(null);
            
            Log.d(TAG, "Camera deactivated successfully");
        }
    }

    // Camera Animation Methods
    public void animateToPosition(ReadableArray position, float duration) {
        if (position != null && position.size() >= 3 && mNodeJni != null) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                Vector targetPosition = new Vector(x, y, z);
                
                Log.d(TAG, "Animating camera to position: " + targetPosition + " over " + duration + "s");
                
                // Use ViroReact animation system to animate camera position
                mNodeJni.animateToPosition(targetPosition, duration);
                
                // Update stored position
                mPosition = targetPosition;
                
                // Emit transform update event
                emitTransformUpdateEvent();
                
            } catch (Exception e) {
                Log.e(TAG, "Error animating to position: " + e.getMessage());
            }
        }
    }

    public void animateToRotation(ReadableArray rotation, float duration) {
        if (rotation != null && rotation.size() >= 3 && mNodeJni != null) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0));
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                Vector targetRotation = new Vector(x, y, z);
                
                Log.d(TAG, "Animating camera to rotation: " + targetRotation + " over " + duration + "s");
                
                // Use ViroReact animation system to animate camera rotation
                mNodeJni.animateToRotation(targetRotation, duration);
                
                // Update stored rotation
                mRotation = targetRotation;
                
                // Emit transform update event
                emitTransformUpdateEvent();
                
            } catch (Exception e) {
                Log.e(TAG, "Error animating to rotation: " + e.getMessage());
            }
        }
    }

    // Event Emission
    private void emitCameraDidMountEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroCamera");
        emitCameraEvent("onCameraDidMount", event);
    }

    private void emitCameraWillUnmountEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroCamera");
        emitCameraEvent("onCameraWillUnmount", event);
    }

    private void emitTransformUpdateEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroCamera");
        
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
        
        emitCameraEvent("onTransformUpdate", event);
    }
    
    private void emitCameraEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Emit unmount event
        emitCameraWillUnmountEvent();
        
        // Deactivate camera if it's active
        if (mActive) {
            deactivateCamera();
        }
        
        // Clean up ViroReact camera resources
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
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroCameraView attached to window");
        
        // Camera will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mCameraJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact camera ready for scene attachment");
            
            // Activate camera if it should be active
            if (mActive) {
                activateCamera();
            }
        }
        
        // Ensure camera properties are applied
        applyCameraProperties();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroCameraView detached from window");
        
        // Camera cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }

    // Getters for current values (useful for debugging and testing)
    public Vector getPosition() { return mPosition; }
    public Vector getRotation() { return mRotation; }
    public float getFieldOfView() { return mFieldOfView; }
    public float getNearClippingPlane() { return mNearClippingPlane; }
    public float getFarClippingPlane() { return mFarClippingPlane; }
    public String getProjectionType() { return mProjectionType; }
    public float getFocalLength() { return mFocalLength; }
    public float getAnimationDuration() { return mAnimationDuration; }
    public String getAnimationType() { return mAnimationType; }
    public boolean isActive() { return mActive; }
}