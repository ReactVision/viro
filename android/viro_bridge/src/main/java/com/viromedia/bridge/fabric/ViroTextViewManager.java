package com.viromedia.bridge.fabric;

import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.ViroTextManagerDelegate;
import com.facebook.react.viewmanagers.ViroTextManagerInterface;

import android.util.Log;

/**
 * ViewManager for ViroText component in React Native New Architecture.
 * ViroText provides comprehensive 3D text rendering capabilities with typography controls,
 * layout management, and material support.
 */
public class ViroTextViewManager extends ViewGroupManager<ViroTextView> implements ViroTextManagerInterface<ViroTextView> {
    
    private static final String TAG = "ViroTextViewManager";
    public static final String REACT_CLASS = "ViroText";
    
    private final ViewManagerDelegate<ViroTextView> mDelegate;
    
    public ViroTextViewManager() {
        mDelegate = new ViroTextManagerDelegate(this);
    }
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected ViroTextView createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating ViroTextView instance");
        return new ViroTextView(reactContext);
    }
    
    @Override
    public ViewManagerDelegate<ViroTextView> getDelegate() {
        return mDelegate;
    }
    
    // Text content props
    
    @ReactProp(name = "text")
    public void setText(ViroTextView view, @Nullable String text) {
        view.setText(text);
    }
    
    // Text styling props
    
    @ReactProp(name = "fontFamily")
    public void setFontFamily(ViroTextView view, @Nullable String fontFamily) {
        view.setFontFamily(fontFamily);
    }
    
    @ReactProp(name = "fontSize", defaultFloat = 12.0f)
    public void setFontSize(ViroTextView view, float fontSize) {
        view.setFontSize(fontSize);
    }
    
    @ReactProp(name = "fontWeight")
    public void setFontWeight(ViroTextView view, @Nullable String fontWeight) {
        view.setFontWeight(fontWeight);
    }
    
    @ReactProp(name = "fontStyle")
    public void setFontStyle(ViroTextView view, @Nullable String fontStyle) {
        view.setFontStyle(fontStyle);
    }
    
    @ReactProp(name = "color")
    public void setColor(ViroTextView view, @Nullable String color) {
        view.setColor(color);
    }
    
    // Text layout props
    
    @ReactProp(name = "width", defaultFloat = 1.0f)
    public void setTextWidth(ViroTextView view, float width) {
        view.setTextWidth(width);
    }
    
    @ReactProp(name = "height", defaultFloat = 1.0f)
    public void setTextHeight(ViroTextView view, float height) {
        view.setTextHeight(height);
    }
    
    @ReactProp(name = "textAlign")
    public void setTextAlign(ViroTextView view, @Nullable String textAlign) {
        view.setTextAlign(textAlign);
    }
    
    @ReactProp(name = "textAlignVertical")
    public void setTextAlignVertical(ViroTextView view, @Nullable String textAlignVertical) {
        view.setTextAlignVertical(textAlignVertical);
    }
    
    @ReactProp(name = "textLineBreakMode")
    public void setTextLineBreakMode(ViroTextView view, @Nullable String textLineBreakMode) {
        view.setTextLineBreakMode(textLineBreakMode);
    }
    
    @ReactProp(name = "textClipMode")
    public void setTextClipMode(ViroTextView view, @Nullable String textClipMode) {
        view.setTextClipMode(textClipMode);
    }
    
    @ReactProp(name = "maxLines", defaultInt = 0)
    public void setMaxLines(ViroTextView view, int maxLines) {
        view.setMaxLines(maxLines);
    }
    
    // 3D text props
    
    @ReactProp(name = "extrusionDepth", defaultFloat = 0.0f)
    public void setExtrusionDepth(ViroTextView view, float extrusionDepth) {
        view.setExtrusionDepth(extrusionDepth);
    }
    
    @ReactProp(name = "outerStroke")
    public void setOuterStroke(ViroTextView view, @Nullable ReadableMap outerStroke) {
        view.setOuterStroke(outerStroke);
    }
    
    @ReactProp(name = "materials")
    public void setMaterials(ViroTextView view, @Nullable ReadableArray materials) {
        view.setMaterials(materials);
    }
    
    // Transform props
    
    @ReactProp(name = "scale")
    public void setScale(ViroTextView view, @Nullable ReadableArray scale) {
        view.setScale(scale);
    }
    
    @ReactProp(name = "rotation")
    public void setRotation(ViroTextView view, @Nullable ReadableArray rotation) {
        view.setRotation(rotation);
    }
    
    @ReactProp(name = "position")
    public void setPosition(ViroTextView view, @Nullable ReadableArray position) {
        view.setPosition(position);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroTextView view) {
        Log.d(TAG, "Dropping ViroTextView instance");
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
    
    @Override
    protected void onAfterUpdateTransaction(@NonNull ViroTextView view) {
        super.onAfterUpdateTransaction(view);
        Log.d(TAG, "Text view transaction completed");
    }
}