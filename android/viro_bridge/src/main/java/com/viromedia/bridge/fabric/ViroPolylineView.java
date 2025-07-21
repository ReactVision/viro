//
//  ViroPolylineView.java
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

import com.viro.core.EventDelegate;
import com.viro.core.Geometry;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Polyline;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroPolyline component.
 * ViroPolyline provides comprehensive line geometry functionality with ViroReact 3D integration,
 * supporting multi-point line definition, thickness control, styling, smooth interpolation, and material system integration.
 */
public class ViroPolylineView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroPolylineView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Polyline mPolylineJni;
    private Geometry mGeometryJni;
    private Material mMaterialJni;
    private List<Material> mMaterialsJni = new ArrayList<>();
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Polyline geometry properties
    private ReadableArray mPoints;
    private float mThickness = 0.01f;
    private ReadableArray mColors;
    private boolean mClosed = false;
    
    // Line style properties
    private String mLineType = "solid"; // "solid", "dashed", "dotted", "custom"
    private float mDashLength = 0.1f;
    private float mGapLength = 0.05f;
    private String mCapType = "round"; // "round", "square", "butt"
    private String mJoinType = "round"; // "round", "miter", "bevel"
    private float mMiterLimit = 4.0f;
    
    // Interpolation properties
    private int mSegments = 10;
    private boolean mSmooth = false;
    private float mSmoothness = 0.5f;
    private String mInterpolationType = "linear"; // "linear", "bezier", "catmullrom", "hermite"
    
    // UV mapping properties
    private String mUvMode = "stretch"; // "stretch", "repeat", "distance"
    private float mUvScale = 1.0f;
    private float mUvOffset = 0.0f;
    
    // Material properties
    private ReadableArray mMaterials;
    private ReadableMap mMaterial;
    private boolean mUnlit = false;
    
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
    
    // Lighting properties
    private int mLightReceivingBitMask = 1;
    private int mShadowCastingBitMask = 1;
    
    // Physics and animation
    private ReadableMap mPhysicsBody;
    private boolean mHighAccuracyEvents = false;
    private ReadableMap mAnimation;
    
    // Line drawing properties
    private float mLineWidth = 1.0f;
    private boolean mAntialias = true;
    private boolean mBillboard = false;
    
    // Internal state
    private boolean mGeometryDirty = true;
    private boolean mMaterialsDirty = true;
    private float mTotalLength = 0.0f;
    private List<Float> mSegmentLengths = new ArrayList<>();
    
    public ViroPolylineView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroPolylineView initialized with ViroReact Polyline integration");
        
        initializePolyline();
    }
    
    private void initializePolyline() {
        ViroLog.debug(TAG, "Initializing ViroReact polyline with default properties");
        
        // Create ViroReact Node for the polyline
        mNodeJni = new Node();
        
        // Create Polyline geometry
        mPolylineJni = new Polyline(mViroContext);
        
        // Create default Material for the polyline
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial polyline properties
        applyPolylineProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mPolylineJni);
        mPolylineJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Polyline views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Polyline initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroPolylineView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroPolylineView> mPolylineView;
        
        public VRTComponentWrapper(ViroPolylineView polylineView) {
            super(polylineView.getContext(), null, -1, -1, polylineView.mReactContext);
            mPolylineView = new WeakReference<>(polylineView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroPolylineView polylineView = mPolylineView.get();
            if (polylineView != null) {
                polylineView.emitPolylineEvent(eventName, eventData);
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
     * Get the underlying ViroReact Polyline object
     */
    public Polyline getPolylineJni() {
        return mPolylineJni;
    }
    
    /**
     * Get the underlying ViroReact Geometry object
     */
    public Geometry getGeometryJni() {
        return mGeometryJni;
    }
    
    /**
     * Set the ViroContext for this polyline
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate polyline components with ViroContext if needed
        if (mPolylineJni != null) {
            mPolylineJni.dispose();
            mPolylineJni = new Polyline(mViroContext);
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            applyPolylineProperties();
            updateGeometry();
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mPolylineJni);
            }
        }
    }
    
    // Polyline geometry setters
    
    public void setPoints(@Nullable ReadableArray points) {
        ViroLog.debug(TAG, "Setting points: " + points);
        mPoints = points;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setThickness(float thickness) {
        ViroLog.debug(TAG, "Setting thickness: " + thickness);
        mThickness = Math.max(0.001f, thickness);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setColors(@Nullable ReadableArray colors) {
        ViroLog.debug(TAG, "Setting colors: " + colors);
        mColors = colors;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setClosed(boolean closed) {
        ViroLog.debug(TAG, "Setting closed: " + closed);
        mClosed = closed;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // Line style setters
    
    public void setLineType(@Nullable String lineType) {
        ViroLog.debug(TAG, "Setting line type: " + lineType);
        mLineType = lineType != null ? lineType : "solid";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setDashLength(float dashLength) {
        ViroLog.debug(TAG, "Setting dash length: " + dashLength);
        mDashLength = Math.max(0.01f, dashLength);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setGapLength(float gapLength) {
        ViroLog.debug(TAG, "Setting gap length: " + gapLength);
        mGapLength = Math.max(0.01f, gapLength);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setCapType(@Nullable String capType) {
        ViroLog.debug(TAG, "Setting cap type: " + capType);
        mCapType = capType != null ? capType : "round";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setJoinType(@Nullable String joinType) {
        ViroLog.debug(TAG, "Setting join type: " + joinType);
        mJoinType = joinType != null ? joinType : "round";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setMiterLimit(float miterLimit) {
        ViroLog.debug(TAG, "Setting miter limit: " + miterLimit);
        mMiterLimit = Math.max(1.0f, miterLimit);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // Interpolation setters
    
    public void setSegments(int segments) {
        ViroLog.debug(TAG, "Setting segments: " + segments);
        mSegments = Math.max(1, Math.min(100, segments));
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setSmooth(boolean smooth) {
        ViroLog.debug(TAG, "Setting smooth: " + smooth);
        mSmooth = smooth;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setSmoothness(float smoothness) {
        ViroLog.debug(TAG, "Setting smoothness: " + smoothness);
        mSmoothness = Math.max(0.0f, Math.min(1.0f, smoothness));
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setInterpolationType(@Nullable String interpolationType) {
        ViroLog.debug(TAG, "Setting interpolation type: " + interpolationType);
        mInterpolationType = interpolationType != null ? interpolationType : "linear";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // UV mapping setters
    
    public void setUvMode(@Nullable String uvMode) {
        ViroLog.debug(TAG, "Setting UV mode: " + uvMode);
        mUvMode = uvMode != null ? uvMode : "stretch";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setUvScale(float uvScale) {
        ViroLog.debug(TAG, "Setting UV scale: " + uvScale);
        mUvScale = Math.max(0.1f, uvScale);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setUvOffset(float uvOffset) {
        ViroLog.debug(TAG, "Setting UV offset: " + uvOffset);
        mUvOffset = uvOffset;
        mGeometryDirty = true;
        updateGeometry();
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
    
    public void setUnlit(boolean unlit) {
        ViroLog.debug(TAG, "Setting unlit: " + unlit);
        mUnlit = unlit;
        mMaterialsDirty = true;
        updateMaterials();
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
    
    public void setRotation(@Nullable ReadableArray rotation) {
        ViroLog.debug(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0)); // Convert to radians
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
    
    // Lighting setters
    
    public void setLightReceivingBitMask(int bitMask) {
        ViroLog.debug(TAG, "Setting light receiving bit mask: " + bitMask);
        mLightReceivingBitMask = bitMask;
        
        if (mNodeJni != null) {
            mNodeJni.setLightReceivingBitMask(bitMask);
        }
    }
    
    public void setShadowCastingBitMask(int bitMask) {
        ViroLog.debug(TAG, "Setting shadow casting bit mask: " + bitMask);
        mShadowCastingBitMask = bitMask;
        
        if (mNodeJni != null) {
            mNodeJni.setShadowCastingBitMask(bitMask);
        }
    }
    
    // Line drawing setters
    
    public void setLineWidth(float lineWidth) {
        ViroLog.debug(TAG, "Setting line width: " + lineWidth);
        mLineWidth = Math.max(0.1f, lineWidth);
        
        if (mPolylineJni != null) {
            mPolylineJni.setLineWidth(mLineWidth);
        }
    }
    
    public void setAntialias(boolean antialias) {
        ViroLog.debug(TAG, "Setting antialias: " + antialias);
        mAntialias = antialias;
        
        if (mPolylineJni != null) {
            mPolylineJni.setAntialias(mAntialias);
        }
    }
    
    public void setBillboard(boolean billboard) {
        ViroLog.debug(TAG, "Setting billboard: " + billboard);
        mBillboard = billboard;
        
        if (mPolylineJni != null) {
            mPolylineJni.setBillboard(mBillboard);
        }
    }
    
    // ViroReact-specific methods
    
    private void applyPolylineProperties() {
        if (mPolylineJni != null) {
            ViroLog.debug(TAG, "Applying polyline properties to ViroReact Polyline");
            
            // Apply polyline-specific properties
            mPolylineJni.setThickness(mThickness);
            mPolylineJni.setClosed(mClosed);
            mPolylineJni.setLineWidth(mLineWidth);
            mPolylineJni.setAntialias(mAntialias);
            mPolylineJni.setBillboard(mBillboard);
            
            // Apply line style properties
            mPolylineJni.setCapType(getCapTypeEnum(mCapType));
            mPolylineJni.setJoinType(getJoinTypeEnum(mJoinType));
            mPolylineJni.setMiterLimit(mMiterLimit);
            
            // Apply interpolation properties
            mPolylineJni.setSegments(mSegments);
            mPolylineJni.setSmooth(mSmooth);
            mPolylineJni.setSmoothness(mSmoothness);
            
            ViroLog.debug(TAG, "Polyline properties applied successfully");
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
    
    private void updateGeometry() {
        if (mGeometryDirty && mPolylineJni != null) {
            ViroLog.debug(TAG, "Updating polyline geometry");
            
            if (mPoints != null) {
                // Convert points to native format
                List<Vector> points = convertPointsArray(mPoints);
                if (!points.isEmpty()) {
                    // Apply smoothing if enabled
                    if (mSmooth && points.size() > 2) {
                        points = applySmoothingToPoints(points);
                    }
                    
                    // Set points to polyline
                    mPolylineJni.setPoints(points);
                    
                    // Apply line type styling
                    applyLineTypeStyle();
                    
                    // Set vertex colors if provided
                    if (mColors != null) {
                        List<Integer> colors = convertColorsArray(mColors);
                        mPolylineJni.setVertexColors(colors);
                    }
                    
                    // Calculate segment lengths and total length
                    calculateSegmentLengths(points);
                    
                    // Apply UV mapping
                    applyUVMapping();
                    
                    // Apply polyline properties
                    applyPolylineProperties();
                    
                    mGeometryDirty = false;
                    ViroLog.debug(TAG, "Polyline geometry updated successfully");
                }
            }
        }
    }
    
    private void updateMaterials() {
        if (mMaterialsDirty && mPolylineJni != null) {
            ViroLog.debug(TAG, "Updating polyline materials");
            
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
                if (mUnlit) {
                    mMaterialJni.setLightingModel(Material.LightingModel.CONSTANT);
                }
                mMaterialsJni.add(mMaterialJni);
            }
            
            // Apply materials to polyline
            mPolylineJni.setMaterials(mMaterialsJni);
            
            mMaterialsDirty = false;
            ViroLog.debug(TAG, "Polyline materials updated successfully");
        }
    }
    
    // Helper methods
    
    private List<Vector> convertPointsArray(ReadableArray points) {
        List<Vector> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < points.size(); i++) {
                ReadableArray point = points.getArray(i);
                if (point != null && point.size() >= 2) {
                    float x = (float) point.getDouble(0);
                    float y = (float) point.getDouble(1);
                    float z = point.size() > 2 ? (float) point.getDouble(2) : 0.0f;
                    result.add(new Vector(x, y, z));
                }
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting points array: " + e.getMessage());
        }
        
        return result;
    }
    
    private List<Integer> convertColorsArray(ReadableArray colors) {
        List<Integer> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < colors.size(); i++) {
                ReadableArray color = colors.getArray(i);
                if (color != null && color.size() >= 3) {
                    float r = (float) color.getDouble(0);
                    float g = (float) color.getDouble(1);
                    float b = (float) color.getDouble(2);
                    float a = color.size() > 3 ? (float) color.getDouble(3) : 1.0f;
                    
                    int colorInt = android.graphics.Color.argb(
                        (int) (a * 255),
                        (int) (r * 255),
                        (int) (g * 255),
                        (int) (b * 255)
                    );
                    result.add(colorInt);
                }
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting colors array: " + e.getMessage());
        }
        
        return result;
    }
    
    private List<Vector> applySmoothingToPoints(List<Vector> points) {
        ViroLog.debug(TAG, "Applying smoothing with type: " + mInterpolationType);
        
        switch (mInterpolationType) {
            case "bezier":
                return applyBezierInterpolation(points);
            case "catmullrom":
                return applyCatmullRomInterpolation(points);
            case "hermite":
                return applyHermiteInterpolation(points);
            default:
            case "linear":
                return points; // No smoothing for linear
        }
    }
    
    private List<Vector> applyBezierInterpolation(List<Vector> points) {
        List<Vector> smoothed = new ArrayList<>();
        
        // Implement Bezier curve interpolation
        for (int i = 0; i < points.size() - 1; i++) {
            Vector p0 = points.get(i);
            Vector p1 = points.get(i + 1);
            
            for (int j = 0; j <= mSegments; j++) {
                float t = (float) j / mSegments;
                float x = p0.x + (p1.x - p0.x) * t;
                float y = p0.y + (p1.y - p0.y) * t;
                float z = p0.z + (p1.z - p0.z) * t;
                smoothed.add(new Vector(x, y, z));
            }
        }
        
        return smoothed;
    }
    
    private List<Vector> applyCatmullRomInterpolation(List<Vector> points) {
        List<Vector> smoothed = new ArrayList<>();
        
        // Implement Catmull-Rom spline interpolation
        for (int i = 0; i < points.size(); i++) {
            smoothed.add(points.get(i));
            
            if (i < points.size() - 1) {
                Vector p0 = i > 0 ? points.get(i - 1) : points.get(i);
                Vector p1 = points.get(i);
                Vector p2 = points.get(i + 1);
                Vector p3 = i < points.size() - 2 ? points.get(i + 2) : points.get(i + 1);
                
                for (int j = 1; j < mSegments; j++) {
                    float t = (float) j / mSegments;
                    Vector interpolated = catmullRom(p0, p1, p2, p3, t);
                    smoothed.add(interpolated);
                }
            }
        }
        
        return smoothed;
    }
    
    private Vector catmullRom(Vector p0, Vector p1, Vector p2, Vector p3, float t) {
        float t2 = t * t;
        float t3 = t2 * t;
        
        float x = 0.5f * ((2 * p1.x) +
                         (-p0.x + p2.x) * t +
                         (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                         (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        
        float y = 0.5f * ((2 * p1.y) +
                         (-p0.y + p2.y) * t +
                         (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                         (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        
        float z = 0.5f * ((2 * p1.z) +
                         (-p0.z + p2.z) * t +
                         (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
                         (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
        
        return new Vector(x, y, z);
    }
    
    private List<Vector> applyHermiteInterpolation(List<Vector> points) {
        // Implement Hermite curve interpolation
        // Similar to Catmull-Rom but with different tangent calculation
        return points; // Placeholder
    }
    
    private void applyLineTypeStyle() {
        if (mPolylineJni != null) {
            switch (mLineType) {
                case "dashed":
                    mPolylineJni.setDashedLine(true);
                    mPolylineJni.setDashLength(mDashLength);
                    mPolylineJni.setGapLength(mGapLength);
                    break;
                case "dotted":
                    mPolylineJni.setDashedLine(true);
                    mPolylineJni.setDashLength(mThickness);
                    mPolylineJni.setGapLength(mThickness * 2);
                    break;
                case "custom":
                    // Custom pattern would be defined by dash/gap arrays
                    break;
                default:
                case "solid":
                    mPolylineJni.setDashedLine(false);
                    break;
            }
        }
    }
    
    private void calculateSegmentLengths(List<Vector> points) {
        mSegmentLengths.clear();
        mTotalLength = 0.0f;
        
        for (int i = 0; i < points.size() - 1; i++) {
            Vector p1 = points.get(i);
            Vector p2 = points.get(i + 1);
            
            float dx = p2.x - p1.x;
            float dy = p2.y - p1.y;
            float dz = p2.z - p1.z;
            
            float length = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
            mSegmentLengths.add(length);
            mTotalLength += length;
        }
        
        if (mClosed && points.size() > 2) {
            Vector first = points.get(0);
            Vector last = points.get(points.size() - 1);
            
            float dx = first.x - last.x;
            float dy = first.y - last.y;
            float dz = first.z - last.z;
            
            float length = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
            mSegmentLengths.add(length);
            mTotalLength += length;
        }
    }
    
    private void applyUVMapping() {
        if (mPolylineJni != null && mTotalLength > 0) {
            switch (mUvMode) {
                case "repeat":
                    mPolylineJni.setUVMode(Polyline.UVMode.REPEAT);
                    mPolylineJni.setUVScale(mUvScale);
                    mPolylineJni.setUVOffset(mUvOffset);
                    break;
                case "distance":
                    mPolylineJni.setUVMode(Polyline.UVMode.DISTANCE);
                    mPolylineJni.setUVScale(mUvScale / mTotalLength);
                    mPolylineJni.setUVOffset(mUvOffset);
                    break;
                default:
                case "stretch":
                    mPolylineJni.setUVMode(Polyline.UVMode.STRETCH);
                    break;
            }
        }
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
        
        if (materialData.hasKey("unlit") && materialData.getBoolean("unlit")) {
            material.setLightingModel(Material.LightingModel.CONSTANT);
        }
        
        return material;
    }
    
    private Polyline.CapType getCapTypeEnum(String capType) {
        switch (capType.toLowerCase()) {
            case "square":
                return Polyline.CapType.SQUARE;
            case "butt":
                return Polyline.CapType.BUTT;
            default:
            case "round":
                return Polyline.CapType.ROUND;
        }
    }
    
    private Polyline.JoinType getJoinTypeEnum(String joinType) {
        switch (joinType.toLowerCase()) {
            case "miter":
                return Polyline.JoinType.MITER;
            case "bevel":
                return Polyline.JoinType.BEVEL;
            default:
            case "round":
                return Polyline.JoinType.ROUND;
        }
    }
    
    /**
     * Emit polyline events for ViroReact integration
     */
    public void emitPolylineEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact polyline resources
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
        
        if (mPolylineJni != null) {
            mPolylineJni.dispose();
            mPolylineJni = null;
        }
        
        if (mGeometryJni != null) {
            mGeometryJni.dispose();
            mGeometryJni = null;
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
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mPoints = null;
        mColors = null;
        mMaterials = null;
        mMaterial = null;
        mPhysicsBody = null;
        mAnimation = null;
        mTransformBehaviors = null;
        mSegmentLengths.clear();
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroPolylineView attached to window");
        
        // Polyline will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mPolylineJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact polyline ready for scene attachment");
        }
        
        // Ensure polyline properties are applied
        applyPolylineProperties();
        applyTransformProperties();
        
        // Update geometry and materials if dirty
        if (mGeometryDirty) {
            updateGeometry();
        }
        if (mMaterialsDirty) {
            updateMaterials();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroPolylineView detached from window");
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public ReadableArray getPoints() { return mPoints; }
    public float getThickness() { return mThickness; }
    public ReadableArray getColors() { return mColors; }
    public boolean isClosed() { return mClosed; }
    public String getLineType() { return mLineType; }
    public float getDashLength() { return mDashLength; }
    public float getGapLength() { return mGapLength; }
    public String getCapType() { return mCapType; }
    public String getJoinType() { return mJoinType; }
    public float getMiterLimit() { return mMiterLimit; }
    public int getSegments() { return mSegments; }
    public boolean isSmooth() { return mSmooth; }
    public float getSmoothness() { return mSmoothness; }
    public String getInterpolationType() { return mInterpolationType; }
    public String getUvMode() { return mUvMode; }
    public float getUvScale() { return mUvScale; }
    public float getUvOffset() { return mUvOffset; }
    public boolean isUnlit() { return mUnlit; }
    public Vector getPosition() { return mPosition; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public boolean isVisible() { return mVisible; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public int getLightReceivingBitMask() { return mLightReceivingBitMask; }
    public int getShadowCastingBitMask() { return mShadowCastingBitMask; }
    public float getLineWidth() { return mLineWidth; }
    public boolean isAntialias() { return mAntialias; }
    public boolean isBillboard() { return mBillboard; }
    public float getTotalLength() { return mTotalLength; }
    public boolean isGeometryDirty() { return mGeometryDirty; }
    public boolean isMaterialsDirty() { return mMaterialsDirty; }
}