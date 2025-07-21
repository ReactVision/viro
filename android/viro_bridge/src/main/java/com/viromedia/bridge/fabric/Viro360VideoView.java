//
//  Viro360VideoView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.media.MediaPlayer;
import android.net.Uri;
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
import com.viro.core.Sphere;
import com.viro.core.Texture;
import com.viro.core.Vector;
import com.viro.core.Video360;
import com.viro.core.VideoTexture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for Viro360Video component.
 * Viro360Video provides comprehensive 360° immersive video functionality with ViroReact 3D integration,
 * supporting equirectangular videos, stereoscopic content, and interactive playback controls.
 */
public class Viro360VideoView extends View {
    
    private static final String TAG = ViroLog.getTag(Viro360VideoView.class);
    
    // Video states
    public enum PlaybackState {
        IDLE("idle"),
        LOADING("loading"),
        PLAYING("playing"),
        PAUSED("paused"),
        STOPPED("stopped"),
        ERROR("error");
        
        private final String value;
        
        PlaybackState(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Sphere mSphereJni;
    private Video360 mVideo360Jni;
    private Material mMaterialJni;
    private VideoTexture mVideoTextureJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Video properties
    private ReadableMap mSource;
    private String mUri = "";
    private boolean mPaused = true;
    private boolean mLoop = false;
    private boolean mMuted = false;
    private float mVolume = 1.0f;
    private float mPlaybackRate = 1.0f;
    
    // 360° video specific properties
    private boolean mStereoMode = false;
    private String mStereoLayout = "topBottom"; // "topBottom", "leftRight"
    private String mFormat = "equirectangular"; // "equirectangular", "cubemap"
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    
    // Playback state
    private PlaybackState mPlaybackState = PlaybackState.IDLE;
    private float mCurrentTime = 0.0f;
    private float mDuration = 0.0f;
    private boolean mIsBuffering = false;
    
    // Legacy MediaPlayer (for fallback)
    private MediaPlayer mMediaPlayer;
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    public Viro360VideoView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "Viro360VideoView initialized with ViroReact 360° Video integration");
        
        initialize360Video();
        setupMediaPlayer();
    }
    
