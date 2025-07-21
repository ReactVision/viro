//
//  ViroSoundFieldView.java
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

import com.viro.core.AmbientSound;
import com.viro.core.EventDelegate;
import com.viro.core.Node;
import com.viro.core.Sound;
import com.viro.core.SoundField;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroSoundField component.
 * ViroSoundField provides comprehensive spatial audio field functionality with ViroReact 3D integration,
 * supporting ambisonic audio, environmental effects, 3D spatial positioning, and advanced audio processing.
 */
public class ViroSoundFieldView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroSoundFieldView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private SoundField mSoundFieldJni;
    private Sound mSoundJni;
    private AmbientSound mAmbientSoundJni;
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
    private float mSeekTime = 0.0f;
    
    // Spatial audio properties
    private boolean mSpatialAudioEnabled = true;
    private String mSpatialAudioQuality = "high"; // "low", "medium", "high", "ultra"
    private float mMinDistance = 0.5f;
    private float mMaxDistance = 1000.0f;
    private String mDistanceModel = "inverse"; // "inverse", "linear", "exponential"
    private float mRolloffFactor = 1.0f;
    
    // Sound field properties
    private String mFieldType = "spherical"; // "spherical", "cylindrical", "directional", "ambient"
    private Vector mFieldSize = new Vector(10.0f, 10.0f, 10.0f);
    private float mFieldIntensity = 1.0f;
    private float mFieldFalloff = 1.0f;
    private Vector mFieldDirection = new Vector(0.0f, 0.0f, -1.0f);
    private String mFieldPattern = "omnidirectional"; // "omnidirectional", "directional", "cardioid", "bidirectional"
    
    // Ambisonic audio properties
    private boolean mAmbisonicEnabled = false;
    private int mAmbisonicOrder = 1; // 1st, 2nd, 3rd order ambisonic
    private String mAmbisonicFormat = "AmbiX"; // "AmbiX", "FuMA"
    private String mAmbisonicChannelOrder = "ACN"; // "ACN", "FuMA"
    private String mAmbisonicNormalization = "SN3D"; // "SN3D", "N3D", "FuMA"
    private float mAmbisonicRotationX = 0.0f;
    private float mAmbisonicRotationY = 0.0f;
    private float mAmbisonicRotationZ = 0.0f;
    
    // Environmental audio properties
    private ReadableMap mEnvironmentalAudio;
    private ReadableMap mReverb;
    private Vector mRoomSize = new Vector(10.0f, 3.0f, 10.0f);
    private ReadableMap mRoomMaterials;
    private ReadableMap mReflections;
    private float mReverbGain = 0.3f;
    private float mReverbDelay = 0.1f;
    private float mReverbDecay = 1.5f;
    
    // Audio effects properties
    private ReadableArray mEffects;
    private ReadableArray mFilters;
    private ReadableMap mEqualizer;
    private ReadableMap mCompressor;
    private ReadableMap mLimiter;
    private boolean mEffectsEnabled = true;
    
    // Occlusion and obstruction properties
    private boolean mOcclusionEnabled = false;
    private float mOcclusionStrength = 1.0f;
    private boolean mObstructionEnabled = false;
    private float mObstructionStrength = 1.0f;
    
    // Transform properties
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotationPivot;
    private Vector mScalePivot;
    private ReadableArray mTransformBehaviors;
    
    // Performance properties
    private String mProcessingQuality = "high"; // "low", "medium", "high", "ultra"
    private int mBufferSize = 4096;
    private int mSampleRate = 44100;
    private boolean mOptimizationEnabled = true;
    
    // Animation and interaction
    private ReadableMap mAnimation;
    private String mViroTag;
    
    // Internal state
    private boolean mAudioDirty = true;
    private boolean mSpatialDirty = true;
    private boolean mFieldDirty = true;
    private boolean mEffectsDirty = true;
    
    public ViroSoundFieldView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroSoundFieldView initialized with ViroReact Spatial Audio Field integration");
        
        initializeSoundField();
    }
    
    private void initializeSoundField() {
        ViroLog.debug(TAG, "Initializing ViroReact sound field with default properties");
        
        // Create ViroReact Node for the sound field
        mNodeJni = new Node();
        
        // Create SoundField for spatial audio
        mSoundFieldJni = new SoundField(mViroContext);
        
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
        
        // Configure initial sound field properties
        applySoundFieldProperties();
        
        // Attach sound field to node
        mNodeJni.setSoundField(mSoundFieldJni);
        mSoundFieldJni.setSound(mSoundJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Sound field views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Sound Field initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroSoundFieldView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroSoundFieldView> mSoundFieldView;
        
        public VRTComponentWrapper(ViroSoundFieldView soundFieldView) {
            super(soundFieldView.getContext(), null, -1, -1, soundFieldView.mReactContext);
            mSoundFieldView = new WeakReference<>(soundFieldView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroSoundFieldView soundFieldView = mSoundFieldView.get();
            if (soundFieldView != null) {
                soundFieldView.emitSoundFieldEvent(eventName, eventData);
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
     * Get the underlying ViroReact SoundField object
     */
    public SoundField getSoundFieldJni() {
        return mSoundFieldJni;
    }
    
    /**
     * Get the underlying ViroReact Sound object
     */
    public Sound getSoundJni() {
        return mSoundJni;
    }
    
    /**
     * Set the ViroContext for this sound field
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate sound field components with ViroContext if needed
        if (mSoundFieldJni != null) {
            mSoundFieldJni.dispose();
            mSoundFieldJni = new SoundField(mViroContext);
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
            applySoundFieldProperties();
            if (mNodeJni != null) {
                mNodeJni.setSoundField(mSoundFieldJni);
                mSoundFieldJni.setSound(mSoundJni);
            }
        }
    }
    
    // Audio source setters
    
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting sound field source: " + source);
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
            loadSoundFieldAudio();
        }
    }
    
    public void setUri(@Nullable String uri) {
        ViroLog.debug(TAG, "Setting URI: " + uri);
        mUri = uri != null ? uri : "";
        mAudioDirty = true;
        loadSoundFieldAudio();
    }
    
    public void setLocal(@Nullable String local) {
        ViroLog.debug(TAG, "Setting local: " + local);
        mLocal = local != null ? local : "";
        mAudioDirty = true;
        loadSoundFieldAudio();
    }
    
    public void setResource(@Nullable String resource) {
        ViroLog.debug(TAG, "Setting resource: " + resource);
        mResource = resource != null ? resource : "";
        mAudioDirty = true;
        loadSoundFieldAudio();
    }
    
    public void setAudioFormat(@Nullable String audioFormat) {
        ViroLog.debug(TAG, "Setting audio format: " + audioFormat);
        mAudioFormat = audioFormat != null ? audioFormat : "auto";
        mAudioDirty = true;
        loadSoundFieldAudio();
    }
    
    // Playback control setters
    
    public void setPaused(boolean paused) {
        ViroLog.debug(TAG, "Setting paused: " + paused);
        mPaused = paused;
        
        if (mSoundJni != null) {
            if (paused) {
                pauseSoundField();
            } else {
                playSoundField();
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
    
    public void setSeekTime(float seekTime) {
        ViroLog.debug(TAG, "Setting seek time: " + seekTime);
        mSeekTime = seekTime;
        
        if (mSoundJni != null) {
            mSoundJni.seekToTime(seekTime);
        }
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
    
    public void setMinDistance(float distance) {
        ViroLog.debug(TAG, "Setting min distance: " + distance);
        mMinDistance = Math.max(0.1f, distance);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setMaxDistance(float distance) {
        ViroLog.debug(TAG, "Setting max distance: " + distance);
        mMaxDistance = Math.max(mMinDistance, distance);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setDistanceModel(@Nullable String model) {
        ViroLog.debug(TAG, "Setting distance model: " + model);
        mDistanceModel = model != null ? model : "inverse";
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    public void setRolloffFactor(float factor) {
        ViroLog.debug(TAG, "Setting rolloff factor: " + factor);
        mRolloffFactor = Math.max(0.1f, factor);
        mSpatialDirty = true;
        updateSpatialAudio();
    }
    
    // Sound field setters
    
    public void setFieldType(@Nullable String fieldType) {
        ViroLog.debug(TAG, "Setting field type: " + fieldType);
        mFieldType = fieldType != null ? fieldType : "spherical";
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setFieldSize(@Nullable ReadableArray fieldSize) {
        ViroLog.debug(TAG, "Setting field size: " + fieldSize);
        
        if (fieldSize != null && fieldSize.size() >= 3) {
            try {
                float x = (float) fieldSize.getDouble(0);
                float y = (float) fieldSize.getDouble(1);
                float z = (float) fieldSize.getDouble(2);
                mFieldSize = new Vector(Math.max(0.1f, x), Math.max(0.1f, y), Math.max(0.1f, z));
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing field size: " + e.getMessage());
                mFieldSize = new Vector(10.0f, 10.0f, 10.0f);
            }
        } else {
            mFieldSize = new Vector(10.0f, 10.0f, 10.0f);
        }
        
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setFieldIntensity(float intensity) {
        ViroLog.debug(TAG, "Setting field intensity: " + intensity);
        mFieldIntensity = Math.max(0.0f, Math.min(2.0f, intensity));
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setFieldFalloff(float falloff) {
        ViroLog.debug(TAG, "Setting field falloff: " + falloff);
        mFieldFalloff = Math.max(0.1f, Math.min(5.0f, falloff));
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setFieldDirection(@Nullable ReadableArray direction) {
        ViroLog.debug(TAG, "Setting field direction: " + direction);
        
        if (direction != null && direction.size() >= 3) {
            try {
                float x = (float) direction.getDouble(0);
                float y = (float) direction.getDouble(1);
                float z = (float) direction.getDouble(2);
                mFieldDirection = new Vector(x, y, z);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing field direction: " + e.getMessage());
                mFieldDirection = new Vector(0.0f, 0.0f, -1.0f);
            }
        } else {
            mFieldDirection = new Vector(0.0f, 0.0f, -1.0f);
        }
        
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setFieldPattern(@Nullable String pattern) {
        ViroLog.debug(TAG, "Setting field pattern: " + pattern);
        mFieldPattern = pattern != null ? pattern : "omnidirectional";
        mFieldDirty = true;
        updateSoundField();
    }
    
    // Ambisonic setters
    
    public void setAmbisonicEnabled(boolean enabled) {
        ViroLog.debug(TAG, "Setting ambisonic enabled: " + enabled);
        mAmbisonicEnabled = enabled;
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setAmbisonicOrder(int order) {
        ViroLog.debug(TAG, "Setting ambisonic order: " + order);
        mAmbisonicOrder = Math.max(1, Math.min(3, order));
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setAmbisonicFormat(@Nullable String format) {
        ViroLog.debug(TAG, "Setting ambisonic format: " + format);
        mAmbisonicFormat = format != null ? format : "AmbiX";
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setAmbisonicRotation(@Nullable ReadableArray rotation) {
        ViroLog.debug(TAG, "Setting ambisonic rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                mAmbisonicRotationX = (float) Math.toRadians(rotation.getDouble(0));
                mAmbisonicRotationY = (float) Math.toRadians(rotation.getDouble(1));
                mAmbisonicRotationZ = (float) Math.toRadians(rotation.getDouble(2));
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing ambisonic rotation: " + e.getMessage());
                mAmbisonicRotationX = mAmbisonicRotationY = mAmbisonicRotationZ = 0.0f;
            }
        } else {
            mAmbisonicRotationX = mAmbisonicRotationY = mAmbisonicRotationZ = 0.0f;
        }
        
        mFieldDirty = true;
        updateSoundField();
    }
    
    // Environmental audio setters
    
    public void setEnvironmentalAudio(@Nullable ReadableMap environmentalAudio) {
        ViroLog.debug(TAG, "Setting environmental audio: " + environmentalAudio);
        mEnvironmentalAudio = environmentalAudio;
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setReverb(@Nullable ReadableMap reverb) {
        ViroLog.debug(TAG, "Setting reverb: " + reverb);
        mReverb = reverb;
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setRoomSize(@Nullable ReadableArray roomSize) {
        ViroLog.debug(TAG, "Setting room size: " + roomSize);
        
        if (roomSize != null && roomSize.size() >= 3) {
            try {
                float x = (float) roomSize.getDouble(0);
                float y = (float) roomSize.getDouble(1);
                float z = (float) roomSize.getDouble(2);
                mRoomSize = new Vector(Math.max(1.0f, x), Math.max(1.0f, y), Math.max(1.0f, z));
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing room size: " + e.getMessage());
                mRoomSize = new Vector(10.0f, 3.0f, 10.0f);
            }
        } else {
            mRoomSize = new Vector(10.0f, 3.0f, 10.0f);
        }
        
        mFieldDirty = true;
        updateSoundField();
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
    
    // Performance setters
    
    public void setProcessingQuality(@Nullable String quality) {
        ViroLog.debug(TAG, "Setting processing quality: " + quality);
        mProcessingQuality = quality != null ? quality : "high";
        mFieldDirty = true;
        updateSoundField();
    }
    
    public void setBufferSize(int bufferSize) {
        ViroLog.debug(TAG, "Setting buffer size: " + bufferSize);
        mBufferSize = Math.max(1024, Math.min(16384, bufferSize));
        mAudioDirty = true;
        loadSoundFieldAudio();
    }
    
    public void setSampleRate(int sampleRate) {
        ViroLog.debug(TAG, "Setting sample rate: " + sampleRate);
        mSampleRate = Math.max(22050, Math.min(96000, sampleRate));
        mAudioDirty = true;
        loadSoundFieldAudio();
    }
    
    // ViroReact-specific methods
    
    private void applySoundFieldProperties() {
        if (mSoundFieldJni != null) {
            ViroLog.debug(TAG, "Applying sound field properties to ViroReact SoundField");
            
            // Apply field type and size
            SoundField.FieldType fieldType = getFieldTypeEnum(mFieldType);
            mSoundFieldJni.setFieldType(fieldType);
            mSoundFieldJni.setFieldSize(mFieldSize);
            
            // Apply field properties
            mSoundFieldJni.setIntensity(mFieldIntensity);
            mSoundFieldJni.setFalloff(mFieldFalloff);
            mSoundFieldJni.setDirection(mFieldDirection);
            
            // Apply field pattern
            SoundField.FieldPattern pattern = getFieldPatternEnum(mFieldPattern);
            mSoundFieldJni.setFieldPattern(pattern);
            
            // Apply ambisonic properties if enabled
            if (mAmbisonicEnabled) {
                mSoundFieldJni.setAmbisonicEnabled(true);
                mSoundFieldJni.setAmbisonicOrder(mAmbisonicOrder);
                SoundField.AmbisonicFormat format = getAmbisonicFormatEnum(mAmbisonicFormat);
                mSoundFieldJni.setAmbisonicFormat(format);
                mSoundFieldJni.setAmbisonicRotation(mAmbisonicRotationX, mAmbisonicRotationY, mAmbisonicRotationZ);
            }
            
            // Apply environmental audio
            if (mRoomSize != null) {
                mSoundFieldJni.setRoomSize(mRoomSize);
            }
            if (mReverbGain > 0) {
                mSoundFieldJni.setReverbGain(mReverbGain);
                mSoundFieldJni.setReverbDelay(mReverbDelay);
                mSoundFieldJni.setReverbDecay(mReverbDecay);
            }
            
            ViroLog.debug(TAG, "Sound field properties applied successfully");
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
    
    private void loadSoundFieldAudio() {
        if (mUri.isEmpty() && mLocal.isEmpty() && mResource.isEmpty()) {
            ViroLog.debug(TAG, "No sound field audio source provided");
            return;
        }
        
        String audioSource = !mUri.isEmpty() ? mUri : (!mLocal.isEmpty() ? mLocal : mResource);
        ViroLog.debug(TAG, "Loading sound field audio in ViroReact: " + audioSource);
        
        if (mViroContext != null && mSoundFieldJni != null) {
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
                    handleSoundError("Sound field audio failed: " + error);
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
            
            // Set sound to sound field
            mSoundFieldJni.setSound(mSoundJni);
            
            // Apply sound field properties
            applySoundFieldProperties();
        } else {
            handleSoundError("ViroContext not available for sound field audio loading");
        }
    }
    
    private void playSoundField() {
        if (mSoundJni != null) {
            ViroLog.debug(TAG, "Playing sound field");
            mSoundJni.play();
            emitSoundFieldEvent("onPlay", createSoundEventData());
        }
    }
    
    private void pauseSoundField() {
        if (mSoundJni != null) {
            ViroLog.debug(TAG, "Pausing sound field");
            mSoundJni.pause();
            emitSoundFieldEvent("onPause", createSoundEventData());
        }
    }
    
    private void updateSpatialAudio() {
        if (mSpatialDirty && mSoundJni != null) {
            ViroLog.debug(TAG, "Updating spatial audio properties");
            
            // Apply spatial audio settings
            mSoundJni.setMinDistance(mMinDistance);
            mSoundJni.setMaxDistance(mMaxDistance);
            mSoundJni.setRolloffFactor(mRolloffFactor);
            
            // Update volume rolloff model
            Sound.VolumeRolloff rolloff = getVolumeRolloffEnum(mDistanceModel);
            mSoundJni.setVolumeRolloff(rolloff);
            
            mSpatialDirty = false;
            ViroLog.debug(TAG, "Spatial audio properties updated successfully");
        }
    }
    
    private void updateSoundField() {
        if (mFieldDirty && mSoundFieldJni != null) {
            ViroLog.debug(TAG, "Updating sound field properties");
            
            applySoundFieldProperties();
            
            mFieldDirty = false;
            ViroLog.debug(TAG, "Sound field properties updated successfully");
        }
    }
    
    // Event handlers
    
    private void handleSoundLoaded() {
        ViroLog.debug(TAG, "Sound field audio loaded");
        emitSoundFieldEvent("onLoad", createSoundEventData());
        
        // Auto-play if not paused
        if (!mPaused) {
            playSoundField();
        }
    }
    
    private void handleSoundError(String errorMessage) {
        ViroLog.error(TAG, "Sound field error: " + errorMessage);
        
        WritableMap eventData = createSoundEventData();
        eventData.putString("error", errorMessage);
        emitSoundFieldEvent("onError", eventData);
    }
    
    private WritableMap createSoundEventData() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("uri", mUri);
        eventData.putBoolean("paused", mPaused);
        eventData.putBoolean("loop", mLoop);
        eventData.putBoolean("muted", mMuted);
        eventData.putDouble("volume", mVolume);
        eventData.putDouble("rate", mRate);
        eventData.putBoolean("spatialAudioEnabled", mSpatialAudioEnabled);
        eventData.putString("fieldType", mFieldType);
        eventData.putDouble("fieldIntensity", mFieldIntensity);
        eventData.putBoolean("ambisonicEnabled", mAmbisonicEnabled);
        eventData.putInt("ambisonicOrder", mAmbisonicOrder);
        return eventData;
    }
    
    /**
     * Emit sound field events for ViroReact integration
     */
    public void emitSoundFieldEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    private SoundField.FieldType getFieldTypeEnum(String fieldType) {
        switch (fieldType.toLowerCase()) {
            case "cylindrical":
                return SoundField.FieldType.CYLINDRICAL;
            case "directional":
                return SoundField.FieldType.DIRECTIONAL;
            case "ambient":
                return SoundField.FieldType.AMBIENT;
            default:
            case "spherical":
                return SoundField.FieldType.SPHERICAL;
        }
    }
    
    private SoundField.FieldPattern getFieldPatternEnum(String fieldPattern) {
        switch (fieldPattern.toLowerCase()) {
            case "directional":
                return SoundField.FieldPattern.DIRECTIONAL;
            case "cardioid":
                return SoundField.FieldPattern.CARDIOID;
            case "bidirectional":
                return SoundField.FieldPattern.BIDIRECTIONAL;
            default:
            case "omnidirectional":
                return SoundField.FieldPattern.OMNIDIRECTIONAL;
        }
    }
    
    private SoundField.AmbisonicFormat getAmbisonicFormatEnum(String ambisonicFormat) {
        switch (ambisonicFormat.toLowerCase()) {
            case "fuma":
                return SoundField.AmbisonicFormat.FUMA;
            default:
            case "ambix":
                return SoundField.AmbisonicFormat.AMBIX;
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
        
        // Clean up ViroReact sound field resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.setSoundField(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mSoundFieldJni != null) {
            mSoundFieldJni.dispose();
            mSoundFieldJni = null;
        }
        
        if (mSoundJni != null) {
            mSoundJni.dispose();
            mSoundJni = null;
        }
        
        if (mAmbientSoundJni != null) {
            mAmbientSoundJni.dispose();
            mAmbientSoundJni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mSource = null;
        mEnvironmentalAudio = null;
        mReverb = null;
        mRoomMaterials = null;
        mReflections = null;
        mEffects = null;
        mFilters = null;
        mEqualizer = null;
        mCompressor = null;
        mLimiter = null;
        mTransformBehaviors = null;
        mAnimation = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroSoundFieldView attached to window");
        
        // Sound field will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mSoundFieldJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact sound field ready for scene attachment");
        }
        
        // Ensure sound field properties are applied
        applySoundFieldProperties();
        applyTransformProperties();
        
        // Update audio and spatial audio if dirty
        if (mAudioDirty) {
            loadSoundFieldAudio();
        }
        if (mSpatialDirty) {
            updateSpatialAudio();
        }
        if (mFieldDirty) {
            updateSoundField();
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroSoundFieldView detached from window");
        
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
    public float getSeekTime() { return mSeekTime; }
    public boolean isSpatialAudioEnabled() { return mSpatialAudioEnabled; }
    public String getSpatialAudioQuality() { return mSpatialAudioQuality; }
    public float getMinDistance() { return mMinDistance; }
    public float getMaxDistance() { return mMaxDistance; }
    public String getDistanceModel() { return mDistanceModel; }
    public float getRolloffFactor() { return mRolloffFactor; }
    public String getFieldType() { return mFieldType; }
    public Vector getFieldSize() { return mFieldSize; }
    public float getFieldIntensity() { return mFieldIntensity; }
    public float getFieldFalloff() { return mFieldFalloff; }
    public Vector getFieldDirection() { return mFieldDirection; }
    public String getFieldPattern() { return mFieldPattern; }
    public boolean isAmbisonicEnabled() { return mAmbisonicEnabled; }
    public int getAmbisonicOrder() { return mAmbisonicOrder; }
    public String getAmbisonicFormat() { return mAmbisonicFormat; }
    public Vector getRoomSize() { return mRoomSize; }
    public Vector getPosition() { return mPosition; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public String getProcessingQuality() { return mProcessingQuality; }
    public int getBufferSize() { return mBufferSize; }
    public int getSampleRate() { return mSampleRate; }
    public boolean isAudioDirty() { return mAudioDirty; }
    public boolean isSpatialDirty() { return mSpatialDirty; }
    public boolean isFieldDirty() { return mFieldDirty; }
    public boolean isEffectsDirty() { return mEffectsDirty; }
}