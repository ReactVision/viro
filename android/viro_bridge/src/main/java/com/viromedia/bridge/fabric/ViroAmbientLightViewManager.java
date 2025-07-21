package com.viromedia.bridge.fabric;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

/**
 * ViewManager for ViroAmbientLight component.
 * Manages the creation and property updates for ViroAmbientLightView.
 */
public class ViroAmbientLightViewManager extends SimpleViewManager<ViroAmbientLightView> {
    
    private static final String REACT_CLASS = "ViroAmbientLight";
    
    @Override
    @NonNull
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    @NonNull
    protected ViroAmbientLightView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new ViroAmbientLightView(reactContext);
    }
    
    @ReactProp(name = "color")
    public void setColor(ViroAmbientLightView view, @Nullable String color) {
        view.setColor(color);
    }
    
    @ReactProp(name = "intensity")
    public void setIntensity(ViroAmbientLightView view, float intensity) {
        view.setIntensity(intensity);
    }
    
    @ReactProp(name = "temperature")
    public void setTemperature(ViroAmbientLightView view, float temperature) {
        view.setTemperature(temperature);
    }
    
    @ReactProp(name = "influenceBitMask")
    public void setInfluenceBitMask(ViroAmbientLightView view, int influenceBitMask) {
        view.setInfluenceBitMask(influenceBitMask);
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroAmbientLightView view) {
        view.onDropViewInstance();
        super.onDropViewInstance(view);
    }
    
    @Override
    @Nullable
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
                .put("onAmbientLightUpdate", MapBuilder.of("registrationName", "onAmbientLightUpdate"))
                .build();
    }
}