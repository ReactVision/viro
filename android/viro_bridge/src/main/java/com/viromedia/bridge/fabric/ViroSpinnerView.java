//
//  ViroSpinnerView.java
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
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Quad;
import com.viro.core.Texture;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viro.core.Animation;
import com.viro.core.AnimationTransaction;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;
import java.util.List;
import java.util.ArrayList;

/**
 * Native Android view for ViroSpinner component.
 * ViroSpinner provides comprehensive loading indicator functionality with ViroReact 3D integration,
 * supporting multiple spinner types, customizable animations, progress indication, and 3D positioning.
 */
public class ViroSpinnerView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroSpinnerView.class);
    
    // Spinner types
    public enum SpinnerType {
        CIRCULAR("circular"),
        DOTS("dots"),
        BARS("bars"),
        RING("ring"),
        PULSE("pulse");
        
        private final String value;
        
        SpinnerType(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        public static SpinnerType fromString(String value) {
            for (SpinnerType type : SpinnerType.values()) {
                if (type.value.equals(value)) {
                    return type;
                }
            }
            return CIRCULAR;
        }
    }
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private List<Node> mSpinnerNodes = new ArrayList<>();
    private Material mMaterialJni;
    private List<Material> mSpinnerMaterials = new ArrayList<>();
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Animation system
    private AnimationTransaction mAnimationTransaction;
    private List<Animation> mActiveAnimations = new ArrayList<>();
    private boolean mAnimationsEnabled = true;
    
    // Spinner appearance properties
    private SpinnerType mType = SpinnerType.CIRCULAR;
    private Vector mColor = new Vector(1.0f, 1.0f, 1.0f);
    private float mSize = 1.0f;
    private float mThickness = 0.1f;
    private float mRadius = 0.5f;
    private float mSpacing = 0.2f;
    
    // Spinner animation properties
    private boolean mAnimating = false;
    private float mSpeed = 1.0f;
    private String mDirection = "clockwise";
    private float mDuration = 1.0f;
    private String mEasing = "linear";
    private float mDelay = 0.0f;
    
    // Spinner behavior properties
    private boolean mVisible = true;
    private boolean mAutoHide = false;
    private float mHideDelay = 0.0f;
    private float mFadeInDuration = 0.3f;
    private float mFadeOutDuration = 0.3f;
    
    // Spinner progress properties
    private float mProgress = 0.0f;
    private Vector mProgressColor = new Vector(0.0f, 0.7f, 1.0f);
    private Vector mProgressBackgroundColor = new Vector(0.3f, 0.3f, 0.3f);
    private boolean mShowProgress = false;
    private String mProgressText = "";
    
    // Spinner text properties
    private String mText = "";
    private Vector mTextColor = new Vector(1.0f, 1.0f, 1.0f);
    private float mTextSize = 0.1f;
    private String mTextFont = "System";
    private String mTextPosition = "bottom";
    private float mTextOffset = 0.2f;
    
    // Spinner customization properties
    private int mDotCount = 8;
    private float mDotSize = 0.1f;
    private int mBarCount = 12;
    private float mBarWidth = 0.05f;
    private float mBarHeight = 0.2f;
    private float mRingWidth = 0.1f;
    private float mPulseScale = 1.5f;
    
    // Transform properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotationPivot;
    private Vector mScalePivot;
    private ReadableArray mTransformBehaviors;
    
    // Visibility and interaction
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
    
    // Spinner event handling flags
    private boolean mOnStart = false;
    private boolean mOnStop = false;
    private boolean mOnProgressChange = false;
    
    // Internal state
    private boolean mSpinnerDirty = true;
    private boolean mAnimationDirty = true;
    private float mCurrentAnimationTime = 0.0f;
    
    public ViroSpinnerView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroSpinnerView initialized with ViroReact 3D Spinner integration");
        
        initializeSpinner();
    }
    
    private void initializeSpinner() {
        ViroLog.debug(TAG, "Initializing ViroReact spinner with default properties");
        
        // Create ViroReact Node for the spinner
        mNodeJni = new Node();
        
        // Create default Material for the spinner
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial spinner properties
        applySpinnerProperties();
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Create animation system
        mAnimationTransaction = new AnimationTransaction();
        
        // Spinner views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Spinner initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroSpinnerView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroSpinnerView> mSpinnerView;
        
        public VRTComponentWrapper(ViroSpinnerView spinnerView) {
            super(spinnerView.getContext(), null, -1, -1, spinnerView.mReactContext);
            mSpinnerView = new WeakReference<>(spinnerView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroSpinnerView spinnerView = mSpinnerView.get();
            if (spinnerView != null) {
                spinnerView.emitSpinnerEvent(eventName, eventData);
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
     * Get the spinner nodes (for multi-element spinners like dots/bars)
     */
    public List<Node> getSpinnerNodes() {
        return mSpinnerNodes;
    }
    
    /**
     * Set the ViroContext for this spinner
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate spinner components with ViroContext if needed
        if (mMaterialJni != null) {
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            applySpinnerProperties();
            // Rebuild spinner geometry
            buildSpinnerGeometry();
        }
    }
    
    // Property setters
    
    public void setType(@Nullable String type) {
        ViroLog.debug(TAG, "Setting type: " + type);
        mType = SpinnerType.fromString(type != null ? type : "circular");
        mSpinnerDirty = true;
        buildSpinnerGeometry();
    }
    
    public void setColor(@Nullable ReadableArray color) {
        ViroLog.debug(TAG, "Setting color: " + color);
        
        if (color != null && color.size() >= 3) {
            try {
                float r = (float) color.getDouble(0);
                float g = (float) color.getDouble(1);
                float b = (float) color.getDouble(2);
                mColor = new Vector(r, g, b);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing color: " + e.getMessage());
                mColor = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mColor = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applySpinnerProperties();
    }
    
    public void setSize(float size) {
        ViroLog.debug(TAG, "Setting size: " + size);
        mSize = Math.max(0.1f, size);
        mRadius = mSize / 2.0f;
        mSpinnerDirty = true;
        buildSpinnerGeometry();
    }
    
    public void setThickness(float thickness) {
        ViroLog.debug(TAG, "Setting thickness: " + thickness);
        mThickness = Math.max(0.01f, thickness);
        mSpinnerDirty = true;
        buildSpinnerGeometry();
    }
    
    public void setAnimating(boolean animating) {
        ViroLog.debug(TAG, "Setting animating: " + animating);
        mAnimating = animating;
        if (animating) {
            startSpinnerAnimation();
        } else {
            stopSpinnerAnimation();
        }
    }
    
    public void setSpeed(float speed) {
        ViroLog.debug(TAG, "Setting speed: " + speed);
        mSpeed = Math.max(0.1f, Math.min(5.0f, speed));
        if (mAnimating) {
            stopSpinnerAnimation();
            startSpinnerAnimation();
        }
    }
    
    public void setDirection(@Nullable String direction) {
        ViroLog.debug(TAG, "Setting direction: " + direction);
        mDirection = direction != null ? direction : "clockwise";
        if (mAnimating) {
            stopSpinnerAnimation();
            startSpinnerAnimation();
        }
    }
    
    public void setDuration(float duration) {
        ViroLog.debug(TAG, "Setting duration: " + duration);
        mDuration = Math.max(0.1f, Math.min(10.0f, duration));
        if (mAnimating) {
            stopSpinnerAnimation();
            startSpinnerAnimation();
        }
    }
    
    public void setProgress(float progress) {
        ViroLog.debug(TAG, "Setting progress: " + progress);
        mProgress = Math.max(0.0f, Math.min(1.0f, progress));
        
        if (mOnProgressChange) {
            WritableMap eventData = Arguments.createMap();
            eventData.putDouble("progress", mProgress);
            emitSpinnerEvent("onProgressChange", eventData);
        }
        
        applyProgressProperties();
    }
    
    public void setText(@Nullable String text) {
        ViroLog.debug(TAG, "Setting text: " + text);
        mText = text != null ? text : "";
        applyTextProperties();
    }
    
    public void setShowProgress(boolean showProgress) {
        ViroLog.debug(TAG, "Setting show progress: " + showProgress);
        mShowProgress = showProgress;
        applyProgressProperties();
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
    
    public void setOnStart(boolean onStart) {
        ViroLog.debug(TAG, "Setting on start: " + onStart);
        mOnStart = onStart;
    }
    
    public void setOnStop(boolean onStop) {
        ViroLog.debug(TAG, "Setting on stop: " + onStop);
        mOnStop = onStop;
    }
    
    public void setOnProgressChange(boolean onProgressChange) {
        ViroLog.debug(TAG, "Setting on progress change: " + onProgressChange);
        mOnProgressChange = onProgressChange;
    }
    
    // ViroReact-specific methods
    
    private void applySpinnerProperties() {
        if (mMaterialJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "Applying spinner properties to ViroReact Material");
            
            // Apply spinner color
            mMaterialJni.setDiffuseColor(mColor.x, mColor.y, mColor.z);
            mMaterialJni.setOpacity(mOpacity);
            
            // Configure material for spinner display
            mMaterialJni.setLightingModel(Material.LightingModel.CONSTANT);
            mMaterialJni.setBlendMode(Material.BlendMode.ALPHA);
            mMaterialJni.setCullMode(Material.CullMode.NONE);
            
            ViroLog.debug(TAG, "Spinner properties applied successfully");
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
    
    private void applyProgressProperties() {
        if (mShowProgress) {
            ViroLog.debug(TAG, "Applying progress properties");
            // Progress implementation would update progress materials/geometry
        }
    }
    
    private void applyTextProperties() {
        if (!mText.isEmpty()) {
            ViroLog.debug(TAG, "Applying text properties");
            // Text implementation would create text nodes
        }
    }
    
    private void buildSpinnerGeometry() {
        if (mSpinnerDirty && mViroContext != null) {
            ViroLog.debug(TAG, "Building spinner geometry for type: " + mType.getValue());
            
            // Clear existing spinner nodes
            for (Node node : mSpinnerNodes) {
                if (node != null) {
                    node.dispose();
                }
            }
            mSpinnerNodes.clear();
            
            // Clear existing materials
            for (Material material : mSpinnerMaterials) {
                if (material != null) {
                    material.dispose();
                }
            }
            mSpinnerMaterials.clear();
            
            // Build geometry based on spinner type
            switch (mType) {
                case CIRCULAR:
                    buildCircularSpinner();
                    break;
                case DOTS:
                    buildDotsSpinner();
                    break;
                case BARS:
                    buildBarsSpinner();
                    break;
                case RING:
                    buildRingSpinner();
                    break;
                case PULSE:
                    buildPulseSpinner();
                    break;
            }
            
            mSpinnerDirty = false;
            ViroLog.debug(TAG, "Spinner geometry built successfully");
        }
    }
    
    private void buildCircularSpinner() {
        ViroLog.debug(TAG, "Building circular spinner geometry");
        
        // Create circular spinner using Quad with circular texture or geometry
        Node spinnerNode = new Node();
        Quad circularQuad = new Quad(mRadius * 2, mRadius * 2);
        Material circularMaterial = new Material(mViroContext);
        
        // Configure circular material
        circularMaterial.setDiffuseColor(mColor.x, mColor.y, mColor.z);
        circularMaterial.setOpacity(mOpacity);
        circularMaterial.setLightingModel(Material.LightingModel.CONSTANT);
        
        circularQuad.setMaterials(java.util.Arrays.asList(circularMaterial));
        spinnerNode.setGeometry(circularQuad);
        
        mNodeJni.addChildNode(spinnerNode);
        mSpinnerNodes.add(spinnerNode);
        mSpinnerMaterials.add(circularMaterial);
    }
    
    private void buildDotsSpinner() {
        ViroLog.debug(TAG, "Building dots spinner geometry");
        
        for (int i = 0; i < mDotCount; i++) {
            float angle = (float) (2 * Math.PI * i / mDotCount);
            float x = (mRadius + mSpacing) * (float) Math.cos(angle);
            float y = (mRadius + mSpacing) * (float) Math.sin(angle);
            
            Node dotNode = new Node();
            Quad dotQuad = new Quad(mDotSize, mDotSize);
            Material dotMaterial = new Material(mViroContext);
            
            // Configure dot material
            dotMaterial.setDiffuseColor(mColor.x, mColor.y, mColor.z);
            dotMaterial.setOpacity(mOpacity);
            dotMaterial.setLightingModel(Material.LightingModel.CONSTANT);
            
            dotQuad.setMaterials(java.util.Arrays.asList(dotMaterial));
            dotNode.setGeometry(dotQuad);
            dotNode.setPosition(new Vector(x, y, 0.0f));
            
            mNodeJni.addChildNode(dotNode);
            mSpinnerNodes.add(dotNode);
            mSpinnerMaterials.add(dotMaterial);
        }
    }
    
    private void buildBarsSpinner() {
        ViroLog.debug(TAG, "Building bars spinner geometry");
        
        for (int i = 0; i < mBarCount; i++) {
            float angle = (float) (2 * Math.PI * i / mBarCount);
            
            Node barNode = new Node();
            Quad barQuad = new Quad(mBarWidth, mBarHeight);
            Material barMaterial = new Material(mViroContext);
            
            // Configure bar material
            barMaterial.setDiffuseColor(mColor.x, mColor.y, mColor.z);
            barMaterial.setOpacity(mOpacity);
            barMaterial.setLightingModel(Material.LightingModel.CONSTANT);
            
            barQuad.setMaterials(java.util.Arrays.asList(barMaterial));
            barNode.setGeometry(barQuad);
            
            // Position bar at radius and rotate
            barNode.setPosition(new Vector(mRadius, 0.0f, 0.0f));
            barNode.setRotation(new Vector(0.0f, 0.0f, angle));
            
            mNodeJni.addChildNode(barNode);
            mSpinnerNodes.add(barNode);
            mSpinnerMaterials.add(barMaterial);
        }
    }
    
    private void buildRingSpinner() {
        ViroLog.debug(TAG, "Building ring spinner geometry");
        
        // Create ring spinner using Quad with ring-like appearance
        Node ringNode = new Node();
        Quad ringQuad = new Quad(mRadius * 2, mRadius * 2);
        Material ringMaterial = new Material(mViroContext);
        
        // Configure ring material
        ringMaterial.setDiffuseColor(mColor.x, mColor.y, mColor.z);
        ringMaterial.setOpacity(mOpacity);
        ringMaterial.setLightingModel(Material.LightingModel.CONSTANT);
        
        ringQuad.setMaterials(java.util.Arrays.asList(ringMaterial));
        ringNode.setGeometry(ringQuad);
        
        mNodeJni.addChildNode(ringNode);
        mSpinnerNodes.add(ringNode);
        mSpinnerMaterials.add(ringMaterial);
    }
    
    private void buildPulseSpinner() {
        ViroLog.debug(TAG, "Building pulse spinner geometry");
        
        // Create pulse spinner using Quad with pulsing effect
        Node pulseNode = new Node();
        Quad pulseQuad = new Quad(mRadius * 2, mRadius * 2);
        Material pulseMaterial = new Material(mViroContext);
        
        // Configure pulse material
        pulseMaterial.setDiffuseColor(mColor.x, mColor.y, mColor.z);
        pulseMaterial.setOpacity(mOpacity);
        pulseMaterial.setLightingModel(Material.LightingModel.CONSTANT);
        
        pulseQuad.setMaterials(java.util.Arrays.asList(pulseMaterial));
        pulseNode.setGeometry(pulseQuad);
        
        mNodeJni.addChildNode(pulseNode);
        mSpinnerNodes.add(pulseNode);
        mSpinnerMaterials.add(pulseMaterial);
    }
    
    // Animation methods
    
    private void startSpinnerAnimation() {
        if (!mAnimationsEnabled || mViroContext == null) {
            return;
        }
        
        ViroLog.debug(TAG, "Starting spinner animation with ViroReact Animation system");
        
        // Stop any existing animations
        stopSpinnerAnimation();
        
        // Create animation based on spinner type
        switch (mType) {
            case CIRCULAR:
            case RING:
                startRotationAnimation();
                break;
            case DOTS:
                startDotsAnimation();
                break;
            case BARS:
                startBarsAnimation();
                break;
            case PULSE:
                startPulseAnimation();
                break;
        }
        
        if (mOnStart) {
            WritableMap eventData = Arguments.createMap();
            emitSpinnerEvent("onStart", eventData);
        }
    }
    
    private void stopSpinnerAnimation() {
        ViroLog.debug(TAG, "Stopping spinner animation");
        
        // Stop all active animations
        for (Animation animation : mActiveAnimations) {
            if (animation != null) {
                animation.cancel();
            }
        }
        mActiveAnimations.clear();
        
        if (mAnimationTransaction != null) {
            mAnimationTransaction.finish();
        }
        
        if (mOnStop) {
            WritableMap eventData = Arguments.createMap();
            emitSpinnerEvent("onStop", eventData);
        }
    }
    
    private void startRotationAnimation() {
        if (mSpinnerNodes.isEmpty()) {
            return;
        }
        
        Node spinnerNode = mSpinnerNodes.get(0);
        Vector rotationAxis = new Vector(0.0f, 0.0f, 1.0f);
        float rotationAngle = "clockwise".equals(mDirection) ? 360.0f : -360.0f;
        
        Animation rotationAnimation = Animation.createRotateByAnimation(
            mDuration / mSpeed,
            rotationAxis,
            (float) Math.toRadians(rotationAngle)
        );
        rotationAnimation.setRepeatCount(-1); // Infinite
        rotationAnimation.setTimeOffset(mDelay);
        
        spinnerNode.addAnimation("spinnerRotation", rotationAnimation);
        mActiveAnimations.add(rotationAnimation);
    }
    
    private void startDotsAnimation() {
        for (int i = 0; i < mSpinnerNodes.size(); i++) {
            Node dotNode = mSpinnerNodes.get(i);
            float delay = (float) i / mSpinnerNodes.size();
            
            // Create opacity animation for each dot
            Animation opacityAnimation = Animation.createFadeToAnimation(
                mDuration / mSpeed,
                0.3f
            );
            opacityAnimation.setRepeatCount(-1);
            opacityAnimation.setRepeatMode(Animation.RepeatMode.REVERSE);
            opacityAnimation.setTimeOffset(mDelay + delay * mDuration / mSpeed);
            
            dotNode.addAnimation("dotFade_" + i, opacityAnimation);
            mActiveAnimations.add(opacityAnimation);
        }
    }
    
    private void startBarsAnimation() {
        for (int i = 0; i < mSpinnerNodes.size(); i++) {
            Node barNode = mSpinnerNodes.get(i);
            float delay = (float) i / mSpinnerNodes.size();
            
            // Create scale animation for each bar
            Animation scaleAnimation = Animation.createScaleToAnimation(
                mDuration / mSpeed,
                new Vector(1.0f, 0.3f, 1.0f)
            );
            scaleAnimation.setRepeatCount(-1);
            scaleAnimation.setRepeatMode(Animation.RepeatMode.REVERSE);
            scaleAnimation.setTimeOffset(mDelay + delay * mDuration / mSpeed);
            
            barNode.addAnimation("barScale_" + i, scaleAnimation);
            mActiveAnimations.add(scaleAnimation);
        }
    }
    
    private void startPulseAnimation() {
        if (mSpinnerNodes.isEmpty()) {
            return;
        }
        
        Node pulseNode = mSpinnerNodes.get(0);
        
        // Create scale animation
        Animation scaleAnimation = Animation.createScaleToAnimation(
            mDuration / mSpeed,
            new Vector(mPulseScale, mPulseScale, mPulseScale)
        );
        scaleAnimation.setRepeatCount(-1);
        scaleAnimation.setRepeatMode(Animation.RepeatMode.REVERSE);
        scaleAnimation.setTimeOffset(mDelay);
        
        // Create fade animation
        Animation fadeAnimation = Animation.createFadeToAnimation(
            mDuration / mSpeed,
            0.0f
        );
        fadeAnimation.setRepeatCount(-1);
        fadeAnimation.setRepeatMode(Animation.RepeatMode.REVERSE);
        fadeAnimation.setTimeOffset(mDelay);
        
        pulseNode.addAnimation("pulseScale", scaleAnimation);
        pulseNode.addAnimation("pulseFade", fadeAnimation);
        mActiveAnimations.add(scaleAnimation);
        mActiveAnimations.add(fadeAnimation);
    }
    
    // Spinner Control Methods
    public void startAnimating() {
        ViroLog.debug(TAG, "Starting ViroReact spinner animation");
        mAnimating = true;
        startSpinnerAnimation();
    }
    
    public void stopAnimating() {
        ViroLog.debug(TAG, "Stopping ViroReact spinner animation");
        mAnimating = false;
        stopSpinnerAnimation();
        
        if (mAutoHide) {
            postDelayed(this::hide, (long) (mHideDelay * 1000));
        }
    }
    
    public void show() {
        ViroLog.debug(TAG, "Showing ViroReact spinner");
        mVisible = true;
        setVisibility(VISIBLE);
        
        if (mNodeJni != null) {
            mNodeJni.setVisible(true);
            
            // Create fade-in animation using ViroReact
            Animation fadeInAnimation = Animation.createFadeToAnimation(
                mFadeInDuration,
                mOpacity
            );
            mNodeJni.addAnimation("fadeIn", fadeInAnimation);
        }
    }
    
    public void hide() {
        ViroLog.debug(TAG, "Hiding ViroReact spinner");
        
        if (mNodeJni != null) {
            // Create fade-out animation using ViroReact
            Animation fadeOutAnimation = Animation.createFadeToAnimation(
                mFadeOutDuration,
                0.0f
            );
            fadeOutAnimation.setListener(new Animation.AnimationListener() {
                @Override
                public void onAnimationStart() {}
                
                @Override
                public void onAnimationFinish() {
                    mVisible = false;
                    setVisibility(GONE);
                    mNodeJni.setVisible(false);
                }
            });
            mNodeJni.addAnimation("fadeOut", fadeOutAnimation);
        }
    }
    
    /**
     * Emit spinner events for ViroReact integration
     */
    public void emitSpinnerEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    // State Information
    public boolean isAnimating() {
        return mAnimating;
    }
    
    public boolean isVisible() {
        return mVisible;
    }
    
    public float getCurrentProgress() {
        return mProgress;
    }
    
    public String getSpinnerType() {
        return mType.getValue();
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop all animations
        stopSpinnerAnimation();
        
        // Clean up ViroReact spinner resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setGeometry(null);
            
            // Remove all child nodes
            for (Node spinnerNode : mSpinnerNodes) {
                if (spinnerNode != null) {
                    mNodeJni.removeChildNode(spinnerNode);
                    spinnerNode.dispose();
                }
            }
            
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mMaterialJni != null) {
            mMaterialJni.dispose();
            mMaterialJni = null;
        }
        
        // Dispose spinner materials
        for (Material material : mSpinnerMaterials) {
            if (material != null) {
                material.dispose();
            }
        }
        mSpinnerMaterials.clear();
        
        // Dispose animation system
        if (mAnimationTransaction != null) {
            mAnimationTransaction.finish();
            mAnimationTransaction = null;
        }
        
        // Clear animations
        mActiveAnimations.clear();
        mSpinnerNodes.clear();
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mTransformBehaviors = null;
        mPhysicsBody = null;
        mAnimation = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroSpinnerView attached to window");
        
        // Spinner will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact spinner ready for scene attachment");
        }
        
        // Ensure spinner properties are applied
        applySpinnerProperties();
        applyTransformProperties();
        
        // Build spinner geometry if dirty
        if (mSpinnerDirty) {
            buildSpinnerGeometry();
        }
        
        // Start animation if needed
        if (mAnimating) {
            startSpinnerAnimation();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroSpinnerView detached from window");
        
        // Stop animations when detached
        stopSpinnerAnimation();
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public SpinnerType getType() { return mType; }
    public Vector getColor() { return mColor; }
    public float getSize() { return mSize; }
    public float getThickness() { return mThickness; }
    public float getRadius() { return mRadius; }
    public float getSpacing() { return mSpacing; }
    public float getSpeed() { return mSpeed; }
    public String getDirection() { return mDirection; }
    public float getDuration() { return mDuration; }
    public String getEasing() { return mEasing; }
    public float getDelay() { return mDelay; }
    public boolean isAutoHide() { return mAutoHide; }
    public float getHideDelay() { return mHideDelay; }
    public float getFadeInDuration() { return mFadeInDuration; }
    public float getFadeOutDuration() { return mFadeOutDuration; }
    public boolean isShowProgress() { return mShowProgress; }
    public String getText() { return mText; }
    public Vector getPosition() { return mPosition; }
    public Vector getRotation() { return mRotation; }
    public Vector getScale() { return mScale; }
    public float getOpacity() { return mOpacity; }
    public int getRenderingOrder() { return mRenderingOrder; }
    public int getDotCount() { return mDotCount; }
    public float getDotSize() { return mDotSize; }
    public int getBarCount() { return mBarCount; }
    public float getBarWidth() { return mBarWidth; }
    public float getBarHeight() { return mBarHeight; }
    public float getRingWidth() { return mRingWidth; }
    public float getPulseScale() { return mPulseScale; }
    public boolean isSpinnerDirty() { return mSpinnerDirty; }
    public boolean isAnimationDirty() { return mAnimationDirty; }
    public float getCurrentAnimationTime() { return mCurrentAnimationTime; }
}