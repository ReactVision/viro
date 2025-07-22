//
//  ViroARPlaneView.java
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
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;

import com.viro.core.ARPlaneAnchor;
import com.viro.core.ARAnchor;
import com.viro.core.ARNode;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.internal.ARDeclarativeNode;
import com.viro.core.internal.ARDeclarativePlane;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroARPlane component.
 * ViroARPlane provides AR plane detection and tracking capabilities
 * for React Native New Architecture.
 */
public class ViroARPlaneView extends ViroNodeView {
    
    private static final String TAG = ViroLog.getTag(ViroARPlaneView.class);
    
    // Default values
    private static final float DEFAULT_WIDTH = 0f;
    private static final float DEFAULT_HEIGHT = 0f;
    private static final ARPlaneAnchor.Alignment DEFAULT_ALIGNMENT = ARPlaneAnchor.Alignment.HORIZONTAL;
    
    // AR Plane properties
    private ARDeclarativePlane mARPlane;
    private boolean mNeedsUpdate = false;
    
    // Plane configuration
    private float mMinWidth = 0.1f;
    private float mMinHeight = 0.1f;
    private ARPlaneAnchor.Alignment mAlignment = DEFAULT_ALIGNMENT;
    private String mAnchorId;
    
    // Plane detection settings
    private boolean mPauseUpdates = false;
    private boolean mIgnoreEventHandling = false;
    
    // Event handling
    private boolean mHasAnchorFoundListener = false;
    private boolean mHasAnchorUpdatedListener = false;
    private boolean mHasAnchorRemovedListener = false;
    
    // Plane event listener
    private PlaneEventListener mPlaneEventListener;
    
    /**
     * Plane event listener implementation
     */
    private class PlaneEventListener implements ARDeclarativePlane.Listener {
        
        private WeakReference<ViroARPlaneView> mView;
        
        PlaneEventListener(ViroARPlaneView view) {
            mView = new WeakReference<>(view);
        }
        
