//
//  ViroARObjectMarkerView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;

import com.viro.core.ARObjectAnchor;
import com.viro.core.ARObjectTarget;
import com.viro.core.ARAnchor;
import com.viro.core.ARNode;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.internal.ARDeclarativeObjectNode;
import com.viro.core.internal.ARDeclarativeNode;
import com.viromedia.bridge.module.ARTrackingTargetsModule;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroARObjectMarker component.
 * ViroARObjectMarker provides AR object tracking and marker detection capabilities
 * for React Native New Architecture.
 */
public class ViroARObjectMarkerView extends ViroNodeView {
    
    private static final String TAG = ViroLog.getTag(ViroARObjectMarkerView.class);
    
    // AR Object Marker properties
    private ARDeclarativeObjectNode mARObjectMarker;
    private String mTargetName;
    private boolean mShouldUpdate = false;
    private boolean mNeedsAddToScene = true;
    
    // Object tracking settings
    private boolean mPauseUpdates = false;
    private boolean mIgnoreEventHandling = false;
    
    // Event handling
    private boolean mHasAnchorFoundListener = false;
    private boolean mHasAnchorUpdatedListener = false;
    private boolean mHasAnchorRemovedListener = false;
    
    // Object marker event listener
    private ObjectMarkerEventListener mObjectMarkerEventListener;
    
    /**
     * Object marker event listener implementation
     */
    private class ObjectMarkerEventListener implements ARDeclarativeObjectNode.Listener {
        
        private WeakReference<ViroARObjectMarkerView> mView;
        
        ObjectMarkerEventListener(ViroARObjectMarkerView view) {
            mView = new WeakReference<>(view);
        }
        
