//
//  ViroParticleEmitterView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.util.Log;
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
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.ParticleEmitter;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroParticleEmitter component.
 * ViroParticleEmitter provides advanced particle system functionality with comprehensive
 * emission control, physics simulation, and visual effects.
 */
public class ViroParticleEmitterView extends View {
    
    private static final String TAG = "ViroParticleEmitterView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private ParticleEmitter mParticleEmitterJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    // Particle emission properties
    private float mEmissionRate = 100.0f; // particles per second
    private int mBurstCount = 0;
    private float mDuration = 5.0f; // seconds
    private float mDelay = 0.0f; // seconds
    private boolean mLooping = true;
    private boolean mPrewarm = false;
    private int mMaxParticles = 1000;

    // Particle appearance properties
    private ReadableMap mImage;
    private float[] mColor = {1.0f, 1.0f, 1.0f}; // RGB
    private float[] mColorVariation = {0.0f, 0.0f, 0.0f}; // RGB
    private float mOpacity = 1.0f;
    private float mOpacityVariation = 0.0f;
    private float mSize = 1.0f;
    private float mSizeVariation = 0.0f;
    private float mRotation = 0.0f; // degrees
    private float mRotationVariation = 0.0f; // degrees

    // Particle physics properties
    private Vector mVelocity = new Vector(0.0f, 1.0f, 0.0f);
    private Vector mVelocityVariation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mAcceleration = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mGravity = new Vector(0.0f, -9.8f, 0.0f);
    private float mDamping = 0.0f;
    private float mAngularVelocity = 0.0f; // degrees per second
    private float mAngularAcceleration = 0.0f;

    // Particle lifecycle properties
    private float mLifetime = 3.0f; // seconds
    private float mLifetimeVariation = 0.0f;
    private float mStartSize = 1.0f;
    private float mEndSize = 1.0f;
    private float[] mStartColor = {1.0f, 1.0f, 1.0f};
    private float[] mEndColor = {1.0f, 1.0f, 1.0f};
    private float mStartOpacity = 1.0f;
    private float mEndOpacity = 0.0f;

    // Emission shape properties
    private String mEmissionShape = "point";
    private float mEmissionRadius = 1.0f;
    private float mEmissionAngle = 30.0f; // degrees
    private float mEmissionWidth = 1.0f;
    private float mEmissionHeight = 1.0f;
    private float mEmissionDepth = 1.0f;

    // Particle behavior properties
    private String mBlendMode = "alpha";
    private String mSortingMode = "distance";
    private String mAlignment = "billboard";
    private boolean mStretchWithVelocity = false;
    private String mSpawnBehavior = "continuous";
    private float mFixedTimeStep = 0.016f; // 60 FPS

    // Particle forces
    private List<ReadableMap> mAttractors;
    private List<ReadableMap> mRepulsors;
    private ReadableMap mTurbulence;
    private Vector mWind = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mMagneticField = new Vector(0.0f, 0.0f, 0.0f);