    private void initialize360Video() {
        ViroLog.debug(TAG, "Initializing ViroReact 360° video with default properties");
        
        // Create ViroReact Node for the 360° video
        mNodeJni = new Node();
        
        // Create Sphere geometry for 360° video projection
        mSphereJni = new Sphere(1.0f); // 1 meter radius
        
        // Create Video360 for panoramic video handling
        mVideo360Jni = new Video360(mViroContext);
        
        // Create Material for the 360° video
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial 360° video properties
        apply360VideoProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mSphereJni);
        mSphereJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // 360° video views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact 360° Video initialized successfully");
    }
    
    /**
     * Wrapper class to make Viro360VideoView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<Viro360VideoView> m360VideoView;
        
        public VRTComponentWrapper(Viro360VideoView videoView) {
            super(videoView.getContext(), null, -1, -1, videoView.mReactContext);
            m360VideoView = new WeakReference<>(videoView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            Viro360VideoView videoView = m360VideoView.get();
            if (videoView != null) {
                videoView.emit360VideoEvent(eventName, eventData);
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
     * Get the underlying ViroReact Sphere object
     */
    public Sphere getSphereJni() {
        return mSphereJni;
    }
    
    /**
     * Get the underlying ViroReact Video360 object
     */
    public Video360 getVideo360Jni() {
        return mVideo360Jni;
    }
    
    /**
     * Set the ViroContext for this 360° video
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate 360° video components with ViroContext if needed
        if (mVideo360Jni != null) {
            mVideo360Jni.dispose();
            mVideo360Jni = new Video360(mViroContext);
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            apply360VideoProperties();
            if (mSphereJni != null) {
                mSphereJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
            }
        }
    }
    
    private void setupMediaPlayer() {
        mMediaPlayer = new MediaPlayer();
        // Setup media player listeners for fallback functionality
    }
    
    // Property setters
    
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting 360° video source: " + source);
        mSource = source;
        
        if (source != null && source.hasKey("uri")) {
            mUri = source.getString("uri");
            load360Video();
        }
    }
    
    public void setPaused(boolean paused) {
        ViroLog.debug(TAG, "Setting paused: " + paused);
        mPaused = paused;
        
        if (mVideoTextureJni != null) {
            if (paused) {
                pause360Video();
            } else {
                play360Video();
            }
        }
    }
    
    public void setLoop(boolean loop) {
        ViroLog.debug(TAG, "Setting loop: " + loop);
        mLoop = loop;
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.setLoop(loop);
        }
    }
    
    public void setMuted(boolean muted) {
        ViroLog.debug(TAG, "Setting muted: " + muted);
        mMuted = muted;
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.setMuted(muted);
        }
    }
    
    public void setVolume(float volume) {
        ViroLog.debug(TAG, "Setting volume: " + volume);
        mVolume = Math.max(0.0f, Math.min(1.0f, volume)); // Clamp between 0 and 1
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.setVolume(mVolume);
        }
    }
    
    public void setPlaybackRate(float rate) {
        ViroLog.debug(TAG, "Setting playback rate: " + rate);
        mPlaybackRate = Math.max(0.1f, Math.min(3.0f, rate)); // Clamp between 0.1 and 3.0
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.setPlaybackRate(mPlaybackRate);
        }
    }
    
    public void setStereoMode(boolean stereoMode) {
        ViroLog.debug(TAG, "Setting stereo mode: " + stereoMode);
        mStereoMode = stereoMode;
        apply360VideoProperties();
    }
    
    public void setStereoLayout(@Nullable String layout) {
        ViroLog.debug(TAG, "Setting stereo layout: " + layout);
        mStereoLayout = layout != null ? layout : "topBottom";
        apply360VideoProperties();
    }
    
    public void setFormat(@Nullable String format) {
        ViroLog.debug(TAG, "Setting format: " + format);
        mFormat = format != null ? format : "equirectangular";
        apply360VideoProperties();
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
        
        if (mNodeJni != null) {
            mNodeJni.setRotation(mRotation);
        }
    }
    
    // ViroReact-specific methods
    
    private void apply360VideoProperties() {
        if (mMaterialJni != null) {
            ViroLog.debug(TAG, "Applying 360° video properties to ViroReact Material");
            
            // Apply stereo mode if enabled
            if (mStereoMode) {
                Material.StereoMode stereoMode = Material.StereoMode.fromString(mStereoLayout);
                mMaterialJni.setStereoMode(stereoMode);
            }
            
            ViroLog.debug(TAG, "360° video properties applied successfully");
        }
        
        if (mNodeJni != null && mRotation != null) {
            mNodeJni.setRotation(mRotation);
        }
    }
    
    private void load360Video() {
        if (mUri.isEmpty()) {
            ViroLog.debug(TAG, "No 360° video URI provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading 360° video in ViroReact: " + mUri);
        setPlaybackState(PlaybackState.LOADING);
        
        if (mViroContext != null && mMaterialJni != null) {
            // Create video texture from URI
            mVideoTextureJni = new VideoTexture(mViroContext, mUri, new VideoTexture.PlaybackListener() {
                @Override
                public void onVideoBufferStart() {
                    handleVideoBufferStart();
                }
                
                @Override
                public void onVideoBufferEnd() {
                    handleVideoBufferEnd();
                }
                
                @Override
                public void onVideoFinished() {
                    handleVideoFinished();
                }
                
                @Override
                public void onReady() {
                    handleVideoReady();
                }
                
                @Override
                public void onVideoFailed(String error) {
                    handleVideoError("360° video failed: " + error);
                }
                
                @Override
                public void onVideoUpdatedTime(float currentTime, float totalTime) {
                    handleVideoTimeUpdate(currentTime, totalTime);
                }
            });
            
            // Configure video texture properties
            mVideoTextureJni.setLoop(mLoop);
            mVideoTextureJni.setMuted(mMuted);
            mVideoTextureJni.setVolume(mVolume);
            mVideoTextureJni.setPlaybackRate(mPlaybackRate);
            
            // Set video texture to material
            mMaterialJni.setDiffuseTexture(mVideoTextureJni);
            
            // Apply 360° video properties
            apply360VideoProperties();
        } else {
            handleVideoError("ViroContext not available for 360° video loading");
        }
    }
    
    private void play360Video() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Playing 360° video");
            mVideoTextureJni.play();
            setPlaybackState(PlaybackState.PLAYING);
        }
    }
    
    private void pause360Video() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Pausing 360° video");
            mVideoTextureJni.pause();
            setPlaybackState(PlaybackState.PAUSED);
        }
    }
    
    private void stop360Video() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Stopping 360° video");
            mVideoTextureJni.seekToTime(0.0f);
            mVideoTextureJni.pause();
            setPlaybackState(PlaybackState.STOPPED);
        }
    }
    
    public void seekToTime(float time) {
        ViroLog.debug(TAG, "Seeking to time: " + time);
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.seekToTime(time);
        }
    }
    
    // Event handlers
    
    private void handleVideoReady() {
        ViroLog.debug(TAG, "360° video ready");
        setPlaybackState(PlaybackState.PAUSED);
        emitVideoEvent("onLoad", createVideoEventData());
        
        // Auto-play if not paused
        if (!mPaused) {
            play360Video();
        }
    }
    
    private void handleVideoBufferStart() {
        ViroLog.debug(TAG, "360° video buffer start");
        mIsBuffering = true;
        emitVideoEvent("onBuffer", createVideoEventData());
    }
    
    private void handleVideoBufferEnd() {
        ViroLog.debug(TAG, "360° video buffer end");
        mIsBuffering = false;
        emitVideoEvent("onBuffer", createVideoEventData());
    }
    
    private void handleVideoFinished() {
        ViroLog.debug(TAG, "360° video finished");
        setPlaybackState(PlaybackState.STOPPED);
        emitVideoEvent("onEnd", createVideoEventData());
    }
    
    private void handleVideoError(String errorMessage) {
        ViroLog.error(TAG, "360° video error: " + errorMessage);
        setPlaybackState(PlaybackState.ERROR);
        
        WritableMap eventData = createVideoEventData();
        eventData.putString("error", errorMessage);
        emitVideoEvent("onError", eventData);
    }
    
    private void handleVideoTimeUpdate(float currentTime, float totalTime) {
        mCurrentTime = currentTime;
        mDuration = totalTime;
        
        emitVideoEvent("onProgress", createVideoEventData());
    }
    
    private void setPlaybackState(PlaybackState state) {
        if (mPlaybackState != state) {
            mPlaybackState = state;
            emitVideoEvent("onPlaybackStateChanged", createVideoEventData());
        }
    }
    
    private WritableMap createVideoEventData() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("uri", mUri);
        eventData.putString("playbackState", mPlaybackState.getValue());
        eventData.putDouble("currentTime", mCurrentTime);
        eventData.putDouble("duration", mDuration);
        eventData.putBoolean("isBuffering", mIsBuffering);
        eventData.putBoolean("isLooping", mLoop);
        eventData.putBoolean("isMuted", mMuted);
        eventData.putDouble("volume", mVolume);
        eventData.putDouble("playbackRate", mPlaybackRate);
        return eventData;
    }
    
    private void emitVideoEvent(String eventName, WritableMap eventData) {
        if (eventEmitter != null && reactTag != -1) {
            eventEmitter.receiveEvent(reactTag, eventName, eventData);
        }
    }
    
    /**
     * Emit 360° video events for ViroReact integration
     */
    public void emit360VideoEvent(String eventName, @Nullable WritableMap eventData) {
        try {
            if (mReactContext != null && mReactContext.hasActiveCatalystInstance()) {
                mReactContext.getJSModule(RCTEventEmitter.class)
                    .receiveEvent(getId(), eventName, eventData);
            } else {
                ViroLog.warn(TAG, "Cannot emit event " + eventName + ": no active React context");
            }
        } catch (Exception e) {
            ViroLog.error(TAG, "Error emitting event " + eventName + " : " + e.getMessage());
        }
    }
    
    public void setEventEmitter(RCTEventEmitter eventEmitter, int reactTag) {
        this.eventEmitter = eventEmitter;
        this.reactTag = reactTag;
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop video playback
        stop360Video();
        
        // Clean up ViroReact 360° video resources
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
        
        if (mSphereJni != null) {
            mSphereJni.dispose();
            mSphereJni = null;
        }
        
        if (mMaterialJni != null) {
            mMaterialJni.dispose();
            mMaterialJni = null;
        }
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.dispose();
            mVideoTextureJni = null;
        }
        
        if (mVideo360Jni != null) {
            mVideo360Jni.dispose();
            mVideo360Jni = null;
        }
        
        if (mMediaPlayer != null) {
            mMediaPlayer.release();
            mMediaPlayer = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        mSource = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "Viro360VideoView attached to window");
        
        // 360° video will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mSphereJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact 360° video ready for scene attachment");
        }
        
        // Ensure 360° video properties are applied
        apply360VideoProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "Viro360VideoView detached from window");
        
        // Pause video when detached
        pause360Video();
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public String getUri() { return mUri; }
    public boolean isPaused() { return mPaused; }
    public boolean isLoop() { return mLoop; }
    public boolean isMuted() { return mMuted; }
    public float getVolume() { return mVolume; }
    public float getPlaybackRate() { return mPlaybackRate; }
    public boolean isStereoMode() { return mStereoMode; }
    public String getStereoLayout() { return mStereoLayout; }
    public String getFormat() { return mFormat; }
    public Vector getRotation() { return mRotation; }
    public PlaybackState getPlaybackState() { return mPlaybackState; }
    public float getCurrentTime() { return mCurrentTime; }
    public float getDuration() { return mDuration; }
    public boolean isBuffering() { return mIsBuffering; }
}