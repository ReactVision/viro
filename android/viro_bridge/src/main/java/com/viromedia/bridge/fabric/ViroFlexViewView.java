//
//  ViroFlexViewView.java
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
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viro.core.EventDelegate;
import com.viro.core.FlexView;
import com.viro.core.Material;
import com.viro.core.Node;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.VRTComponent;
import com.viromedia.bridge.utility.ComponentEventDelegate;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/**
 * Native Android view for ViroFlexView component.
 * ViroFlexView provides flexbox layout capabilities in 3D space, allowing developers
 * to arrange 3D components using familiar CSS flexbox properties.
 */
public class ViroFlexViewView extends View {
    
    private static final String TAG = "ViroFlexViewView";
    
    private ReactContext mReactContext;
    
    // ViroReact Integration
    private Node mNodeJni;
    private FlexView mFlexViewJni;
    private ViroContext mViroContext;
    private EventDelegate mEventDelegateJni;
    private ComponentEventDelegate mComponentEventDelegate;

    // FlexView layout properties
    private float mWidth = 1.0f;
    private float mHeight = 1.0f;
    private String mFlexDirection = "column";
    private String mJustifyContent = "flex-start";
    private String mAlignItems = "stretch";
    private String mAlignContent = "stretch";
    private String mFlexWrap = "nowrap";

    // Individual flex item properties
    private float mFlex = 0.0f;
    private float mFlexGrow = 0.0f;
    private float mFlexShrink = 1.0f;
    private float mFlexBasis = 0.0f;
    private String mAlignSelf = "auto";

    // Margin and padding
    private float[] mMargin = new float[4]; // top, right, bottom, left
    private float[] mPadding = new float[4]; // top, right, bottom, left

    // Material properties
    private List<Material> mMaterials;

    public ViroFlexViewView(@NonNull Context context) {
        super(context);
        mReactContext = (ReactContext) context;
        Log.d(TAG, "ViroFlexViewView initialized with ViroReact FlexView integration");
        
        // Initialize default margin and padding
        for (int i = 0; i < 4; i++) {
            mMargin[i] = 0.0f;
            mPadding[i] = 0.0f;
        }
        
        initializeFlexView();
    }

    private void initializeFlexView() {
        Log.d(TAG, "Initializing ViroReact flex view with default properties");
        
        // Create ViroReact Node for the flex container
        mNodeJni = new Node();
        
        // Create FlexView with initial properties
        mFlexViewJni = new FlexView();
        
        // Configure initial flex properties
        applyFlexProperties();
        
        // Attach flex view to node
        mNodeJni.setGeometry(mFlexViewJni);
        
        // Create and attach event callbacks
        mComponentEventDelegate = new ComponentEventDelegate(new VRTComponentWrapper(this));
        mEventDelegateJni = new EventDelegate();
        mEventDelegateJni.setEventDelegateCallback(mComponentEventDelegate);
        mNodeJni.setEventDelegate(mEventDelegateJni);
        
        // FlexView containers are typically transparent
        setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        Log.d(TAG, "ViroReact FlexView initialized successfully");
    }

    /**
     * Wrapper class to make ViroFlexViewView compatible with ComponentEventDelegate
     */
    private static class VRTComponentWrapper extends VRTComponent {
        private WeakReference<ViroFlexViewView> mFlexViewView;
        
        public VRTComponentWrapper(ViroFlexViewView flexViewView) {
            super(flexViewView.getContext(), null, -1, -1, flexViewView.mReactContext);
            mFlexViewView = new WeakReference<>(flexViewView);
        }
        
