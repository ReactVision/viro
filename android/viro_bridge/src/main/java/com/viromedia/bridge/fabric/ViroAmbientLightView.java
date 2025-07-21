package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.AmbientLight;
import com.viro.core.EventDelegate;
import com.viro.core.Light;
import com.viro.core.Node;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroAmbientLight component.
 * ViroAmbientLight represents global ambient lighting that uniformly 
 * illuminates all objects in the scene without direction or shadows.
 */
public class ViroAmbientLightView extends View {
    
    private static final String TAG = "ViroAmbientLightView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private AmbientLight mAmbientLightJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Light color and intensity properties
    private int mColor = 0xFFFFFFFF; // White light by default
    private float mIntensity = 300.0f; // Default ambient intensity (lower than directional)
    private float mTemperature = 6500.0f; // Default daylight temperature
    
    // Light influence
    private int mInfluenceBitMask = 1;
    
    public ViroAmbientLightView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroAmbientLightView with ViroReact AmbientLight integration");
        
        // Create ViroReact Node for the light
        mNodeJni = new Node();
        
        // Create AmbientLight with initial parameters
        mAmbientLightJni = new AmbientLight();
        
        // Configure initial light properties
        applyLightProperties();
        
        // Attach light to node
        mNodeJni.addLight(mAmbientLightJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Light views are typically transparent since they represent non-visible light sources
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact AmbientLight initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroAmbientLightView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroAmbientLightView> mLightView;
        
        public VRTComponentWrapper(ViroAmbientLightView lightView) {
            super(lightView.getContext(), null, -1, -1, lightView.mReactContext);
            mLightView = new WeakReference<>(lightView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroAmbientLightView lightView = mLightView.get();
            if (lightView != null) {
                lightView.emitLightEvent(eventName, eventData);
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
     * Get the underlying ViroReact AmbientLight object
     */
    public AmbientLight getAmbientLightJni() {
        return mAmbientLightJni;
    }
    
    /**
     * Set the ViroContext for this light
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For lights, we don't use traditional Android view measurements
        // The light effect is determined by 3D light properties, not 2D view size
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D light properties, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Light color and intensity setters
    
    public void setColor(@Nullable String colorString) {
        Log.d(TAG, "Setting ambient light color: " + colorString);
        
        if (colorString != null) {
            try {
                // Parse color string (hex format like "#FFFFFF" or named colors)
                if (colorString.startsWith("#")) {
                    mColor = android.graphics.Color.parseColor(colorString);
                } else {
                    // Handle named colors or other formats
                    mColor = android.graphics.Color.parseColor(colorString);
                }
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "Invalid color format: " + colorString + ", using white");
                mColor = 0xFFFFFFFF;
            }
        } else {
            mColor = 0xFFFFFFFF; // Default to white
        }
        
        applyLightProperties();
    }
    
    public void setIntensity(float intensity) {
        Log.d(TAG, "Setting ambient light intensity: " + intensity);
        mIntensity = Math.max(0.0f, intensity); // Ensure non-negative intensity
        applyLightProperties();
    }
    
    public void setTemperature(float temperature) {
        Log.d(TAG, "Setting ambient light temperature: " + temperature);
        mTemperature = Math.max(1000.0f, Math.min(12000.0f, temperature)); // Clamp to realistic range
        applyLightProperties();
    }
    
    // Light influence setters
    
    public void setInfluenceBitMask(int influenceBitMask) {
        Log.d(TAG, "Setting ambient light influence bit mask: " + influenceBitMask);
        mInfluenceBitMask = influenceBitMask;
        applyLightProperties();
    }
    
    private void applyLightProperties() {
        if (mAmbientLightJni != null) {
            Log.d(TAG, "Applying ambient light properties to ViroReact AmbientLight");
            
            // Apply color (convert Android Color to RGB components)
            float red = ((mColor >> 16) & 0xFF) / 255.0f;
            float green = ((mColor >> 8) & 0xFF) / 255.0f;
            float blue = (mColor & 0xFF) / 255.0f;
            
            // Set light color and intensity
            mAmbientLightJni.setColor(red, green, blue);
            mAmbientLightJni.setIntensity(mIntensity);
            mAmbientLightJni.setTemperature(mTemperature);
            
            // Set influence bit mask
            mAmbientLightJni.setInfluenceBitMask(mInfluenceBitMask);
            
            Log.d(TAG, "AmbientLight properties applied successfully");
        }
    }
    
    // Event emission
    
    private void emitLightEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact ambient light resources
        if (mNodeJni != null) {
            if (mAmbientLightJni != null) {
                mNodeJni.removeLight(mAmbientLightJni);
            }
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mAmbientLightJni != null) {
            mAmbientLightJni.dispose();
            mAmbientLightJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroAmbientLightView attached to window");
        
        // Light will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mAmbientLightJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact ambient light ready for scene attachment");
        }
        
        // Ensure light properties are applied
        applyLightProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroAmbientLightView detached from window");
        
        // Light cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}