//
//  ViroARImageMarkerView.java
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

import com.viro.core.ARImageAnchor;
import com.viro.core.ARImageTarget;
import com.viro.core.ARAnchor;
import com.viro.core.ARNode;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.internal.ARDeclarativeImageNode;
import com.viro.core.internal.ARDeclarativeNode;
import com.viromedia.bridge.module.ARTrackingTargetsModule;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroARImageMarker component.
 * ViroARImageMarker provides AR image tracking and marker detection capabilities
 * for React Native New Architecture.
 */
public class ViroARImageMarkerView extends ViroNodeView {
    
    private static final String TAG = ViroLog.getTag(ViroARImageMarkerView.class);
    
    // AR Image Marker properties
    private ARDeclarativeImageNode mARImageMarker;
    private String mTargetName;
    private boolean mShouldUpdate = false;
    private boolean mNeedsAddToScene = true;
    
    // Image tracking settings
    private boolean mPauseUpdates = false;
    private boolean mIgnoreEventHandling = false;
    
    // Event handling
    private boolean mHasAnchorFoundListener = false;
    private boolean mHasAnchorUpdatedListener = false;
    private boolean mHasAnchorRemovedListener = false;
    
    // Image marker event listener
    private ImageMarkerEventListener mImageMarkerEventListener;
    
    /**
     * Image marker event listener implementation
     */
    private class ImageMarkerEventListener implements ARDeclarativeImageNode.Listener {
        
        private WeakReference<ViroARImageMarkerView> mView;
        
        ImageMarkerEventListener(ViroARImageMarkerView view) {
            mView = new WeakReference<>(view);
        }
        
        @Override
        public void onAnchorFound(ARAnchor anchor, ARNode arNode) {
            ViroARImageMarkerView view = mView.get();
            if (view != null && view.mHasAnchorFoundListener) {
                view.emitAnchorEvent("onAnchorFound", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorUpdated(ARAnchor anchor, ARNode arNode) {
            ViroARImageMarkerView view = mView.get();
            if (view != null && view.mHasAnchorUpdatedListener) {
                view.emitAnchorEvent("onAnchorUpdated", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorRemoved(ARAnchor anchor, ARNode arNode) {
            ViroARImageMarkerView view = mView.get();
            if (view != null && view.mHasAnchorRemovedListener) {
                view.emitAnchorEvent("onAnchorRemoved", anchor, arNode);
            }
        }
    }
    
    public ViroARImageMarkerView(@NonNull Context context) {
        super(context);
        ViroLog.i(TAG, "Initializing ViroARImageMarkerView");
    }
    
    @Override
    protected Node createNodeJni() {
        mARImageMarker = new ARDeclarativeImageNode();
        
        // Set up image marker event listener
        mImageMarkerEventListener = new ImageMarkerEventListener(this);
        mARImageMarker.setDelegate(mImageMarkerEventListener);
        
        return mARImageMarker;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.i(TAG, "ViroARImageMarkerView attached to window");
    }
    
    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        
        if (context != null && mARImageMarker != null) {
            // Apply image marker configuration when context is available
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
        if (mARImageMarker != null) {
            mARImageMarker.setPauseUpdates(pauseUpdates);
        }
    }
    
    public void setIgnoreEventHandling(boolean ignore) {
        mIgnoreEventHandling = ignore;
        // This would be used to disable event handling for the image marker
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
    
    // Image marker commands
    
    /**
     * Reset the image marker detection
     */
    public void reset() {
        if (mARImageMarker != null) {
            mARImageMarker.reset();
            
            WritableMap event = Arguments.createMap();
            emitEvent("onImageMarkerReset", event);
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
            updateARDeclarativeImageNode(mNeedsAddToScene);
            mShouldUpdate = false;
            // We should only add to the scene on the first invocation
            mNeedsAddToScene = false;
        }
    }
    
    /**
     * Update or create the AR declarative image node with the target
     */
    private void updateARDeclarativeImageNode(final boolean shouldAddToScene) {
        ReactContext reactContext = (ReactContext) getContext();
        ARTrackingTargetsModule trackingTargetsModule = reactContext.getNativeModule(ARTrackingTargetsModule.class);
        
        if (trackingTargetsModule == null) {
            ViroLog.e(TAG, "ARTrackingTargetsModule not found");
            return;
        }
        
        // Get the image target from the tracking targets module
        ARImageTarget imageTarget = trackingTargetsModule.getARImageTarget(mTargetName);
        if (imageTarget == null) {
            ViroLog.w(TAG, "Image target not found: " + mTargetName);
            return;
        }
        
        // Set the target on the AR image marker
        mARImageMarker.setTarget(imageTarget);
        
        // Apply pause updates setting
        if (mPauseUpdates) {
            mARImageMarker.setPauseUpdates(true);
        }
        
        ViroLog.i(TAG, "Updated AR image marker with target: " + mTargetName);
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
        anchorMap.putString("type", "image");
        
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
        
        // Add image-specific data
        if (anchor instanceof ARImageAnchor) {
            ARImageAnchor imageAnchor = (ARImageAnchor) anchor;
            WritableMap imageData = Arguments.createMap();
            
            imageData.putString("referenceImageName", imageAnchor.getReferenceImageName());
            imageData.putString("targetName", mTargetName != null ? mTargetName : "");
            
            // Add physical size if available
            Vector physicalSize = imageAnchor.getPhysicalSize();
            if (physicalSize != null) {
                WritableArray sizeArray = Arguments.createArray();
                sizeArray.pushDouble(physicalSize.x);
                sizeArray.pushDouble(physicalSize.y);
                imageData.putArray("physicalSize", sizeArray);
            }
            
            anchorMap.putMap("image", imageData);
        }
        
        return anchorMap;
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        
        // Clean up image marker resources
        if (mARImageMarker != null) {
            mARImageMarker.setDelegate(null);
            mARImageMarker = null;
        }
        
        mImageMarkerEventListener = null;
        mTargetName = null;
    }
}