//
//  ViroTextView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

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
import com.viro.core.Text;
import com.viro.core.Vector;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroText component.
 * ViroText provides comprehensive 3D text rendering capabilities with typography controls,
 * layout management, and material support.
 */
public class ViroTextView extends View {
    
    private static final String TAG = "ViroTextView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private Text mTextJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    // Text content
    private String mText = "";

    // Text styling
    private String mFontFamily = "Helvetica";
    private float mFontSize = 12.0f;
    private String mFontWeight = "normal";
    private String mFontStyle = "normal";
    private String mColor = "#FFFFFF";

    // Text layout
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    private String mTextAlign = "left";
    private String mTextAlignVertical = "top";
    private String mTextLineBreakMode = "wordWrap";
    private String mTextClipMode = "clipToBounds";
    private int mMaxLines = 0; // 0 = unlimited

    // 3D text properties
    private float mExtrusionDepth = 0.0f;
    private ReadableMap mOuterStroke;
    private List<Material> mMaterials;

    // Transform properties
    private Vector mScale = new Vector(1.0f, 1.0f, 1.0f);
    private Vector mRotation = new Vector(0.0f, 0.0f, 0.0f);
    private Vector mPosition = new Vector(0.0f, 0.0f, 0.0f);

    public ViroTextView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroTextView initialized with ViroReact Text integration");
        
        // Initialize materials list
        mMaterials = new ArrayList<>();
        
