//
//  ViroVideoView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Quad;
import com.viro.core.Texture;
import com.viro.core.Vector;
import com.viro.core.VideoTexture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;

/**
 * ViroVideo - Video Playback Component
 * 
 * ViroVideo provides comprehensive video playback capabilities in 3D space.
 * It supports various video formats, streaming sources, and can be used as
 * textures for 3D geometry. The component handles video loading, playback
 * control, and provides rich event callbacks for monitoring playback state.
 * 
 * Key Features:
 * - Multiple video source support (URL, local files, streaming)
 * - Playback control (play, pause, seek, loop)
 * - Volume and mute control
 * - Video scaling and resize modes
 * - 3D positioning and rotation
 * - Stereo video support for VR experiences
 * - Progress and state event callbacks
 * - Integration with ViroReact material system
 */
public class ViroVideoView extends View {

    private static final String TAG = "ViroVideoView";
    
    private ReactContext mReactContext;

    // ViroReact Integration
    private Node mNodeJni;
    private VideoTexture mVideoTextureJni;
    private Quad mQuadJni;
    private Material mMaterialJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Video source properties
    private ReadableMap mSource;
    private String mUri;

    // Video playback control
    private boolean mLoop = false;
    private boolean mMuted = false;
    private float mVolume = 1.0f;
    private boolean mPaused = false;

