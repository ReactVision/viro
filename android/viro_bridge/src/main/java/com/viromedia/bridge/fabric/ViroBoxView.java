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

import com.viro.core.Box;
import com.viro.core.EventDelegate;
import com.viro.core.Geometry;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroBox component.
 * ViroBox represents a 3D box geometry primitive.
 */
public class ViroBoxView extends View {
    
    private static final String TAG = "ViroBoxView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Box mBoxGeometry;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Box geometry properties
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    private float mLength = 1.0f;
    
    // Material properties
    private List<String> mMaterials;
    
    public ViroBoxView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroBoxView with ViroReact Box integration");
        
        // Create ViroReact Node for the box
        mNodeJni = new Node();
        
        // Create Box geometry
        mBoxGeometry = new Box(mWidth, mHeight, mLength);
        
        // Attach geometry to node
        mNodeJni.setGeometry(mBoxGeometry);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Box views are typically transparent since they represent 3D geometry
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Box initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroBoxView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroBoxView> mBoxView;
        
        public VRTComponentWrapper(ViroBoxView boxView) {
            super(boxView.getContext(), null, -1, -1, boxView.mReactContext);
            mBoxView = new WeakReference<>(boxView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroBoxView boxView = mBoxView.get();
            if (boxView != null) {
                boxView.emitBoxEvent(eventName, eventData);
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
     * Set the ViroContext for this box
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For 3D geometry, we don't use traditional Android view measurements
        // The size is determined by the 3D geometry properties (width, height, length)
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D transforms, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Box geometry setters
    
    public void setBoxWidth(float width) {
        Log.d(TAG, "Setting box width: " + width);
        mWidth = width;
        updateBoxGeometry();
    }
    
    public void setBoxHeight(float height) {
        Log.d(TAG, "Setting box height: " + height);
        mHeight = height;
        updateBoxGeometry();
    }
    
    public void setBoxLength(float length) {
        Log.d(TAG, "Setting box length: " + length);
        mLength = length;
        updateBoxGeometry();
    }
    
    private void updateBoxGeometry() {
        Log.d(TAG, "Updating box geometry: " + mWidth + " x " + mHeight + " x " + mLength);
        
        if (mBoxGeometry != null) {
            // Create new box geometry with updated dimensions
            mBoxGeometry = new Box(mWidth, mHeight, mLength);
            
            // Update the node's geometry
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mBoxGeometry);
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
        
        if (mBoxGeometry != null && mMaterials != null) {
            List<Material> materialList = new ArrayList<>();
            
            // Convert material names to Material objects
            for (String materialName : mMaterials) {
                // TODO: Look up material by name from MaterialManager
                // For now, create a basic material
                Material material = new Material();
                // Apply material properties based on materialName
                materialList.add(material);
            }
            
            // Apply materials to the box geometry
            if (materialList.size() == 1) {
                // Single material applies to all faces
                Material[] materials = new Material[6];
                for (int i = 0; i < 6; i++) {
                    materials[i] = materialList.get(0);
                }
                mBoxGeometry.setMaterials(materials);
            } else if (materialList.size() == 6) {
                // Six materials apply to individual faces: [front, right, back, left, top, bottom]
                mBoxGeometry.setMaterials(materialList.toArray(new Material[0]));
            } else if (materialList.size() > 0) {
                // Use first material for all faces if count doesn't match
                Material[] materials = new Material[6];
                for (int i = 0; i < 6; i++) {
                    materials[i] = materialList.get(0);
                }
                mBoxGeometry.setMaterials(materials);
            }
        }
    }
    
    // Event emission (inherited from ViroNode behavior)
    
    public void emitClickEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroBox");
        event.putArray("position", Arguments.fromArray(new float[]{0f, 0f, 0f})); // TODO: Get actual click position
        emitBoxEvent("onClick", event);
    }
    
    public void emitHoverEvent(boolean isHovering) {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroBox");
        event.putBoolean("isHovering", isHovering);
        emitBoxEvent("onHover", event);
    }
    
    private void emitBoxEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact box resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mBoxGeometry != null) {
            mBoxGeometry.dispose();
            mBoxGeometry = null;
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
        Log.d(TAG, "ViroBoxView attached to window");
        
        // Box will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact box ready for scene attachment");
        }
        updateBoxGeometry();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroBoxView detached from window");
        
        // Box cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}