//
//  Viro360ImageView.java
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
import android.graphics.Matrix;
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

import com.viro.core.EventDelegate;
import com.viro.core.Image360;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.Sphere;
import com.viro.core.Texture;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;
import com.viromedia.bridge.utility.ViroLog;

import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Native Android view for Viro360Image component.
 * Viro360Image provides comprehensive 360° panoramic image functionality with ViroReact 3D integration,
 * supporting equirectangular images, cube maps, stereoscopic content, and immersive viewing experiences.
 */
public class Viro360ImageView extends View {
    
    private static final String TAG = ViroLog.getTag(Viro360ImageView.class);
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Sphere mSphereJni;
    private Image360 mImage360Jni;
    private Material mMaterialJni;
    private Texture mTextureJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Image formats
    public enum ImageFormat {
        EQUIRECTANGULAR("equirectangular"),
        CUBE_MAP("cubemap"),
        SPHERICAL("spherical"),
        CYLINDRICAL("cylindrical");
        
        private final String value;
        
        ImageFormat(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        public static ImageFormat fromString(String value) {
            for (ImageFormat format : ImageFormat.values()) {
                if (format.value.equals(value)) {
                    return format;
                }
            }
            return EQUIRECTANGULAR;
        }
    }
    
    // Loading states
    public enum LoadingState {
        IDLE("idle"),
        LOADING("loading"),
        LOADED("loaded"),
        ERROR("error");
        
        private final String value;
        
        LoadingState(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    // Image source and properties
    private ReadableMap source;
    private String uri = "";
    private boolean isLocalImage = false;
    private ImageFormat format = ImageFormat.EQUIRECTANGULAR;
    private boolean stereoMode = false;
    private String stereoLayout = "topBottom";
    
    // Display properties
    private float rotation = 0.0f;
    private ReadableArray rotationAxis;
    private float fieldOfView = 90.0f;
    private boolean enableInteraction = true;
    private float zoom = 1.0f;
    private float minZoom = 0.5f;
    private float maxZoom = 3.0f;
    
    // Image transformation
    private ReadableArray tintColor;
    private float brightness = 1.0f;
    private float contrast = 1.0f;
    private float saturation = 1.0f;
    private float opacity = 1.0f;
    
    // Animation and transition
    private float fadeInDuration = 0.5f;
    private float fadeOutDuration = 0.5f;
    private boolean autoRotate = false;
    private float autoRotateSpeed = 1.0f;
    private String autoRotateDirection = "clockwise";
    
    // Cube map specific
    private ReadableMap cubeMapSources;
    private String[] cubeMapUris = new String[6]; // px, nx, py, ny, pz, nz
    
    // Internal state
    private Bitmap panoramaBitmap;
    private LoadingState loadingState = LoadingState.IDLE;
    private Paint imagePaint;
    private Paint overlayPaint;
    private Matrix imageMatrix;
    private RectF imageRect;
    private RectF viewRect;
    
    // Touch interaction
    private float lastTouchX = 0.0f;
    private float lastTouchY = 0.0f;
    private float currentRotationX = 0.0f;
    private float currentRotationY = 0.0f;
    private boolean isDragging = false;
    
    // Loading
    private Thread loadingThread;
    private volatile boolean cancelLoading = false;
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    // Auto rotation
    private Runnable autoRotateRunnable = new Runnable() {
        @Override
        public void run() {
            if (autoRotate && loadingState == LoadingState.LOADED) {
                float rotationSpeed = autoRotateSpeed * 0.5f; // Degrees per frame
                if ("counterclockwise".equals(autoRotateDirection)) {
                    rotationSpeed = -rotationSpeed;
                }
                
                currentRotationY += rotationSpeed;
                if (currentRotationY >= 360.0f) {
                    currentRotationY -= 360.0f;
                } else if (currentRotationY < 0.0f) {
                    currentRotationY += 360.0f;
                }
                
                updateImageMatrix();
                invalidate();
                
                postDelayed(this, 16); // ~60 FPS
            }
        }
    };
    
    public Viro360ImageView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        
        ViroLog.debug(TAG, "Viro360ImageView initialized with ViroReact 360° Image integration");
        
        // Initialize default values
        rotationAxis = createVector3Array(0.0f, 1.0f, 0.0f);
        tintColor = createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        
        initialize360Image();
        initializePaints();
        setupMatrices();
    }
    
