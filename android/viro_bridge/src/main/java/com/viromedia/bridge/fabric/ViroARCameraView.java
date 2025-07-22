//
//  ViroARCameraView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.ARCamera;
import com.viro.core.ARNode;
import com.viro.core.Camera;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.Quaternion;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

/**
 * Native Android view for ViroARCamera component.
 * ViroARCamera provides access to the AR camera properties and tracking state
 * for React Native New Architecture.
 */
public class ViroARCameraView extends ViroNodeView {
    
    private static final String TAG = ViroLog.getTag(ViroARCameraView.class);
    
    // AR Camera properties
    private ARCamera mARCamera;
    private Camera mCamera;
    private ARNode mARCameraNode;
    
    // Camera configuration
    private boolean mActive = true;
    private float[] mFieldOfView = null;
    
    // Event handling
    private boolean mHasTransformUpdateListener = false;
    private boolean mHasCameraTransformUpdateListener = false;
    
    // Camera tracking
    private CameraTransformListener mCameraTransformListener;
    private Handler mMainHandler;
    
    /**
     * Camera transform update listener
     */
    private class CameraTransformListener implements Runnable {
        private WeakReference<ViroARCameraView> mView;
        private boolean mIsRunning = false;
        
        CameraTransformListener(ViroARCameraView view) {
            mView = new WeakReference<>(view);
        }
        
        public void start() {
            if (!mIsRunning) {
                mIsRunning = true;
                run();
            }
        }
        
        public void stop() {
            mIsRunning = false;
        }
        
        @Override
        public void run() {
            ViroARCameraView view = mView.get();
            if (view != null && mIsRunning && view.mHasCameraTransformUpdateListener) {
                view.emitCameraTransform();
                
                // Schedule next update (60 FPS)
                if (mIsRunning) {
                    view.mMainHandler.postDelayed(this, 16);
                }
            }
        }
    }
    
    public ViroARCameraView(@NonNull Context context) {
        super(context);
        mMainHandler = new Handler(Looper.getMainLooper());
        ViroLog.i(TAG, "Initializing ViroARCameraView");
    }
    