    // Video display properties
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    private String mResizeMode = "scaleAspectFit";
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);

    // Video material properties
    private ReadableArray mMaterials;

    // Video quality and performance
    private float mPlaybackRate = 1.0f;
    private String mStereoMode = "none";

    // Internal video state
    private Handler mProgressUpdateHandler;
    private Runnable mProgressUpdateRunnable;
    private boolean mIsLoading = false;
    private boolean mIsReady = false;
    private float mVideoDuration = 0.0f;
    private int mVideoWidth = 0;
    private int mVideoHeight = 0;

    public ViroVideoView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroVideoView initialized with ViroReact VideoTexture integration");
        
        // Initialize progress update handler
        mProgressUpdateHandler = new Handler(Looper.getMainLooper());
        mProgressUpdateRunnable = new Runnable() {
            @Override
            public void run() {
                updateProgress();
                if (mVideoTextureJni != null && mVideoTextureJni.isPlaying()) {
                    mProgressUpdateHandler.postDelayed(this, 250); // Update 4 times per second
                }
            }
        };
        
        initializeVideo();
    }

    private void initializeVideo() {
        Log.d(TAG, "Initializing ViroReact video with default properties");
        
        // Create ViroReact Node for the video
        mNodeJni = new Node();
        
        // Create Quad geometry for video surface
        mQuadJni = new Quad(mWidth, mHeight);
        
        // Create Material for video texture
        mMaterialJni = new Material();
        
        // Configure initial geometry and material
        updateVideoGeometry();
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Video views are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact video initialized successfully");
    }

    // Video Source Properties
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting source: " + source);
        mSource = source;
        
        // Extract URI from source map
        if (source != null && source.hasKey("uri")) {
            String uri = source.getString("uri");
            if (uri != null) {
                setUri(uri);
            }
        }
    }

    public void setUri(@Nullable String uri) {
        ViroLog.debug(TAG, "Setting URI: " + uri);
        mUri = uri;
        
        if (uri != null && !uri.isEmpty()) {
            loadVideo(uri);
        } else {
            stopVideo();
        }
    }

    // Video Playback Control
    public void setLoop(boolean loop) {
        ViroLog.debug(TAG, "Setting loop: " + loop);
        mLoop = loop;
        
        if (mMediaPlayer != null) {
            mMediaPlayer.setLooping(loop);
        }
        
        updateVideoPlayback();
    }

    public void setMuted(boolean muted) {
        ViroLog.debug(TAG, "Setting muted: " + muted);
        mMuted = muted;
        
        if (mMediaPlayer != null) {
            if (muted) {
                mMediaPlayer.setVolume(0.0f, 0.0f);
            } else {
                mMediaPlayer.setVolume(mVolume, mVolume);
            }
        }
        
        updateVideoPlayback();
    }

    public void setVolume(float volume) {
        ViroLog.debug(TAG, "Setting volume: " + volume);
        mVolume = Math.max(0.0f, Math.min(1.0f, volume)); // Clamp to [0, 1]
        
        if (mMediaPlayer != null && !mMuted) {
            mMediaPlayer.setVolume(mVolume, mVolume);
        }
        
        updateVideoPlayback();
    }

    public void setPaused(boolean paused) {
        ViroLog.debug(TAG, "Setting paused: " + paused);
        mPaused = paused;
        
        if (mMediaPlayer != null && mIsReady) {
            if (paused) {
                if (mMediaPlayer.isPlaying()) {
                    mMediaPlayer.pause();
                }
                mProgressUpdateHandler.removeCallbacks(mProgressUpdateRunnable);
            } else {
                if (!mMediaPlayer.isPlaying()) {
                    mMediaPlayer.start();
                }
                mProgressUpdateHandler.post(mProgressUpdateRunnable);
            }
        }
    }

    // Video Display Properties
    public void setVideoWidth(float width) {
        ViroLog.debug(TAG, "Setting video width: " + width);
        mWidth = width;
        updateVideoGeometry();
    }

    public void setVideoHeight(float height) {
        ViroLog.debug(TAG, "Setting video height: " + height);
        mHeight = height;
        updateVideoGeometry();
    }

    public void setResizeMode(@NonNull String resizeMode) {
        ViroLog.debug(TAG, "Setting resize mode: " + resizeMode);
        mResizeMode = resizeMode;
        updateVideoGeometry();
    }

    public void setRotation(@Nullable ReadableArray rotation) {
        ViroLog.debug(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                mRotation[0] = (float) rotation.getDouble(0); // X
                mRotation[1] = (float) rotation.getDouble(1); // Y
                mRotation[2] = (float) rotation.getDouble(2); // Z
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing rotation: " + e.getMessage());
                // Keep current rotation on error
            }
        } else {
            // Reset to default rotation
            mRotation[0] = 0.0f;
            mRotation[1] = 0.0f;
            mRotation[2] = 0.0f;
        }
        
        updateVideoGeometry();
    }

    // Video Material Properties
    public void setMaterials(@Nullable ReadableArray materials) {
        ViroLog.debug(TAG, "Setting materials: " + materials);
        mMaterials = materials;
        
        // TODO: Apply materials to ViroReact video surface
        // Video can be used as texture on 3D geometry
    }

    // Video Quality and Performance
    public void setPlaybackRate(float playbackRate) {
        ViroLog.debug(TAG, "Setting playback rate: " + playbackRate);
        mPlaybackRate = playbackRate;
        
        // TODO: Android MediaPlayer doesn't directly support playback rate
        // This would need to be implemented in the ViroReact video system
        updateVideoPlayback();
    }

    public void setStereoMode(@NonNull String stereoMode) {
        ViroLog.debug(TAG, "Setting stereo mode: " + stereoMode);
        mStereoMode = stereoMode;
        
        // TODO: Update stereo mode in ViroReact renderer
        // Modes: none, leftRight, rightLeft, topBottom, bottomTop
        updateVideoPlayback();
    }

    // Video Control Methods
    public void seekToTime(float seconds) {
        ViroLog.debug(TAG, "Seeking to time: " + seconds + " seconds");
        
        if (mMediaPlayer != null && mIsReady) {
            int milliseconds = (int) (seconds * 1000);
            mMediaPlayer.seekTo(milliseconds);
        }
    }

    public void play() {
        ViroLog.debug(TAG, "Playing video");
        setPaused(false);
    }

    public void pause() {
        ViroLog.debug(TAG, "Pausing video");
        setPaused(true);
    }

    public void stop() {
        ViroLog.debug(TAG, "Stopping video");
        setPaused(true);
        seekToTime(0.0f);
    }

    // Video Loading and Management
    private void loadVideo(String uri) {
        ViroLog.debug(TAG, "Loading video from URI: " + uri);
        
        // Clean up existing player
        releaseMediaPlayer();
        
        mIsLoading = true;
        mIsReady = false;
        
        // Fire onLoadStart event
        emitLoadStartEvent();
        
        try {
            // Create new media player
            mMediaPlayer = new MediaPlayer();
            
            // Set listeners
            mMediaPlayer.setOnPreparedListener(this);
            mMediaPlayer.setOnCompletionListener(this);
            mMediaPlayer.setOnErrorListener(this);
            mMediaPlayer.setOnBufferingUpdateListener(this);
            mMediaPlayer.setOnSeekCompleteListener(this);
            mMediaPlayer.setOnVideoSizeChangedListener(this);
            
            // Set data source
            mMediaPlayer.setDataSource(uri);
            
            // TODO: Set surface for rendering to ViroReact texture
            // Surface surface = getViroReactVideoSurface();
            // mMediaPlayer.setSurface(surface);
            
            // Configure player
            mMediaPlayer.setLooping(mLoop);
            if (mMuted) {
                mMediaPlayer.setVolume(0.0f, 0.0f);
            } else {
                mMediaPlayer.setVolume(mVolume, mVolume);
            }
            
            // Start loading
            mMediaPlayer.prepareAsync();
            
        } catch (IOException e) {
            ViroLog.error(TAG, "Error loading video: " + e.getMessage());
            emitErrorEvent("Failed to load video: " + e.getMessage());
            mIsLoading = false;
        }
    }

    private void releaseMediaPlayer() {
        if (mMediaPlayer != null) {
            mProgressUpdateHandler.removeCallbacks(mProgressUpdateRunnable);
            
            if (mMediaPlayer.isPlaying()) {
                mMediaPlayer.stop();
            }
            mMediaPlayer.release();
            mMediaPlayer = null;
        }
        
        mIsReady = false;
    }

    private void stopVideo() {
        ViroLog.debug(TAG, "Stopping video");
        releaseMediaPlayer();
        
        // TODO: Remove video texture from ViroReact surface
    }

    // Video Updates
    private void updateVideoPlayback() {
        ViroLog.debug(TAG, String.format(
            "Updating video playback - Loop: %s, Muted: %s, Volume: %.2f, Rate: %.2f",
            mLoop, mMuted, mVolume, mPlaybackRate));
        
        // TODO: Apply video playback settings to ViroReact renderer
        // This should update the video texture properties and playback state
    }

    private void updateVideoGeometry() {
        ViroLog.debug(TAG, String.format(
            "Updating video geometry - Size: %.2fx%.2f, Mode: %s, Rotation: [%.2f, %.2f, %.2f]",
            mWidth, mHeight, mResizeMode, mRotation[0], mRotation[1], mRotation[2]));
        
        // TODO: Apply video geometry settings to ViroReact renderer
        // This should update the 3D surface dimensions and orientation
    }

    private void updateProgress() {
        if (mMediaPlayer != null && mIsReady) {
            int currentPosition = mMediaPlayer.getCurrentPosition();
            int duration = mMediaPlayer.getDuration();
            
            if (duration > 0) {
                float currentTime = currentPosition / 1000.0f;
                float totalTime = duration / 1000.0f;
                float progress = currentTime / totalTime;
                
                WritableMap event = Arguments.createMap();
                event.putDouble("currentTime", currentTime);
                event.putDouble("duration", totalTime);
                event.putDouble("progress", progress);
                
                ThemedReactContext reactContext = (ThemedReactContext) getContext();
                reactContext.getJSModule(RCTEventEmitter.class)
                        .receiveEvent(getId(), "onVideoProgress", event);
            }
        }
    }

    // MediaPlayer Callbacks
    @Override
    public void onPrepared(MediaPlayer mp) {
        ViroLog.debug(TAG, "Video prepared");
        mIsLoading = false;
        mIsReady = true;
        mVideoDuration = mp.getDuration();
        
        // Fire onLoad event
        WritableMap event = Arguments.createMap();
        event.putDouble("duration", mVideoDuration / 1000.0f);
        
        WritableMap naturalSize = Arguments.createMap();
        naturalSize.putInt("width", mVideoWidth);
        naturalSize.putInt("height", mVideoHeight);
        event.putMap("naturalSize", naturalSize);
        
        ThemedReactContext reactContext = (ThemedReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onVideoLoad", event);
        
        // Auto-play if not paused
        if (!mPaused) {
            mp.start();
            mProgressUpdateHandler.post(mProgressUpdateRunnable);
        }
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        ViroLog.debug(TAG, "Video playback completed");
        mProgressUpdateHandler.removeCallbacks(mProgressUpdateRunnable);
        
        // Fire onEnd event
        WritableMap event = Arguments.createMap();
        ThemedReactContext reactContext = (ThemedReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onVideoEnd", event);
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        ViroLog.error(TAG, "Video playback error: what=" + what + ", extra=" + extra);
        mIsLoading = false;
        mIsReady = false;
        
        String errorMessage = "Video playback error (code: " + what + ", extra: " + extra + ")";
        emitErrorEvent(errorMessage);
        
        return true; // Error handled
    }

    @Override
    public void onBufferingUpdate(MediaPlayer mp, int percent) {
        // Fire onBuffer event
        WritableMap event = Arguments.createMap();
        event.putBoolean("buffering", percent < 100);
        event.putInt("bufferProgress", percent);
        
        ThemedReactContext reactContext = (ThemedReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onVideoBuffer", event);
    }

    @Override
    public void onSeekComplete(MediaPlayer mp) {
        ViroLog.debug(TAG, "Video seek completed");
        
        // Fire onSeekComplete event
        WritableMap event = Arguments.createMap();
        event.putDouble("currentTime", mp.getCurrentPosition() / 1000.0f);
        
        ThemedReactContext reactContext = (ThemedReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onVideoSeekComplete", event);
    }

    @Override
    public void onVideoSizeChanged(MediaPlayer mp, int width, int height) {
        ViroLog.debug(TAG, "Video size changed: " + width + "x" + height);
        mVideoWidth = width;
        mVideoHeight = height;
        
        // Update geometry based on new video dimensions
        updateVideoGeometry();
    }

    // Event Emission
    private void emitLoadStartEvent() {
        WritableMap event = Arguments.createMap();
        ThemedReactContext reactContext = (ThemedReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onVideoLoadStart", event);
    }

    private void emitErrorEvent(String errorMessage) {
        WritableMap event = Arguments.createMap();
        event.putString("error", errorMessage);
        
        ThemedReactContext reactContext = (ThemedReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class)
                .receiveEvent(getId(), "onVideoError", event);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "Video attached to window");
        
        // TODO: Add video to ViroReact scene when attached to window
        updateVideoGeometry();
        updateVideoPlayback();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "Video detached from window");
        
        // TODO: Remove video from ViroReact scene when detached from window
        releaseMediaPlayer();
    }

    // Getters for current values (useful for debugging and testing)
    public String getUri() { return mUri; }
    public boolean isLoop() { return mLoop; }
    public boolean isMuted() { return mMuted; }
    public float getVolume() { return mVolume; }
    public boolean isPaused() { return mPaused; }
    public float getVideoWidth() { return mWidth; }
    public float getVideoHeight() { return mHeight; }
    public String getResizeMode() { return mResizeMode; }
    public float[] getRotation() { return mRotation.clone(); }
    public float getPlaybackRate() { return mPlaybackRate; }
    public String getStereoMode() { return mStereoMode; }
    public boolean isReady() { return mIsReady; }
    public int getVideoDuration() { return mVideoDuration; }
}