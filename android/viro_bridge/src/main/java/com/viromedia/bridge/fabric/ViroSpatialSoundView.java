//
//  ViroSpatialSoundView.java
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
import com.viro.core.Node;
import com.viro.core.Sound;
import com.viro.core.SpatialSound;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroSpatialSound component.
 * ViroSpatialSound provides comprehensive 3D spatial audio functionality with ViroReact 3D integration,
 * supporting precise 3D positioning, directional audio cones, distance attenuation, Doppler effects, and environmental audio.
 */
public class ViroSpatialSoundView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroSpatialSoundView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private SpatialSound mSpatialSoundJni;
    private Sound mSoundJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Audio source properties
    private ReadableMap mSource;
    private String mUri = "";
    private String mLocal = "";
    private String mResource = "";
    private String mAudioFormat = "auto"; // "auto", "wav", "mp3", "ogg", "aac", "m4a"
    
    // Playback control properties
    private boolean mPaused = false;
    private boolean mLoop = false;
    private boolean mMuted = false;
    private float mVolume = 1.0f;
    private float mRate = 1.0f;
    private float mPitch = 1.0f;
    private float mSeekTime = 0.0f;
    
    // 3D position properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mVelocity = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mDirection = new Vector(0.0f, 0.0f, -1.0f);
    private Vector mUp = new Vector(0.0f, 1.0f, 0.0f);
    
    // Spatial audio properties
    private boolean mSpatialAudioEnabled = true;
    private String mSpatialAudioQuality = "high"; // "low", "medium", "high", "ultra"
    private float mSpatialBlend = 1.0f; // 0.0 = 2D, 1.0 = 3D
    private float mStereoPan = 0.0f; // -1.0 (left) to 1.0 (right)
    
    // Distance and attenuation properties
    private String mDistanceModel = "inverse"; // "inverse", "linear", "exponential"
    private float mMaxDistance = 1000.0f;
    private float mReferenceDistance = 1.0f;
    private float mRolloffFactor = 1.0f;
    private float mMinDistance = 0.5f;
    
    // Directional audio properties
    private boolean mDirectional = false;
    private float mConeInnerAngle = 360.0f; // degrees
    private float mConeOuterAngle = 360.0f; // degrees
    private float mConeOuterGain = 0.0f; // 0.0 to 1.0
    private float mConeOuterGainHF = 0.0f; // High frequency outer gain
    private String mDirectionalityPattern = "cone"; // "cone", "cardioid", "bidirectional"
    
    // Doppler effect properties
    private boolean mDopplerEnabled = false;
    private float mDopplerLevel = 1.0f;
    private float mDopplerFactor = 1.0f;
    private float mSpeedOfSound = 343.3f; // meters per second
    
    // Environmental audio properties
    private ReadableMap mEnvironmentalAudio;
    private ReadableMap mReverb;
    private ReadableMap mReverbZone;
    private float mAirAbsorption = 0.0f;
    private float mWetness = 0.0f; // Reverb wetness
    private float mRoomSize = 10.0f;
    
    // Occlusion and obstruction properties
    private boolean mOcclusionEnabled = false;
    private float mOcclusionStrength = 1.0f;
    private boolean mObstructionEnabled = false;
    private float mObstructionStrength = 1.0f;
    private float mOcclusionLFDamp = 1.0f; // Low frequency damping
    private float mOcclusionHFDamp = 1.0f; // High frequency damping
    
    // Audio effects properties
    private ReadableArray mEffects;
    private ReadableMap mLowPassFilter;
    private ReadableMap mHighPassFilter;
    private ReadableMap mBandPassFilter;
    private ReadableMap mDistortion;
    private ReadableMap mChorus;
    private ReadableMap mEcho;
    
    // Performance properties
    private String mProcessingQuality = "high"; // "low", "medium", "high", "ultra"
    private boolean mOptimizationEnabled = true;
    private int mMaxVoices = 8;
    private String mPriorityLevel = "normal"; // "low", "normal", "high", "critical"
    
    // Animation and interaction
    private ReadableMap mAnimation;
    private ReadableArray mTransformBehaviors;
    private String mViroTag;
    
    // Internal state
    private boolean mAudioDirty = true;
    private boolean mSpatialDirty = true;
    private boolean mDirectionalDirty = true;
    private boolean mEffectsDirty = true;
    
    public ViroSpatialSoundView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroSpatialSoundView initialized with ViroReact 3D Spatial Audio integration");
        
        initializeSpatialSound();
    }
    
    private void initializeSpatialSound() {
        ViroLog.debug(TAG, "Initializing ViroReact spatial sound with default properties");
        
        // Create ViroReact Node for the spatial sound
        mNodeJni = new Node();
        
        // Create SpatialSound for 3D positioned audio
        mSpatialSoundJni = new SpatialSound(mViroContext);
        
        // Create Sound for audio playback
        mSoundJni = new Sound(mViroContext, mUri, Sound.VolumeRolloff.LINEAR, new Sound.LoadCallback() {
            @Override
            public void onSoundLoaded(Sound sound) {
                handleSoundLoaded();
            }
            
            @Override
            public void onSoundFailed(String error) {
                handleSoundError("Sound loading failed: " + error);
            }
        });
        
        // Configure initial spatial sound properties
        applySpatialSoundProperties();
        
        // Attach spatial sound to node
        mNodeJni.setSpatialSound(mSpatialSoundJni);
        mSpatialSoundJni.setSound(mSoundJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Spatial sound views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Spatial Sound initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroSpatialSoundView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroSpatialSoundView> mSpatialSoundView;
        
        public VRTComponentWrapper(ViroSpatialSoundView spatialSoundView) {
            super(spatialSoundView.getContext(), null, -1, -1, spatialSoundView.mReactContext);
            mSpatialSoundView = new WeakReference<>(spatialSoundView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroSpatialSoundView spatialSoundView = mSpatialSoundView.get();
            if (spatialSoundView != null) {
                spatialSoundView.emitSpatialSoundEvent(eventName, eventData);
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
     * Get the underlying ViroReact SpatialSound object
     */
    public SpatialSound getSpatialSoundJni() {
        return mSpatialSoundJni;
    }
    
    /**
     * Get the underlying ViroReact Sound object
     */
    public Sound getSoundJni() {
        return mSoundJni;
    }
    
    /**
     * Set the ViroContext for this spatial sound
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate spatial sound components with ViroContext if needed
        if (mSpatialSoundJni != null) {
            mSpatialSoundJni.dispose();
            mSpatialSoundJni = new SpatialSound(mViroContext);
            if (mSoundJni != null) {
                mSoundJni.dispose();
            }
            mSoundJni = new Sound(mViroContext, mUri, Sound.VolumeRolloff.LINEAR, new Sound.LoadCallback() {
                @Override
                public void onSoundLoaded(Sound sound) {
                    handleSoundLoaded();
                }
                
                @Override
                public void onSoundFailed(String error) {
                    handleSoundError("Sound loading failed: " + error);
                }
            });
            applySpatialSoundProperties();
            if (mNodeJni != null) {
                mNodeJni.setSpatialSound(mSpatialSoundJni);
                mSpatialSoundJni.setSound(mSoundJni);
            }
        }
    }
    
    // Audio source setters
    
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting spatial sound source: " + source);
        mSource = source;
        
        if (source != null) {
            if (source.hasKey("uri")) {
                mUri = source.getString("uri");
            }
            if (source.hasKey("local")) {
                mLocal = source.getString("local");
            }
            if (source.hasKey("resource")) {
                mResource = source.getString("resource");
            }
            loadSpatialSoundAudio();
        }
    }
    
    public void setUri(@Nullable String uri) {
        ViroLog.debug(TAG, "Setting URI: " + uri);
        mUri = uri != null ? uri : "";
        mAudioDirty = true;
        loadSpatialSoundAudio();
    }
    
    public void setLocal(@Nullable String local) {
        ViroLog.debug(TAG, "Setting local: " + local);
        mLocal = local != null ? local : "";
        mAudioDirty = true;
        loadSpatialSoundAudio();
    }
    
    public void setResource(@Nullable String resource) {
        ViroLog.debug(TAG, "Setting resource: " + resource);
        mResource = resource != null ? resource : "";
        mAudioDirty = true;
        loadSpatialSoundAudio();
    }
    
    public void setAudioFormat(@Nullable String audioFormat) {
        ViroLog.debug(TAG, "Setting audio format: " + audioFormat);
        mAudioFormat = audioFormat != null ? audioFormat : "auto";
        mAudioDirty = true;
        loadSpatialSoundAudio();
    }
    
    // Playback control setters
    
    public void setPaused(boolean paused) {
        ViroLog.debug(TAG, "Setting paused: " + paused);
        mPaused = paused;
        
        if (mSoundJni != null) {
            if (paused) {
                pauseSpatialSound();
            } else {
                playSpatialSound();
            }
        }
    }
    
    public void setLoop(boolean loop) {
        ViroLog.debug(TAG, "Setting loop: " + loop);
        mLoop = loop;
        
        if (mSoundJni != null) {
            mSoundJni.setLoop(loop);
        }
    }
    
    public void setMuted(boolean muted) {
        ViroLog.debug(TAG, "Setting muted: " + muted);
        mMuted = muted;
        
        if (mSoundJni != null) {
            mSoundJni.setMuted(muted);
        }
    }
    
    public void setVolume(float volume) {
        ViroLog.debug(TAG, "Setting volume: " + volume);
        mVolume = Math.max(0.0f, Math.min(1.0f, volume));
        
        if (mSoundJni != null) {
            mSoundJni.setVolume(mVolume);
        }
    }
    
    public void setRate(float rate) {
        ViroLog.debug(TAG, "Setting playback rate: " + rate);
        mRate = Math.max(0.1f, Math.min(3.0f, rate));
        
        if (mSoundJni != null) {
            mSoundJni.setPlaybackRate(mRate);
        }
    }
    
    public void setPitch(float pitch) {
        ViroLog.debug(TAG, "Setting pitch: " + pitch);
        mPitch = Math.max(0.1f, Math.min(3.0f, pitch));
        
        if (mSpatialSoundJni != null) {
            mSpatialSoundJni.setPitch(mPitch);
        }
    }
    
    public void setSeekTime(float seekTime) {
        ViroLog.debug(TAG, "Setting seek time: " + seekTime);
        mSeekTime = seekTime;
        
        if (mSoundJni != null) {
            mSoundJni.seekToTime(seekTime);
        }
    }
    
    // 3D position setters
    
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
    
    public void setVelocity(@Nullable ReadableArray velocity) {
        ViroLog.debug(TAG, "Setting velocity: " + velocity);
        
        if (velocity != null && velocity.size() >= 3) {
            try {
                float x = (float) velocity.getDouble(0);
                float y = (float) velocity.getDouble(1);
                float z = (float) velocity.getDouble(2);
                mVelocity = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing velocity: " + e.getMessage());
                mVelocity = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mVelocity = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setDirection(@Nullable ReadableArray direction) {
        ViroLog.debug(TAG, "Setting direction: " + direction);
        
        if (direction != null && direction.size() >= 3) {
            try {
                float x = (float) direction.getDouble(0);
                float y = (float) direction.getDouble(1);
                float z = (float) direction.getDouble(2);
                mDirection = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing direction: " + e.getMessage());
                mDirection = new Vector(0.0f, 0.0f, -1.0f);
            }
        } else {
            mDirection = new Vector(0.0f, 0.0f, -1.0f);
        }
        
        mDirectionalDirty = true;
        updateDirectionalAudio();
    }
    
    // Spatial audio setters
    
    public void setSpatialAudioEnabled(boolean enabled) {
        ViroLog.debug(TAG, "Setting spatial audio enabled: " + enabled);
        mSpatialAudioEnabled = enabled;
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setSpatialAudioQuality(@Nullable String quality) {
        ViroLog.debug(TAG, "Setting spatial audio quality: " + quality);
        mSpatialAudioQuality = quality != null ? quality : "high";
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setSpatialBlend(float spatialBlend) {
        ViroLog.debug(TAG, "Setting spatial blend: " + spatialBlend);
        mSpatialBlend = Math.max(0.0f, Math.min(1.0f, spatialBlend));
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setStereoPan(float stereoPan) {
        ViroLog.debug(TAG, "Setting stereo pan: " + stereoPan);
        mStereoPan = Math.max(-1.0f, Math.min(1.0f, stereoPan));
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    // Distance and attenuation setters
    
    public void setDistanceModel(@Nullable String model) {
        ViroLog.debug(TAG, "Setting distance model: " + model);
        mDistanceModel = model != null ? model : "inverse";
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setMaxDistance(float distance) {
        ViroLog.debug(TAG, "Setting max distance: " + distance);
        mMaxDistance = Math.max(mReferenceDistance, distance);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setReferenceDistance(float distance) {
        ViroLog.debug(TAG, "Setting reference distance: " + distance);
        mReferenceDistance = Math.max(0.1f, distance);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setRolloffFactor(float factor) {
        ViroLog.debug(TAG, "Setting rolloff factor: " + factor);
        mRolloffFactor = Math.max(0.1f, factor);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setMinDistance(float distance) {
        ViroLog.debug(TAG, "Setting min distance: " + distance);
        mMinDistance = Math.max(0.1f, distance);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    // Directional audio setters
    
    public void setDirectional(boolean directional) {
        ViroLog.debug(TAG, "Setting directional: " + directional);
        mDirectional = directional;
        mDirectionalDirty = true;
        updateDirectionalAudio();
    }
    
    public void setConeInnerAngle(float angle) {
        ViroLog.debug(TAG, "Setting cone inner angle: " + angle);
        mConeInnerAngle = Math.max(0.0f, Math.min(360.0f, angle));
        mDirectionalDirty = true;
        updateDirectionalAudio();
    }
    
    public void setConeOuterAngle(float angle) {
        ViroLog.debug(TAG, "Setting cone outer angle: " + angle);
        mConeOuterAngle = Math.max(mConeInnerAngle, Math.min(360.0f, angle));
        mDirectionalDirty = true;
        updateDirectionalAudio();
    }
    
    public void setConeOuterGain(float gain) {
        ViroLog.debug(TAG, "Setting cone outer gain: " + gain);
        mConeOuterGain = Math.max(0.0f, Math.min(1.0f, gain));
        mDirectionalDirty = true;
        updateDirectionalAudio();
    }
    
    public void setDirectionalityPattern(@Nullable String pattern) {
        ViroLog.debug(TAG, "Setting directionality pattern: " + pattern);
        mDirectionalityPattern = pattern != null ? pattern : "cone";
        mDirectionalDirty = true;
        updateDirectionalAudio();
    }
    
    // Doppler effect setters
    
    public void setDopplerEnabled(boolean enabled) {
        ViroLog.debug(TAG, "Setting doppler enabled: " + enabled);
        mDopplerEnabled = enabled;
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setDopplerLevel(float level) {
        ViroLog.debug(TAG, "Setting doppler level: " + level);
        mDopplerLevel = Math.max(0.0f, Math.min(5.0f, level));
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setDopplerFactor(float factor) {
        ViroLog.debug(TAG, "Setting doppler factor: " + factor);
        mDopplerFactor = Math.max(0.0f, Math.min(5.0f, factor));
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    // ViroReact-specific methods
    
    private void applySpatialSoundProperties() {
        if (mSpatialSoundJni != null) {
            ViroLog.debug(TAG, "Applying spatial sound properties to ViroReact SpatialSound");
            
            // Apply spatial audio properties
            mSpatialSoundJni.setSpatialBlend(mSpatialBlend);
            mSpatialSoundJni.setStereoPan(mStereoPan);
            
            // Apply directional properties if enabled
            if (mDirectional) {
                mSpatialSoundJni.setDirectional(true);
                mSpatialSoundJni.setConeInnerAngle(mConeInnerAngle);
                mSpatialSoundJni.setConeOuterAngle(mConeOuterAngle);
                mSpatialSoundJni.setConeOuterGain(mConeOuterGain);
                mSpatialSoundJni.setDirection(mDirection);
                
                SpatialSound.DirectionalityPattern pattern = getDirectionalityPatternEnum(mDirectionalityPattern);
                mSpatialSoundJni.setDirectionalityPattern(pattern);
            }
            
            // Apply Doppler effect if enabled
            if (mDopplerEnabled) {
                mSpatialSoundJni.setDopplerEnabled(true);
                mSpatialSoundJni.setDopplerLevel(mDopplerLevel);
                mSpatialSoundJni.setDopplerFactor(mDopplerFactor);
                mSpatialSoundJni.setVelocity(mVelocity);
            }
            
            // Apply environmental audio
            if (mRoomSize > 0) {
                mSpatialSoundJni.setRoomSize(mRoomSize);
            }
            if (mWetness > 0) {
                mSpatialSoundJni.setReverbWetness(mWetness);
            }
            if (mAirAbsorption > 0) {
                mSpatialSoundJni.setAirAbsorption(mAirAbsorption);
            }
            
            // Apply occlusion and obstruction
            if (mOcclusionEnabled) {
                mSpatialSoundJni.setOcclusionEnabled(true);
                mSpatialSoundJni.setOcclusionStrength(mOcclusionStrength);
                mSpatialSoundJni.setOcclusionLFDamp(mOcclusionLFDamp);
                mSpatialSoundJni.setOcclusionHFDamp(mOcclusionHFDamp);
            }
            
            ViroLog.debug(TAG, "Spatial sound properties applied successfully");
        }
    }
    
    private void applyTransformProperties() {
        if (mNodeJni != null) {
            ViroLog.debug(TAG, "Applying transform properties to ViroReact Node");
            
            // Apply position, rotation, and scale to the node
            mNodeJni.setPosition(mPosition);
            mNodeJni.setRotation(mRotation);
            mNodeJni.setScale(mScale);
            
            ViroLog.debug(TAG, "Transform properties applied successfully");
        }
    }
    
    private void loadSpatialSoundAudio() {
        if (mUri.isEmpty() && mLocal.isEmpty() && mResource.isEmpty()) {
            ViroLog.debug(TAG, "No spatial sound audio source provided");
            return;
        }
        
        String audioSource = !mUri.isEmpty() ? mUri : (!mLocal.isEmpty() ? mLocal : mResource);
        ViroLog.debug(TAG, "Loading spatial sound audio in ViroReact: " + audioSource);
        
        if (mViroContext != null && mSpatialSoundJni != null) {
            // Dispose existing sound if any
            if (mSoundJni != null) {
                mSoundJni.dispose();
            }
            
            // Create new sound with proper rolloff model
            Sound.VolumeRolloff rolloff = getVolumeRolloffEnum(mDistanceModel);
            mSoundJni = new Sound(mViroContext, audioSource, rolloff, new Sound.LoadCallback() {
                @Override
                public void onSoundLoaded(Sound sound) {
                    handleSoundLoaded();
                }
                
                @Override
                public void onSoundFailed(String error) {
                    handleSoundError("Spatial sound audio failed: " + error);
                }
            });
            
            // Configure sound properties
            mSoundJni.setLoop(mLoop);
            mSoundJni.setMuted(mMuted);
            mSoundJni.setVolume(mVolume);
            mSoundJni.setPlaybackRate(mRate);
            
            // Apply spatial audio properties
            mSoundJni.setMinDistance(mMinDistance);
            mSoundJni.setMaxDistance(mMaxDistance);
            mSoundJni.setRolloffFactor(mRolloffFactor);
            
            // Set sound to spatial sound
            mSpatialSoundJni.setSound(mSoundJni);
            
            // Apply spatial sound properties
            applySpatialSoundProperties();
        } else {
            handleSoundError("ViroContext not available for spatial sound audio loading");
        }
    }
    
    private void playSpatialSound() {
        if (mSoundJni != null) {
            ViroLog.debug(TAG, "Playing spatial sound");
            mSoundJni.play();
            emitSpatialSoundEvent("onPlay", createSoundEventData());
        }
    }
    
    private void pauseSpatialSound() {
        if (mSoundJni != null) {
            ViroLog.debug(TAG, "Pausing spatial sound");
            mSoundJni.pause();
            emitSpatialSoundEvent("onPause", createSoundEventData());
        }
    }
    
    private void updateSpatialAudio() {
        if (mSpatialDirty && mSpatialSoundJni != null && mSoundJni != null) {
            ViroLog.debug(TAG, "Updating spatial audio properties");
            
            // Apply spatial audio settings
            mSpatialSoundJni.setSpatialBlend(mSpatialBlend);
            mSpatialSoundJni.setStereoPan(mStereoPan);
            
            // Apply distance and attenuation settings
            mSoundJni.setMinDistance(mMinDistance);
            mSoundJni.setMaxDistance(mMaxDistance);
            mSoundJni.setRolloffFactor(mRolloffFactor);
            
            // Update volume rolloff model
            Sound.VolumeRolloff rolloff = getVolumeRolloffEnum(mDistanceModel);
            mSoundJni.setVolumeRolloff(rolloff);
            
            // Apply Doppler effect if enabled
            if (mDopplerEnabled) {
                mSpatialSoundJni.setDopplerEnabled(true);
                mSpatialSoundJni.setDopplerLevel(mDopplerLevel);
                mSpatialSoundJni.setDopplerFactor(mDopplerFactor);
                mSpatialSoundJni.setVelocity(mVelocity);
            } else {
                mSpatialSoundJni.setDopplerEnabled(false);
            }
            
            mSpatialDirty = false;
            ViroLog.debug(TAG, "Spatial audio properties updated successfully");
        }
    }
    
    private void updateDirectionalAudio() {
        if (mDirectionalDirty && mSpatialSoundJni != null) {
            ViroLog.debug(TAG, "Updating directional audio properties");
            
            if (mDirectional) {
                mSpatialSoundJni.setDirectional(true);
                mSpatialSoundJni.setConeInnerAngle(mConeInnerAngle);
                mSpatialSoundJni.setConeOuterAngle(mConeOuterAngle);
                mSpatialSoundJni.setConeOuterGain(mConeOuterGain);
                mSpatialSoundJni.setDirection(mDirection);
                
                SpatialSound.DirectionalityPattern pattern = getDirectionalityPatternEnum(mDirectionalityPattern);
                mSpatialSoundJni.setDirectionalityPattern(pattern);
            } else {
                mSpatialSoundJni.setDirectional(false);
            }
            
            mDirectionalDirty = false;
            ViroLog.debug(TAG, "Directional audio properties updated successfully");
        }
    }
    
    // Event handlers
    
    private void handleSoundLoaded() {
        ViroLog.debug(TAG, "Spatial sound audio loaded");
        emitSpatialSoundEvent("onLoad", createSoundEventData());
        
        // Auto-play if not paused
        if (!mPaused) {
            playSpatialSound();
        }
    }
    
    private void handleSoundError(String errorMessage) {
        ViroLog.error(TAG, "Spatial sound error: " + errorMessage);
        
        WritableMap eventData = createSoundEventData();
        eventData.putString("error", errorMessage);
        emitSpatialSoundEvent("onError", eventData);
    }
    
    private WritableMap createSoundEventData() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("uri", mUri);
        eventData.putBoolean("paused", mPaused);
        eventData.putBoolean("loop", mLoop);
        eventData.putBoolean("muted", mMuted);
        eventData.putDouble("volume", mVolume);
        eventData.putDouble("rate", mRate);
        eventData.putDouble("pitch", mPitch);
        eventData.putBoolean("spatialAudioEnabled", mSpatialAudioEnabled);
        eventData.putDouble("spatialBlend", mSpatialBlend);
        eventData.putBoolean("directional", mDirectional);
        eventData.putBoolean("dopplerEnabled", mDopplerEnabled);
        eventData.putDouble("maxDistance", mMaxDistance);
        eventData.putDouble("referenceDistance", mReferenceDistance);
        return eventData;
    }
    
    /**
     * Emit spatial sound events for ViroReact integration
     */
    public void emitSpatialSoundEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    // Helper methods to convert string properties to enum values
    
    private SpatialSound.DirectionalityPattern getDirectionalityPatternEnum(String pattern) {
        switch (pattern.toLowerCase()) {
            case "cardioid":
                return SpatialSound.DirectionalityPattern.CARDIOID;
            case "bidirectional":
                return SpatialSound.DirectionalityPattern.BIDIRECTIONAL;
            default:
            case "cone":
                return SpatialSound.DirectionalityPattern.CONE;
        }
    }
    
    private Sound.VolumeRolloff getVolumeRolloffEnum(String distanceModel) {
        switch (distanceModel.toLowerCase()) {
            case "linear":
                return Sound.VolumeRolloff.LINEAR;
            case "exponential":
                return Sound.VolumeRolloff.EXPONENTIAL;
            default:
            case "inverse":
                return Sound.VolumeRolloff.LOGARITHMIC;
        }
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop sound playback
        if (mSoundJni != null) {
            mSoundJni.pause();
        }
        
        // Clean up ViroReact spatial sound resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setSpatialSound(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mSpatialSoundJni != null) {
            mSpatialSoundJni.dispose();
            mSpatialSoundJni = null;
        }
        
        if (mSoundJni != null) {
            mSoundJni.dispose();
            mSoundJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mSource = null;
        mEnvironmentalAudio = null;
        mReverb = null;
        mReverbZone = null;
        mEffects = null;
        mLowPassFilter = null;
        mHighPassFilter = null;
        mBandPassFilter = null;
        mDistortion = null;
        mChorus = null;
        mEcho = null;
        mTransformBehaviors = null;
        mAnimation = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroSpatialSoundView attached to window");
        
        // Spatial sound will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mSpatialSoundJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact spatial sound ready for scene attachment");
        }
        
        // Ensure spatial sound properties are applied
        applySpatialSoundProperties();
        applyTransformProperties();
        
        // Update audio and spatial audio if dirty
        if (mAudioDirty) {
            loadSpatialSoundAudio();
        }
        if (mSpatialDirty) {
            updateSpatialAudio();
        }
        if (mDirectionalDirty) {
            updateDirectionalAudio();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroSpatialSoundView detached from window");
        
        // Pause sound when detached
        if (mSoundJni != null) {
            mSoundJni.pause();
        }
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public String getUri() { return mUri; }
    public String getLocal() { return mLocal; }
    public String getResource() { return mResource; }
    public String getAudioFormat() { return mAudioFormat; }
    public boolean isPaused() { return mPaused; }
    public boolean isLoop() { return mLoop; }
    public boolean isMuted() { return mMuted; }
    public float getVolume() { return mVolume; }
    public float getRate() { return mRate; }
    public float getPitch() { return mPitch; }
    public float getSeekTime() { return mSeekTime; }
    public Vector getPosition() { return mPosition; }
    public Vector getRotation() { return mRotation; }
    public Vector getScale() { return mScale; }
    public Vector getVelocity() { return mVelocity; }
    public Vector getDirection() { return mDirection; }
    public Vector getUp() { return mUp; }
    public boolean isSpatialAudioEnabled() { return mSpatialAudioEnabled; }
    public String getSpatialAudioQuality() { return mSpatialAudioQuality; }
    public float getSpatialBlend() { return mSpatialBlend; }
    public float getStereoPan() { return mStereoPan; }
    public String getDistanceModel() { return mDistanceModel; }
    public float getMaxDistance() { return mMaxDistance; }
    public float getReferenceDistance() { return mReferenceDistance; }
    public float getRolloffFactor() { return mRolloffFactor; }
    public float getMinDistance() { return mMinDistance; }
    public boolean isDirectional() { return mDirectional; }
    public float getConeInnerAngle() { return mConeInnerAngle; }
    public float getConeOuterAngle() { return mConeOuterAngle; }
    public float getConeOuterGain() { return mConeOuterGain; }
    public String getDirectionalityPattern() { return mDirectionalityPattern; }
    public boolean isDopplerEnabled() { return mDopplerEnabled; }
    public float getDopplerLevel() { return mDopplerLevel; }
    public float getDopplerFactor() { return mDopplerFactor; }
    public float getSpeedOfSound() { return mSpeedOfSound; }
    public float getAirAbsorption() { return mAirAbsorption; }
    public float getWetness() { return mWetness; }
    public float getRoomSize() { return mRoomSize; }
    public boolean isOcclusionEnabled() { return mOcclusionEnabled; }
    public float getOcclusionStrength() { return mOcclusionStrength; }
    public String getProcessingQuality() { return mProcessingQuality; }
    public boolean isAudioDirty() { return mAudioDirty; }
    public boolean isSpatialDirty() { return mSpatialDirty; }
    public boolean isDirectionalDirty() { return mDirectionalDirty; }
    public boolean isEffectsDirty() { return mEffectsDirty; }
}