        @Override
        public void onAnchorFound(ARAnchor anchor, ARNode arNode) {
            ViroARObjectMarkerView view = mView.get();
            if (view != null && view.mHasAnchorFoundListener) {
                view.emitAnchorEvent("onAnchorFound", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorUpdated(ARAnchor anchor, ARNode arNode) {
            ViroARObjectMarkerView view = mView.get();
            if (view != null && view.mHasAnchorUpdatedListener) {
                view.emitAnchorEvent("onAnchorUpdated", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorRemoved(ARAnchor anchor, ARNode arNode) {
            ViroARObjectMarkerView view = mView.get();
            if (view != null && view.mHasAnchorRemovedListener) {
                view.emitAnchorEvent("onAnchorRemoved", anchor, arNode);
            }
        }
    }
    
    public ViroARObjectMarkerView(@NonNull Context context) {
        super(context);
        ViroLog.i(TAG, "Initializing ViroARObjectMarkerView");
    }
    
    @Override
    protected Node createNodeJni() {
        mARObjectMarker = new ARDeclarativeObjectNode();
        
        // Set up object marker event listener
        mObjectMarkerEventListener = new ObjectMarkerEventListener(this);
        mARObjectMarker.setDelegate(mObjectMarkerEventListener);
        
        return mARObjectMarker;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.i(TAG, "ViroARObjectMarkerView attached to window");
    }
    
    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        
        if (context != null && mARObjectMarker != null) {
            // Apply object marker configuration when context is available
            onPropsSet();
        }
    }
    
    // Property setters
    
    public void setTarget(@Nullable String target) {
        mTargetName = target;
        mShouldUpdate = true;
        onPropsSet();
    }
    
    public void setPauseUpdates(boolean pauseUpdates) {
        mPauseUpdates = pauseUpdates;
        if (mARObjectMarker != null) {
            mARObjectMarker.setPauseUpdates(pauseUpdates);
        }
    }
    
    public void setIgnoreEventHandling(boolean ignore) {
        mIgnoreEventHandling = ignore;
        // This would be used to disable event handling for the object marker
    }
    
    // Event listener setters
    
    public void setOnAnchorFoundListener(boolean hasListener) {
        mHasAnchorFoundListener = hasListener;
    }
    
    public void setOnAnchorUpdatedListener(boolean hasListener) {
        mHasAnchorUpdatedListener = hasListener;
    }
    
    public void setOnAnchorRemovedListener(boolean hasListener) {
        mHasAnchorRemovedListener = hasListener;
    }
    
    // Object marker commands
    
    /**
     * Reset the object marker detection
     */
    public void reset() {
        if (mARObjectMarker != null) {
            mARObjectMarker.reset();
            
            WritableMap event = Arguments.createMap();
            emitEvent("onObjectMarkerReset", event);
        }
    }
    
    /**
     * Get current target information
     */
    public void getTargetInfo() {
        WritableMap event = Arguments.createMap();
        event.putString("targetName", mTargetName != null ? mTargetName : "");
        event.putBoolean("pauseUpdates", mPauseUpdates);
        
        emitEvent("onGetTargetInfoResult", event);
    }
    
    /**
     * Apply props when they are set
     */
    private void onPropsSet() {
        if (mShouldUpdate && mViroContext != null && mTargetName != null) {
            updateARDeclarativeObjectNode(mNeedsAddToScene);
            mShouldUpdate = false;
            // We should only add to the scene on the first invocation
            mNeedsAddToScene = false;
        }
    }
    
    /**
     * Update or create the AR declarative object node with the target
     */
    private void updateARDeclarativeObjectNode(final boolean shouldAddToScene) {
        ReactContext reactContext = (ReactContext) getContext();
        ARTrackingTargetsModule trackingTargetsModule = reactContext.getNativeModule(ARTrackingTargetsModule.class);
        
        if (trackingTargetsModule == null) {
            ViroLog.e(TAG, "ARTrackingTargetsModule not found");
            return;
        }
        
        // Get the object target from the tracking targets module
        ARObjectTarget objectTarget = trackingTargetsModule.getARObjectTarget(mTargetName);
        if (objectTarget == null) {
            ViroLog.w(TAG, "Object target not found: " + mTargetName);
            return;
        }
        
        // Set the target on the AR object marker
        mARObjectMarker.setTarget(objectTarget);
        
        // Apply pause updates setting
        if (mPauseUpdates) {
            mARObjectMarker.setPauseUpdates(true);
        }
        
        ViroLog.i(TAG, "Updated AR object marker with target: " + mTargetName);
    }
    
    // Helper methods
    
    /**
     * Emit an anchor-related event
     */
    private void emitAnchorEvent(@NonNull String eventName, @NonNull ARAnchor anchor, @Nullable ARNode arNode) {
        WritableMap event = createAnchorMap(anchor);
        
        if (arNode != null) {
            event.putString("nodeId", String.valueOf(arNode.hashCode()));
        }
        
        emitEvent(eventName, event);
    }
    
    /**
     * Create a WritableMap from an ARAnchor
     */
    private WritableMap createAnchorMap(@NonNull ARAnchor anchor) {
        WritableMap anchorMap = Arguments.createMap();
        
        anchorMap.putString("anchorId", anchor.getAnchorId());
        anchorMap.putString("type", "object");
        
        // Add position
        Vector position = anchor.getPosition();
        WritableArray positionArray = Arguments.createArray();
        positionArray.pushDouble(position.x);
        positionArray.pushDouble(position.y);
        positionArray.pushDouble(position.z);
        anchorMap.putArray("position", positionArray);
        
        // Add rotation (as euler angles)
        Vector rotation = anchor.getRotationEuler();
        WritableArray rotationArray = Arguments.createArray();
        rotationArray.pushDouble(rotation.x);
        rotationArray.pushDouble(rotation.y);
        rotationArray.pushDouble(rotation.z);
        anchorMap.putArray("rotation", rotationArray);
        
        // Add object-specific data
        if (anchor instanceof ARObjectAnchor) {
            ARObjectAnchor objectAnchor = (ARObjectAnchor) anchor;
            WritableMap objectData = Arguments.createMap();
            
            objectData.putString("referenceObjectName", objectAnchor.getReferenceObjectName());
            objectData.putString("targetName", mTargetName != null ? mTargetName : "");
            
            // Add bounding box if available
            Vector[] boundingBox = objectAnchor.getBoundingBox();
            if (boundingBox != null && boundingBox.length >= 2) {
                WritableMap boundingBoxData = Arguments.createMap();
                
                WritableArray minArray = Arguments.createArray();
                minArray.pushDouble(boundingBox[0].x);
                minArray.pushDouble(boundingBox[0].y);
                minArray.pushDouble(boundingBox[0].z);
                boundingBoxData.putArray("min", minArray);
                
                WritableArray maxArray = Arguments.createArray();
                maxArray.pushDouble(boundingBox[1].x);
                maxArray.pushDouble(boundingBox[1].y);
                maxArray.pushDouble(boundingBox[1].z);
                boundingBoxData.putArray("max", maxArray);
                
                objectData.putMap("boundingBox", boundingBoxData);
            }
            
            anchorMap.putMap("object", objectData);
        }
        
        return anchorMap;
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        
        // Clean up object marker resources
        if (mARObjectMarker != null) {
            mARObjectMarker.setDelegate(null);
            mARObjectMarker = null;
        }
        
        mObjectMarkerEventListener = null;
        mTargetName = null;
    }
}