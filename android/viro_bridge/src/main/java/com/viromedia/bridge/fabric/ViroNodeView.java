package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.Node;
import com.viro.core.PhysicsBody;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.Helper;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroNode component.
 * ViroNode is the base container for all 3D objects in ViroReact.
 */
public class ViroNodeView extends ViewGroup {
    
    private static final String TAG = "ViroNodeView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Transform properties
    private float[] mPosition = {0f, 0f, 0f};
    private float[] mScale = {1f, 1f, 1f};
    private float[] mRotation = {0f, 0f, 0f};
    private float[] mRotationPivot;
    private float[] mScalePivot;
    private List<String> mTransformBehaviors;
    
    // Visibility and interaction
    private boolean mVisible = true;
    private float mOpacity = 1.0f;
    private int mRenderingOrder = 0;
    private boolean mIgnoreEventHandling = false;
    private String mDragType;
    
    // Physics and animation
    private Map<String, Object> mPhysicsBody;
    private boolean mHighAccuracyEvents = false;
    private Map<String, Object> mAnimation;
    
    public ViroNodeView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroNodeView with ViroReact Node integration");
        
        // Create ViroReact Node
        mNodeJni = createNodeJni();
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        
        // Node views are typically transparent containers for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Node initialized successfully");
    }
    
    /**
     * Creates a ViroReact Node object. Child classes can override to provide their own Node.
     */
    protected Node createNodeJni() {
        return new Node();
    }
    
    /**
     * Get the underlying ViroReact Node object
     */
    public Node getNodeJni() {
        return mNodeJni;
    }
    
    /**
     * Set the ViroContext for this node
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    /**
     * Wrapper class to make ViroNodeView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroNodeView> mNodeView;
        
        public VRTComponentWrapper(ViroNodeView nodeView) {
            super(nodeView.getContext(), null, -1, -1, nodeView.mReactContext);
            mNodeView = new WeakReference<>(nodeView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroNodeView nodeView = mNodeView.get();
            if (nodeView != null) {
                nodeView.emitNodeEvent(eventName, eventData);
            }
        }
    }
    
    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        // Layout child views (other 3D nodes/objects)
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + l + "," + t + "," + r + "," + b + "]");
        
        // For 3D nodes, positioning is handled by 3D transforms, not 2D layout
        for (int i = 0; i < getChildCount(); i++) {
            getChildAt(i).layout(0, 0, r - l, b - t);
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        
        // Measure child views
        for (int i = 0; i < getChildCount(); i++) {
            measureChild(getChildAt(i), widthMeasureSpec, heightMeasureSpec);
        }
    }
    
    // Transform setters
    
    public void setPosition(@Nullable ReadableArray position) {
        if (position != null && position.size() >= 3) {
            mPosition[0] = (float) position.getDouble(0);
            mPosition[1] = (float) position.getDouble(1);
            mPosition[2] = (float) position.getDouble(2);
        } else {
            mPosition[0] = 0f;
            mPosition[1] = 0f;
            mPosition[2] = 0f;
        }
        Log.d(TAG, "Setting position: [" + mPosition[0] + ", " + mPosition[1] + ", " + mPosition[2] + "]");
        
        if (mNodeJni != null) {
            mNodeJni.setPosition(new Vector(mPosition));
        }
    }
    
    public void setScale(@Nullable ReadableArray scale) {
        if (scale != null && scale.size() >= 3) {
            mScale[0] = (float) scale.getDouble(0);
            mScale[1] = (float) scale.getDouble(1);
            mScale[2] = (float) scale.getDouble(2);
        } else {
            mScale[0] = 1f;
            mScale[1] = 1f;
            mScale[2] = 1f;
        }
        Log.d(TAG, "Setting scale: [" + mScale[0] + ", " + mScale[1] + ", " + mScale[2] + "]");
        
        if (mNodeJni != null) {
            mNodeJni.setScale(new Vector(mScale));
        }
    }
    
    public void setRotation(@Nullable ReadableArray rotation) {
        if (rotation != null && rotation.size() >= 3) {
            mRotation[0] = (float) rotation.getDouble(0);
            mRotation[1] = (float) rotation.getDouble(1);
            mRotation[2] = (float) rotation.getDouble(2);
        } else {
            mRotation[0] = 0f;
            mRotation[1] = 0f;
            mRotation[2] = 0f;
        }
        Log.d(TAG, "Setting rotation: [" + mRotation[0] + ", " + mRotation[1] + ", " + mRotation[2] + "]");
        
        if (mNodeJni != null) {
            mNodeJni.setRotation(Helper.toRadiansVector(mRotation));
        }
    }
    
    public void setRotationPivot(@Nullable ReadableArray rotationPivot) {
        if (rotationPivot != null && rotationPivot.size() >= 3) {
            mRotationPivot = new float[3];
            mRotationPivot[0] = (float) rotationPivot.getDouble(0);
            mRotationPivot[1] = (float) rotationPivot.getDouble(1);
            mRotationPivot[2] = (float) rotationPivot.getDouble(2);
        } else {
            mRotationPivot = null;
        }
        Log.d(TAG, "Setting rotation pivot: " + (mRotationPivot != null ? 
            "[" + mRotationPivot[0] + ", " + mRotationPivot[1] + ", " + mRotationPivot[2] + "]" : "null"));
        
        if (mNodeJni != null && mRotationPivot != null) {
            mNodeJni.setRotationPivot(new Vector(mRotationPivot));
        }
    }
    
    public void setScalePivot(@Nullable ReadableArray scalePivot) {
        if (scalePivot != null && scalePivot.size() >= 3) {
            mScalePivot = new float[3];
            mScalePivot[0] = (float) scalePivot.getDouble(0);
            mScalePivot[1] = (float) scalePivot.getDouble(1);
            mScalePivot[2] = (float) scalePivot.getDouble(2);
        } else {
            mScalePivot = null;
        }
        Log.d(TAG, "Setting scale pivot: " + (mScalePivot != null ? 
            "[" + mScalePivot[0] + ", " + mScalePivot[1] + ", " + mScalePivot[2] + "]" : "null"));
        
        if (mNodeJni != null && mScalePivot != null) {
            mNodeJni.setScalePivot(new Vector(mScalePivot));
        }
    }
    
    public void setTransformBehaviors(@Nullable ReadableArray transformBehaviors) {
        if (transformBehaviors != null) {
            mTransformBehaviors = new ArrayList<>();
            for (int i = 0; i < transformBehaviors.size(); i++) {
                mTransformBehaviors.add(transformBehaviors.getString(i));
            }
        } else {
            mTransformBehaviors = null;
        }
        Log.d(TAG, "Setting transform behaviors: " + mTransformBehaviors);
        
        if (mNodeJni != null && mTransformBehaviors != null) {
            EnumSet<Node.TransformBehavior> behaviors = EnumSet.noneOf(Node.TransformBehavior.class);
            for (String behavior : mTransformBehaviors) {
                if (behavior.equalsIgnoreCase("billboard")) {
                    behaviors.add(Node.TransformBehavior.BILLBOARD);
                } else if (behavior.equalsIgnoreCase("billboardX")) {
                    behaviors.add(Node.TransformBehavior.BILLBOARD_X);
                } else if (behavior.equalsIgnoreCase("billboardY")) {
                    behaviors.add(Node.TransformBehavior.BILLBOARD_Y);
                }
            }
            mNodeJni.setTransformBehaviors(behaviors);
        }
    }
    
    // Visibility and interaction setters
    
    public void setVisible(boolean visible) {
        Log.d(TAG, "Setting visible: " + visible);
        mVisible = visible;
        
        if (mNodeJni != null) {
            mNodeJni.setVisible(visible);
        }
        setVisibility(visible ? VISIBLE : INVISIBLE);
    }
    
    public void setOpacity(float opacity) {
        Log.d(TAG, "Setting opacity: " + opacity);
        mOpacity = opacity;
        
        if (mNodeJni != null) {
            mNodeJni.setOpacity(opacity);
        }
        setAlpha(opacity);
    }
    
    public void setRenderingOrder(int renderingOrder) {
        Log.d(TAG, "Setting rendering order: " + renderingOrder);
        mRenderingOrder = renderingOrder;
        
        if (mNodeJni != null) {
            mNodeJni.setRenderingOrder(renderingOrder);
        }
    }
    
    public void setIgnoreEventHandling(boolean ignoreEventHandling) {
        Log.d(TAG, "Setting ignore event handling: " + ignoreEventHandling);
        mIgnoreEventHandling = ignoreEventHandling;
        
        if (mNodeJni != null) {
            mNodeJni.setIgnoreEventHandling(ignoreEventHandling);
        }
    }
    
    public void setDragType(@Nullable String dragType) {
        Log.d(TAG, "Setting drag type: " + dragType);
        mDragType = dragType;
        
        if (mNodeJni != null && dragType != null) {
            mNodeJni.setDragType(Node.DragType.valueFromString(dragType));
        }
    }
    
    // Physics and animation setters
    
    public void setPhysicsBody(@Nullable ReadableMap physicsBody) {
        Log.d(TAG, "Setting physics body: " + physicsBody);
        mPhysicsBody = physicsBody != null ? physicsBody.toHashMap() : null;
        
        if (mNodeJni != null && mPhysicsBody != null) {
            PhysicsBody body = new PhysicsBody();
            
            // Set physics body type
            Object typeObj = mPhysicsBody.get("type");
            if (typeObj instanceof String) {
                String type = (String) typeObj;
                if (type.equalsIgnoreCase("dynamic")) {
                    body.setType(PhysicsBody.RigidBodyType.DYNAMIC);
                } else if (type.equalsIgnoreCase("kinematic")) {
                    body.setType(PhysicsBody.RigidBodyType.KINEMATIC);
                } else if (type.equalsIgnoreCase("static")) {
                    body.setType(PhysicsBody.RigidBodyType.STATIC);
                }
            }
            
            // Set mass
            Object massObj = mPhysicsBody.get("mass");
            if (massObj instanceof Number) {
                body.setMass(((Number) massObj).floatValue());
            }
            
            // Set restitution (bounciness)
            Object restitutionObj = mPhysicsBody.get("restitution");
            if (restitutionObj instanceof Number) {
                body.setRestitution(((Number) restitutionObj).floatValue());
            }
            
            // Set friction
            Object frictionObj = mPhysicsBody.get("friction");
            if (frictionObj instanceof Number) {
                body.setFriction(((Number) frictionObj).floatValue());
            }
            
            mNodeJni.setPhysicsBody(body);
        } else if (mNodeJni != null && mPhysicsBody == null) {
            // Remove physics body
            mNodeJni.setPhysicsBody(null);
        }
    }
    
    public void setHighAccuracyEvents(boolean highAccuracyEvents) {
        Log.d(TAG, "Setting high accuracy events: " + highAccuracyEvents);
        mHighAccuracyEvents = highAccuracyEvents;
        
        if (mNodeJni != null) {
            mNodeJni.setHighAccuracyEvents(highAccuracyEvents);
        }
    }
    
    public void setAnimation(@Nullable ReadableMap animation) {
        Log.d(TAG, "Setting animation: " + animation);
        mAnimation = animation != null ? animation.toHashMap() : null;
        
        if (mNodeJni != null && mAnimation != null) {
            // Animation implementation would depend on the specific animation format
            // For now, we store the configuration for future use
            Log.d(TAG, "Animation configuration stored for node: " + mAnimation);
        }
    }
    
    // Event emission
    
    public void emitClickEvent(Map<String, Object> clickInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("clickInfo", Arguments.makeNativeMap(clickInfo));
        emitNodeEvent("onClick", event);
    }
    
    public void emitHoverEvent(Map<String, Object> hoverInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("hoverInfo", Arguments.makeNativeMap(hoverInfo));
        emitNodeEvent("onHover", event);
    }
    
    public void emitDragEvent(Map<String, Object> dragInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("dragInfo", Arguments.makeNativeMap(dragInfo));
        emitNodeEvent("onDrag", event);
    }
    
    public void emitTransformUpdateEvent(Map<String, Object> transformInfo) {
        WritableMap event = Arguments.createMap();
        event.putMap("transformInfo", Arguments.makeNativeMap(transformInfo));
        emitNodeEvent("onTransformUpdate", event);
    }
    
    private void emitNodeEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact node resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mTransformBehaviors = null;
        mPhysicsBody = null;
        mAnimation = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroNodeView attached to window");
        
        // Node will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact node ready for scene attachment");
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroNodeView detached from window");
        
        // Node cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}