    // Transform properties
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotationVector = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);

    // Particle system state
    private boolean mIsPlaying = false;
    private boolean mIsPaused = false;

    public ViroParticleEmitterView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroParticleEmitterView initialized with ViroReact ParticleEmitter integration");
        
        // Initialize collections
        mAttractors = new ArrayList<>();
        mRepulsors = new ArrayList<>();
        
        initializeParticleEmitter();
    }

    private void initializeParticleEmitter() {
        Log.d(TAG, "Initializing ViroReact particle emitter with default properties");
        
        // Create ViroReact Node for the particle emitter
        mNodeJni = new Node();
        
        // Create ParticleEmitter with initial properties
        mParticleEmitterJni = new ParticleEmitter(mViroContext);
        
        // Configure initial particle properties
        applyParticleProperties();
        
        // Attach particle emitter to node
        mNodeJni.setGeometry(mParticleEmitterJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Particle emitters are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact ParticleEmitter initialized successfully");
    }

    /**
     * Wrapper class to make ViroParticleEmitterView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroParticleEmitterView> mParticleEmitterView;
        
        public VRTComponentWrapper(ViroParticleEmitterView particleEmitterView) {
            super(particleEmitterView.getContext(), null, -1, -1, particleEmitterView.mReactContext);
            mParticleEmitterView = new WeakReference<>(particleEmitterView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroParticleEmitterView particleEmitterView = mParticleEmitterView.get();
            if (particleEmitterView != null) {
                particleEmitterView.emitParticleEvent(eventName, eventData);
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
     * Get the underlying ViroReact ParticleEmitter object
     */
    public ParticleEmitter getParticleEmitterJni() {
        return mParticleEmitterJni;
    }
    
    /**
     * Set the ViroContext for this particle emitter
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate particle emitter with ViroContext if needed
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.dispose();
            mParticleEmitterJni = new ParticleEmitter(mViroContext);
            applyParticleProperties();
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mParticleEmitterJni);
            }
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // Particle emitters don't have traditional dimensions
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Particle layout is handled by 3D transforms and emission shapes
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Particle Emission Properties
    public void setEmissionRate(float emissionRate) {
        Log.d(TAG, "Setting emission rate: " + emissionRate);
        mEmissionRate = emissionRate;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setEmissionRate(emissionRate);
        }
    }

    public void setBurstCount(int burstCount) {
        Log.d(TAG, "Setting burst count: " + burstCount);
        mBurstCount = burstCount;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setBurstCount(burstCount);
        }
    }

    public void setDuration(float duration) {
        Log.d(TAG, "Setting duration: " + duration);
        mDuration = duration;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setDuration(duration);
        }
    }

    public void setDelay(float delay) {
        Log.d(TAG, "Setting delay: " + delay);
        mDelay = delay;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setDelay(delay);
        }
    }

    public void setLooping(boolean looping) {
        Log.d(TAG, "Setting looping: " + looping);
        mLooping = looping;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setLooping(looping);
        }
    }

    public void setMaxParticles(int maxParticles) {
        Log.d(TAG, "Setting max particles: " + maxParticles);
        mMaxParticles = maxParticles;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setMaxParticles(maxParticles);
        }
    }

    // Particle Appearance Properties
    public void setParticleImage(@Nullable ReadableMap image) {
        Log.d(TAG, "Setting particle image: " + image);
        mImage = image;
        
        // TODO: Load texture from image map and apply to particle emitter
        applyParticleAppearance();
    }

    public void setParticleColor(@Nullable ReadableArray color) {
        Log.d(TAG, "Setting particle color: " + color);
        
        if (color != null && color.size() >= 3) {
            try {
                mColor[0] = (float) color.getDouble(0);
                mColor[1] = (float) color.getDouble(1);
                mColor[2] = (float) color.getDouble(2);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing color: " + e.getMessage());
                mColor = new float[]{1.0f, 1.0f, 1.0f};
            }
        }
        
        applyParticleAppearance();
    }

    public void setParticleSize(float size) {
        Log.d(TAG, "Setting particle size: " + size);
        mSize = size;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setParticleSize(size);
        }
    }

    public void setParticleOpacity(float opacity) {
        Log.d(TAG, "Setting particle opacity: " + opacity);
        mOpacity = opacity;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setParticleOpacity(opacity);
        }
    }

    // Particle Physics Properties
    public void setVelocity(@Nullable ReadableArray velocity) {
        Log.d(TAG, "Setting velocity: " + velocity);
        
        if (velocity != null && velocity.size() >= 3) {
            try {
                float x = (float) velocity.getDouble(0);
                float y = (float) velocity.getDouble(1);
                float z = (float) velocity.getDouble(2);
                mVelocity = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing velocity: " + e.getMessage());
                mVelocity = new Vector(0.0f, 1.0f, 0.0f);
            }
        }
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setVelocity(mVelocity);
        }
    }

    public void setAcceleration(@Nullable ReadableArray acceleration) {
        Log.d(TAG, "Setting acceleration: " + acceleration);
        
        if (acceleration != null && acceleration.size() >= 3) {
            try {
                float x = (float) acceleration.getDouble(0);
                float y = (float) acceleration.getDouble(1);
                float z = (float) acceleration.getDouble(2);
                mAcceleration = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing acceleration: " + e.getMessage());
                mAcceleration = new Vector(0.0f, 0.0f, 0.0f);
            }
        }
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setAcceleration(mAcceleration);
        }
    }

    public void setGravity(@Nullable ReadableArray gravity) {
        Log.d(TAG, "Setting gravity: " + gravity);
        
        if (gravity != null && gravity.size() >= 3) {
            try {
                float x = (float) gravity.getDouble(0);
                float y = (float) gravity.getDouble(1);
                float z = (float) gravity.getDouble(2);
                mGravity = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing gravity: " + e.getMessage());
                mGravity = new Vector(0.0f, -9.8f, 0.0f);
            }
        }
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setGravity(mGravity);
        }
    }

    // Particle Lifecycle Properties
    public void setLifetime(float lifetime) {
        Log.d(TAG, "Setting lifetime: " + lifetime);
        mLifetime = lifetime;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setLifetime(lifetime);
        }
    }

    // Emission Shape Properties
    public void setEmissionShape(@Nullable String emissionShape) {
        Log.d(TAG, "Setting emission shape: " + emissionShape);
        mEmissionShape = emissionShape != null ? emissionShape : "point";
        
        if (mParticleEmitterJni != null) {
            ParticleEmitter.EmissionShape shape = getEmissionShapeEnum(mEmissionShape);
            mParticleEmitterJni.setEmissionShape(shape);
        }
    }

    public void setEmissionRadius(float emissionRadius) {
        Log.d(TAG, "Setting emission radius: " + emissionRadius);
        mEmissionRadius = emissionRadius;
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.setEmissionRadius(emissionRadius);
        }
    }

    // Transform Properties
    public void setScale(@Nullable ReadableArray scale) {
        Log.d(TAG, "Setting scale: " + scale);
        
        if (scale != null && scale.size() >= 3) {
            try {
                float x = (float) scale.getDouble(0);
                float y = (float) scale.getDouble(1);
                float z = (float) scale.getDouble(2);
                mScale = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing scale: " + e.getMessage());
                mScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        }
        
        applyTransformProperties();
    }

    public void setRotation(@Nullable ReadableArray rotation) {
        Log.d(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0));
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                mRotationVector = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing rotation: " + e.getMessage());
                mRotationVector = new Vector(0.0f, 0.0f, 0.0f);
            }
        }
        
        applyTransformProperties();
    }

    public void setPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                mPosition = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing position: " + e.getMessage());
                mPosition = new Vector(0.0f, 0.0f, 0.0f);
            }
        }
        
        applyTransformProperties();
    }

    // Particle Control Methods
    public void play() {
        Log.d(TAG, "Starting particle emission");
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.play();
            mIsPlaying = true;
            mIsPaused = false;
        }
        
        emitParticleStartEvent();
    }

    public void pause() {
        Log.d(TAG, "Pausing particle emission");
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.pause();
            mIsPlaying = false;
            mIsPaused = true;
        }
        
        emitParticlePauseEvent();
    }

    public void stop() {
        Log.d(TAG, "Stopping particle emission");
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.stop();
            mIsPlaying = false;
            mIsPaused = false;
        }
        
        emitParticleStopEvent();
    }

    public void reset() {
        Log.d(TAG, "Resetting particle system");
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.reset();
        }
        
        emitParticleResetEvent();
    }

    // Helper Methods
    private void applyParticleProperties() {
        if (mParticleEmitterJni != null) {
            Log.d(TAG, "Applying particle properties to ViroReact ParticleEmitter");
            
            // Apply emission properties
            mParticleEmitterJni.setEmissionRate(mEmissionRate);
            mParticleEmitterJni.setBurstCount(mBurstCount);
            mParticleEmitterJni.setDuration(mDuration);
            mParticleEmitterJni.setDelay(mDelay);
            mParticleEmitterJni.setLooping(mLooping);
            mParticleEmitterJni.setMaxParticles(mMaxParticles);
            
            // Apply appearance properties
            applyParticleAppearance();
            
            // Apply physics properties
            mParticleEmitterJni.setVelocity(mVelocity);
            mParticleEmitterJni.setAcceleration(mAcceleration);
            mParticleEmitterJni.setGravity(mGravity);
            
            // Apply lifecycle properties
            mParticleEmitterJni.setLifetime(mLifetime);
            
            // Apply emission shape
            ParticleEmitter.EmissionShape shape = getEmissionShapeEnum(mEmissionShape);
            mParticleEmitterJni.setEmissionShape(shape);
            mParticleEmitterJni.setEmissionRadius(mEmissionRadius);
            
            Log.d(TAG, "Particle properties applied successfully");
        }
    }

    private void applyParticleAppearance() {
        if (mParticleEmitterJni != null) {
            Log.d(TAG, "Applying particle appearance properties");
            
            // Apply color
            mParticleEmitterJni.setParticleColor(mColor[0], mColor[1], mColor[2]);
            
            // Apply size and opacity
            mParticleEmitterJni.setParticleSize(mSize);
            mParticleEmitterJni.setParticleOpacity(mOpacity);
            
            // TODO: Apply texture from image map
            
            Log.d(TAG, "Particle appearance applied successfully");
        }
    }

    private void applyTransformProperties() {
        if (mNodeJni != null) {
            Log.d(TAG, "Applying transform properties to ViroReact Node");
            
            // Apply position, rotation, and scale to the node
            mNodeJni.setPosition(mPosition);
            mNodeJni.setRotation(mRotationVector);
            mNodeJni.setScale(mScale);
            
            Log.d(TAG, "Transform properties applied successfully");
        }
    }

    // Helper methods to convert string properties to enum values
    private ParticleEmitter.EmissionShape getEmissionShapeEnum(String shape) {
        switch (shape.toLowerCase()) {
            case "sphere":
                return ParticleEmitter.EmissionShape.SPHERE;
            case "box":
                return ParticleEmitter.EmissionShape.BOX;
            case "cone":
                return ParticleEmitter.EmissionShape.CONE;
            case "circle":
                return ParticleEmitter.EmissionShape.CIRCLE;
            default:
            case "point":
                return ParticleEmitter.EmissionShape.POINT;
        }
    }

    // Event Emission
    private void emitParticleStartEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroParticleEmitter");
        event.putString("action", "start");
        emitParticleEvent("onParticleStart", event);
    }

    private void emitParticlePauseEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroParticleEmitter");
        event.putString("action", "pause");
        emitParticleEvent("onParticlePause", event);
    }

    private void emitParticleStopEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroParticleEmitter");
        event.putString("action", "stop");
        emitParticleEvent("onParticleStop", event);
    }

    private void emitParticleResetEvent() {
        WritableMap event = Arguments.createMap();
        event.putString("source", "ViroParticleEmitter");
        event.putString("action", "reset");
        emitParticleEvent("onParticleReset", event);
    }
    
    private void emitParticleEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Stop particle emission
        if (mIsPlaying) {
            stop();
        }
        
        // Clean up ViroReact particle emitter resources
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
        
        if (mParticleEmitterJni != null) {
            mParticleEmitterJni.dispose();
            mParticleEmitterJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroParticleEmitterView attached to window");
        
        // Particle emitter will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mParticleEmitterJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact particle emitter ready for scene attachment");
        }
        
        // Ensure particle properties are applied
        applyParticleProperties();
        applyTransformProperties();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroParticleEmitterView detached from window");
        
        // Particle emitter cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }

    // Getters for current values (useful for debugging and testing)
    public float getEmissionRate() { return mEmissionRate; }
    public int getBurstCount() { return mBurstCount; }
    public float getDuration() { return mDuration; }
    public boolean isLooping() { return mLooping; }
    public int getMaxParticles() { return mMaxParticles; }
    public float getParticleSize() { return mSize; }
    public float getParticleOpacity() { return mOpacity; }
    public Vector getVelocity() { return mVelocity; }
    public Vector getAcceleration() { return mAcceleration; }
    public Vector getGravity() { return mGravity; }
    public float getLifetime() { return mLifetime; }
    public String getEmissionShape() { return mEmissionShape; }
    public float getEmissionRadius() { return mEmissionRadius; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotationVector; }
    public Vector getPosition() { return mPosition; }
    public boolean isPlaying() { return mIsPlaying; }
    public boolean isPaused() { return mIsPaused; }
}