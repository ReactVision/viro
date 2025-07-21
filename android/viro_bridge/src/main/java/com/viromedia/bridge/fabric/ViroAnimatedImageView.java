//
//  ViroAnimatedImageView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.AnimatedTexture;
import com.viro.core.EventDelegate;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Quad;
import com.viro.core.Texture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroAnimatedImage component.
 * ViroAnimatedImage provides comprehensive animated image sequence functionality with ViroReact 3D integration,
 * supporting frame-based animations, sprite sheets, GIF-like sequences, and texture animation.
 */
public class ViroAnimatedImageView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroAnimatedImageView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Quad mQuadJni;
    private Material mMaterialJni;
    private AnimatedTexture mAnimatedTextureJni;
    private List<Texture> mFrameTexturesJni = new ArrayList<>();
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Animation source
    private ReadableArray source;
    private List<String> frameUris = new ArrayList<>();
    private List<Bitmap> frames = new ArrayList<>();
    private boolean isLocalImages = false;
    
    // Animation control
    private boolean paused = true;
    private boolean loop = true;
    private float frameRate = 30.0f;
    private int currentFrame = 0;
    private float animationDuration = 0.0f;
    private boolean autoPlay = true;
    
    // Animation state
    private boolean isPlaying = false;
    private boolean isLoaded = false;
    private long lastFrameTime = 0;
    private long frameDuration = 33; // Default ~30 FPS
    
    // Display properties
    private String resizeMode = "contain";
    private float opacity = 1.0f;
    private ReadableArray tintColor;
    
    // Internal rendering
    private Paint imagePaint;
    private RectF imageRect;
    private RectF viewRect;
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    // Animation runnable
    private Runnable animationRunnable = new Runnable() {
        @Override
        public void run() {
            if (isPlaying && !frames.isEmpty()) {
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastFrameTime >= frameDuration) {
                    nextFrame();
                    invalidate();
                    lastFrameTime = currentTime;
                }
                postDelayed(this, 16); // Check every ~60 FPS
            }
        }
    };
    
    public ViroAnimatedImageView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "ViroAnimatedImageView initialized with ViroReact Animated Image integration");
        
        // Initialize default values
        tintColor = createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        
        initializeAnimatedImage();
        initializePaints();
        updateFrameDuration();
    }
    
    private void initializeAnimatedImage() {
        ViroLog.debug(TAG, "Initializing ViroReact animated image with default properties");
        
        // Create ViroReact Node for the animated image
        mNodeJni = new Node();
        
        // Create Quad geometry for animated image display
        mQuadJni = new Quad(1.0f, 1.0f); // 1x1 meter quad
        
        // Create Material for the animated image
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial animated image properties
        applyAnimatedImageProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mQuadJni);
        mQuadJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Animated image views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact Animated Image initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroAnimatedImageView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroAnimatedImageView> mAnimatedImageView;
        
        public VRTComponentWrapper(ViroAnimatedImageView imageView) {
            super(imageView.getContext(), null, -1, -1, imageView.mReactContext);
            mAnimatedImageView = new WeakReference<>(imageView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroAnimatedImageView imageView = mAnimatedImageView.get();
            if (imageView != null) {
                imageView.emitAnimatedImageEvent(eventName, eventData);
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
     * Get the underlying ViroReact AnimatedTexture object
     */
    public AnimatedTexture getAnimatedTextureJni() {
        return mAnimatedTextureJni;
    }
    
    /**
     * Set the ViroContext for this animated image
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate animated image components with ViroContext if needed
        if (mAnimatedTextureJni != null) {
            mAnimatedTextureJni.dispose();
            mAnimatedTextureJni = new AnimatedTexture(mViroContext);
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            applyAnimatedImageProperties();
            if (mQuadJni != null) {
                mQuadJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
            }
        }
    }
    
    private void initializePaints() {
        imagePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        imagePaint.setFilterBitmap(true);
        
        imageRect = new RectF();
        viewRect = new RectF();
    }
    
    private void updateFrameDuration() {
        frameDuration = (long) (1000.0f / frameRate);
    }
    
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        viewRect.set(0, 0, w, h);
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (frames.isEmpty() || currentFrame >= frames.size()) {
            return;
        }
        
        Bitmap currentBitmap = frames.get(currentFrame);
        if (currentBitmap == null) {
            return;
        }
        
        // Apply transformations
        applyImageTransformations();
        
        // Calculate image rect based on resize mode
        calculateImageRect(currentBitmap);
        
        // Draw the current frame
        canvas.drawBitmap(currentBitmap, imageRect, viewRect, imagePaint);
    }
    
    private void applyImageTransformations() {
        // Apply tint color
        int tintColorInt = getColorFromArray(tintColor);
        if (tintColorInt != 0xFFFFFFFF) {
            imagePaint.setColorFilter(new android.graphics.LightingColorFilter(tintColorInt, 0));
        } else {
            imagePaint.setColorFilter(null);
        }
        
        // Apply opacity
        imagePaint.setAlpha((int) (opacity * 255));
    }
    
    private void calculateImageRect(Bitmap bitmap) {
        if (bitmap == null) {
            return;
        }
        
        float bitmapWidth = bitmap.getWidth();
        float bitmapHeight = bitmap.getHeight();
        float viewWidth = getWidth();
        float viewHeight = getHeight();
        
        switch (resizeMode) {
            case "cover":
                float coverScale = Math.max(viewWidth / bitmapWidth, viewHeight / bitmapHeight);
                float coverWidth = bitmapWidth * coverScale;
                float coverHeight = bitmapHeight * coverScale;
                float coverX = (viewWidth - coverWidth) / 2;
                float coverY = (viewHeight - coverHeight) / 2;
                imageRect.set(0, 0, bitmapWidth, bitmapHeight);
                viewRect.set(coverX, coverY, coverX + coverWidth, coverY + coverHeight);
                break;
                
            case "stretch":
                imageRect.set(0, 0, bitmapWidth, bitmapHeight);
                viewRect.set(0, 0, viewWidth, viewHeight);
                break;
                
            case "center":
                float centerX = (viewWidth - bitmapWidth) / 2;
                float centerY = (viewHeight - bitmapHeight) / 2;
                imageRect.set(0, 0, bitmapWidth, bitmapHeight);
                viewRect.set(centerX, centerY, centerX + bitmapWidth, centerY + bitmapHeight);
                break;
                
            case "contain":
            default:
                float containScale = Math.min(viewWidth / bitmapWidth, viewHeight / bitmapHeight);
                float containWidth = bitmapWidth * containScale;
                float containHeight = bitmapHeight * containScale;
                float containX = (viewWidth - containWidth) / 2;
                float containY = (viewHeight - containHeight) / 2;
                imageRect.set(0, 0, bitmapWidth, bitmapHeight);
                viewRect.set(containX, containY, containX + containWidth, containY + containHeight);
                break;
        }
    }
    
    private void nextFrame() {
        if (frames.isEmpty()) {
            return;
        }
        
        currentFrame++;
        if (currentFrame >= frames.size()) {
            if (loop) {
                currentFrame = 0;
                sendLoopEvent();
            } else {
                currentFrame = frames.size() - 1;
                stop();
                sendFinishEvent();
            }
        }
        
        sendFrameChangeEvent();
    }
    
    private void loadFrames() {
        if (frameUris.isEmpty()) {
            ViroLog.debug(TAG, "No frame URIs provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading animated image frames: " + frameUris.size());
        sendLoadStartEvent();
        
        // Load frames in background thread
        new Thread(() -> {
            List<Bitmap> loadedFrames = new ArrayList<>();
            boolean success = true;
            
            try {
                for (String uri : frameUris) {
                    Bitmap bitmap;
                    
                    if (isLocalImages) {
                        InputStream inputStream = getContext().getAssets().open(uri);
                        bitmap = BitmapFactory.decodeStream(inputStream);
                        inputStream.close();
                    } else {
                        // For remote images, you'd implement HTTP loading here
                        bitmap = null; // Placeholder
                    }
                    
                    if (bitmap != null) {
                        loadedFrames.add(bitmap);
                    } else {
                        success = false;
                        break;
                    }
                }
                
            } catch (IOException e) {
                ViroLog.error(TAG, "Error loading frames: " + e.getMessage());
                success = false;
            }
            
            final boolean finalSuccess = success;
            final List<Bitmap> finalFrames = loadedFrames;
            
            post(() -> {
                if (finalSuccess && !finalFrames.isEmpty()) {
                    frames.clear();
                    frames.addAll(finalFrames);
                    isLoaded = true;
                    currentFrame = 0;
                    
                    calculateAnimationDuration();
                    invalidate();
                    sendLoadEndEvent();
                    
                    if (autoPlay) {
                        play();
                    }
                } else {
                    sendErrorEvent("Failed to load animation frames");
                }
            });
            
        }).start();
    }
    
    private void calculateAnimationDuration() {
        if (!frames.isEmpty()) {
            animationDuration = frames.size() / frameRate;
        }
    }
    
    // ViroReact-specific methods
    
    private void applyAnimatedImageProperties() {
        if (mMaterialJni != null) {
            ViroLog.debug(TAG, "Applying animated image properties to ViroReact Material");
            
            // Apply transformation properties
            mMaterialJni.setOpacity(opacity);
            
            // Apply tint color if set
            if (tintColor != null) {
                float[] color = getColorArrayFromReadableArray(tintColor);
                mMaterialJni.setTintColor(color[0], color[1], color[2], color[3]);
            }
            
            ViroLog.debug(TAG, "Animated image properties applied successfully");
        }
    }
    
    private void loadAnimatedFrames() {
        if (frameUris.isEmpty()) {
            ViroLog.debug(TAG, "No frame URIs provided for animated texture");
            return;
        }
        
        ViroLog.debug(TAG, "Loading animated frames in ViroReact: " + frameUris.size() + " frames");
        sendLoadStartEvent();
        
        if (mViroContext != null && mMaterialJni != null) {
            // Create AnimatedTexture with frame URIs
            mAnimatedTextureJni = new AnimatedTexture(mViroContext);
            
            // Load all frame textures
            mFrameTexturesJni.clear();
            for (String uri : frameUris) {
                Texture frameTexture = new Texture(mViroContext, uri, new Texture.LoadCallback() {
                    @Override
                    public void onSuccess(Texture texture) {
                        handleFrameLoadSuccess(texture);
                    }
                    
                    @Override
                    public void onError(String error) {
                        handleAnimatedImageLoadError("Frame loading failed: " + error);
                    }
                });
                mFrameTexturesJni.add(frameTexture);
            }
            
            // Configure animated texture properties
            mAnimatedTextureJni.setFrameRate(frameRate);
            mAnimatedTextureJni.setLoop(loop);
            mAnimatedTextureJni.setPaused(paused);
            
            // Set animated texture to material
            mMaterialJni.setDiffuseTexture(mAnimatedTextureJni);
            
            // Apply animated image properties
            applyAnimatedImageProperties();
        } else {
            handleAnimatedImageLoadError("ViroContext not available for animated texture loading");
        }
    }
    
    private void handleFrameLoadSuccess(Texture texture) {
        ViroLog.debug(TAG, "Frame loaded successfully: " + mFrameTexturesJni.size() + "/" + frameUris.size());
        
        // Check if all frames are loaded
        int loadedFrames = 0;
        for (Texture frameTexture : mFrameTexturesJni) {
            if (frameTexture != null) {
                loadedFrames++;
            }
        }
        
        if (loadedFrames == frameUris.size()) {
            // All frames loaded, setup animated texture
            if (mAnimatedTextureJni != null) {
                mAnimatedTextureJni.setFrames(mFrameTexturesJni);
                
                isLoaded = true;
                calculateAnimationDuration();
                sendLoadEndEvent();
                
                if (autoPlay && !paused) {
                    play();
                }
            }
        }
    }
    
    private void handleAnimatedImageLoadError(String errorMessage) {
        ViroLog.error(TAG, "Animated image load error: " + errorMessage);
        sendErrorEvent(errorMessage);
    }
    
    // Animation Control Methods
    public void play() {
        ViroLog.debug(TAG, "Playing animation");
        
        if (!isLoaded || frames.isEmpty()) {
            ViroLog.debug(TAG, "Animation not ready to play");
            return;
        }
        
        isPlaying = true;
        paused = false;
        lastFrameTime = System.currentTimeMillis();
        
        post(animationRunnable);
        sendPlayEvent();
    }
    
    public void pause() {
        ViroLog.debug(TAG, "Pausing animation");
        
        isPlaying = false;
        paused = true;
        
        removeCallbacks(animationRunnable);
        sendPauseEvent();
    }
    
    public void stop() {
        ViroLog.debug(TAG, "Stopping animation");
        
        isPlaying = false;
        paused = true;
        currentFrame = 0;
        
        removeCallbacks(animationRunnable);
        invalidate();
        sendStopEvent();
    }
    
    public void seekToFrame(int frame) {
        ViroLog.debug(TAG, "Seeking to frame: " + frame);
        
        if (frame >= 0 && frame < frames.size()) {
            currentFrame = frame;
            invalidate();
            sendSeekEvent(frame);
        }
    }
    
    // Property Setters
    public void setSource(@Nullable ReadableArray source) {
        ViroLog.debug(TAG, "Setting source: " + source);
        this.source = source;
        
        frameUris.clear();
        frames.clear();
        isLoaded = false;
        
        if (source != null) {
            for (int i = 0; i < source.size(); i++) {
                ReadableMap frameSource = source.getMap(i);
                if (frameSource != null && frameSource.hasKey("uri")) {
                    String uri = frameSource.getString("uri");
                    frameUris.add(uri);
                }
            }
            
            // Determine if local or remote
            isLocalImages = !frameUris.isEmpty() && !frameUris.get(0).startsWith("http");
            
            // Use ViroReact loading for 3D integration
            if (mViroContext != null) {
                loadAnimatedFrames();
            } else {
                // Fallback to legacy 2D loading
                loadFrames();
            }
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
    }
    
    public void setFrameRate(float frameRate) {
        ViroLog.debug(TAG, "Setting frame rate: " + frameRate);
        this.frameRate = Math.max(1.0f, Math.min(120.0f, frameRate));
        updateFrameDuration();
        calculateAnimationDuration();
    }
    
    public void setResizeMode(@Nullable String resizeMode) {
        ViroLog.debug(TAG, "Setting resize mode: " + resizeMode);
        this.resizeMode = resizeMode != null ? resizeMode : "contain";
        invalidate();
    }
    
    public void setOpacity(float opacity) {
        ViroLog.debug(TAG, "Setting opacity: " + opacity);
        this.opacity = Math.max(0.0f, Math.min(1.0f, opacity));
        invalidate();
    }
    
    public void setTintColor(@Nullable ReadableArray tintColor) {
        ViroLog.debug(TAG, "Setting tint color: " + tintColor);
        this.tintColor = tintColor != null ? tintColor : createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        invalidate();
    }
    
    // State Information
    public boolean isPlaying() {
        return isPlaying;
    }
    
    public boolean isPaused() {
        return paused;
    }
    
    public boolean isLoaded() {
        return isLoaded;
    }
    
    public int getCurrentFrame() {
        return currentFrame;
    }
    
    public int getFrameCount() {
        return frames.size();
    }
    
    public float getAnimationDuration() {
        return animationDuration;
    }
    
    public ReadableMap getAnimationInfo() {
        WritableMap info = Arguments.createMap();
        info.putBoolean("isPlaying", isPlaying);
        info.putBoolean("isPaused", paused);
        info.putBoolean("isLoaded", isLoaded);
        info.putInt("currentFrame", currentFrame);
        info.putInt("frameCount", frames.size());
        info.putDouble("frameRate", frameRate);
        info.putDouble("duration", animationDuration);
        info.putBoolean("loop", loop);
        return info;
    }
    
    // Helper Methods
    private ReadableArray createColorArray(float r, float g, float b, float a) {
        WritableArray array = Arguments.createArray();
        array.pushDouble(r);
        array.pushDouble(g);
        array.pushDouble(b);
        array.pushDouble(a);
        return array;
    }
    
    private int getColorFromArray(@Nullable ReadableArray colorArray) {
        if (colorArray == null || colorArray.size() < 3) {
            return 0xFFFFFFFF;
        }
        
        float red = (float) colorArray.getDouble(0);
        float green = (float) colorArray.getDouble(1);
        float blue = (float) colorArray.getDouble(2);
        float alpha = colorArray.size() > 3 ? (float) colorArray.getDouble(3) : 1.0f;
        
        return android.graphics.Color.argb(
            (int) (alpha * 255),
            (int) (red * 255),
            (int) (green * 255),
            (int) (blue * 255)
        );
    }
    
    private float[] getColorArrayFromReadableArray(@Nullable ReadableArray colorArray) {
        if (colorArray == null || colorArray.size() < 3) {
            return new float[]{1.0f, 1.0f, 1.0f, 1.0f};
        }
        
        float red = (float) colorArray.getDouble(0);
        float green = (float) colorArray.getDouble(1);
        float blue = (float) colorArray.getDouble(2);
        float alpha = colorArray.size() > 3 ? (float) colorArray.getDouble(3) : 1.0f;
        
        return new float[]{red, green, blue, alpha};
    }
    
    // Event Methods
    private void sendLoadStartEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putInt("frameCount", frameUris.size());
        sendEvent("onLoadStart", eventData);
    }
    
    private void sendLoadEndEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putMap("animationInfo", (WritableMap) getAnimationInfo());
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
    
    private void sendLoopEvent() {
        WritableMap eventData = Arguments.createMap();
        sendEvent("onLoop", eventData);
    }
    
    private void sendFrameChangeEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putInt("frame", currentFrame);
        eventData.putDouble("progress", (double) currentFrame / frames.size());
        sendEvent("onFrameChange", eventData);
    }
    
    private void sendSeekEvent(int frame) {
        WritableMap eventData = Arguments.createMap();
        eventData.putInt("frame", frame);
        sendEvent("onSeek", eventData);
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
    
    /**
     * Emit animated image events for ViroReact integration
     */
    public void emitAnimatedImageEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop animation
        pause();
        removeCallbacks(animationRunnable);
        
        // Clean up ViroReact animated image resources
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
        
        if (mAnimatedTextureJni != null) {
            mAnimatedTextureJni.dispose();
            mAnimatedTextureJni = null;
        }
        
        // Dispose frame textures
        for (Texture frameTexture : mFrameTexturesJni) {
            if (frameTexture != null) {
                frameTexture.dispose();
            }
        }
        mFrameTexturesJni.clear();
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        source = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "ViroAnimatedImageView attached to window");
        
        // Animated image will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mQuadJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact animated image ready for scene attachment");
        }
        
        // Ensure animated image properties are applied
        applyAnimatedImageProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "ViroAnimatedImageView detached from window");
        
        // Pause animation when detached
        pause();
        removeCallbacks(animationRunnable);
        
        // Cleanup bitmaps
        for (Bitmap bitmap : frames) {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
        frames.clear();
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public boolean isLocalImages() { return isLocalImages; }
    public float getFrameRate() { return frameRate; }
    public String getResizeMode() { return resizeMode; }
    public ReadableArray getTintColor() { return tintColor; }
    public List<String> getFrameUris() { return frameUris; }
}