        @Override
        public void emitEvent(String eventName, WritableMap eventData) {
            ViroFlexViewView flexViewView = mFlexViewView.get();
            if (flexViewView != null) {
                flexViewView.emitFlexEvent(eventName, eventData);
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
     * Get the underlying ViroReact FlexView object
     */
    public FlexView getFlexViewJni() {
        return mFlexViewJni;
    }
    
    /**
     * Set the ViroContext for this flex view
     */
    public void setViroContext(ViroContext context) {
        mViroContext = context;
        // Apply any pending configurations that require ViroContext
    }
    
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        // For flex views, we don't use traditional Android view measurements
        // The flex size is determined by 3D flexbox properties
        // Set a minimal size for the view container
        setMeasuredDimension(1, 1);
    }
    
    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        // Layout is handled by 3D flexbox calculations, not 2D layout
        Log.d(TAG, "onLayout called: " + changed + " bounds: [" + left + "," + top + "," + right + "," + bottom + "]");
    }
    
    // FlexView Layout Properties
    public void setFlexWidth(float width) {
        Log.d(TAG, "Setting flex width: " + width);
        mWidth = width;
        applyFlexProperties();
    }

    public void setFlexHeight(float height) {
        Log.d(TAG, "Setting flex height: " + height);
        mHeight = height;
        applyFlexProperties();
    }

    public void setFlexDirection(@NonNull String flexDirection) {
        Log.d(TAG, "Setting flex direction: " + flexDirection);
        mFlexDirection = flexDirection;
        applyFlexProperties();
    }

    public void setJustifyContent(@NonNull String justifyContent) {
        Log.d(TAG, "Setting justify content: " + justifyContent);
        mJustifyContent = justifyContent;
        applyFlexProperties();
    }

    public void setAlignItems(@NonNull String alignItems) {
        Log.d(TAG, "Setting align items: " + alignItems);
        mAlignItems = alignItems;
        applyFlexProperties();
    }

    public void setAlignContent(@NonNull String alignContent) {
        Log.d(TAG, "Setting align content: " + alignContent);
        mAlignContent = alignContent;
        applyFlexProperties();
    }

    public void setFlexWrap(@NonNull String flexWrap) {
        Log.d(TAG, "Setting flex wrap: " + flexWrap);
        mFlexWrap = flexWrap;
        applyFlexProperties();
    }

    // Individual Flex Item Properties
    public void setFlex(float flex) {
        Log.d(TAG, "Setting flex: " + flex);
        mFlex = flex;
        applyFlexProperties();
    }

    public void setFlexGrow(float flexGrow) {
        Log.d(TAG, "Setting flex grow: " + flexGrow);
        mFlexGrow = flexGrow;
        applyFlexProperties();
    }

    public void setFlexShrink(float flexShrink) {
        Log.d(TAG, "Setting flex shrink: " + flexShrink);
        mFlexShrink = flexShrink;
        applyFlexProperties();
    }

    public void setFlexBasis(float flexBasis) {
        Log.d(TAG, "Setting flex basis: " + flexBasis);
        mFlexBasis = flexBasis;
        applyFlexProperties();
    }

    public void setAlignSelf(@NonNull String alignSelf) {
        Log.d(TAG, "Setting align self: " + alignSelf);
        mAlignSelf = alignSelf;
        applyFlexProperties();
    }

    // Margin and Padding
    public void setMargin(@Nullable ReadableArray margin) {
        Log.d(TAG, "Setting margin: " + margin);
        if (margin != null) {
            parseSpacingArray(margin, mMargin);
            applyFlexProperties();
        }
    }

    public void setPadding(@Nullable ReadableArray padding) {
        Log.d(TAG, "Setting padding: " + padding);
        if (padding != null) {
            parseSpacingArray(padding, mPadding);
            applyFlexProperties();
        }
    }

    private void parseSpacingArray(@NonNull ReadableArray spacingArray, @NonNull float[] output) {
        // Parse spacing array in CSS format
        // [all] or [vertical, horizontal] or [top, right, bottom, left]
        int size = spacingArray.size();
        
        if (size == 1) {
            // [all]
            float all = (float) spacingArray.getDouble(0);
            output[0] = output[1] = output[2] = output[3] = all;
        } else if (size == 2) {
            // [vertical, horizontal]
            float vertical = (float) spacingArray.getDouble(0);
            float horizontal = (float) spacingArray.getDouble(1);
            output[0] = output[2] = vertical;   // top, bottom
            output[1] = output[3] = horizontal; // right, left
        } else if (size >= 4) {
            // [top, right, bottom, left]
            output[0] = (float) spacingArray.getDouble(0); // top
            output[1] = (float) spacingArray.getDouble(1); // right
            output[2] = (float) spacingArray.getDouble(2); // bottom
            output[3] = (float) spacingArray.getDouble(3); // left
        }
    }