    @Override
    protected Node createNodeJni() {
        // AR Camera uses a special ARNode
        mARCameraNode = new ARNode();
        return mARCameraNode;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.i(TAG, "ViroARCameraView attached to window");
    }
    
    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        
        if (context != null) {
            initializeARCamera();
        }
    }
    
    /**
     * Initialize the AR camera with ViroContext
     */
    private void initializeARCamera() {
        if (mViroContext == null) {
            ViroLog.w(TAG, "Cannot initialize AR camera - ViroContext is null");
            return;
        }
        
        // Get the AR camera from the scene
        if (mViroContext.getScene() != null) {
            Camera camera = mViroContext.getScene().getCamera();
            if (camera instanceof ARCamera) {
                mARCamera = (ARCamera) camera;
                mCamera = camera;
                
                // Bind the camera node to the AR camera
                if (mARCameraNode != null) {
                    mARCameraNode.setCamera(mCamera);
                }
                
                // Apply camera configuration
                applyCameraConfiguration();
                
                ViroLog.i(TAG, "AR Camera initialized successfully");
            } else {
                ViroLog.w(TAG, "Scene camera is not an ARCamera instance");
            }
        }
    }
    
    /**
     * Apply camera configuration
     */
    private void applyCameraConfiguration() {
        if (mCamera == null) {
            return;
        }
        
        // Set field of view if specified
        if (mFieldOfView != null && mFieldOfView.length >= 1) {
            mCamera.setFieldOfView(mFieldOfView[0]);
        }
        
        // Set active state
        mCamera.setActive(mActive);
    }
    
    // Property setters
    
    public void setActive(boolean active) {
        mActive = active;
        if (mCamera != null) {
            mCamera.setActive(active);
        }
    }
    
    public void setFieldOfView(@Nullable ReadableArray fov) {
        if (fov != null && fov.size() > 0) {
            mFieldOfView = new float[]{(float) fov.getDouble(0)};
            if (mCamera != null) {
                mCamera.setFieldOfView(mFieldOfView[0]);
            }
        }
    }
    
    // Event listener setters
    
    public void setOnTransformUpdateListener(boolean hasListener) {
        mHasTransformUpdateListener = hasListener;
    }
    
    public void setOnCameraTransformUpdateListener(boolean hasListener) {
        mHasCameraTransformUpdateListener = hasListener;
        
        if (hasListener && mCameraTransformListener == null) {
            mCameraTransformListener = new CameraTransformListener(this);
            mCameraTransformListener.start();
        } else if (!hasListener && mCameraTransformListener != null) {
            mCameraTransformListener.stop();
        }
    }
    
    // Camera state methods
    
    /**
     * Get the current camera transform
     */
    public void getCameraTransform() {
        emitCameraTransform();
    }
    
    /**
     * Get camera orientation in euler angles
     */
    public void getCameraOrientation() {
        if (mARCamera == null) {
            return;
        }
        
        Vector rotation = mARCamera.getRotationEuler();
        
        WritableMap event = Arguments.createMap();
        WritableArray orientationArray = Arguments.createArray();
        orientationArray.pushDouble(rotation.x);
        orientationArray.pushDouble(rotation.y);
        orientationArray.pushDouble(rotation.z);
        event.putArray("orientation", orientationArray);
        
        emitEvent("onGetCameraOrientationResult", event);
    }
    
    /**
     * Get camera position and rotation
     */
    public void getCameraPositionAndRotation() {
        if (mARCamera == null) {
            return;
        }
        
        Vector position = mARCamera.getPosition();
        Quaternion rotation = mARCamera.getRotation();
        Vector forward = mARCamera.getForward();
        Vector up = mARCamera.getUp();
        
        WritableMap event = Arguments.createMap();
        
        // Position
        WritableArray positionArray = Arguments.createArray();
        positionArray.pushDouble(position.x);
        positionArray.pushDouble(position.y);
        positionArray.pushDouble(position.z);
        event.putArray("position", positionArray);
        
        // Rotation (quaternion)
        WritableArray rotationArray = Arguments.createArray();
        rotationArray.pushDouble(rotation.x);
        rotationArray.pushDouble(rotation.y);
        rotationArray.pushDouble(rotation.z);
        rotationArray.pushDouble(rotation.w);
        event.putArray("rotation", rotationArray);
        
        // Forward vector
        WritableArray forwardArray = Arguments.createArray();
        forwardArray.pushDouble(forward.x);
        forwardArray.pushDouble(forward.y);
        forwardArray.pushDouble(forward.z);
        event.putArray("forward", forwardArray);
        
        // Up vector
        WritableArray upArray = Arguments.createArray();
        upArray.pushDouble(up.x);
        upArray.pushDouble(up.y);
        upArray.pushDouble(up.z);
        event.putArray("up", upArray);
        
        emitEvent("onGetCameraPositionResult", event);
    }
    
    // Helper methods
    
    /**
     * Emit camera transform event
     */
    private void emitCameraTransform() {
        if (mARCamera == null) {
            return;
        }
        
        WritableMap event = Arguments.createMap();
        
        // Get camera transform
        Vector position = mARCamera.getPosition();
        Vector rotation = mARCamera.getRotationEuler();
        
        // Position
        WritableArray positionArray = Arguments.createArray();
        positionArray.pushDouble(position.x);
        positionArray.pushDouble(position.y);
        positionArray.pushDouble(position.z);
        event.putArray("position", positionArray);
        
        // Rotation (euler angles)
        WritableArray rotationArray = Arguments.createArray();
        rotationArray.pushDouble(rotation.x);
        rotationArray.pushDouble(rotation.y);
        rotationArray.pushDouble(rotation.z);
        event.putArray("rotation", rotationArray);
        
        // Forward vector
        Vector forward = mARCamera.getForward();
        WritableArray forwardArray = Arguments.createArray();
        forwardArray.pushDouble(forward.x);
        forwardArray.pushDouble(forward.y);
        forwardArray.pushDouble(forward.z);
        event.putArray("forward", forwardArray);
        
        // Field of view
        event.putDouble("fieldOfView", mARCamera.getFieldOfView());
        
        emitEvent("onCameraTransformUpdate", event);
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        
        // Stop camera transform listener
        if (mCameraTransformListener != null) {
            mCameraTransformListener.stop();
            mCameraTransformListener = null;
        }
        
        // Clean up AR camera resources
        mARCamera = null;
        mCamera = null;
        mARCameraNode = null;
    }
}