        @Override
        public void onAnchorFound(ARAnchor anchor, ARNode arNode) {
            ViroARPlaneView view = mView.get();
            if (view != null && view.mHasAnchorFoundListener) {
                view.emitAnchorEvent("onAnchorFound", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorUpdated(ARAnchor anchor, ARNode arNode) {
            ViroARPlaneView view = mView.get();
            if (view != null && view.mHasAnchorUpdatedListener) {
                view.emitAnchorEvent("onAnchorUpdated", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorRemoved(ARAnchor anchor, ARNode arNode) {
            ViroARPlaneView view = mView.get();
            if (view != null && view.mHasAnchorRemovedListener) {
                view.emitAnchorEvent("onAnchorRemoved", anchor, arNode);
            }
        }
    }
    
    public ViroARPlaneView(@NonNull Context context) {
        super(context);
        ViroLog.i(TAG, "Initializing ViroARPlaneView");
    }
    
    @Override
    protected Node createNodeJni() {
        mARPlane = new ARDeclarativePlane(DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_ALIGNMENT);
        
        // Set up plane event listener
        mPlaneEventListener = new PlaneEventListener(this);
        mARPlane.setDelegate(mPlaneEventListener);
        
        return mARPlane;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.i(TAG, "ViroARPlaneView attached to window");
    }
    
    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        
        if (context != null && mARPlane != null) {
            applyPlaneConfiguration();
        }
    }
    
    /**
     * Apply plane configuration
     */
    private void applyPlaneConfiguration() {
        if (mARPlane == null) {
            return;
        }
        
        // Apply minimum size constraints
        mARPlane.setMinWidth(mMinWidth);
        mARPlane.setMinHeight(mMinHeight);
        
        // Apply alignment
        mARPlane.setAlignment(mAlignment);
        
        // Apply anchor ID if set
        if (mAnchorId != null) {
            mARPlane.setAnchorId(mAnchorId);
        }
        
        // Apply pause updates setting
        mARPlane.setPauseUpdates(mPauseUpdates);
        
        mNeedsUpdate = false;
    }
    
    // Property setters
    
    public void setMinWidth(float minWidth) {
        mMinWidth = minWidth;
        if (mARPlane != null) {
            mARPlane.setMinWidth(minWidth);
        }
        mNeedsUpdate = true;
    }
    
    public void setMinHeight(float minHeight) {
        mMinHeight = minHeight;
        if (mARPlane != null) {
            mARPlane.setMinHeight(minHeight);
        }
        mNeedsUpdate = true;
    }
    
    public void setAlignment(@Nullable String alignment) {
        if (alignment == null) {
            return;
        }
        
        ARPlaneAnchor.Alignment newAlignment = DEFAULT_ALIGNMENT;
        switch (alignment.toLowerCase()) {
            case "horizontal":
                newAlignment = ARPlaneAnchor.Alignment.HORIZONTAL;
                break;
            case "horizontalupward":
            case "horizontal_upward":
                newAlignment = ARPlaneAnchor.Alignment.HORIZONTAL_UPWARD;
                break;
            case "horizontaldownward":
            case "horizontal_downward":
                newAlignment = ARPlaneAnchor.Alignment.HORIZONTAL_DOWNWARD;
                break;
            case "vertical":
                newAlignment = ARPlaneAnchor.Alignment.VERTICAL;
                break;
            default:
                ViroLog.w(TAG, "Unknown plane alignment: " + alignment);
                return;
        }
        
        mAlignment = newAlignment;
        if (mARPlane != null) {
            mARPlane.setAlignment(newAlignment);
        }
        mNeedsUpdate = true;
    }
    
    public void setAnchorId(@Nullable String anchorId) {
        mAnchorId = anchorId;
        if (mARPlane != null) {
            mARPlane.setAnchorId(anchorId);
        }
        mNeedsUpdate = true;
    }
    
    public void setPauseUpdates(boolean pauseUpdates) {
        mPauseUpdates = pauseUpdates;
        if (mARPlane != null) {
            mARPlane.setPauseUpdates(pauseUpdates);
        }
    }
    
    public void setIgnoreEventHandling(boolean ignore) {
        mIgnoreEventHandling = ignore;
        // This would be used to disable event handling for the plane
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
    
    // Plane commands
    
    /**
     * Reset the plane detection
     */
    public void reset() {
        if (mARPlane != null) {
            mARPlane.reset();
            
            WritableMap event = Arguments.createMap();
            emitEvent("onPlaneReset", event);
        }
    }
    
    /**
     * Get current plane information
     */
    public void getPlaneInfo() {
        if (mARPlane == null) {
            return;
        }
        
        WritableMap event = Arguments.createMap();
        event.putDouble("minWidth", mMinWidth);
        event.putDouble("minHeight", mMinHeight);
        event.putString("alignment", getAlignmentString(mAlignment));
        event.putString("anchorId", mAnchorId != null ? mAnchorId : "");
        event.putBoolean("pauseUpdates", mPauseUpdates);
        
        emitEvent("onGetPlaneInfoResult", event);
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
        anchorMap.putString("type", "plane");
        
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
        
        // Add plane-specific data
        if (anchor instanceof ARPlaneAnchor) {
            ARPlaneAnchor planeAnchor = (ARPlaneAnchor) anchor;
            WritableMap planeData = Arguments.createMap();
            
            Vector extent = planeAnchor.getExtent();
            WritableArray extentArray = Arguments.createArray();
            extentArray.pushDouble(extent.x);
            extentArray.pushDouble(extent.z);
            planeData.putArray("extent", extentArray);
            
            planeData.putString("alignment", getAlignmentString(planeAnchor.getAlignment()));
            
            anchorMap.putMap("plane", planeData);
        }
        
        return anchorMap;
    }
    
    /**
     * Convert alignment enum to string
     */
    private String getAlignmentString(ARPlaneAnchor.Alignment alignment) {
        switch (alignment) {
            case HORIZONTAL:
                return "horizontal";
            case HORIZONTAL_UPWARD:
                return "horizontalUpward";
            case HORIZONTAL_DOWNWARD:
                return "horizontalDownward";
            case VERTICAL:
                return "vertical";
            default:
                return "horizontal";
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        
        // Clean up plane resources
        if (mARPlane != null) {
            mARPlane.setDelegate(null);
            mARPlane = null;
        }
        
        mPlaneEventListener = null;
    }
}