    // Material Properties
    public void setMaterials(@Nullable ReadableArray materials) {
        Log.d(TAG, "Setting materials: " + materials);
        
        // Convert ReadableArray to Material list
        if (materials != null && mFlexViewJni != null) {
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
            
            // Apply materials to FlexView
            if (!mMaterials.isEmpty()) {
                mFlexViewJni.setMaterials(mMaterials);
            }
        }
    }

    private void applyFlexProperties() {
        if (mFlexViewJni != null) {
            Log.d(TAG, "Applying flex properties to ViroReact FlexView");
            
            // Apply container dimensions
            mFlexViewJni.setWidth(mWidth);
            mFlexViewJni.setHeight(mHeight);
            
            // Apply flex direction
            FlexView.FlexDirection flexDirection = getFlexDirectionEnum(mFlexDirection);
            mFlexViewJni.setFlexDirection(flexDirection);
            
            // Apply justify content
            FlexView.JustifyContent justifyContent = getJustifyContentEnum(mJustifyContent);
            mFlexViewJni.setJustifyContent(justifyContent);
            
            // Apply align items
            FlexView.AlignItems alignItems = getAlignItemsEnum(mAlignItems);
            mFlexViewJni.setAlignItems(alignItems);
            
            // Apply align content
            FlexView.AlignContent alignContent = getAlignContentEnum(mAlignContent);
            mFlexViewJni.setAlignContent(alignContent);
            
            // Apply flex wrap
            FlexView.FlexWrap flexWrap = getFlexWrapEnum(mFlexWrap);
            mFlexViewJni.setFlexWrap(flexWrap);
            
            // Apply individual flex properties
            mFlexViewJni.setFlex(mFlex);
            mFlexViewJni.setFlexGrow(mFlexGrow);
            mFlexViewJni.setFlexShrink(mFlexShrink);
            mFlexViewJni.setFlexBasis(mFlexBasis);
            
            // Apply align self
            FlexView.AlignSelf alignSelf = getAlignSelfEnum(mAlignSelf);
            mFlexViewJni.setAlignSelf(alignSelf);
            
            // Apply margin and padding
            mFlexViewJni.setMargin(mMargin[0], mMargin[1], mMargin[2], mMargin[3]);
            mFlexViewJni.setPadding(mPadding[0], mPadding[1], mPadding[2], mPadding[3]);
            
            Log.d(TAG, "FlexView properties applied successfully");
            
            // Emit layout update event for React Native
            emitFlexLayoutUpdateEvent();
        }
    }

    // Helper methods to convert string properties to enum values
    private FlexView.FlexDirection getFlexDirectionEnum(String direction) {
        switch (direction.toLowerCase()) {
            case "row":
                return FlexView.FlexDirection.ROW;
            case "row-reverse":
                return FlexView.FlexDirection.ROW_REVERSE;
            case "column-reverse":
                return FlexView.FlexDirection.COLUMN_REVERSE;
            default:
            case "column":
                return FlexView.FlexDirection.COLUMN;
        }
    }
    
    private FlexView.JustifyContent getJustifyContentEnum(String justify) {
        switch (justify.toLowerCase()) {
            case "flex-end":
                return FlexView.JustifyContent.FLEX_END;
            case "center":
                return FlexView.JustifyContent.CENTER;
            case "space-between":
                return FlexView.JustifyContent.SPACE_BETWEEN;
            case "space-around":
                return FlexView.JustifyContent.SPACE_AROUND;
            case "space-evenly":
                return FlexView.JustifyContent.SPACE_EVENLY;
            default:
            case "flex-start":
                return FlexView.JustifyContent.FLEX_START;
        }
    }
    
