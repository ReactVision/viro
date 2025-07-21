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
import com.viro.core.Quad;
import com.viro.core.Texture;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Android view for ViroImage component.
 * ViroImage displays 2D images in 3D space.
 */
public class ViroImageView extends View {
    
    private static final String TAG = "ViroImageView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Quad mQuadGeometry;
    private Texture mImageTexture;
    private Material mImageMaterial;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;
    
    // Image source and content
    private Map<String, Object> mSource;
    private Map<String, Object> mPlaceholderSource;
    
    // Image dimensions
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    
    // Image display properties
    private String mFormat = "RGBA8";
    private boolean mMipmap = true;
    private String mWrapS = "clamp";
    private String mWrapT = "clamp";
    private String mMinificationFilter = "linear";
    private String mMagnificationFilter = "linear";
    private String mResizeMode = "scaleToFill";
    private String mImageClipMode = "none";
    
    // Stereo image properties
    private String mStereoMode = "none";
    
    // Material properties
    private List<String> mMaterials;
    
    public ViroImageView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        initializeView();
    }
    
    private void initializeView() {
        Log.d(TAG, "Initializing ViroImageView with ViroReact integration");
        
        // Create ViroReact Node for the image
        mNodeJni = new Node();
        
        // Create Quad geometry for image display (images are displayed on quad surfaces)
        mQuadGeometry = new Quad(mWidth, mHeight);
        
        // Create material for the image
        mImageMaterial = new Material();
        
        // Attach geometry and material to node
        mNodeJni.setGeometry(mQuadGeometry);
        mQuadGeometry.setMaterial(mImageMaterial);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Image views are typically transparent since they represent 3D geometry
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Image initialized successfully");
    }
    
    /**
     * Wrapper class to make ViroImageView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroImageView> mImageView;
        
        public VRTComponentWrapper(ViroImageView imageView) {
            super(imageView.getContext(), null, -1, -1, imageView.mReactContext);
            mImageView = new WeakReference<>(imageView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroImageView imageView = mImageView.get();
            if (imageView != null) {
                imageView.emitImageEvent(eventName, eventData);
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
     * Set the ViroContext for this image
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For 3D images, we don't use traditional Android view measurements
        // The size is determined by the 3D image dimensions (width, height)
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D transforms and image dimensions, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Image source and content setters
    
    public void setSource(@Nullable ReadableMap source) {
        Log.d(TAG, "Setting source: " + source);
        mSource = source != null ? source.toHashMap() : null;
        
        // TODO: Load image from source in ViroReact renderer
        loadImageFromSource();
    }
    
    public void setPlaceholderSource(@Nullable ReadableMap placeholderSource) {
        Log.d(TAG, "Setting placeholder source: " + placeholderSource);
        mPlaceholderSource = placeholderSource != null ? placeholderSource.toHashMap() : null;
        
        // TODO: Load placeholder image in ViroReact renderer
    }
    
    private void loadImageFromSource() {
        if (mSource == null) {
            return;
        }
        
        // Emit load start event
        emitImageEvent("onLoadStart", Arguments.createMap());
        
        Log.d(TAG, "Loading image from source: " + mSource);
        
        // Create ViroReact texture from source
        if (mViroContext != null && mImageMaterial != null) {
            try {
                // Get image URI from source
                Object uriObj = mSource.get("uri");
                String imageUri = uriObj != null ? uriObj.toString() : null;
                
                if (imageUri != null) {
                    // Create texture from URI
                    mImageTexture = new Texture(imageUri, Texture.Type.TEXTURE_2D, mMipmap, 
                                              Texture.StereoMode.NONE);
                    
                    // Apply texture filtering and wrap modes
                    applyTextureProperties();
                    
                    // Set texture on material
                    mImageMaterial.setDiffuseTexture(mImageTexture);
                    
                    // Emit successful load event
                    post(() -> {
                        WritableMap event = Arguments.createMap();
                        event.putMap("source", Arguments.makeNativeMap(mSource));
                        event.putBoolean("success", true);
                        emitImageEvent("onLoadEnd", event);
                    });
                } else {
                    // Emit error event
                    post(() -> {
                        WritableMap event = Arguments.createMap();
                        event.putString("error", "Invalid image source URI");
                        emitImageEvent("onError", event);
                    });
                }
            } catch (Exception e) {
                Log.e(TAG, "Error loading image: " + e.getMessage(), e);
                // Emit error event
                post(() -> {
                    WritableMap event = Arguments.createMap();
                    event.putString("error", e.getMessage());
                    emitImageEvent("onError", event);
                });
            }
        }
    }
    
    private void applyTextureProperties() {
        if (mImageTexture != null) {
            // Apply wrap modes
            Texture.WrapMode wrapModeS = getWrapModeFromString(mWrapS);
            Texture.WrapMode wrapModeT = getWrapModeFromString(mWrapT);
            mImageTexture.setWrapMode(wrapModeS, wrapModeT);
            
            // Apply filtering
            Texture.FilterMode minFilter = getFilterModeFromString(mMinificationFilter);
            Texture.FilterMode magFilter = getFilterModeFromString(mMagnificationFilter);
            mImageTexture.setFilterMode(minFilter, magFilter);
        }
    }
    
    private Texture.WrapMode getWrapModeFromString(String wrap) {
        switch (wrap.toLowerCase()) {
            case "repeat": return Texture.WrapMode.REPEAT;
            case "mirror": return Texture.WrapMode.MIRRORED_REPEAT;
            case "clamp":
            default: return Texture.WrapMode.CLAMP_TO_EDGE;
        }
    }
    
    private Texture.FilterMode getFilterModeFromString(String filter) {
        switch (filter.toLowerCase()) {
            case "nearest": return Texture.FilterMode.NEAREST;
            case "linear":
            default: return Texture.FilterMode.LINEAR;
        }
    }
    
    // Image dimensions setters
    
    public void setImageWidth(float width) {
        Log.d(TAG, "Setting image width: " + width);
        mWidth = width;
        updateImageGeometry();
    }
    
    public void setImageHeight(float height) {
        Log.d(TAG, "Setting image height: " + height);
        mHeight = height;
        updateImageGeometry();
    }
    
    private void updateImageGeometry() {
        Log.d(TAG, "Updating image geometry: " + mWidth + " x " + mHeight);
        
        if (mQuadGeometry != null) {
            // Create new quad geometry with updated dimensions
            mQuadGeometry = new Quad(mWidth, mHeight);
            
            // Reapply material
            if (mImageMaterial != null) {
                mQuadGeometry.setMaterial(mImageMaterial);
            }
            
            // Update the node's geometry
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mQuadGeometry);
            }
        }
    }
    
    // Image display properties setters
    
    public void setFormat(@Nullable String format) {
        Log.d(TAG, "Setting format: " + format);
        mFormat = format != null ? format : "RGBA8";
        
        // TODO: Apply image format to ViroReact renderer
        // Formats: RGBA8, RGB565, etc.
    }
    
    public void setMipmap(boolean mipmap) {
        Log.d(TAG, "Setting mipmap: " + mipmap);
        mMipmap = mipmap;
        
        // Reload texture with new mipmap setting if we have a source
        if (mSource != null) {
            loadImageFromSource();
        }
    }
    
    public void setWrapS(@Nullable String wrapS) {
        Log.d(TAG, "Setting wrapS: " + wrapS);
        mWrapS = wrapS != null ? wrapS : "clamp";
        applyTextureProperties();
    }
    
    public void setWrapT(@Nullable String wrapT) {
        Log.d(TAG, "Setting wrapT: " + wrapT);
        mWrapT = wrapT != null ? wrapT : "clamp";
        applyTextureProperties();
    }
    
    public void setMinificationFilter(@Nullable String minificationFilter) {
        Log.d(TAG, "Setting minification filter: " + minificationFilter);
        mMinificationFilter = minificationFilter != null ? minificationFilter : "linear";
        applyTextureProperties();
    }
    
    public void setMagnificationFilter(@Nullable String magnificationFilter) {
        Log.d(TAG, "Setting magnification filter: " + magnificationFilter);
        mMagnificationFilter = magnificationFilter != null ? magnificationFilter : "linear";
        applyTextureProperties();
    }
    
    public void setResizeMode(@Nullable String resizeMode) {
        Log.d(TAG, "Setting resize mode: " + resizeMode);
        mResizeMode = resizeMode != null ? resizeMode : "scaleToFill";
        
        // TODO: Apply resize mode to ViroReact renderer
        // Modes: scaleToFill, scaleAspectFit, scaleAspectFill
    }
    
    public void setImageClipMode(@Nullable String imageClipMode) {
        Log.d(TAG, "Setting image clip mode: " + imageClipMode);
        mImageClipMode = imageClipMode != null ? imageClipMode : "none";
        
        // TODO: Apply image clipping to ViroReact renderer
    }
    
    // Stereo image properties setters
    
    public void setStereoMode(@Nullable String stereoMode) {
        Log.d(TAG, "Setting stereo mode: " + stereoMode);
        mStereoMode = stereoMode != null ? stereoMode : "none";
        
        // TODO: Apply stereo mode to ViroReact renderer
        // Modes: none, leftRight, rightLeft, topBottom, bottomTop
    }
    
    // Material setters
    
    public void setMaterials(@Nullable ReadableArray materials) {
        if (materials != null) {
            mMaterials = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                String material = materials.getString(i);
                if (material != null) {
                    mMaterials.add(material);
                }
            }
        } else {
            mMaterials = null;
        }
        
        Log.d(TAG, "Setting materials: " + mMaterials);
        
        // TODO: Apply materials to ViroReact image
    }
    
    // Event emission
    
    private void emitImageEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact image resources
        if (mNodeJni != null) {
            mNodeJni.setEventDelegate(null);
            mNodeJni.dispose();
            mNodeJni = null;
        }
        
        if (mEventDelegateJni != null) {
            mEventDelegateJni.dispose();
            mEventDelegateJni = null;
        }
        
        if (mQuadGeometry != null) {
            mQuadGeometry.dispose();
            mQuadGeometry = null;
        }
        
        if (mImageTexture != null) {
            mImageTexture.dispose();
            mImageTexture = null;
        }
        
        if (mImageMaterial != null) {
            mImageMaterial.dispose();
            mImageMaterial = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mSource = null;
        mPlaceholderSource = null;
        mMaterials = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroImageView attached to window");
        
        // Image will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact image ready for scene attachment");
        }
        loadImageFromSource();
    }
    
    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroImageView detached from window");
        // Image cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }
}