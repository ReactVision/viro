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

import com.viro.core.EventDelegate;
import com.viro.core.Geometry;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Sphere;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroSphere component.
 * ViroSphere represents a 3D sphere geometry primitive.
 */
public class ViroSphereView extends View {
    
    private static final String TAG = "ViroSphereView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Sphere mSphereGeometry;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Sphere geometry properties
    private float mRadius = 1.0f;
    private int mWidthSegmentCount = 20;
    private int mHeightSegmentCount = 20;
    private float mPhiStart = 0.0f;
    private float mPhiLength = (float)(2 * Math.PI); // Full circle
    private float mThetaStart = 0.0f;
    private float mThetaLength = (float)Math.PI; // Half circle (full sphere)
    
    // Material properties
    private List<String> mMaterials;
    
    public ViroSphereView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroSphereView with ViroReact Sphere integration");
        
        // Create ViroReact Node for the sphere
        mNodeJni = new Node();
        
        // Create Sphere geometry with initial parameters
        mSphereGeometry = new Sphere(mRadius, mWidthSegmentCount, mHeightSegmentCount, 
                                   mPhiStart, mPhiLength, mThetaStart, mThetaLength);
        
        // Attach geometry to node
        mNodeJni.setGeometry(mSphereGeometry);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Sphere views are typically transparent since they represent 3D geometry
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Sphere initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroSphereView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroSphereView> mSphereView;
        
        public VRTComponentWrapper(ViroSphereView sphereView) {
            super(sphereView.getContext(), null, -1, -1, sphereView.mReactContext);
            mSphereView = new WeakReference<>(sphereView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroSphereView sphereView = mSphereView.get();
            if (sphereView != null) {
                sphereView.emitSphereEvent(eventName, eventData);
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
     * Set the ViroContext for this sphere
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For 3D geometry, we don't use traditional Android view measurements
        // The size is determined by the 3D sphere radius and geometry parameters
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D transforms and sphere parameters, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Sphere geometry setters
    
    public void setRadius(float radius) {
        Log.d(TAG, "Setting sphere radius: " + radius);
        mRadius = radius;
        updateSphereGeometry();
    }
    
    public void setWidthSegmentCount(int widthSegmentCount) {
        Log.d(TAG, "Setting width segment count: " + widthSegmentCount);
        mWidthSegmentCount = widthSegmentCount;
        updateSphereGeometry();
    }
    
    public void setHeightSegmentCount(int heightSegmentCount) {
        Log.d(TAG, "Setting height segment count: " + heightSegmentCount);
        mHeightSegmentCount = heightSegmentCount;
        updateSphereGeometry();
    }
    
    public void setPhiStart(float phiStart) {
        Log.d(TAG, "Setting phi start: " + phiStart);
        mPhiStart = phiStart;
        updateSphereGeometry();
    }
    
    public void setPhiLength(float phiLength) {
        Log.d(TAG, "Setting phi length: " + phiLength);
        mPhiLength = phiLength;
        updateSphereGeometry();
    }
    
    public void setThetaStart(float thetaStart) {
        Log.d(TAG, "Setting theta start: " + thetaStart);
        mThetaStart = thetaStart;
        updateSphereGeometry();
    }
    
    public void setThetaLength(float thetaLength) {
        Log.d(TAG, "Setting theta length: " + thetaLength);
        mThetaLength = thetaLength;
        updateSphereGeometry();
    }
    
    private void updateSphereGeometry() {
        Log.d(TAG, "Updating sphere geometry: radius=" + mRadius + 
                   ", segments=" + mWidthSegmentCount + "x" + mHeightSegmentCount + 
                   ", phi=[" + mPhiStart + "," + mPhiLength + "]" +
                   ", theta=[" + mThetaStart + "," + mThetaLength + "]");
        
        if (mSphereGeometry != null) {
            // Create new sphere geometry with updated parameters
            mSphereGeometry = new Sphere(mRadius, mWidthSegmentCount, mHeightSegmentCount, 
                                       mPhiStart, mPhiLength, mThetaStart, mThetaLength);
            
            // Update the node's geometry
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mSphereGeometry);
            }
        }
    }
    
    // Material setters
    
    public void setMaterials(@Nullable ReadableArray materials) {
        if (materials != null) {
            mMaterials = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                String material = materials.getString(i);
                if (material != null) {
                    mMaterials.add(material);
                }
            }
        } else {
            mMaterials = null;
        }
        
        Log.d(TAG, "Setting materials: " + mMaterials);
        
        if (mSphereGeometry != null && mMaterials != null && mMaterials.size() > 0) {
            List<Material> materialList = new ArrayList<>();
            
            // Convert material names to Material objects
            for (String materialName : mMaterials) {
                // TODO: Look up material by name from MaterialManager
                // For now, create a basic material
                Material material = new Material();
                // Apply material properties based on materialName
                materialList.add(material);
            }
            
            // Apply material to the sphere geometry
            // Spheres typically use a single material for the entire surface
            if (materialList.size() > 0) {
                mSphereGeometry.setMaterial(materialList.get(0));
            }
        }
    }
    
    // Event emission (inherited from ViroNode behavior)
    
    public void emitClickEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroSphere");
        event.putArray("position", Arguments.fromArray(new float[]{0f, 0f, 0f})); // TODO: Get actual click position
        emitSphereEvent("onClick", event);
    }
    
    public void emitHoverEvent(boolean isHovering) {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroSphere");
        event.putBoolean("isHovering", isHovering);
        emitSphereEvent("onHover", event);
    }
    
    private void emitSphereEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact sphere resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mSphereGeometry != null) {
            mSphereGeometry.dispose();
            mSphereGeometry = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mMaterials = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroSphereView attached to window");
        
        // Sphere will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact sphere ready for scene attachment");
        }
        updateSphereGeometry();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroSphereView detached from window");
        
        // Sphere cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}