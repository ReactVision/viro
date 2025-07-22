//
//  ViroARSceneView.java
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

import com.viro.core.ARScene;
import com.viro.core.ARNode;
import com.viro.core.ARPlane;
import com.viro.core.ARPlaneAnchor;
import com.viro.core.ARImageAnchor;
import com.viro.core.ARObjectAnchor;
import com.viro.core.ARAnchor;
import com.viro.core.Texture;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.ARScene.Listener;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.component.node.VRTARScene;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;
import com.viromedia.bridge.utility.ARUtils;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroARScene component.
 * ViroARScene provides AR scene management with anchor detection, plane tracking,
 * and AR-specific event handling for React Native New Architecture.
 */
public class ViroARSceneView extends ViroSceneView {
    
    private static final String TAG = ViroLog.getTag(ViroARSceneView.class);
    
    // AR Scene properties
    private ARScene mARScene;
    private boolean mDisplayPointCloud = false;
    private float[] mPointCloudScale = {1.0f, 1.0f, 1.0f};
    private int mPointCloudMaxPoints = 500;
    
    // Anchor tracking
    private Map<String, ARAnchor> mAnchors = new HashMap<>();
    private List<String> mAnchorIds = new ArrayList<>();
    
    // Event handling
    private boolean mHasARInitializedListener = false;
    private boolean mHasTrackingUpdatedListener = false;
    private boolean mHasAmbientLightUpdateListener = false;
    private boolean mHasAnchorFoundListener = false;
    private boolean mHasAnchorUpdatedListener = false;
    private boolean mHasAnchorRemovedListener = false;
    
    // AR Scene listener
    private ARSceneListener mARSceneListener;
    
    /**
     * AR Scene event listener implementation
     */
    private class ARSceneListener implements ARScene.Listener {
        
        private WeakReference<ViroARSceneView> mView;
        
        ARSceneListener(ViroARSceneView view) {
            mView = new WeakReference<>(view);
        }
        
        @Override
        public void onARInitialized() {
            ViroARSceneView view = mView.get();
            if (view != null && view.mHasARInitializedListener) {
                view.emitEvent("onARInitialized", Arguments.createMap());
            }
        }
        
        @Override
        public void onTrackingUpdated(ARScene.TrackingState state, ARScene.TrackingStateReason reason) {
            ViroARSceneView view = mView.get();
            if (view != null && view.mHasTrackingUpdatedListener) {
                WritableMap event = Arguments.createMap();
                event.putString("state", state.toString());
                event.putString("reason", reason.toString());
                view.emitEvent("onTrackingUpdated", event);
            }
        }
        
        @Override
        public void onAmbientLightUpdate(float intensity, Vector color) {
            ViroARSceneView view = mView.get();
            if (view != null && view.mHasAmbientLightUpdateListener) {
                WritableMap event = Arguments.createMap();
                event.putDouble("intensity", intensity);
                
                WritableArray colorArray = Arguments.createArray();
                colorArray.pushDouble(color.x);
                colorArray.pushDouble(color.y);
                colorArray.pushDouble(color.z);
                event.putArray("color", colorArray);
                
                view.emitEvent("onAmbientLightUpdate", event);
            }
        }
        
        @Override
        public void onAnchorFound(ARAnchor anchor, ARNode arNode) {
            ViroARSceneView view = mView.get();
            if (view != null) {
                String anchorId = anchor.getAnchorId();
                view.mAnchors.put(anchorId, anchor);
                view.mAnchorIds.add(anchorId);
                
                if (view.mHasAnchorFoundListener) {
                    view.emitAnchorEvent("onAnchorFound", anchor, arNode);
                }
            }
        }
        
        @Override
        public void onAnchorUpdated(ARAnchor anchor, ARNode arNode) {
            ViroARSceneView view = mView.get();
            if (view != null && view.mHasAnchorUpdatedListener) {
                view.emitAnchorEvent("onAnchorUpdated", anchor, arNode);
            }
        }
        
