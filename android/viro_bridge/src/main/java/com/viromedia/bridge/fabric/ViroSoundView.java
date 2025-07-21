//
//  ViroSoundView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viromedia.bridge.utility.ViroLog;

import java.io.IOException;

/**
 * ViroSoundView - Audio Playback Android View
 * 
 * This View provides comprehensive audio functionality for ViroReact applications,
 * supporting local and remote audio files, playback control, and audio effects.
 * 
 * Key Features:
 * - Local and remote audio file support
 * - Full playback control (play, pause, stop, seek, loop)
 * - Volume control and muting
 * - Playback rate adjustment
 * - Audio loading and buffering states
 * - Progress tracking and time updates
 * - Error handling and recovery
 * - Event callbacks for audio lifecycle
 * - Integration with ViroReact audio system
 */
public class ViroSoundView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroSoundView.class);
    
    // Audio playback states
    public enum PlaybackState {
        IDLE("idle"),
        LOADING("loading"),
        READY("ready"),
        PLAYING("playing"),
        PAUSED("paused"),
        STOPPED("stopped"),
        ERROR("error"),
        BUFFERING("buffering");
        
        private final String value;
        
        PlaybackState(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        public static PlaybackState fromString(String value) {
            for (PlaybackState state : PlaybackState.values()) {
                if (state.value.equals(value)) {
                    return state;
                }
            }
            return IDLE;
        }
    }
    
    // Audio source
    private ReadableMap source;
    private String uri = "";
    private boolean isLocalFile = false;
    
    // Audio playback control
    private boolean paused = true;
    private boolean loop = false;
    private float volume = 1.0f;
    private boolean muted = false;
    private float playbackRate = 1.0f;
    private float currentTime = 0.0f;
    private boolean autoPlay = false;
    
    // Audio behavior
    private boolean preload = true;
    private int maxRetries = 3;
    private float retryDelay = 1.0f;
    private boolean resumeOnActive = true;
    private boolean pauseOnInactive = true;
    
    // Audio effects
    private float fadeInDuration = 0.0f;
    private float fadeOutDuration = 0.0f;
    private ReadableArray position;
    private float minDistance = 1.0f;
    private float maxDistance = 1000.0f;
    private float rolloffFactor = 1.0f;
    
    // Internal state
    private MediaPlayer mediaPlayer;
    private PlaybackState playbackState = PlaybackState.IDLE;
    private float duration = 0.0f;
    private boolean isPrepared = false;
    private int retryCount = 0;
    private long lastProgressUpdate = 0;
    private static final long PROGRESS_UPDATE_INTERVAL = 100; // 100ms
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    // Progress tracking
    private Runnable progressTracker = new Runnable() {
        @Override
        public void run() {
            if (mediaPlayer != null && playbackState == PlaybackState.PLAYING) {
                try {
                    currentTime = mediaPlayer.getCurrentPosition() / 1000.0f;
                    sendProgressEvent();
                    postDelayed(this, PROGRESS_UPDATE_INTERVAL);
                } catch (IllegalStateException e) {
                    ViroLog.error(TAG, "Error getting current position: " + e.getMessage());
                }
            }
        }
    };
    
    public ViroSoundView(@NonNull Context context) {
        super(context);
        
        ViroLog.debug(TAG, "ViroSoundView created");
        
        // Initialize default position
        position = createPositionArray(0.0f, 0.0f, 0.0f);
        
        setupMediaPlayer();
    }
    
    private void setupMediaPlayer() {
        ViroLog.debug(TAG, "Setting up MediaPlayer");
        
        try {
            mediaPlayer = new MediaPlayer();
            
            // Set audio attributes for ViroReact
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            
            // Set event listeners
            mediaPlayer.setOnPreparedListener(mp -> {
                ViroLog.debug(TAG, "MediaPlayer prepared");
                isPrepared = true;
                duration = mp.getDuration() / 1000.0f;
                setPlaybackState(PlaybackState.READY);
                
                sendLoadEndEvent();
                
                if (autoPlay) {
                    play();
                }
            });
            
            mediaPlayer.setOnCompletionListener(mp -> {
                ViroLog.debug(TAG, "MediaPlayer playback completed");
                setPlaybackState(PlaybackState.STOPPED);
                sendFinishEvent();
                
                if (loop) {
                    play();
                }
            });
            
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                ViroLog.error(TAG, "MediaPlayer error: what=" + what + ", extra=" + extra);
                setPlaybackState(PlaybackState.ERROR);
                sendErrorEvent("Playback error: " + what);
                
                // Retry playback if configured
                if (retryCount < maxRetries) {
                    retryCount++;
                    postDelayed(() -> loadAudio(), (long) (retryDelay * 1000));
                }
                
                return true;
            });
            
            mediaPlayer.setOnBufferingUpdateListener((mp, percent) -> {
                ViroLog.debug(TAG, "Buffering: " + percent + "%");
                sendBufferingEvent(percent);
            });
            
            mediaPlayer.setOnSeekCompleteListener(mp -> {
                ViroLog.debug(TAG, "Seek completed");
                sendSeekCompleteEvent();
            });
            
        } catch (Exception e) {
            ViroLog.error(TAG, "Error setting up MediaPlayer: " + e.getMessage());
            setPlaybackState(PlaybackState.ERROR);
        }
    }
    
    private void loadAudio() {
        if (uri.isEmpty()) {
            ViroLog.debug(TAG, "No audio URI provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading audio: " + uri);
        setPlaybackState(PlaybackState.LOADING);
        sendLoadStartEvent();
        
        try {
            if (mediaPlayer != null) {
                mediaPlayer.reset();
                isPrepared = false;
                
                if (isLocalFile) {
                    mediaPlayer.setDataSource(getContext(), Uri.parse(uri));
                } else {
                    mediaPlayer.setDataSource(uri);
                }
                
                if (preload) {
                    mediaPlayer.prepareAsync();
                } else {
                    setPlaybackState(PlaybackState.READY);
                }
            }
        } catch (IOException e) {
            ViroLog.error(TAG, "Error loading audio: " + e.getMessage());
            setPlaybackState(PlaybackState.ERROR);
            sendErrorEvent("Failed to load audio: " + e.getMessage());
        }
    }
    
    // Audio Control Methods
    public void play() {
        ViroLog.debug(TAG, "Playing audio");
        
        if (mediaPlayer == null) {
            ViroLog.error(TAG, "MediaPlayer not initialized");
            return;
        }
        
        try {
            if (!isPrepared && preload) {
                ViroLog.debug(TAG, "Audio not prepared yet, waiting...");
                return;
            }
            
            if (!isPrepared && !preload) {
                mediaPlayer.prepareAsync();
                return;
            }
            
            if (playbackState == PlaybackState.PAUSED) {
                mediaPlayer.start();
            } else if (playbackState == PlaybackState.READY || playbackState == PlaybackState.STOPPED) {
                mediaPlayer.start();
            }
            
            setPlaybackState(PlaybackState.PLAYING);
            paused = false;
            
            // Start progress tracking
            post(progressTracker);
            
            sendPlayEvent();
            
        } catch (IllegalStateException e) {
            ViroLog.error(TAG, "Error playing audio: " + e.getMessage());
            setPlaybackState(PlaybackState.ERROR);
            sendErrorEvent("Failed to play audio: " + e.getMessage());
        }
    }
    
    public void pause() {
        ViroLog.debug(TAG, "Pausing audio");
        
        if (mediaPlayer != null && playbackState == PlaybackState.PLAYING) {
            try {
                mediaPlayer.pause();
                setPlaybackState(PlaybackState.PAUSED);
                paused = true;
                
                // Stop progress tracking
                removeCallbacks(progressTracker);
                
                sendPauseEvent();
                
            } catch (IllegalStateException e) {
                ViroLog.error(TAG, "Error pausing audio: " + e.getMessage());
            }
        }
    }
    
    public void stop() {
        ViroLog.debug(TAG, "Stopping audio");
        
        if (mediaPlayer != null) {
            try {
                if (playbackState == PlaybackState.PLAYING || playbackState == PlaybackState.PAUSED) {
                    mediaPlayer.stop();
                    mediaPlayer.prepareAsync();
                }
                
                setPlaybackState(PlaybackState.STOPPED);
                paused = true;
                currentTime = 0.0f;
                
                // Stop progress tracking
                removeCallbacks(progressTracker);
                
                sendStopEvent();
                
            } catch (IllegalStateException e) {
                ViroLog.error(TAG, "Error stopping audio: " + e.getMessage());
            }
        }
    }
    
    public void seekTo(float time) {
        ViroLog.debug(TAG, "Seeking to: " + time);
        
        if (mediaPlayer != null && isPrepared) {
            try {
                int seekPosition = (int) (time * 1000);
                mediaPlayer.seekTo(seekPosition);
                currentTime = time;
                
                sendSeekEvent(time);
                
            } catch (IllegalStateException e) {
                ViroLog.error(TAG, "Error seeking audio: " + e.getMessage());
            }
        }
    }
    
    // Property Setters
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting source: " + source);
        this.source = source;
        
        if (source != null && source.hasKey("uri")) {
            this.uri = source.getString("uri");
            this.isLocalFile = uri != null && !uri.startsWith("http");
            loadAudio();
        }
    }
    
    public void setPaused(boolean paused) {
        ViroLog.debug(TAG, "Setting paused: " + paused);
        if (paused) {
            pause();
        } else {
            play();
        }
    }
    
    public void setLoop(boolean loop) {
        ViroLog.debug(TAG, "Setting loop: " + loop);
        this.loop = loop;
        if (mediaPlayer != null) {
            mediaPlayer.setLooping(loop);
        }
    }
    
    public void setVolume(float volume) {
        ViroLog.debug(TAG, "Setting volume: " + volume);
        this.volume = Math.max(0.0f, Math.min(1.0f, volume));
        updateVolume();
    }
    
    public void setMuted(boolean muted) {
        ViroLog.debug(TAG, "Setting muted: " + muted);
        this.muted = muted;
        updateVolume();
    }
    
    private void updateVolume() {
        if (mediaPlayer != null) {
            float effectiveVolume = muted ? 0.0f : volume;
            mediaPlayer.setVolume(effectiveVolume, effectiveVolume);
        }
    }
    
    public void setPlaybackRate(float rate) {
        ViroLog.debug(TAG, "Setting playback rate: " + rate);
        this.playbackRate = rate;
        
        if (mediaPlayer != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                android.media.PlaybackParams params = mediaPlayer.getPlaybackParams();
                params.setSpeed(rate);
                mediaPlayer.setPlaybackParams(params);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error setting playback rate: " + e.getMessage());
            }
        }
    }
    
    public void setPosition(@Nullable ReadableArray position) {
        ViroLog.debug(TAG, "Setting position: " + position);
        this.position = position != null ? position : createPositionArray(0.0f, 0.0f, 0.0f);
        // TODO: Apply 3D positioning when ViroReact spatial audio is integrated
    }
    
    // State Information
    public boolean isPlaying() {
        return playbackState == PlaybackState.PLAYING;
    }
    
    public boolean isPaused() {
        return paused;
    }
    
    public float getCurrentTime() {
        return currentTime;
    }
    
    public float getDuration() {
        return duration;
    }
    
    public String getPlaybackState() {
        return playbackState.getValue();
    }
    
    private void setPlaybackState(PlaybackState state) {
        if (this.playbackState != state) {
            this.playbackState = state;
            sendStateChangeEvent();
        }
    }
    
    // Helper Methods
    private ReadableArray createPositionArray(float x, float y, float z) {
        WritableArray array = Arguments.createArray();
        array.pushDouble(x);
        array.pushDouble(y);
        array.pushDouble(z);
        return array;
    }
    
    // Event Methods
    private void sendLoadStartEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onLoadStart", eventData);
    }
    
    private void sendLoadEndEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putDouble("duration", duration);
        sendEvent("onLoadEnd", eventData);
    }
    
    private void sendErrorEvent(String error) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("error", error);
        sendEvent("onError", eventData);
    }
    
    private void sendPlayEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onPlay", eventData);
    }
    
    private void sendPauseEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onPause", eventData);
    }
    
    private void sendStopEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onStop", eventData);
    }
    
    private void sendFinishEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onFinish", eventData);
    }
    
    private void sendProgressEvent() {
        long now = System.currentTimeMillis();
        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
            WritableMap eventData = Arguments.createMap();
            eventData.putDouble("currentTime", currentTime);
            eventData.putDouble("duration", duration);
            sendEvent("onProgress", eventData);
            lastProgressUpdate = now;
        }
    }
    
    private void sendSeekEvent(float time) {
        WritableMap eventData = Arguments.createMap();
        eventData.putDouble("time", time);
        sendEvent("onSeek", eventData);
    }
    
    private void sendSeekCompleteEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onSeekComplete", eventData);
    }
    
    private void sendBufferingEvent(int percent) {
        WritableMap eventData = Arguments.createMap();
        eventData.putInt("percent", percent);
        sendEvent("onBuffering", eventData);
    }
    
    private void sendStateChangeEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("state", playbackState.getValue());
        sendEvent("onStateChange", eventData);
    }
    
    // Event Handling
    public void setEventEmitter(RCTEventEmitter eventEmitter, int reactTag) {
        this.eventEmitter = eventEmitter;
        this.reactTag = reactTag;
    }
    
    private void sendEvent(String eventName, WritableMap eventData) {
        if (eventEmitter != null && reactTag != -1) {
            eventEmitter.receiveEvent(reactTag, eventName, eventData);
        }
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        
        // Cleanup
        removeCallbacks(progressTracker);
        
        if (mediaPlayer != null) {
            try {
                if (playbackState == PlaybackState.PLAYING || playbackState == PlaybackState.PAUSED) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            } catch (Exception e) {
                ViroLog.error(TAG, "Error releasing MediaPlayer: " + e.getMessage());
            }
        }
    }
}