    private FlexView.AlignItems getAlignItemsEnum(String align) {
        switch (align.toLowerCase()) {
            case "flex-start":
                return FlexView.AlignItems.FLEX_START;
            case "flex-end":
                return FlexView.AlignItems.FLEX_END;
            case "center":
                return FlexView.AlignItems.CENTER;
            case "baseline":
                return FlexView.AlignItems.BASELINE;
            default:
            case "stretch":
                return FlexView.AlignItems.STRETCH;
        }
    }
    
    private FlexView.AlignContent getAlignContentEnum(String align) {
        switch (align.toLowerCase()) {
            case "flex-start":
                return FlexView.AlignContent.FLEX_START;
            case "flex-end":
                return FlexView.AlignContent.FLEX_END;
            case "center":
                return FlexView.AlignContent.CENTER;
            case "space-between":
                return FlexView.AlignContent.SPACE_BETWEEN;
            case "space-around":
                return FlexView.AlignContent.SPACE_AROUND;
            default:
            case "stretch":
                return FlexView.AlignContent.STRETCH;
        }
    }
    
    private FlexView.FlexWrap getFlexWrapEnum(String wrap) {
        switch (wrap.toLowerCase()) {
            case "wrap":
                return FlexView.FlexWrap.WRAP;
            case "wrap-reverse":
                return FlexView.FlexWrap.WRAP_REVERSE;
            default:
            case "nowrap":
                return FlexView.FlexWrap.NOWRAP;
        }
    }
    
    private FlexView.AlignSelf getAlignSelfEnum(String align) {
        switch (align.toLowerCase()) {
            case "flex-start":
                return FlexView.AlignSelf.FLEX_START;
            case "flex-end":
                return FlexView.AlignSelf.FLEX_END;
            case "center":
                return FlexView.AlignSelf.CENTER;
            case "baseline":
                return FlexView.AlignSelf.BASELINE;
            case "stretch":
                return FlexView.AlignSelf.STRETCH;
            default:
            case "auto":
                return FlexView.AlignSelf.AUTO;
        }
    }
    
    private void emitFlexLayoutUpdateEvent() {
        WritableMap event = Arguments.createMap();
        event.putDouble("width", mWidth);
        event.putDouble("height", mHeight);
        event.putString("flexDirection", mFlexDirection);
        event.putString("justifyContent", mJustifyContent);
        event.putString("alignItems", mAlignItems);
        
        emitFlexEvent("onFlexLayoutUpdate", event);
    }
    
    // Event emission
    private void emitFlexEvent(String eventName, @Nullable WritableMap eventData) {
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
        
        // Clean up ViroReact flex view resources
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
        
        if (mFlexViewJni != null) {
            mFlexViewJni.dispose();
            mFlexViewJni = null;
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
        Log.d(TAG, "ViroFlexViewView attached to window");
        
        // FlexView will be added to scene hierarchy through parent-child relationships
        if (mNodeJni != null && mFlexViewJni != null && mViroContext != null) {
            Log.d(TAG, "ViroReact flex view ready for scene attachment");
        }
        
        // Ensure flex properties are applied
        applyFlexProperties();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Log.d(TAG, "ViroFlexViewView detached from window");
        
        // FlexView cleanup is handled in onDropViewInstance
        // Scene hierarchy cleanup is automatic through parent-child relationships
    }

    // Getters for current values (useful for debugging and testing)
    public float getFlexWidth() { return mWidth; }
    public float getFlexHeight() { return mHeight; }
    public String getFlexDirection() { return mFlexDirection; }
    public String getJustifyContent() { return mJustifyContent; }
    public String getAlignItems() { return mAlignItems; }
    public float getFlex() { return mFlex; }
    public float getFlexGrow() { return mFlexGrow; }
    public float getFlexShrink() { return mFlexShrink; }
    public float getFlexBasis() { return mFlexBasis; }
    public String getAlignSelf() { return mAlignSelf; }
    public float[] getMargin() { return mMargin.clone(); }
    public float[] getPadding() { return mPadding.clone(); }
}