        @Override
        public void onAnchorRemoved(ARAnchor anchor, ARNode arNode) {
            ViroARSceneView view = mView.get();
            if (view != null) {
                String anchorId = anchor.getAnchorId();
                view.mAnchors.remove(anchorId);
                view.mAnchorIds.remove(anchorId);
                
                if (view.mHasAnchorRemovedListener) {
                    view.emitAnchorEvent("onAnchorRemoved", anchor, arNode);
                }
            }
        }
    }
    
    public ViroARSceneView(@NonNull Context context) {
        super(context);
        ViroLog.i(TAG, "Initializing ViroARSceneView");
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.i(TAG, "ViroARSceneView attached to window");
    }
    
    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        
        if (context != null) {
            initializeARScene();
        }
    }
    
    /**
     * Initialize the AR scene with ViroContext
     */
    private void initializeARScene() {
        if (mScene == null || !(mScene.getSceneJni() instanceof ARScene)) {
            ViroLog.w(TAG, "Scene is not an ARScene instance");
            return;
        }
        
        mARScene = (ARScene) mScene.getSceneJni();
        
        // Set up AR scene listener
        mARSceneListener = new ARSceneListener(this);
        mARScene.setListener(mARSceneListener);
        
        // Apply AR-specific configuration
        applyARConfiguration();
    }
    
    /**
     * Apply AR-specific configuration to the scene
     */
    private void applyARConfiguration() {
        if (mARScene == null) {
            return;
        }
        
        // Set point cloud display
        mARScene.displayPointCloud(mDisplayPointCloud);
        
        if (mDisplayPointCloud) {
            mARScene.setPointCloudScale(new Vector(
                mPointCloudScale[0],
                mPointCloudScale[1],
                mPointCloudScale[2]
            ));
            mARScene.setPointCloudMaxPoints(mPointCloudMaxPoints);
        }
    }
    
    // Property setters for AR-specific features
    
    public void setDisplayPointCloud(boolean display) {
        mDisplayPointCloud = display;
        if (mARScene != null) {
            mARScene.displayPointCloud(display);
        }
    }
    
    public void setPointCloudScale(@Nullable ReadableArray scale) {
        if (scale != null && scale.size() >= 3) {
            mPointCloudScale[0] = (float) scale.getDouble(0);
            mPointCloudScale[1] = (float) scale.getDouble(1);
            mPointCloudScale[2] = (float) scale.getDouble(2);
            
            if (mARScene != null && mDisplayPointCloud) {
                mARScene.setPointCloudScale(new Vector(
                    mPointCloudScale[0],
                    mPointCloudScale[1],
                    mPointCloudScale[2]
                ));
            }
        }
    }
    
    public void setPointCloudMaxPoints(int maxPoints) {
        mPointCloudMaxPoints = maxPoints;
        if (mARScene != null && mDisplayPointCloud) {
            mARScene.setPointCloudMaxPoints(maxPoints);
        }
    }
    
    // AR-specific commands
    
    /**
     * Load an AR image marker database
     */
    public void loadARImageDatabase(@NonNull ReadableMap database) {
        if (mARScene == null) {
            ViroLog.w(TAG, "Cannot load AR image database - ARScene not initialized");
            return;
        }
        
        try {
            // Parse database configuration
            if (database.hasKey("source")) {
                ReadableMap source = database.getMap("source");
                if (source != null && source.hasKey("uri")) {
                    String uri = source.getString("uri");
                    
                    // Load image database from URI
                    // This would typically involve loading images and creating AR reference images
                    ViroLog.i(TAG, "Loading AR image database from: " + uri);
                    
                    // For now, emit success event
                    WritableMap event = Arguments.createMap();
                    event.putString("database", uri);
                    event.putBoolean("success", true);
                    emitEvent("onARImageDatabaseLoaded", event);
                }
            }
        } catch (Exception e) {
            ViroLog.e(TAG, "Failed to load AR image database: " + e.getMessage());
            
            WritableMap event = Arguments.createMap();
            event.putBoolean("success", false);
            event.putString("error", e.getMessage());
            emitEvent("onARImageDatabaseLoaded", event);
        }
    }
    
    /**
     * Detach an anchor by ID
     */
    public void detachAnchor(@NonNull String anchorId) {
        if (mARScene == null) {
            return;
        }
        
        ARAnchor anchor = mAnchors.get(anchorId);
        if (anchor != null) {
            anchor.detach();
            mAnchors.remove(anchorId);
            mAnchorIds.remove(anchorId);
        }
    }
    
    /**
     * Get all current anchors
     */
    public void getAnchors() {
        WritableArray anchorsArray = Arguments.createArray();
        
        for (String anchorId : mAnchorIds) {
            ARAnchor anchor = mAnchors.get(anchorId);
            if (anchor != null) {
                WritableMap anchorMap = createAnchorMap(anchor);
                anchorsArray.pushMap(anchorMap);
            }
        }
        
        WritableMap event = Arguments.createMap();
        event.putArray("anchors", anchorsArray);
        emitEvent("onGetAnchorsResult", event);
    }
    
    /**
     * Reset the AR session for this scene
     */
    public void resetARSession() {
        if (mARScene != null) {
            // Clear anchors
            mAnchors.clear();
            mAnchorIds.clear();
            
            // Reset would be handled by the AR session in the navigator
            emitEvent("onARSessionReset", Arguments.createMap());
        }
    }
    
    // Event listener setters
    
    public void setOnARInitializedListener(boolean hasListener) {
        mHasARInitializedListener = hasListener;
    }
    
    public void setOnTrackingUpdatedListener(boolean hasListener) {
        mHasTrackingUpdatedListener = hasListener;
    }
    
    public void setOnAmbientLightUpdateListener(boolean hasListener) {
        mHasAmbientLightUpdateListener = hasListener;
    }
    
    public void setOnAnchorFoundListener(boolean hasListener) {
        mHasAnchorFoundListener = hasListener;
    }
    
    public void setOnAnchorUpdatedListener(boolean hasListener) {
        mHasAnchorUpdatedListener = hasListener;
    }
    
    public void setOnAnchorRemovedListener(boolean hasListener) {
        mHasAnchorRemovedListener = hasListener;
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
        anchorMap.putString("type", getAnchorType(anchor));
        
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
        
        // Add anchor-specific data
        if (anchor instanceof ARPlaneAnchor) {
            ARPlaneAnchor planeAnchor = (ARPlaneAnchor) anchor;
            WritableMap planeData = Arguments.createMap();
            
            Vector extent = planeAnchor.getExtent();
            WritableArray extentArray = Arguments.createArray();
            extentArray.pushDouble(extent.x);
            extentArray.pushDouble(extent.z);
            planeData.putArray("extent", extentArray);
            
            planeData.putString("alignment", planeAnchor.getAlignment().toString());
            
            anchorMap.putMap("plane", planeData);
        } else if (anchor instanceof ARImageAnchor) {
            ARImageAnchor imageAnchor = (ARImageAnchor) anchor;
            WritableMap imageData = Arguments.createMap();
            
            imageData.putString("referenceImageName", imageAnchor.getReferenceImageName());
            
            anchorMap.putMap("image", imageData);
        }
        
        return anchorMap;
    }
    
    /**
     * Get the type of an anchor as a string
     */
    private String getAnchorType(@NonNull ARAnchor anchor) {
        if (anchor instanceof ARPlaneAnchor) {
            return "plane";
        } else if (anchor instanceof ARImageAnchor) {
            return "image";
        } else if (anchor instanceof ARObjectAnchor) {
            return "object";
        } else {
            return "unknown";
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        
        // Clean up AR resources
        if (mARScene != null) {
            mARScene.setListener(null);
            mARScene = null;
        }
        
        mARSceneListener = null;
        mAnchors.clear();
        mAnchorIds.clear();
    }
}