    private void initialize360Image() {
        ViroLog.debug(TAG, "Initializing ViroReact 360° image with default properties");
        
        // Create ViroReact Node for the 360° image
        mNodeJni = new Node();
        
        // Create Sphere geometry for 360° image projection
        mSphereJni = new Sphere(1.0f); // 1 meter radius
        
        // Create Image360 for panoramic image handling
        mImage360Jni = new Image360(mViroContext);
        
        // Create Material for the 360° image
        mMaterialJni = new Material(mViroContext);
        
        // Configure initial 360° image properties
        apply360ImageProperties();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mSphereJni);
        mSphereJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // 360° image views are typically transparent for 3D content
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        ViroLog.debug(TAG, "ViroReact 360° Image initialized successfully");
    }
    
    /**
     * Wrapper class to make Viro360ImageView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<Viro360ImageView> m360ImageView;
        
        public VRTComponentWrapper(Viro360ImageView imageView) {
            super(imageView.getContext(), null, -1, -1, imageView.mReactContext);
            m360ImageView = new WeakReference<>(imageView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            Viro360ImageView imageView = m360ImageView.get();
            if (imageView != null) {
                imageView.emit360ImageEvent(eventName, eventData);
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
     * Get the underlying ViroReact Image360 object
     */
    public Image360 getImage360Jni() {
        return mImage360Jni;
    }
    
