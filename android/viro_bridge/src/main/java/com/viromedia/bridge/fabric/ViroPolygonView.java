//
//  ViroPolygonView.java
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
import com.viro.core.Polygon;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroPolygon component.
 * ViroPolygon provides comprehensive custom polygon geometry functionality with ViroReact 3D integration,
 * supporting vertex-based polygon definition, hole support, tessellation, UV mapping, and material system integration.
 */
public class ViroPolygonView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroPolygonView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Polygon mPolygonJni;
    private Geometry mGeometryJni;
    private Material mMaterialJni;
    private List<Material> mMaterialsJni = new ArrayList<>();
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Polygon geometry properties
    private ReadableArray mVertices;
    private ReadableArray mHoles;
    private ReadableArray mUvCoordinates;
    private ReadableArray mNormals;
    private ReadableArray mColors;
    private ReadableArray mIndices;
    
    // Polygon specific properties
    private float mThickness = 0.0f;
    private boolean mFacesOutward = true;
    private String mWindingOrder = "CounterClockwise"; // "Clockwise", "CounterClockwise"
    
    // Tessellation properties
    private int mTessellationFactor = 1;
    private String mTessellationMode = "uniform"; // "uniform", "adaptive", "distance"
    private float mTessellationTolerance = 0.1f;
    
    // Extrusion properties
    private boolean mExtruded = false;
    private float mExtrusionDepth = 1.0f;
    private boolean mCapEnds = true;
    private boolean mSmoothNormals = true;
    
    // UV mapping properties
    private String mUvMapping = "planar"; // "planar", "cylindrical", "spherical", "custom"
    private Vector mUvScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mUvOffset = new Vector(0.0f, 0.0f, 0.0f);
    
    // Material properties
    private ReadableArray mMaterials;
    private ReadableMap mMaterial;
    
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
    
    // Internal state
    private boolean mGeometryDirty = true;
    private boolean mMaterialsDirty = true;
    
    public ViroPolygonView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroPolygonView initialized with ViroReact Polygon integration");
        
        initializePolygon();
    }
    
    private void initializePolygon() {
        ViroLog.debug(TAG, "Initializing ViroReact polygon with default properties");
        
        // Create ViroReact Node for the polygon
        mNodeJni = new Node();
        
        // Create Polygon geometry
        mPolygonJni = new Polygon(mViroContext);
        
        // Create default Material for the polygon
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial polygon properties
        applyPolygonProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mPolygonJni);
        mPolygonJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Polygon views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Polygon initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroPolygonView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroPolygonView> mPolygonView;
        
        public VRTComponentWrapper(ViroPolygonView polygonView) {
            super(polygonView.getContext(), null, -1, -1, polygonView.mReactContext);
            mPolygonView = new WeakReference<>(polygonView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroPolygonView polygonView = mPolygonView.get();
            if (polygonView != null) {
                polygonView.emitPolygonEvent(eventName, eventData);
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
     * Get the underlying ViroReact Polygon object
     */
    public Polygon getPolygonJni() {
        return mPolygonJni;
    }
    
    /**
     * Get the underlying ViroReact Geometry object
     */
    public Geometry getGeometryJni() {
        return mGeometryJni;
    }
    
    /**
     * Set the ViroContext for this polygon
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate polygon components with ViroContext if needed
        if (mPolygonJni != null) {
            mPolygonJni.dispose();
            mPolygonJni = new Polygon(mViroContext);
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            applyPolygonProperties();
            updateGeometry();
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mPolygonJni);
            }
        }
    }
    
    // Polygon geometry setters
    
    public void setVertices(@Nullable ReadableArray vertices) {
        ViroLog.debug(TAG, "Setting vertices: " + vertices);
        mVertices = vertices;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setHoles(@Nullable ReadableArray holes) {
        ViroLog.debug(TAG, "Setting holes: " + holes);
        mHoles = holes;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setUvCoordinates(@Nullable ReadableArray uvCoordinates) {
        ViroLog.debug(TAG, "Setting UV coordinates: " + uvCoordinates);
        mUvCoordinates = uvCoordinates;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setNormals(@Nullable ReadableArray normals) {
        ViroLog.debug(TAG, "Setting normals: " + normals);
        mNormals = normals;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setColors(@Nullable ReadableArray colors) {
        ViroLog.debug(TAG, "Setting colors: " + colors);
        mColors = colors;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setIndices(@Nullable ReadableArray indices) {
        ViroLog.debug(TAG, "Setting indices: " + indices);
        mIndices = indices;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // Polygon specific setters
    
    public void setThickness(float thickness) {
        ViroLog.debug(TAG, "Setting thickness: " + thickness);
        mThickness = Math.max(0.0f, thickness);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setFacesOutward(boolean facesOutward) {
        ViroLog.debug(TAG, "Setting faces outward: " + facesOutward);
        mFacesOutward = facesOutward;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setWindingOrder(@Nullable String windingOrder) {
        ViroLog.debug(TAG, "Setting winding order: " + windingOrder);
        mWindingOrder = windingOrder != null ? windingOrder : "CounterClockwise";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // Tessellation setters
    
    public void setTessellationFactor(int tessellationFactor) {
        ViroLog.debug(TAG, "Setting tessellation factor: " + tessellationFactor);
        mTessellationFactor = Math.max(1, Math.min(16, tessellationFactor));
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setTessellationMode(@Nullable String tessellationMode) {
        ViroLog.debug(TAG, "Setting tessellation mode: " + tessellationMode);
        mTessellationMode = tessellationMode != null ? tessellationMode : "uniform";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setTessellationTolerance(float tolerance) {
        ViroLog.debug(TAG, "Setting tessellation tolerance: " + tolerance);
        mTessellationTolerance = Math.max(0.01f, Math.min(1.0f, tolerance));
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // Extrusion setters
    
    public void setExtruded(boolean extruded) {
        ViroLog.debug(TAG, "Setting extruded: " + extruded);
        mExtruded = extruded;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setExtrusionDepth(float depth) {
        ViroLog.debug(TAG, "Setting extrusion depth: " + depth);
        mExtrusionDepth = Math.max(0.1f, depth);
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setCapEnds(boolean capEnds) {
        ViroLog.debug(TAG, "Setting cap ends: " + capEnds);
        mCapEnds = capEnds;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setSmoothNormals(boolean smoothNormals) {
        ViroLog.debug(TAG, "Setting smooth normals: " + smoothNormals);
        mSmoothNormals = smoothNormals;
        mGeometryDirty = true;
        updateGeometry();
    }
    
    // UV mapping setters
    
    public void setUvMapping(@Nullable String uvMapping) {
        ViroLog.debug(TAG, "Setting UV mapping: " + uvMapping);
        mUvMapping = uvMapping != null ? uvMapping : "planar";
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setUvScale(@Nullable ReadableArray uvScale) {
        ViroLog.debug(TAG, "Setting UV scale: " + uvScale);
        
        if (uvScale != null && uvScale.size() >= 2) {
            try {
                float u = (float) uvScale.getDouble(0);
                float v = (float) uvScale.getDouble(1);
                mUvScale = new Vector(u, v, 1.0f);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing UV scale: " + e.getMessage());
                mUvScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mUvScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        mGeometryDirty = true;
        updateGeometry();
    }
    
    public void setUvOffset(@Nullable ReadableArray uvOffset) {
        ViroLog.debug(TAG, "Setting UV offset: " + uvOffset);
        
        if (uvOffset != null && uvOffset.size() >= 2) {
            try {
                float u = (float) uvOffset.getDouble(0);
                float v = (float) uvOffset.getDouble(1);
                mUvOffset = new Vector(u, v, 0.0f);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing UV offset: " + e.getMessage());
                mUvOffset = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mUvOffset = new Vector(0.0f, 0.0f, 0.0f);
        }
        
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
    
    // ViroReact-specific methods
    
    private void applyPolygonProperties() {
        if (mPolygonJni != null) {
            ViroLog.debug(TAG, "Applying polygon properties to ViroReact Polygon");
            
            // Apply polygon-specific properties
            mPolygonJni.setFacesOutward(mFacesOutward);
            mPolygonJni.setThickness(mThickness);
            
            // Apply tessellation properties
            mPolygonJni.setTessellationFactor(mTessellationFactor);
            
            // Apply extrusion properties if enabled
            if (mExtruded) {
                mPolygonJni.setExtruded(true);
                mPolygonJni.setExtrusionDepth(mExtrusionDepth);
                mPolygonJni.setCapEnds(mCapEnds);
                mPolygonJni.setSmoothNormals(mSmoothNormals);
            }
            
            ViroLog.debug(TAG, "Polygon properties applied successfully");
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
        if (mGeometryDirty && mPolygonJni != null) {
            ViroLog.debug(TAG, "Updating polygon geometry");
            
            if (mVertices != null) {
                // Convert vertices to native format
                List<Vector> vertices = convertVerticesArray(mVertices);
                if (!vertices.isEmpty()) {
                    mPolygonJni.setVertices(vertices);
                    
                    // Set holes if provided
                    if (mHoles != null) {
                        List<List<Vector>> holes = convertHolesArray(mHoles);
                        mPolygonJni.setHoles(holes);
                    }
                    
                    // Set UV coordinates if provided
                    if (mUvCoordinates != null) {
                        List<Vector> uvs = convertUVArray(mUvCoordinates);
                        mPolygonJni.setUVCoordinates(uvs);
                    } else {
                        // Generate UV coordinates based on mapping mode
                        generateUVCoordinates();
                    }
                    
                    // Set normals if provided
                    if (mNormals != null) {
                        List<Vector> normals = convertNormalsArray(mNormals);
                        mPolygonJni.setNormals(normals);
                    }
                    
                    // Set vertex colors if provided
                    if (mColors != null) {
                        List<Integer> colors = convertColorsArray(mColors);
                        mPolygonJni.setVertexColors(colors);
                    }
                    
                    // Set indices if provided
                    if (mIndices != null) {
                        List<Integer> indices = convertIndicesArray(mIndices);
                        mPolygonJni.setTriangleIndices(indices);
                    }
                    
                    // Apply polygon properties
                    applyPolygonProperties();
                    
                    mGeometryDirty = false;
                    ViroLog.debug(TAG, "Polygon geometry updated successfully");
                }
            }
        }
    }
    
    private void updateMaterials() {
        if (mMaterialsDirty && mPolygonJni != null) {
            ViroLog.debug(TAG, "Updating polygon materials");
            
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
            
            // Apply materials to polygon
            mPolygonJni.setMaterials(mMaterialsJni);
            
            mMaterialsDirty = false;
            ViroLog.debug(TAG, "Polygon materials updated successfully");
        }
    }
    
    // Helper methods for array conversion
    
    private List<Vector> convertVerticesArray(ReadableArray vertices) {
        List<Vector> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < vertices.size(); i++) {
                ReadableArray vertex = vertices.getArray(i);
                if (vertex != null && vertex.size() >= 2) {
                    float x = (float) vertex.getDouble(0);
                    float y = (float) vertex.getDouble(1);
                    float z = vertex.size() > 2 ? (float) vertex.getDouble(2) : 0.0f;
                    result.add(new Vector(x, y, z));
                }
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting vertices array: " + e.getMessage());
        }
        
        return result;
    }
    
    private List<List<Vector>> convertHolesArray(ReadableArray holes) {
        List<List<Vector>> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < holes.size(); i++) {
                ReadableArray hole = holes.getArray(i);
                if (hole != null) {
                    List<Vector> holeVertices = convertVerticesArray(hole);
                    if (!holeVertices.isEmpty()) {
                        result.add(holeVertices);
                    }
                }
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting holes array: " + e.getMessage());
        }
        
        return result;
    }
    
    private List<Vector> convertUVArray(ReadableArray uvCoordinates) {
        List<Vector> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < uvCoordinates.size(); i++) {
                ReadableArray uv = uvCoordinates.getArray(i);
                if (uv != null && uv.size() >= 2) {
                    float u = (float) uv.getDouble(0);
                    float v = (float) uv.getDouble(1);
                    result.add(new Vector(u, v, 0.0f));
                }
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting UV coordinates array: " + e.getMessage());
        }
        
        return result;
    }
    
    private List<Vector> convertNormalsArray(ReadableArray normals) {
        List<Vector> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < normals.size(); i++) {
                ReadableArray normal = normals.getArray(i);
                if (normal != null && normal.size() >= 3) {
                    float x = (float) normal.getDouble(0);
                    float y = (float) normal.getDouble(1);
                    float z = (float) normal.getDouble(2);
                    result.add(new Vector(x, y, z));
                }
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting normals array: " + e.getMessage());
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
    
    private List<Integer> convertIndicesArray(ReadableArray indices) {
        List<Integer> result = new ArrayList<>();
        
        try {
            for (int i = 0; i < indices.size(); i++) {
                int index = indices.getInt(i);
                result.add(index);
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error converting indices array: " + e.getMessage());
        }
        
        return result;
    }
    
    private void generateUVCoordinates() {
        if (mPolygonJni != null) {
            ViroLog.debug(TAG, "Generating UV coordinates with mapping: " + mUvMapping);
            
            switch (mUvMapping) {
                case "planar":
                    mPolygonJni.generatePlanarUVs(mUvScale, mUvOffset);
                    break;
                case "cylindrical":
                    mPolygonJni.generateCylindricalUVs(mUvScale, mUvOffset);
                    break;
                case "spherical":
                    mPolygonJni.generateSphericalUVs(mUvScale, mUvOffset);
                    break;
                case "custom":
                default:
                    // UV coordinates should be provided manually for custom mapping
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
        
        return material;
    }
    
    /**
     * Emit polygon events for ViroReact integration
     */
    public void emitPolygonEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact polygon resources
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
        
        if (mPolygonJni != null) {
            mPolygonJni.dispose();
            mPolygonJni = null;
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
        mVertices = null;
        mHoles = null;
        mUvCoordinates = null;
        mNormals = null;
        mColors = null;
        mIndices = null;
        mMaterials = null;
        mMaterial = null;
        mPhysicsBody = null;
        mAnimation = null;
        mTransformBehaviors = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroPolygonView attached to window");
        
        // Polygon will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mPolygonJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact polygon ready for scene attachment");
        }
        
        // Ensure polygon properties are applied
        applyPolygonProperties();
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
        ViroLog.debug(TAG, "ViroPolygonView detached from window");
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public ReadableArray getVertices() { return mVertices; }
    public ReadableArray getHoles() { return mHoles; }
    public ReadableArray getUvCoordinates() { return mUvCoordinates; }
    public ReadableArray getNormals() { return mNormals; }
    public ReadableArray getColors() { return mColors; }
    public ReadableArray getIndices() { return mIndices; }
    public float getThickness() { return mThickness; }
    public boolean isFacesOutward() { return mFacesOutward; }
    public String getWindingOrder() { return mWindingOrder; }
    public int getTessellationFactor() { return mTessellationFactor; }
    public String getTessellationMode() { return mTessellationMode; }
    public float getTessellationTolerance() { return mTessellationTolerance; }
    public boolean isExtruded() { return mExtruded; }
    public float getExtrusionDepth() { return mExtrusionDepth; }
    public boolean isCapEnds() { return mCapEnds; }
    public boolean isSmoothNormals() { return mSmoothNormals; }
    public String getUvMapping() { return mUvMapping; }
    public Vector getUvScale() { return mUvScale; }
    public Vector getUvOffset() { return mUvOffset; }
    public Vector getPosition() { return mPosition; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public boolean isVisible() { return mVisible; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public int getLightReceivingBitMask() { return mLightReceivingBitMask; }
    public int getShadowCastingBitMask() { return mShadowCastingBitMask; }
    public boolean isGeometryDirty() { return mGeometryDirty; }
    public boolean isMaterialsDirty() { return mMaterialsDirty; }
}