        initializeText();
    }

    private void initializeText() {
        Log.d(TAG, "Initializing ViroReact text with default properties");
        
        // Create ViroReact Node for the text
        mNodeJni = new Node();
        
        // Create Text with initial properties
        mTextJni = new Text(mViroContext, mText, mFontFamily, mFontSize, 
                           getFontStyleEnum(mFontStyle), getFontWeightEnum(mFontWeight),
                           parseColor(mColor), mWidth, mHeight);
        
        // Configure initial text properties
        applyTextProperties();
        
        // Attach text to node
        mNodeJni.setGeometry(mTextJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // Text views are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact Text initialized successfully");
    }

    /**
     * Wrapper class to make ViroTextView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroTextView> mTextView;
        
        public VRTComponentWrapper(ViroTextView textView) {
            super(textView.getContext(), null, -1, -1, textView.mReactContext);
            mTextView = new WeakReference<>(textView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroTextView textView = mTextView.get();
            if (textView != null) {
                textView.emitTextEvent(eventName, eventData);
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
     * Get the underlying ViroReact Text object
     */
    public Text getTextJni() {
        return mTextJni;
    }
    
    /**
     * Set the ViroContext for this text
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Recreate text with ViroContext if needed
        if (mTextJni != null) {
            mTextJni.dispose();
            mTextJni = new Text(mViroContext, mText, mFontFamily, mFontSize, 
                               getFontStyleEnum(mFontStyle), getFontWeightEnum(mFontWeight),
                               parseColor(mColor), mWidth, mHeight);
            applyTextProperties();
            if (mNodeJni != null) {
                mNodeJni.setGeometry(mTextJni);
            }
        }
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For 3D text, we don't use traditional Android view measurements
        // The size is determined by text dimensions and 3D properties
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D transforms, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // Text Content Properties
    public void setText(@Nullable String text) {
        Log.d(TAG, "Setting text: " + text);
        mText = text != null ? text : "";
        
        if (mTextJni != null) {
            mTextJni.setText(mText);
        }
    }

    // Text Styling Properties
    public void setFontFamily(@Nullable String fontFamily) {
        Log.d(TAG, "Setting font family: " + fontFamily);
        mFontFamily = fontFamily != null ? fontFamily : "Helvetica";
        applyTextStyle();
    }

    public void setFontSize(float fontSize) {
        Log.d(TAG, "Setting font size: " + fontSize);
        mFontSize = fontSize;
        applyTextStyle();
    }

    public void setFontWeight(@Nullable String fontWeight) {
        Log.d(TAG, "Setting font weight: " + fontWeight);
        mFontWeight = fontWeight != null ? fontWeight : "normal";
        applyTextStyle();
    }

    public void setFontStyle(@Nullable String fontStyle) {
        Log.d(TAG, "Setting font style: " + fontStyle);
        mFontStyle = fontStyle != null ? fontStyle : "normal";
        applyTextStyle();
    }

    public void setColor(@Nullable String color) {
        Log.d(TAG, "Setting color: " + color);
        mColor = color != null ? color : "#FFFFFF";
        applyTextStyle();
    }

    // Text Layout Properties
    public void setTextWidth(float width) {
        Log.d(TAG, "Setting text width: " + width);
        mWidth = width;
        applyTextLayout();
    }

    public void setTextHeight(float height) {
        Log.d(TAG, "Setting text height: " + height);
        mHeight = height;
        applyTextLayout();
    }

    public void setTextAlign(@Nullable String textAlign) {
        Log.d(TAG, "Setting text align: " + textAlign);
        mTextAlign = textAlign != null ? textAlign : "left";
        applyTextLayout();
    }

    public void setTextAlignVertical(@Nullable String textAlignVertical) {
        Log.d(TAG, "Setting text align vertical: " + textAlignVertical);
        mTextAlignVertical = textAlignVertical != null ? textAlignVertical : "top";
        applyTextLayout();
    }

    public void setTextLineBreakMode(@Nullable String textLineBreakMode) {
        Log.d(TAG, "Setting text line break mode: " + textLineBreakMode);
        mTextLineBreakMode = textLineBreakMode != null ? textLineBreakMode : "wordWrap";
        applyTextLayout();
    }

    public void setTextClipMode(@Nullable String textClipMode) {
        Log.d(TAG, "Setting text clip mode: " + textClipMode);
        mTextClipMode = textClipMode != null ? textClipMode : "clipToBounds";
        applyTextLayout();
    }

    public void setMaxLines(int maxLines) {
        Log.d(TAG, "Setting max lines: " + maxLines);
        mMaxLines = maxLines;
        applyTextLayout();
    }

    // 3D Text Properties
    public void setExtrusionDepth(float extrusionDepth) {
        Log.d(TAG, "Setting extrusion depth: " + extrusionDepth);
        mExtrusionDepth = extrusionDepth;
        
        if (mTextJni != null) {
            mTextJni.setExtrusionDepth(extrusionDepth);
        }
    }

    public void setOuterStroke(@Nullable ReadableMap outerStroke) {
        Log.d(TAG, "Setting outer stroke: " + outerStroke);
        mOuterStroke = outerStroke;
        
        // TODO: Apply outer stroke properties to ViroReact Text
        applyTextStyle();
    }

    public void setMaterials(@Nullable ReadableArray materials) {
        Log.d(TAG, "Setting materials: " + materials);
        
        // Convert ReadableArray to Material list
        if (materials != null && mTextJni != null) {
            mMaterials = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                String materialName = materials.getString(i);
                if (materialName != null) {
                    // Create material from name/reference
                    Material material = new Material();
                    // TODO: Configure material properties based on materialName
                    mMaterials.add(material);
                }
            }
            
            // Apply materials to text
            if (!mMaterials.isEmpty()) {
                mTextJni.setMaterials(mMaterials);
            }
        }
    }

    // Transform Properties
    public void setScale(@Nullable ReadableArray scale) {
        Log.d(TAG, "Setting scale: " + scale);
        
        if (scale != null && scale.size() >= 3) {
            try {
                float x = (float) scale.getDouble(0);
                float y = (float) scale.getDouble(1);
                float z = (float) scale.getDouble(2);
                mScale = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing scale: " + e.getMessage());
                mScale = new Vector(1.0f, 1.0f, 1.0f);
            }
        } else {
            mScale = new Vector(1.0f, 1.0f, 1.0f);
        }
        
        applyTransformProperties();
    }

    public void setRotation(@Nullable ReadableArray rotation) {
        Log.d(TAG, "Setting rotation: " + rotation);
        
        if (rotation != null && rotation.size() >= 3) {
            try {
                float x = (float) Math.toRadians(rotation.getDouble(0)); // Convert to radians
                float y = (float) Math.toRadians(rotation.getDouble(1));
                float z = (float) Math.toRadians(rotation.getDouble(2));
                mRotation = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing rotation: " + e.getMessage());
                mRotation = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mRotation = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }

    public void setPosition(@Nullable ReadableArray position) {
        Log.d(TAG, "Setting position: " + position);
        
        if (position != null && position.size() >= 3) {
            try {
                float x = (float) position.getDouble(0);
                float y = (float) position.getDouble(1);
                float z = (float) position.getDouble(2);
                mPosition = new Vector(x, y, z);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing position: " + e.getMessage());
                mPosition = new Vector(0.0f, 0.0f, 0.0f);
            }
        } else {
            mPosition = new Vector(0.0f, 0.0f, 0.0f);
        }
        
        applyTransformProperties();
    }

    // Helper Methods
    private void applyTextProperties() {
        if (mTextJni != null) {
            Log.d(TAG, "Applying text properties to ViroReact Text");
            
            // Apply text alignment
            mTextJni.setHorizontalAlignment(getHorizontalAlignmentEnum(mTextAlign));
            mTextJni.setVerticalAlignment(getVerticalAlignmentEnum(mTextAlignVertical));
            
            // Apply line break mode
            mTextJni.setLineBreakMode(getLineBreakModeEnum(mTextLineBreakMode));
            
            // Apply clip mode
            mTextJni.setClipMode(getClipModeEnum(mTextClipMode));
            
            // Apply max lines
            if (mMaxLines > 0) {
                mTextJni.setMaxLines(mMaxLines);
            }
            
            // Apply extrusion depth
            if (mExtrusionDepth > 0) {
                mTextJni.setExtrusionDepth(mExtrusionDepth);
            }
            
            Log.d(TAG, "Text properties applied successfully");
        }
    }

    private void applyTextStyle() {
        if (mTextJni != null) {
            Log.d(TAG, "Applying text style to ViroReact Text");
            
            // Update font properties
            mTextJni.setFontFamily(mFontFamily);
            mTextJni.setFontSize(mFontSize);
            mTextJni.setFontStyle(getFontStyleEnum(mFontStyle));
            mTextJni.setFontWeight(getFontWeightEnum(mFontWeight));
            
            // Update color
            mTextJni.setColor(parseColor(mColor));
            
            Log.d(TAG, "Text style applied successfully");
        }
    }

    private void applyTextLayout() {
        if (mTextJni != null) {
            Log.d(TAG, "Applying text layout to ViroReact Text");
            
            // Update dimensions
            mTextJni.setWidth(mWidth);
            mTextJni.setHeight(mHeight);
            
            // Apply alignment
            mTextJni.setHorizontalAlignment(getHorizontalAlignmentEnum(mTextAlign));
            mTextJni.setVerticalAlignment(getVerticalAlignmentEnum(mTextAlignVertical));
            
            // Apply line properties
            mTextJni.setLineBreakMode(getLineBreakModeEnum(mTextLineBreakMode));
            mTextJni.setClipMode(getClipModeEnum(mTextClipMode));
            
            if (mMaxLines > 0) {
                mTextJni.setMaxLines(mMaxLines);
            }
            
            Log.d(TAG, "Text layout applied successfully");
        }
    }

    private void applyTransformProperties() {
        if (mNodeJni != null) {
            Log.d(TAG, "Applying transform properties to ViroReact Node");
            
            // Apply position, rotation, and scale to the node
            mNodeJni.setPosition(mPosition);
            mNodeJni.setRotation(mRotation);
            mNodeJni.setScale(mScale);
            
            Log.d(TAG, "Transform properties applied successfully");
        }
    }

    // Helper methods to convert string properties to enum values
    private Text.HorizontalAlignment getHorizontalAlignmentEnum(String alignment) {
        switch (alignment.toLowerCase()) {
            case "center":
                return Text.HorizontalAlignment.CENTER;
            case "right":
                return Text.HorizontalAlignment.RIGHT;
            default:
            case "left":
                return Text.HorizontalAlignment.LEFT;
        }
    }
    
    private Text.VerticalAlignment getVerticalAlignmentEnum(String alignment) {
        switch (alignment.toLowerCase()) {
            case "center":
                return Text.VerticalAlignment.CENTER;
            case "bottom":
                return Text.VerticalAlignment.BOTTOM;
            default:
            case "top":
                return Text.VerticalAlignment.TOP;
        }
    }
    
    private Text.LineBreakMode getLineBreakModeEnum(String mode) {
        switch (mode.toLowerCase()) {
            case "charwrap":
                return Text.LineBreakMode.CHAR_WRAP;
            case "justify":
                return Text.LineBreakMode.JUSTIFY;
            case "none":
                return Text.LineBreakMode.NONE;
            default:
            case "wordwrap":
                return Text.LineBreakMode.WORD_WRAP;
        }
    }
    
    private Text.ClipMode getClipModeEnum(String mode) {
        switch (mode.toLowerCase()) {
            case "none":
                return Text.ClipMode.NONE;
            default:
            case "cliptobounds":
                return Text.ClipMode.CLIP_TO_BOUNDS;
        }
    }
    
    private Text.FontStyle getFontStyleEnum(String style) {
        switch (style.toLowerCase()) {
            case "italic":
                return Text.FontStyle.ITALIC;
            default:
            case "normal":
                return Text.FontStyle.NORMAL;
        }
    }
    
    private Text.FontWeight getFontWeightEnum(String weight) {
        switch (weight.toLowerCase()) {
            case "bold":
                return Text.FontWeight.BOLD;
            case "light":
                return Text.FontWeight.LIGHT;
            default:
            case "normal":
                return Text.FontWeight.NORMAL;
        }
    }
    
    private int parseColor(String colorString) {
        try {
            if (colorString.startsWith("#")) {
                return android.graphics.Color.parseColor(colorString);
            } else {
                // Handle named colors
                return android.graphics.Color.parseColor("#" + colorString);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing color: " + colorString + ", using white as default");
            return android.graphics.Color.WHITE;
        }
    }
    
    // Event emission
    private void emitTextEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact text resources
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
        
        if (mTextJni != null) {
            mTextJni.dispose();
            mTextJni = null;
        }
        
        // Clear material references
        if (mMaterials != null) {
            for (Material material : mMaterials) {
                material.dispose();
            }
            mMaterials.clear();
            mMaterials = null;
        }
        
        // Clear references
        mComponentEventDelegate = null;
        mViroContext = null;
        mReactContext = null;
    }
    
    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        Log.d(TAG, "ViroTextView attached to window");
        
        // Text will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mTextJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact text ready for scene attachment");
        }
        
        // Ensure text properties are applied
        applyTextProperties();
        applyTransformProperties();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroTextView detached from window");
        
        // Text cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }

    // Getters for current values (useful for debugging and testing)
    public String getText() { return mText; }
    public String getFontFamily() { return mFontFamily; }
    public float getFontSize() { return mFontSize; }
    public String getFontWeight() { return mFontWeight; }
    public String getFontStyle() { return mFontStyle; }
    public String getColor() { return mColor; }
    public float getTextWidth() { return mWidth; }
    public float getTextHeight() { return mHeight; }
    public String getTextAlign() { return mTextAlign; }
    public String getTextAlignVertical() { return mTextAlignVertical; }
    public int getMaxLines() { return mMaxLines; }
    public float getExtrusionDepth() { return mExtrusionDepth; }
    public Vector getScale() { return mScale; }
    public Vector getRotation() { return mRotation; }
    public Vector getPosition() { return mPosition; }
}