    /**
     * Set the ViroContext for this 360° image
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate 360° image components with ViroContext if needed
        if (mImage360Jni != null) {
            mImage360Jni.dispose();
            mImage360Jni = new Image360(mViroContext);
            mMaterialJni.dispose();
            mMaterialJni = new Material(mViroContext);
            apply360ImageProperties();
            if (mSphereJni != null) {
                mSphereJni.setMaterials(java.util.Arrays.asList(mMaterialJni));
            }
        }
    }
    
    private void initializePaints() {
        imagePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        imagePaint.setFilterBitmap(true);
        
        overlayPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        overlayPaint.setStyle(Paint.Style.FILL);
        
        imageMatrix = new Matrix();
        imageRect = new RectF();
        viewRect = new RectF();
    }
    
    private void setupMatrices() {
        updateImageMatrix();
    }
    
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        viewRect.set(0, 0, w, h);
        updateImageMatrix();
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (panoramaBitmap == null || loadingState != LoadingState.LOADED) {
            drawLoadingState(canvas);
            return;
        }
        
        // Apply transformations
        applyImageTransformations();
        
        // Draw the panoramic image
        canvas.save();
        canvas.concat(imageMatrix);
        
        canvas.drawBitmap(panoramaBitmap, imageRect, viewRect, imagePaint);
        
        canvas.restore();
        
        // Draw overlay effects if needed
        drawOverlayEffects(canvas);
    }
    
    private void drawLoadingState(Canvas canvas) {
        switch (loadingState) {
            case LOADING:
                // Draw loading indicator
                overlayPaint.setColor(0x80000000);
                canvas.drawRect(viewRect, overlayPaint);
                
                // Simple loading text
                overlayPaint.setColor(0xFFFFFFFF);
                overlayPaint.setTextAlign(Paint.Align.CENTER);
                overlayPaint.setTextSize(24);
                canvas.drawText("Loading 360° Image...", 
                    getWidth() / 2.0f, getHeight() / 2.0f, overlayPaint);
                break;
                
            case ERROR:
                // Draw error state
                overlayPaint.setColor(0x80FF0000);
                canvas.drawRect(viewRect, overlayPaint);
                
                overlayPaint.setColor(0xFFFFFFFF);
                overlayPaint.setTextAlign(Paint.Align.CENTER);
                overlayPaint.setTextSize(20);
                canvas.drawText("Failed to load 360° image", 
                    getWidth() / 2.0f, getHeight() / 2.0f, overlayPaint);
                break;
                
            case IDLE:
            default:
                // Draw placeholder
                overlayPaint.setColor(0xFF333333);
                canvas.drawRect(viewRect, overlayPaint);
                break;
        }
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
        
        // Additional transformations (brightness, contrast, saturation) would require
        // more complex ColorMatrixColorFilter implementations
    }
    
    private void drawOverlayEffects(Canvas canvas) {
        // Draw any overlay effects like hotspots, UI elements, etc.
        // This is a placeholder for future enhancements
    }
    
    private void updateImageMatrix() {
        if (panoramaBitmap == null) {
            return;
        }
        
        imageMatrix.reset();
        
        // Calculate scale to fit view
        float scaleX = getWidth() / (float) panoramaBitmap.getWidth();
        float scaleY = getHeight() / (float) panoramaBitmap.getHeight();
        float scale = Math.max(scaleX, scaleY) * zoom;
        
        // Apply transformations
        imageMatrix.postScale(scale, scale);
        
        // Apply rotation
        float centerX = getWidth() / 2.0f;
        float centerY = getHeight() / 2.0f;
        imageMatrix.postRotate(rotation + currentRotationY, centerX, centerY);
        
        // Apply translation for panning
        float translateX = -currentRotationX * scale * 0.01f;
        float translateY = -currentRotationY * scale * 0.01f;
        imageMatrix.postTranslate(translateX, translateY);
        
        // Update image rect
        imageRect.set(0, 0, panoramaBitmap.getWidth(), panoramaBitmap.getHeight());
    }
    
    // ViroReact-specific methods
    
    private void apply360ImageProperties() {
        if (mMaterialJni != null) {
            ViroLog.debug(TAG, "Applying 360° image properties to ViroReact Material");
            
            // Apply transformation properties
            mMaterialJni.setBrightness(brightness);
            mMaterialJni.setContrast(contrast);
            mMaterialJni.setSaturation(saturation);
            mMaterialJni.setOpacity(opacity);
            
            // Apply stereo mode if enabled
            if (stereoMode) {
                mMaterialJni.setStereoMode(Material.StereoMode.fromString(stereoLayout));
            }
            
            ViroLog.debug(TAG, "360° image properties applied successfully");
        }
        
        if (mSphereJni != null) {
            // Apply rotation to sphere geometry
            Vector rotationVec = new Vector(
                (float) Math.toRadians(currentRotationX),
                (float) Math.toRadians(currentRotationY + rotation),
                0.0f
            );
            if (mNodeJni != null) {
                mNodeJni.setRotation(rotationVec);
            }
        }
    }
    
    private void load360Image() {
        if (uri.isEmpty()) {
            ViroLog.debug(TAG, "No 360° image URI provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading 360° image in ViroReact: " + uri);
        setLoadingState(LoadingState.LOADING);
        sendLoadStartEvent();
        
        if (mViroContext != null && mMaterialJni != null) {
            // Create texture from URI
            mTextureJni = new Texture(mViroContext, uri, new Texture.LoadCallback() {
                @Override
                public void onSuccess(Texture texture) {
                    handle360ImageLoadSuccess(texture);
                }
                
                @Override
                public void onError(String error) {
                    handle360ImageLoadError("360° image loading failed: " + error);
                }
            });
        } else {
            handle360ImageLoadError("ViroContext not available for 360° image loading");
        }
    }
    
    private void handle360ImageLoadSuccess(Texture texture) {
        ViroLog.debug(TAG, "360° image loaded successfully in ViroReact");
        
        if (mMaterialJni != null) {
            // Set texture to material based on format
            switch (format) {
                case EQUIRECTANGULAR:
                    mMaterialJni.setDiffuseTexture(texture);
                    break;
                case CUBE_MAP:
                    // Handle cube map loading differently
                    load360CubeMap();
                    return;
                case SPHERICAL:
                case CYLINDRICAL:
                    mMaterialJni.setDiffuseTexture(texture);
                    break;
            }
            
            // Apply 360° image properties
            apply360ImageProperties();
            
            setLoadingState(LoadingState.LOADED);
            sendLoadEndEvent();
            
            // Start auto-rotation if enabled
            if (autoRotate) {
                startAutoRotation();
            }
        }
    }
    
    private void handle360ImageLoadError(String errorMessage) {
        ViroLog.error(TAG, "360° image load error: " + errorMessage);
        
        setLoadingState(LoadingState.ERROR);
        sendErrorEvent(errorMessage);
    }
    
    private void load360CubeMap() {
        if (cubeMapSources == null) {
            handle360ImageLoadError("Cube map sources not provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading cube map for 360° image");
        
        // Extract cube map URIs
        String[] faces = {
            cubeMapSources.hasKey("px") ? cubeMapSources.getString("px") : null,
            cubeMapSources.hasKey("nx") ? cubeMapSources.getString("nx") : null,
            cubeMapSources.hasKey("py") ? cubeMapSources.getString("py") : null,
            cubeMapSources.hasKey("ny") ? cubeMapSources.getString("ny") : null,
            cubeMapSources.hasKey("pz") ? cubeMapSources.getString("pz") : null,
            cubeMapSources.hasKey("nz") ? cubeMapSources.getString("nz") : null
        };
        
        // Validate all faces are provided
        for (String face : faces) {
            if (face == null) {
                handle360ImageLoadError("Missing cube map face");
                return;
            }
        }
        
        if (mViroContext != null && mMaterialJni != null) {
            // Create cube map texture
            Texture cubeMapTexture = new Texture(mViroContext, faces, new Texture.LoadCallback() {
                @Override
                public void onSuccess(Texture texture) {
                    ViroLog.debug(TAG, "Cube map loaded successfully");
                    mMaterialJni.setDiffuseTexture(texture);
                    apply360ImageProperties();
                    setLoadingState(LoadingState.LOADED);
                    sendLoadEndEvent();
                    
                    if (autoRotate) {
                        startAutoRotation();
                    }
                }
                
                @Override
                public void onError(String error) {
                    handle360ImageLoadError("Cube map loading failed: " + error);
                }
            });
        }
    }
    
    private void startAutoRotation() {
        if (autoRotate && !isDragging) {
            removeCallbacks(autoRotateRunnable);
            post(autoRotateRunnable);
        }
    }
    
    private void stopAutoRotation() {
        removeCallbacks(autoRotateRunnable);
    }
    
    // Image Loading Methods (Legacy 2D implementation preserved for fallback)
    private void loadImage() {
        if (uri.isEmpty()) {
            ViroLog.debug(TAG, "No image URI provided");
            return;
        }
        
        ViroLog.debug(TAG, "Loading 360° image: " + uri);
        setLoadingState(LoadingState.LOADING);
        sendLoadStartEvent();
        
        // Cancel any existing loading
        cancelLoading = true;
        if (loadingThread != null) {
            loadingThread.interrupt();
        }
        
        cancelLoading = false;
        loadingThread = new Thread(() -> {
            try {
                Bitmap bitmap;
                
                if (isLocalImage) {
                    bitmap = loadLocalImage();
                } else {
                    bitmap = loadRemoteImage();
                }
                
                if (!cancelLoading && bitmap != null) {
                    post(() -> {
                        panoramaBitmap = bitmap;
                        setLoadingState(LoadingState.LOADED);
                        updateImageMatrix();
                        invalidate();
                        sendLoadEndEvent();
                        
                        if (autoRotate) {
                            startAutoRotation();
                        }
                    });
                } else if (!cancelLoading) {
                    post(() -> {
                        setLoadingState(LoadingState.ERROR);
                        sendErrorEvent("Failed to load image");
                        invalidate();
                    });
                }
                
            } catch (Exception e) {
                ViroLog.error(TAG, "Error loading image: " + e.getMessage());
                if (!cancelLoading) {
                    post(() -> {
                        setLoadingState(LoadingState.ERROR);
                        sendErrorEvent("Error loading image: " + e.getMessage());
                        invalidate();
                    });
                }
            }
        });
        
        loadingThread.start();
    }
    
    private Bitmap loadLocalImage() throws IOException {
        // Load from local assets or resources
        InputStream inputStream = getContext().getAssets().open(uri);
        return BitmapFactory.decodeStream(inputStream);
    }
    
    private Bitmap loadRemoteImage() throws IOException {
        URL url = new URL(uri);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setDoInput(true);
        connection.connect();
        
        InputStream inputStream = connection.getInputStream();
        return BitmapFactory.decodeStream(inputStream);
    }
    
    // Touch Interaction
    @Override
    public boolean onTouchEvent(android.view.MotionEvent event) {
        if (!enableInteraction || loadingState != LoadingState.LOADED) {
            return super.onTouchEvent(event);
        }
        
        switch (event.getAction()) {
            case android.view.MotionEvent.ACTION_DOWN:
                lastTouchX = event.getX();
                lastTouchY = event.getY();
                isDragging = true;
                return true;
                
            case android.view.MotionEvent.ACTION_MOVE:
                if (isDragging) {
                    float deltaX = event.getX() - lastTouchX;
                    float deltaY = event.getY() - lastTouchY;
                    
                    // Convert touch movement to rotation
                    float sensitivity = 0.5f;
                    currentRotationX += deltaX * sensitivity;
                    currentRotationY += deltaY * sensitivity;
                    
                    // Clamp vertical rotation
                    currentRotationY = Math.max(-90, Math.min(90, currentRotationY));
                    
                    updateImageMatrix();
                    invalidate();
                    
                    lastTouchX = event.getX();
                    lastTouchY = event.getY();
                    
                    sendInteractionEvent("drag", deltaX, deltaY);
                    return true;
                }
                break;
                
            case android.view.MotionEvent.ACTION_UP:
            case android.view.MotionEvent.ACTION_CANCEL:
                isDragging = false;
                return true;
        }
        
        return super.onTouchEvent(event);
    }
    
    // Auto Rotation
    private void startAutoRotation() {
        if (autoRotate) {
            post(autoRotateRunnable);
        }
    }
    
    private void stopAutoRotation() {
        removeCallbacks(autoRotateRunnable);
    }
    
    // Property Setters
    public void setSource(@Nullable ReadableMap source) {
        ViroLog.debug(TAG, "Setting 360° image source: " + source);
        this.source = source;
        
        if (source != null && source.hasKey("uri")) {
            this.uri = source.getString("uri");
            this.isLocalImage = uri != null && !uri.startsWith("http");
            load360Image();
        }
    }
    
    public void setFormat(@Nullable String format) {
        ViroLog.debug(TAG, "Setting format: " + format);
        this.format = ImageFormat.fromString(format != null ? format : "equirectangular");
        
        if (panoramaBitmap != null) {
            updateImageMatrix();
            invalidate();
        }
    }
    
    public void setStereoMode(boolean stereoMode) {
        ViroLog.debug(TAG, "Setting stereo mode: " + stereoMode);
        this.stereoMode = stereoMode;
        
        if (panoramaBitmap != null) {
            updateImageMatrix();
            invalidate();
        }
    }
    
    public void setRotation(float rotation) {
        ViroLog.debug(TAG, "Setting rotation: " + rotation);
        this.rotation = rotation;
        updateImageMatrix();
        invalidate();
    }
    
    public void setFieldOfView(float fov) {
        ViroLog.debug(TAG, "Setting field of view: " + fov);
        this.fieldOfView = Math.max(10, Math.min(170, fov));
        updateImageMatrix();
        invalidate();
    }
    
    public void setZoom(float zoom) {
        ViroLog.debug(TAG, "Setting zoom: " + zoom);
        this.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
        updateImageMatrix();
        invalidate();
    }
    
    public void setAutoRotate(boolean autoRotate) {
        ViroLog.debug(TAG, "Setting auto rotate: " + autoRotate);
        this.autoRotate = autoRotate;
        
        if (autoRotate && loadingState == LoadingState.LOADED) {
            startAutoRotation();
        } else {
            stopAutoRotation();
        }
    }
    
    public void setTintColor(@Nullable ReadableArray tintColor) {
        ViroLog.debug(TAG, "Setting tint color: " + tintColor);
        this.tintColor = tintColor != null ? tintColor : createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        invalidate();
    }
    
    // State Information
    public boolean isLoaded() {
        return loadingState == LoadingState.LOADED;
    }
    
    public boolean isLoading() {
        return loadingState == LoadingState.LOADING;
    }
    
    public String getLoadingState() {
        return loadingState.getValue();
    }
    
    public ReadableMap getImageInfo() {
        WritableMap info = Arguments.createMap();
        info.putString("uri", uri);
        info.putString("format", format.getValue());
        info.putBoolean("stereoMode", stereoMode);
        info.putString("loadingState", loadingState.getValue());
        
        if (panoramaBitmap != null) {
            info.putInt("width", panoramaBitmap.getWidth());
            info.putInt("height", panoramaBitmap.getHeight());
        }
        
        return info;
    }
    
    private void setLoadingState(LoadingState state) {
        if (this.loadingState != state) {
            this.loadingState = state;
            sendStateChangeEvent();
        }
    }
    
    // Helper Methods
    private ReadableArray createVector3Array(float x, float y, float z) {
        WritableArray array = Arguments.createArray();
        array.pushDouble(x);
        array.pushDouble(y);
        array.pushDouble(z);
        return array;
    }
    
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
    
    // Event Methods
    private void sendLoadStartEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("uri", uri);
        sendEvent("onLoadStart", eventData);
    }
    
    private void sendLoadEndEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("uri", uri);
        eventData.putMap("imageInfo", (WritableMap) getImageInfo());
        sendEvent("onLoadEnd", eventData);
    }
    
    private void sendErrorEvent(String error) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("error", error);
        eventData.putString("uri", uri);
        sendEvent("onError", eventData);
    }
    
    private void sendStateChangeEvent() {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("state", loadingState.getValue());
        sendEvent("onStateChange", eventData);
    }
    
    private void sendInteractionEvent(String type, float deltaX, float deltaY) {
        WritableMap eventData = Arguments.createMap();
        eventData.putString("type", type);
        eventData.putDouble("deltaX", deltaX);
        eventData.putDouble("deltaY", deltaY);
        eventData.putDouble("rotationX", currentRotationX);
        eventData.putDouble("rotationY", currentRotationY);
        sendEvent("onInteraction", eventData);
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
     * Emit 360° image events for ViroReact integration
     */
    public void emit360ImageEvent(String eventName, @Nullable WritableMap eventData) {
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
    
    // Lifecycle methods
    
    public void onDropViewInstance() {
        ViroLog.debug(TAG, "onDropViewInstance called");
        
        // Stop auto-rotation and loading
        stopAutoRotation();
        cancelLoading = true;
        if (loadingThread != null) {
            loadingThread.interrupt();
        }
        
        // Clean up ViroReact 360° image resources
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
        
        if (mTextureJni != null) {
            mTextureJni.dispose();
            mTextureJni = null;
        }
        
        if (mImage360Jni != null) {
            mImage360Jni.dispose();
            mImage360Jni = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
        
        // Clean up bitmap
        if (panoramaBitmap != null && !panoramaBitmap.isRecycled()) {
            panoramaBitmap.recycle();
            panoramaBitmap = null;
        }
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        ViroLog.debug(TAG, "Viro360ImageView attached to window");
        
        // 360° image will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mSphereJni != null && mViroContext != null) {
            ViroLog.debug(TAG, "ViroReact 360° image ready for scene attachment");
        }
        
        // Ensure 360° image properties are applied
        apply360ImageProperties();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        ViroLog.debug(TAG, "Viro360ImageView detached from window");
        
        // Basic cleanup
        stopAutoRotation();
        cancelLoading = true;
        if (loadingThread != null) {
            loadingThread.interrupt();
        }
        
        // ViroReact cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
    
    // Getters for current values (useful for debugging and testing)
    public ImageFormat getFormat() { return format; }
    public boolean isStereoMode() { return stereoMode; }
    public String getStereoLayout() { return stereoLayout; }
    public float getRotation() { return rotation; }
    public float getFieldOfView() { return fieldOfView; }
    public boolean isEnableInteraction() { return enableInteraction; }
    public float getZoom() { return zoom; }
    public float getBrightness() { return brightness; }
    public float getContrast() { return contrast; }
    public float getSaturation() { return saturation; }
    public float getOpacity() { return opacity; }
    public boolean isAutoRotate() { return autoRotate; }
    public float getAutoRotateSpeed() { return autoRotateSpeed; }
    public String getAutoRotateDirection() { return autoRotateDirection; }
    public LoadingState getLoadingState() { return loadingState; }
    public String getUri() { return uri; }
}