//
//  ViroMaterialVideoView.java
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
import com.viro.core.Vector;
import com.viro.core.VideoTexture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.lang.ref.WeakReference;

/**
 * Native Android view for ViroMaterialVideo component.
 * ViroMaterialVideo provides comprehensive video-as-material functionality with ViroReact 3D integration,
 * supporting video textures applied to 3D geometry, playback controls, and material property animation.
 */
public class ViroMaterialVideoView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroMaterialVideoView.class);
    
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
    private Quad mQuadJni;
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
    
    // Material video specific properties
    private String mMaterialType = "Lit"; // "Lit", "Unlit", "Lambert", "Blinn", "Phong", "PBR"
    private Vector mDiffuseColor = new Vector(1.0f, 1.0f, 1.0f);
    private float mOpacity = 1.0f;
    private boolean mTransparency = false;
    private String mBlendMode = "Alpha"; // "Alpha", "Add", "Subtract", "Multiply"
    private String mCullMode = "Back"; // "Back", "Front", "None"
    
    // Texture properties
    private Vector mTextureTranslation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mTextureRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mTextureScale = new Vector(1.0f, 1.0f, 1.0f);
    private boolean mTextureRepeat = false;
    private String mTextureWrapS = "Repeat"; // "Repeat", "Mirror", "Clamp"
    private String mTextureWrapT = "Repeat";
    
    // Geometry properties
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    
    // Playback state
    private PlaybackState mPlaybackState = PlaybackState.IDLE;
    private float mCurrentTime = 0.0f;
    private float mDuration = 0.0f;
    private boolean mIsBuffering = false;
    
    // Animation properties
    private boolean mAnimateTexture = false;
    private float mAnimationSpeed = 1.0f;
    private String mAnimationType = "scroll"; // "scroll", "rotate", "scale", "pulse"
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    public ViroMaterialVideoView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroMaterialVideoView initialized with ViroReact Video-as-Material integration");
        
        initializeMaterialVideo();
    }
    
    private void initializeMaterialVideo() {
        ViroLog.debug(TAG, "Initializing ViroReact material video with default properties");
        
        // Create ViroReact Node for the material video
        mNodeJni = new Node();
        
        // Create Quad geometry for video texture display
        mQuadJni = new Quad(mWidth, mHeight);
        
        // Create Material for the video texture
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial material video properties
        applyMaterialVideoProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mQuadJni);
        mQuadJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Material video views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Material Video initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroMaterialVideoView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroMaterialVideoView> mMaterialVideoView;
        
        public VRTComponentWrapper(ViroMaterialVideoView videoView) {
            super(videoView.getContext(), null, -1, -1, videoView.mReactContext);
            mMaterialVideoView = new WeakReference<>(videoView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroMaterialVideoView videoView = mMaterialVideoView.get();
            if (videoView != null) {
                videoView.emitMaterialVideoEvent(eventName, eventData);
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
     * Get the underlying ViroReact Quad object
     */
    public Quad getQuadJni() {
        return mQuadJni;
    }
    
    /**
     * Get the underlying ViroReact VideoTexture object
     */
    public VideoTexture getVideoTextureJni() {
        return mVideoTextureJni;
    }
    
    /**
     * Set the ViroContext for this material video
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate material video components with ViroContext if needed
        if (mVideoTextureJni != null) {
            mVideoTextureJni.dispose();
            mVideoTextureJni = null;
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            applyMaterialVideoProperties();
            if (mQuadJni != null) {
                mQuadJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
            }
        }
    }
    
    // Property setters
    
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting material video source: " + source);
        mSource = source;
        
        if (source != null && source.hasKey("uri")) {
            mUri = source.getString("uri");
            loadMaterialVideo();
        }
    }
    
    public void setPaused(boolean paused) {
        ViroLog.debug(TAG, "Setting paused: " + paused);
        mPaused = paused;
        
        if (mVideoTextureJni != null) {
            if (paused) {
                pauseMaterialVideo();
            } else {
                playMaterialVideo();
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
    
    // Material properties
    
    public void setMaterialType(@Nullable String materialType) {
        ViroLog.debug(TAG, "Setting material type: " + materialType);
        mMaterialType = materialType != null ? materialType : "Lit";
        applyMaterialVideoProperties();
    }
    
    public void setDiffuseColor(@Nullable ReadableArray diffuseColor) {
        ViroLog.debug(TAG, "Setting diffuse color: " + diffuseColor);
        
        if (diffuseColor != null && diffuseColor.size() >= 3) {
            try {
                float r = (float) diffuseColor.getDouble(0);
                float g = (float) diffuseColor.getDouble(1);
                float b = (float) diffuseColor.getDouble(2);
                mDiffuseColor = new Vector(r, g, b);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing diffuse color: " + e.getMessage());
                mDiffuseColor = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mDiffuseColor = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applyMaterialVideoProperties();
    }
    
    public void setOpacity(float opacity) {
        ViroLog.debug(TAG, "Setting opacity: " + opacity);
        mOpacity = Math.max(0.0f, Math.min(1.0f, opacity));
        applyMaterialVideoProperties();
    }
    
    public void setTransparency(boolean transparency) {
        ViroLog.debug(TAG, "Setting transparency: " + transparency);
        mTransparency = transparency;
        applyMaterialVideoProperties();
    }
    
    public void setBlendMode(@Nullable String blendMode) {
        ViroLog.debug(TAG, "Setting blend mode: " + blendMode);
        mBlendMode = blendMode != null ? blendMode : "Alpha";
        applyMaterialVideoProperties();
    }
    
    public void setCullMode(@Nullable String cullMode) {
        ViroLog.debug(TAG, "Setting cull mode: " + cullMode);
        mCullMode = cullMode != null ? cullMode : "Back";
        applyMaterialVideoProperties();
    }
    
    // Texture properties
    
    public void setTextureTranslation(@Nullable ReadableArray translation) {
        ViroLog.debug(TAG, "Setting texture translation: " + translation);
        
        if (translation != null && translation.size() >= 2) {
            try {
                float u = (float) translation.getDouble(0);
                float v = (float) translation.getDouble(1);
                mTextureTranslation = new Vector(u, v, 0.0f);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing texture translation: " + e.getMessage());
                mTextureTranslation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mTextureTranslation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTextureProperties();
    }
    
    public void setTextureRotation(@Nullable ReadableArray rotation) {
        ViroLog.debug(TAG, "Setting texture rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 1) {
            try {
                float angle = (float) Math.toRadians(rotation.getDouble(0));
                mTextureRotation = new Vector(0.0f, 0.0f, angle);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing texture rotation: " + e.getMessage());
                mTextureRotation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mTextureRotation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTextureProperties();
    }
    
    public void setTextureScale(@Nullable ReadableArray scale) {
        ViroLog.debug(TAG, "Setting texture scale: " + scale);
        
        if (scale != null && scale.size() >= 2) {
            try {
                float u = (float) scale.getDouble(0);
                float v = (float) scale.getDouble(1);
                mTextureScale = new Vector(u, v, 1.0f);
            } catch (Exception e) {
                ViroLog.error(TAG, "Error parsing texture scale: " + e.getMessage());
                mTextureScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mTextureScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applyTextureProperties();
    }
    
    // Geometry properties
    
    public void setWidth(float width) {
        ViroLog.debug(TAG, "Setting width: " + width);
        mWidth = Math.max(0.1f, width);
        
        if (mQuadJni != null) {
            mQuadJni.setWidth(mWidth);
        }
    }
    
    public void setHeight(float height) {
        ViroLog.debug(TAG, "Setting height: " + height);
        mHeight = Math.max(0.1f, height);
        
        if (mQuadJni != null) {
            mQuadJni.setHeight(mHeight);
        }
    }
    
    // Animation properties
    
    public void setAnimateTexture(boolean animateTexture) {
        ViroLog.debug(TAG, "Setting animate texture: " + animateTexture);
        mAnimateTexture = animateTexture;
        
        if (animateTexture) {
            startTextureAnimation();
        } else {
            stopTextureAnimation();
        }
    }
    
    public void setAnimationSpeed(float speed) {
        ViroLog.debug(TAG, "Setting animation speed: " + speed);
        mAnimationSpeed = Math.max(0.1f, Math.min(5.0f, speed));
    }
    
    public void setAnimationType(@Nullable String type) {
        ViroLog.debug(TAG, "Setting animation type: " + type);
        mAnimationType = type != null ? type : "scroll";
    }
    
    // ViroReact-specific methods
    
    private void applyMaterialVideoProperties() {
        if (mMaterialJni != null) {
            ViroLog.debug(TAG, "Applying material video properties to ViroReact Material");
            
            // Apply material type
            Material.LightingModel lightingModel = getLightingModelEnum(mMaterialType);
            mMaterialJni.setLightingModel(lightingModel);
            
            // Apply material properties
            mMaterialJni.setDiffuseColor(mDiffuseColor.x, mDiffuseColor.y, mDiffuseColor.z);
            mMaterialJni.setOpacity(mOpacity);
            mMaterialJni.setTransparency(mTransparency);
            
            // Apply blend mode
            Material.BlendMode blendMode = getBlendModeEnum(mBlendMode);
            mMaterialJni.setBlendMode(blendMode);
            
            // Apply cull mode
            Material.CullMode cullMode = getCullModeEnum(mCullMode);
            mMaterialJni.setCullMode(cullMode);
            
            ViroLog.debug(TAG, "Material video properties applied successfully");
        }
    }
    
    private void applyTextureProperties() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Applying texture properties to VideoTexture");
            
            // Apply texture transformations
            mVideoTextureJni.setTransform(mTextureTranslation, mTextureRotation, mTextureScale);
            
            // Apply wrap modes
            VideoTexture.WrapMode wrapS = getWrapModeEnum(mTextureWrapS);
            VideoTexture.WrapMode wrapT = getWrapModeEnum(mTextureWrapT);
            mVideoTextureJni.setWrapMode(wrapS, wrapT);
            
            ViroLog.debug(TAG, "Texture properties applied successfully");
        }
    }
    
    private void loadMaterialVideo() {
        if (mUri.isEmpty()) {
            ViroLog.debug(TAG, "No material video URI provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading material video in ViroReact: " + mUri);
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
                    handleVideoError("Material video failed: " + error);
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
            
            // Apply material and texture properties
            applyMaterialVideoProperties();
            applyTextureProperties();
        } else {
            handleVideoError("ViroContext not available for material video loading");
        }
    }
    
    private void playMaterialVideo() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Playing material video");
            mVideoTextureJni.play();
            setPlaybackState(PlaybackState.PLAYING);
        }
    }
    
    private void pauseMaterialVideo() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Pausing material video");
            mVideoTextureJni.pause();
            setPlaybackState(PlaybackState.PAUSED);
        }
    }
    
    private void stopMaterialVideo() {
        if (mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Stopping material video");
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
    
    // Texture animation
    
    private void startTextureAnimation() {
        if (mAnimateTexture && mVideoTextureJni != null) {
            ViroLog.debug(TAG, "Starting texture animation: " + mAnimationType);
            
            switch (mAnimationType) {
                case "scroll":
                    startScrollAnimation();
                    break;
                case "rotate":
                    startRotateAnimation();
                    break;
                case "scale":
                    startScaleAnimation();
                    break;
                case "pulse":
                    startPulseAnimation();
                    break;
            }
        }
    }
    
    private void stopTextureAnimation() {
        ViroLog.debug(TAG, "Stopping texture animation");
        // Animation stopping logic would go here
    }
    
    private void startScrollAnimation() {
        // Implement scrolling texture animation
        ViroLog.debug(TAG, "Starting scroll animation with speed: " + mAnimationSpeed);
    }
    
    private void startRotateAnimation() {
        // Implement rotating texture animation
        ViroLog.debug(TAG, "Starting rotate animation with speed: " + mAnimationSpeed);
    }
    
    private void startScaleAnimation() {
        // Implement scaling texture animation
        ViroLog.debug(TAG, "Starting scale animation with speed: " + mAnimationSpeed);
    }
    
    private void startPulseAnimation() {
        // Implement pulsing texture animation
        ViroLog.debug(TAG, "Starting pulse animation with speed: " + mAnimationSpeed);
    }
    
    // Event handlers
    
    private void handleVideoReady() {
        ViroLog.debug(TAG, "Material video ready");
        setPlaybackState(PlaybackState.PAUSED);
        emitVideoEvent("onLoad", createVideoEventData());
        
        // Auto-play if not paused
        if (!mPaused) {
            playMaterialVideo();
        }
    }
    
    private void handleVideoBufferStart() {
        ViroLog.debug(TAG, "Material video buffer start");
        mIsBuffering = true;
        emitVideoEvent("onBuffer", createVideoEventData());
    }
    
    private void handleVideoBufferEnd() {
        ViroLog.debug(TAG, "Material video buffer end");
        mIsBuffering = false;
        emitVideoEvent("onBuffer", createVideoEventData());
    }
    
    private void handleVideoFinished() {
        ViroLog.debug(TAG, "Material video finished");
        setPlaybackState(PlaybackState.STOPPED);
        emitVideoEvent("onEnd", createVideoEventData());
    }
    
    private void handleVideoError(String errorMessage) {
        ViroLog.error(TAG, "Material video error: " + errorMessage);
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
     * Emit material video events for ViroReact integration
     */
    public void emitMaterialVideoEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    public void setEventEmitter(RCTEventEmitter eventEmitter, int reactTag) {
        this.eventEmitter = eventEmitter;
        this.reactTag = reactTag;
    }
    
    // Helper methods to convert string properties to enum values
    
    private Material.LightingModel getLightingModelEnum(String materialType) {
        switch (materialType.toLowerCase()) {
            case "unlit":
                return Material.LightingModel.CONSTANT;
            case "lambert":
                return Material.LightingModel.LAMBERT;
            case "blinn":
                return Material.LightingModel.BLINN;
            case "phong":
                return Material.LightingModel.PHONG;
            case "pbr":
                return Material.LightingModel.PHYSICALLY_BASED;
            default:
            case "lit":
                return Material.LightingModel.BLINN;
        }
    }
    
    private Material.BlendMode getBlendModeEnum(String blendMode) {
        switch (blendMode.toLowerCase()) {
            case "add":
                return Material.BlendMode.ADD;
            case "subtract":
                return Material.BlendMode.SUBTRACT;
            case "multiply":
                return Material.BlendMode.MULTIPLY;
            default:
            case "alpha":
                return Material.BlendMode.ALPHA;
        }
    }
    
    private Material.CullMode getCullModeEnum(String cullMode) {
        switch (cullMode.toLowerCase()) {
            case "front":
                return Material.CullMode.FRONT;
            case "none":
                return Material.CullMode.NONE;
            default:
            case "back":
                return Material.CullMode.BACK;
        }
    }
    
    private VideoTexture.WrapMode getWrapModeEnum(String wrapMode) {
        switch (wrapMode.toLowerCase()) {
            case "mirror":
                return VideoTexture.WrapMode.MIRROR;
            case "clamp":
                return VideoTexture.WrapMode.CLAMP;
            default:
            case "repeat":
                return VideoTexture.WrapMode.REPEAT;
        }
    }
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop video playback
        stopMaterialVideo();
        
        // Stop texture animation
        stopTextureAnimation();
        
        // Clean up ViroReact material video resources
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
        
        if (mQuadJni != null) {
            mQuadJni.dispose();
            mQuadJni = null;
        }
        
        if (mMaterialJni != null) {
            mMaterialJni.dispose();
            mMaterialJni = null;
        }
        
        if (mVideoTextureJni != null) {
            mVideoTextureJni.dispose();
            mVideoTextureJni = null;
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
        ViroLog.debug(TAG, "ViroMaterialVideoView attached to window");
        
        // Material video will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mQuadJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact material video ready for scene attachment");
        }
        
        // Ensure material video properties are applied
        applyMaterialVideoProperties();
        applyTextureProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroMaterialVideoView detached from window");
        
        // Pause video when detached
        pauseMaterialVideo();
        
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
    public String getMaterialType() { return mMaterialType; }
    public Vector getDiffuseColor() { return mDiffuseColor; }
    public float getOpacity() { return mOpacity; }
    public boolean isTransparency() { return mTransparency; }
    public String getBlendMode() { return mBlendMode; }
    public String getCullMode() { return mCullMode; }
    public Vector getTextureTranslation() { return mTextureTranslation; }
    public Vector getTextureRotation() { return mTextureRotation; }
    public Vector getTextureScale() { return mTextureScale; }
    public float getWidth() { return mWidth; }
    public float getHeight() { return mHeight; }
    public boolean isAnimateTexture() { return mAnimateTexture; }
    public float getAnimationSpeed() { return mAnimationSpeed; }
    public String getAnimationType() { return mAnimationType; }
    public PlaybackState getPlaybackState() { return mPlaybackState; }
    public float getCurrentTime() { return mCurrentTime; }
    public float getDuration() { return mDuration; }
    public boolean isBuffering() { return mIsBuffering; }
}