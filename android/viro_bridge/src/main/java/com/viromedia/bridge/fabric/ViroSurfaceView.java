//
//  ViroSurfaceView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.ARPlaneAnchor;
import com.viro.core.ARSurface;
import com.viro.core.EventDelegate;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Surface;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroSurface component.
 * ViroSurface provides comprehensive AR surface detection functionality with ViroReact 3D integration,
 * supporting AR plane detection (horizontal/vertical), surface geometry customization, material visualization,
 * and plane anchor management with real-time tracking.
 */
public class ViroSurfaceView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroSurfaceView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Surface mSurfaceJni;
    private ARSurface mARSurfaceJni;
    private Material mMaterialJni;
    private List<Material> mMaterialsJni = new ArrayList<>();
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Surface geometry properties
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    private int mSegments = 1;
    private int mWidthSegments = 1;
    private int mHeightSegments = 1;
    private String mSurfaceType = "plane"; // "plane", "mesh", "adaptive"
    
    // Material properties
    private ReadableArray mMaterials;
    private ReadableMap mMaterial;
    
    // AR plane detection properties
    private boolean mArPlaneDetection = false;
    private ReadableArray mArPlaneDetectionTypes;
    private String mPlaneAlignment = "horizontal"; // "horizontal", "vertical", "all"
    private String mPlaneDetectionMode = "all"; // "all", "single", "multiple"
    private Vector mMinPlaneSize = new Vector(0.1f, 0.1f, 0.0f);
    private Vector mMaxPlaneSize = new Vector(100.0f, 100.0f, 0.0f);
    private ReadableMap mPlaneAnchor;
    private String mAnchorId = "";
    
    // Surface tracking properties
    private boolean mTrackingEnabled = true;
    private String mTrackingQuality = "high"; // "low", "medium", "high", "ultra"
    private float mUpdateFrequency = 30.0f; // Hz
    private boolean mPersistentTracking = true;
    
    // AR plane visualization properties
    private boolean mShowPlaneExtent = false;
    private boolean mShowPlaneOutline = true;
    private float mPlaneOutlineWidth = 0.01f;
    private Vector mPlaneColor = new Vector(1.0f, 1.0f, 1.0f);
    private float mPlaneOpacity = 0.5f;
    
    // Transform properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
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
    private ReadableMap mAnimation;
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
    
    // AR plane event handling flags
    private boolean mOnPlaneDetected = false;
    private boolean mOnPlaneUpdated = false;
    private boolean mOnPlaneRemoved = false;
    private boolean mOnAnchorFound = false;
    private boolean mOnAnchorUpdated = false;
    private boolean mOnAnchorRemoved = false;
    
    // Internal state
    private boolean mSurfaceDirty = true;
    private boolean mMaterialsDirty = true;
    private boolean mARTrackingDirty = true;
    private List<ARPlaneAnchor> mDetectedPlanes = new ArrayList<>();
    
    public ViroSurfaceView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroSurfaceView initialized with ViroReact AR Surface integration");
        
        initializeSurface();
    }
    
    private void initializeSurface() {
        ViroLog.debug(TAG, "Initializing ViroReact surface with default properties");
        
        // Create ViroReact Node for the surface
        mNodeJni = new Node();
        
        // Create Surface geometry
        mSurfaceJni = new Surface(mWidth, mHeight);
        
        // Create ARSurface for AR plane detection
        mARSurfaceJni = new ARSurface(mViroContext);
        
        // Create default Material for the surface
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial surface properties
        applySurfaceProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mSurfaceJni);
        mSurfaceJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Attach AR surface for plane detection
        mNodeJni.setARSurface(mARSurfaceJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Surface views are typically transparent for AR content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact AR Surface initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroSurfaceView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroSurfaceView> mSurfaceView;
        
        public VRTComponentWrapper(ViroSurfaceView surfaceView) {
            super(surfaceView.getContext(), null, -1, -1, surfaceView.mReactContext);
            mSurfaceView = new WeakReference<>(surfaceView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroSurfaceView surfaceView = mSurfaceView.get();
            if (surfaceView != null) {
                surfaceView.emitSurfaceEvent(eventName, eventData);
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
     * Get the underlying ViroReact Surface object
     */
    public Surface getSurfaceJni() {
        return mSurfaceJni;
    }
    
    /**
     * Get the underlying ViroReact ARSurface object
     */
    public ARSurface getARSurfaceJni() {
        return mARSurfaceJni;
    }
    
    /**
     * Set the ViroContext for this surface
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate surface components with ViroContext if needed
        if (mSurfaceJni != null) {
            mSurfaceJni.dispose();
            mSurfaceJni = new Surface(mWidth, mHeight);
            mARSurfaceJni.dispose();
            mARSurfaceJni = new ARSurface(mViroContext);
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            applySurfaceProperties();
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mSurfaceJni);
                mNodeJni.setARSurface(mARSurfaceJni);
            }
        }
    }
    
    // Surface geometry setters
    
    public void setWidth(float width) {
        ViroLog.debug(TAG, "Setting width: " + width);
        mWidth = Math.max(0.01f, width);
        mSurfaceDirty = true;
        updateSurface();
    }
    
    public void setHeight(float height) {
        ViroLog.debug(TAG, "Setting height: " + height);
        mHeight = Math.max(0.01f, height);
        mSurfaceDirty = true;
        updateSurface();
    }
    
    public void setSegments(int segments) {
        ViroLog.debug(TAG, "Setting segments: " + segments);
        mSegments = Math.max(1, Math.min(100, segments));
        mWidthSegments = mSegments;
        mHeightSegments = mSegments;
        mSurfaceDirty = true;
        updateSurface();
    }
    
    public void setWidthSegments(int widthSegments) {
        ViroLog.debug(TAG, "Setting width segments: " + widthSegments);
        mWidthSegments = Math.max(1, Math.min(100, widthSegments));
        mSurfaceDirty = true;
        updateSurface();
    }
    
    public void setHeightSegments(int heightSegments) {
        ViroLog.debug(TAG, "Setting height segments: " + heightSegments);
        mHeightSegments = Math.max(1, Math.min(100, heightSegments));
        mSurfaceDirty = true;
        updateSurface();
    }
    
    public void setSurfaceType(@Nullable String surfaceType) {
        ViroLog.debug(TAG, "Setting surface type: " + surfaceType);
        mSurfaceType = surfaceType != null ? surfaceType : "plane";
        mSurfaceDirty = true;
        updateSurface();
    }
    
    // Material setters
    
    public void setMaterials(@Nullable ReadableArray materials) {
        ViroLog.debug(TAG, "Setting materials: " + materials);
        mMaterials = materials;
        mMaterialsDirty = true;
        updateMaterials();
    }
    
    public void setMaterial(@Nullable ReadableMap material) {
        ViroLog.debug(TAG, "Setting material: " + material);
        mMaterial = material;
        mMaterialsDirty = true;
        updateMaterials();
    }
    
    // AR plane detection setters
    
    public void setArPlaneDetection(boolean arPlaneDetection) {
        ViroLog.debug(TAG, "Setting AR plane detection: " + arPlaneDetection);
        mArPlaneDetection = arPlaneDetection;
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setArPlaneDetectionTypes(@Nullable ReadableArray arPlaneDetectionTypes) {
        ViroLog.debug(TAG, "Setting AR plane detection types: " + arPlaneDetectionTypes);
        mArPlaneDetectionTypes = arPlaneDetectionTypes;
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setPlaneAlignment(@Nullable String planeAlignment) {
        ViroLog.debug(TAG, "Setting plane alignment: " + planeAlignment);
        mPlaneAlignment = planeAlignment != null ? planeAlignment : "horizontal";
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setPlaneDetectionMode(@Nullable String planeDetectionMode) {
        ViroLog.debug(TAG, "Setting plane detection mode: " + planeDetectionMode);
        mPlaneDetectionMode = planeDetectionMode != null ? planeDetectionMode : "all";
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setMinPlaneSize(@Nullable ReadableArray minPlaneSize) {
        ViroLog.debug(TAG, "Setting min plane size: " + minPlaneSize);
        
        if (minPlaneSize != null && minPlaneSize.size() >= 2) {
            try {
                float width = (float) minPlaneSize.getDouble(0);
                float height = (float) minPlaneSize.getDouble(1);
                mMinPlaneSize = new Vector(Math.max(0.01f, width), Math.max(0.01f, height), 0.0f);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing min plane size: " + e.getMessage());
                mMinPlaneSize = new Vector(0.1f, 0.1f, 0.0f);
            }
        } else {
            mMinPlaneSize = new Vector(0.1f, 0.1f, 0.0f);
        }
        
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setMaxPlaneSize(@Nullable ReadableArray maxPlaneSize) {
        ViroLog.debug(TAG, "Setting max plane size: " + maxPlaneSize);
        
        if (maxPlaneSize != null && maxPlaneSize.size() >= 2) {
            try {
                float width = (float) maxPlaneSize.getDouble(0);
                float height = (float) maxPlaneSize.getDouble(1);
                mMaxPlaneSize = new Vector(Math.max(mMinPlaneSize.x, width), Math.max(mMinPlaneSize.y, height), 0.0f);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing max plane size: " + e.getMessage());
                mMaxPlaneSize = new Vector(100.0f, 100.0f, 0.0f);
            }
        } else {
            mMaxPlaneSize = new Vector(100.0f, 100.0f, 0.0f);
        }
        
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setAnchorId(@Nullable String anchorId) {
        ViroLog.debug(TAG, "Setting anchor ID: " + anchorId);
        mAnchorId = anchorId != null ? anchorId : "";
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    // Surface tracking setters
    
    public void setTrackingEnabled(boolean trackingEnabled) {
        ViroLog.debug(TAG, "Setting tracking enabled: " + trackingEnabled);
        mTrackingEnabled = trackingEnabled;
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setTrackingQuality(@Nullable String trackingQuality) {
        ViroLog.debug(TAG, "Setting tracking quality: " + trackingQuality);
        mTrackingQuality = trackingQuality != null ? trackingQuality : "high";
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setUpdateFrequency(float updateFrequency) {
        ViroLog.debug(TAG, "Setting update frequency: " + updateFrequency);
        mUpdateFrequency = Math.max(1.0f, Math.min(120.0f, updateFrequency));
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setPersistentTracking(boolean persistentTracking) {
        ViroLog.debug(TAG, "Setting persistent tracking: " + persistentTracking);
        mPersistentTracking = persistentTracking;
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    // AR plane visualization setters
    
    public void setShowPlaneExtent(boolean showPlaneExtent) {
        ViroLog.debug(TAG, "Setting show plane extent: " + showPlaneExtent);
        mShowPlaneExtent = showPlaneExtent;
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setShowPlaneOutline(boolean showPlaneOutline) {
        ViroLog.debug(TAG, "Setting show plane outline: " + showPlaneOutline);
        mShowPlaneOutline = showPlaneOutline;
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setPlaneOutlineWidth(float planeOutlineWidth) {
        ViroLog.debug(TAG, "Setting plane outline width: " + planeOutlineWidth);
        mPlaneOutlineWidth = Math.max(0.001f, planeOutlineWidth);
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setPlaneColor(@Nullable ReadableArray planeColor) {
        ViroLog.debug(TAG, "Setting plane color: " + planeColor);
        
        if (planeColor != null && planeColor.size() >= 3) {
            try {
                float r = (float) planeColor.getDouble(0);
                float g = (float) planeColor.getDouble(1);
                float b = (float) planeColor.getDouble(2);
                mPlaneColor = new Vector(r, g, b);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing plane color: " + e.getMessage());
                mPlaneColor = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mPlaneColor = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    public void setPlaneOpacity(float planeOpacity) {
        ViroLog.debug(TAG, "Setting plane opacity: " + planeOpacity);
        mPlaneOpacity = Math.max(0.0f, Math.min(1.0f, planeOpacity));
        mARTrackingDirty = true;
        updateARTracking();
    }
    
    // Transform setters
    
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
                mPosition = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mPosition = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }
    
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
    
    public void setOnPlaneDetected(boolean onPlaneDetected) {
        ViroLog.debug(TAG, "Setting on plane detected: " + onPlaneDetected);
        mOnPlaneDetected = onPlaneDetected;
    }
    
    public void setOnPlaneUpdated(boolean onPlaneUpdated) {
        ViroLog.debug(TAG, "Setting on plane updated: " + onPlaneUpdated);
        mOnPlaneUpdated = onPlaneUpdated;
    }
    
    public void setOnPlaneRemoved(boolean onPlaneRemoved) {
        ViroLog.debug(TAG, "Setting on plane removed: " + onPlaneRemoved);
        mOnPlaneRemoved = onPlaneRemoved;
    }
    
    public void setOnAnchorFound(boolean onAnchorFound) {
        ViroLog.debug(TAG, "Setting on anchor found: " + onAnchorFound);
        mOnAnchorFound = onAnchorFound;
    }
    
    public void setOnAnchorUpdated(boolean onAnchorUpdated) {
        ViroLog.debug(TAG, "Setting on anchor updated: " + onAnchorUpdated);
        mOnAnchorUpdated = onAnchorUpdated;
    }
    
    public void setOnAnchorRemoved(boolean onAnchorRemoved) {
        ViroLog.debug(TAG, "Setting on anchor removed: " + onAnchorRemoved);
        mOnAnchorRemoved = onAnchorRemoved;
    }
    
    // ViroReact-specific methods
    
    private void applySurfaceProperties() {
        if (mSurfaceJni != null) {
            ViroLog.debug(TAG, "Applying surface properties to ViroReact Surface");
            
            // Apply surface geometry properties
            mSurfaceJni.setWidth(mWidth);
            mSurfaceJni.setHeight(mHeight);
            mSurfaceJni.setWidthSegments(mWidthSegments);
            mSurfaceJni.setHeightSegments(mHeightSegments);
            
            ViroLog.debug(TAG, "Surface properties applied successfully");
        }
    }
    
    private void applyTransformProperties() {
        if (mNodeJni != null) {
            ViroLog.debug(TAG, "Applying transform properties to ViroReact Node");
            
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
            
            ViroLog.debug(TAG, "Transform properties applied successfully");
        }
    }
    
    private void updateSurface() {
        if (mSurfaceDirty && mSurfaceJni != null) {
            ViroLog.debug(TAG, "Updating surface geometry");
            
            // Recreate surface with new dimensions
            mSurfaceJni.dispose();
            mSurfaceJni = new Surface(mWidth, mHeight);
            mSurfaceJni.setWidthSegments(mWidthSegments);
            mSurfaceJni.setHeightSegments(mHeightSegments);
            
            // Reattach to node
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mSurfaceJni);
            }
            
            // Reapply materials
            if (!mMaterialsJni.isEmpty()) {
                mSurfaceJni.setMaterials(mMaterialsJni);
            } else if (mMaterialJni != null) {
                mSurfaceJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
            }
            
            mSurfaceDirty = false;
            ViroLog.debug(TAG, "Surface geometry updated successfully");
        }
    }
    
    private void updateMaterials() {
        if (mMaterialsDirty && mSurfaceJni != null) {
            ViroLog.debug(TAG, "Updating surface materials");
            
            // Clear existing materials
            mMaterialsJni.clear();
            
            if (mMaterials != null) {
                // Handle multiple materials
                for (int i = 0; i < mMaterials.size(); i++) {
                    ReadableMap materialData = mMaterials.getMap(i);
                    if (materialData != null) {
                        Material material = createMaterialFromData(materialData);
                        mMaterialsJni.add(material);
                    }
                }
            } else if (mMaterial != null) {
                // Handle single material
                Material material = createMaterialFromData(mMaterial);
                mMaterialsJni.add(material);
            } else {
                // Use default material
                mMaterialsJni.add(mMaterialJni);
            }
            
            // Apply materials to surface
            mSurfaceJni.setMaterials(mMaterialsJni);
            
            mMaterialsDirty = false;
            ViroLog.debug(TAG, "Surface materials updated successfully");
        }
    }
    
    private void updateARTracking() {
        if (mARTrackingDirty && mARSurfaceJni != null) {
            ViroLog.debug(TAG, "Updating AR tracking properties");
            
            if (mArPlaneDetection && mTrackingEnabled) {
                // Enable AR plane detection
                mARSurfaceJni.setPlaneDetectionEnabled(true);
                
                // Apply plane alignment
                ARSurface.PlaneAlignment alignment = getPlaneAlignmentEnum(mPlaneAlignment);
                mARSurfaceJni.setPlaneAlignment(alignment);
                
                // Apply plane detection mode
                ARSurface.DetectionMode mode = getDetectionModeEnum(mPlaneDetectionMode);
                mARSurfaceJni.setDetectionMode(mode);
                
                // Apply plane size constraints
                mARSurfaceJni.setMinPlaneSize(mMinPlaneSize.x, mMinPlaneSize.y);
                mARSurfaceJni.setMaxPlaneSize(mMaxPlaneSize.x, mMaxPlaneSize.y);
                
                // Apply tracking quality
                ARSurface.TrackingQuality quality = getTrackingQualityEnum(mTrackingQuality);
                mARSurfaceJni.setTrackingQuality(quality);
                
                // Apply update frequency
                mARSurfaceJni.setUpdateFrequency(mUpdateFrequency);
                
                // Apply persistent tracking
                mARSurfaceJni.setPersistentTracking(mPersistentTracking);
                
                // Apply visualization properties
                mARSurfaceJni.setShowPlaneExtent(mShowPlaneExtent);
                mARSurfaceJni.setShowPlaneOutline(mShowPlaneOutline);
                mARSurfaceJni.setPlaneOutlineWidth(mPlaneOutlineWidth);
                mARSurfaceJni.setPlaneColor(mPlaneColor.x, mPlaneColor.y, mPlaneColor.z);
                mARSurfaceJni.setPlaneOpacity(mPlaneOpacity);
                
                // Set up plane detection callbacks
                setupPlaneDetectionCallbacks();
            } else {
                // Disable AR plane detection
                mARSurfaceJni.setPlaneDetectionEnabled(false);
            }
            
            mARTrackingDirty = false;
            ViroLog.debug(TAG, "AR tracking properties updated successfully");
        }
    }
    
    private void setupPlaneDetectionCallbacks() {
        if (mARSurfaceJni != null) {
            mARSurfaceJni.setPlaneDetectionCallback(new ARSurface.PlaneDetectionCallback() {
                @Override
                public void onPlaneDetected(ARPlaneAnchor plane) {
                    handlePlaneDetected(plane);
                }
                
                @Override
                public void onPlaneUpdated(ARPlaneAnchor plane) {
                    handlePlaneUpdated(plane);
                }
                
                @Override
                public void onPlaneRemoved(ARPlaneAnchor plane) {
                    handlePlaneRemoved(plane);
                }
            });
        }
    }
    
    private void handlePlaneDetected(ARPlaneAnchor plane) {
        ViroLog.debug(TAG, "AR plane detected: " + plane.getAnchorId());
        
        mDetectedPlanes.add(plane);
        
        if (mOnPlaneDetected) {
            WritableMap eventData = createPlaneEventData(plane);
            emitSurfaceEvent("onPlaneDetected", eventData);
        }
        
        if (mOnAnchorFound) {
            WritableMap eventData = createAnchorEventData(plane);
            emitSurfaceEvent("onAnchorFound", eventData);
        }
    }
    
    private void handlePlaneUpdated(ARPlaneAnchor plane) {
        ViroLog.debug(TAG, "AR plane updated: " + plane.getAnchorId());
        
        if (mOnPlaneUpdated) {
            WritableMap eventData = createPlaneEventData(plane);
            emitSurfaceEvent("onPlaneUpdated", eventData);
        }
        
        if (mOnAnchorUpdated) {
            WritableMap eventData = createAnchorEventData(plane);
            emitSurfaceEvent("onAnchorUpdated", eventData);
        }
    }
    
    private void handlePlaneRemoved(ARPlaneAnchor plane) {
        ViroLog.debug(TAG, "AR plane removed: " + plane.getAnchorId());
        
        mDetectedPlanes.remove(plane);
        
        if (mOnPlaneRemoved) {
            WritableMap eventData = createPlaneEventData(plane);
            emitSurfaceEvent("onPlaneRemoved", eventData);
        }
        
        if (mOnAnchorRemoved) {
            WritableMap eventData = createAnchorEventData(plane);
            emitSurfaceEvent("onAnchorRemoved", eventData);
        }
    }
    
    private WritableMap createPlaneEventData(ARPlaneAnchor plane) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("planeId", plane.getAnchorId());
        eventData.putString("alignment", plane.getAlignment().toString().toLowerCase());
        
        // Plane center position
        Vector center = plane.getCenter();
        WritableMap centerMap = Arguments.createMap();
        centerMap.putDouble("x", center.x);
        centerMap.putDouble("y", center.y);
        centerMap.putDouble("z", center.z);
        eventData.putMap("center", centerMap);
        
        // Plane extent (size)
        Vector extent = plane.getExtent();
        WritableMap extentMap = Arguments.createMap();
        extentMap.putDouble("width", extent.x);
        extentMap.putDouble("height", extent.y);
        eventData.putMap("extent", extentMap);
        
        // Plane vertices (boundary points)
        List<Vector> vertices = plane.getVertices();
        WritableMap verticesArray = Arguments.createMap();
        for (int i = 0; i < vertices.size(); i++) {
            Vector vertex = vertices.get(i);
            WritableMap vertexMap = Arguments.createMap();
            vertexMap.putDouble("x", vertex.x);
            vertexMap.putDouble("y", vertex.y);
            vertexMap.putDouble("z", vertex.z);
            verticesArray.putMap(String.valueOf(i), vertexMap);
        }
        eventData.putMap("vertices", verticesArray);
        
        return eventData;
    }
    
    private WritableMap createAnchorEventData(ARPlaneAnchor plane) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("anchorId", plane.getAnchorId());
        eventData.putString("type", "plane");
        
        // Anchor transform matrix
        float[] transform = plane.getTransform();
        WritableMap transformMap = Arguments.createMap();
        for (int i = 0; i < transform.length; i++) {
            transformMap.putDouble(String.valueOf(i), transform[i]);
        }
        eventData.putMap("transform", transformMap);
        
        return eventData;
    }
    
    private Material createMaterialFromData(ReadableMap materialData) {
        Material material = new Material(mViroContext);
        
        // Apply material properties from data
        if (materialData.hasKey("diffuseColor")) {
            ReadableArray color = materialData.getArray("diffuseColor");
            if (color != null && color.size() >= 3) {
                float r = (float) color.getDouble(0);
                float g = (float) color.getDouble(1);
                float b = (float) color.getDouble(2);
                material.setDiffuseColor(r, g, b);
            }
        }
        
        if (materialData.hasKey("opacity")) {
            float opacity = (float) materialData.getDouble("opacity");
            material.setOpacity(opacity);
        }
        
        if (materialData.hasKey("transparency")) {
            boolean transparency = materialData.getBoolean("transparency");
            material.setTransparency(transparency);
        }
        
        return material;
    }
    
    // Helper methods to convert string properties to enum values
    
    private ARSurface.PlaneAlignment getPlaneAlignmentEnum(String alignment) {
        switch (alignment.toLowerCase()) {
            case "vertical":
                return ARSurface.PlaneAlignment.VERTICAL;
            case "all":
                return ARSurface.PlaneAlignment.ALL;
            default:
            case "horizontal":
                return ARSurface.PlaneAlignment.HORIZONTAL;
        }
    }
    
    private ARSurface.DetectionMode getDetectionModeEnum(String mode) {
        switch (mode.toLowerCase()) {
            case "single":
                return ARSurface.DetectionMode.SINGLE;
            case "multiple":
                return ARSurface.DetectionMode.MULTIPLE;
            default:
            case "all":
                return ARSurface.DetectionMode.ALL;
        }
    }
    
    private ARSurface.TrackingQuality getTrackingQualityEnum(String quality) {
        switch (quality.toLowerCase()) {
            case "low":
                return ARSurface.TrackingQuality.LOW;
            case "medium":
                return ARSurface.TrackingQuality.MEDIUM;
            case "ultra":
                return ARSurface.TrackingQuality.ULTRA;
            default:
            case "high":
                return ARSurface.TrackingQuality.HIGH;
        }
    }
    
    /**
     * Emit surface events for ViroReact integration
     */
    public void emitSurfaceEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Clean up ViroReact surface resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setGeometry(null);
            mNodeJni.setARSurface(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mSurfaceJni != null) {
            mSurfaceJni.dispose();
            mSurfaceJni = null;
        }
        
        if (mARSurfaceJni != null) {
            mARSurfaceJni.dispose();
            mARSurfaceJni = null;
        }
        
        if (mMaterialJni != null) {
            mMaterialJni.dispose();
            mMaterialJni = null;
        }
        
        // Dispose additional materials
        for (Material material : mMaterialsJni) {
            if (material != null) {
                material.dispose();
            }
        }
        mMaterialsJni.clear();
        
        // Clear detected planes
        mDetectedPlanes.clear();
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mMaterials = null;
        mMaterial = null;
        mArPlaneDetectionTypes = null;
        mPlaneAnchor = null;
        mTransformBehaviors = null;
        mPhysicsBody = null;
        mAnimation = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroSurfaceView attached to window");
        
        // Surface will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mSurfaceJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact AR surface ready for scene attachment");
        }
        
        // Ensure surface properties are applied
        applySurfaceProperties();
        applyTransformProperties();
        
        // Update surface and materials if dirty
        if (mSurfaceDirty) {
            updateSurface();
        }
        if (mMaterialsDirty) {
            updateMaterials();
        }
        if (mARTrackingDirty) {
            updateARTracking();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroSurfaceView detached from window");
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public float getWidth() { return mWidth; }
    public float getHeight() { return mHeight; }
    public int getSegments() { return mSegments; }
    public int getWidthSegments() { return mWidthSegments; }
    public int getHeightSegments() { return mHeightSegments; }
    public String getSurfaceType() { return mSurfaceType; }
    public boolean isArPlaneDetection() { return mArPlaneDetection; }
    public String getPlaneAlignment() { return mPlaneAlignment; }
    public String getPlaneDetectionMode() { return mPlaneDetectionMode; }
    public Vector getMinPlaneSize() { return mMinPlaneSize; }
    public Vector getMaxPlaneSize() { return mMaxPlaneSize; }
    public String getAnchorId() { return mAnchorId; }
    public boolean isTrackingEnabled() { return mTrackingEnabled; }
    public String getTrackingQuality() { return mTrackingQuality; }
    public float getUpdateFrequency() { return mUpdateFrequency; }
    public boolean isPersistentTracking() { return mPersistentTracking; }
    public boolean isShowPlaneExtent() { return mShowPlaneExtent; }
    public boolean isShowPlaneOutline() { return mShowPlaneOutline; }
    public float getPlaneOutlineWidth() { return mPlaneOutlineWidth; }
    public Vector getPlaneColor() { return mPlaneColor; }
    public float getPlaneOpacity() { return mPlaneOpacity; }
    public Vector getPosition() { return mPosition; }
    public Vector getRotation() { return mRotation; }
    public Vector getScale() { return mScale; }
    public boolean isVisible() { return mVisible; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public List<ARPlaneAnchor> getDetectedPlanes() { return mDetectedPlanes; }
    public boolean isSurfaceDirty() { return mSurfaceDirty; }
    public boolean isMaterialsDirty() { return mMaterialsDirty; }
    public boolean isARTrackingDirty() { return mARTrackingDirty; }
}