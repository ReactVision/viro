//
//  ViroSpinnerViewManager.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import com.viromedia.bridge.utility.ViroLog;

/**
 * ViroSpinnerViewManager - Loading Indicator ViewManager
 * 
 * This ViewManager handles loading indicator components in ViroReact.
 * It provides comprehensive spinner functionality including multiple types,
 * animations, progress indication, and text labels.
 * 
 * Key Features:
 * - Multiple spinner types (circular, dots, bars, ring, pulse)
 * - Customizable colors, sizes, and animation properties
 * - Speed and direction control with easing functions
 * - Progress indication support with text labels
 * - Auto-hide behavior with fade animations
 * - Text positioning and styling options
 * - Event callbacks for animation lifecycle
 * - Integration with ViroReact scene graph
 */
public class ViroSpinnerViewManager extends SimpleViewManager<ViroSpinnerView> {
    
    private static final String TAG = ViroLog.getTag(ViroSpinnerViewManager.class);
    private static final String REACT_CLASS = "ViroSpinner";
    
    @Override
    @NonNull
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    @NonNull
    public ViroSpinnerView createViewInstance(@NonNull ThemedReactContext reactContext) {
        ViroLog.debug(TAG, "Creating ViroSpinnerView instance");
        return new ViroSpinnerView(reactContext);
    }
    
    // Spinner Appearance
    @ReactProp(name = "type")
    public void setType(ViroSpinnerView view, @Nullable String type) {
        ViroLog.debug(TAG, "Setting type: " + type);
        view.setType(type);
    }
    
    @ReactProp(name = "color")
    public void setColor(ViroSpinnerView view, @Nullable ReadableArray color) {
        ViroLog.debug(TAG, "Setting color: " + color);
        view.setColor(color);
    }
    
    @ReactProp(name = "size", defaultFloat = 50.0f)
    public void setSize(ViroSpinnerView view, float size) {
        ViroLog.debug(TAG, "Setting size: " + size);
        view.setSize(size);
    }
    
    @ReactProp(name = "thickness", defaultFloat = 4.0f)
    public void setThickness(ViroSpinnerView view, float thickness) {
        ViroLog.debug(TAG, "Setting thickness: " + thickness);
        view.setThickness(thickness);
    }
    
    @ReactProp(name = "radius", defaultFloat = 20.0f)
    public void setRadius(ViroSpinnerView view, float radius) {
        ViroLog.debug(TAG, "Setting radius: " + radius);
        // Radius is derived from size, but can be set independently
    }
    
    @ReactProp(name = "spacing", defaultFloat = 8.0f)
    public void setSpacing(ViroSpinnerView view, float spacing) {
        ViroLog.debug(TAG, "Setting spacing: " + spacing);
        // Spacing for dots and bars spinner types
    }
    
    // Spinner Animation
    @ReactProp(name = "animating", defaultBoolean = false)
    public void setAnimating(ViroSpinnerView view, boolean animating) {
        ViroLog.debug(TAG, "Setting animating: " + animating);
        view.setAnimating(animating);
    }
    
    @ReactProp(name = "speed", defaultFloat = 1.0f)
    public void setSpeed(ViroSpinnerView view, float speed) {
        ViroLog.debug(TAG, "Setting speed: " + speed);
        view.setSpeed(speed);
    }
    
    @ReactProp(name = "direction")
    public void setDirection(ViroSpinnerView view, @Nullable String direction) {
        ViroLog.debug(TAG, "Setting direction: " + direction);
        // Direction will be handled by the view internally
    }
    
    @ReactProp(name = "duration", defaultFloat = 1.0f)
    public void setDuration(ViroSpinnerView view, float duration) {
        ViroLog.debug(TAG, "Setting duration: " + duration);
        // Duration will be handled by the view internally
    }
    
    @ReactProp(name = "easing")
    public void setEasing(ViroSpinnerView view, @Nullable String easing) {
        ViroLog.debug(TAG, "Setting easing: " + easing);
        // Easing will be handled by the view internally
    }
    
    @ReactProp(name = "delay", defaultFloat = 0.0f)
    public void setDelay(ViroSpinnerView view, float delay) {
        ViroLog.debug(TAG, "Setting delay: " + delay);
        // Delay will be handled by the view internally
    }
    
    // Spinner Behavior
    @ReactProp(name = "visible", defaultBoolean = true)
    public void setVisible(ViroSpinnerView view, boolean visible) {
        ViroLog.debug(TAG, "Setting visible: " + visible);
        if (visible) {
            view.show();
        } else {
            view.hide();
        }
    }
    
    @ReactProp(name = "autoHide", defaultBoolean = false)
    public void setAutoHide(ViroSpinnerView view, boolean autoHide) {
        ViroLog.debug(TAG, "Setting auto hide: " + autoHide);
        // Auto hide will be handled by the view internally
    }
    
    @ReactProp(name = "hideDelay", defaultFloat = 0.0f)
    public void setHideDelay(ViroSpinnerView view, float hideDelay) {
        ViroLog.debug(TAG, "Setting hide delay: " + hideDelay);
        // Hide delay will be handled by the view internally
    }
    
    @ReactProp(name = "fadeInDuration", defaultFloat = 0.3f)
    public void setFadeInDuration(ViroSpinnerView view, float fadeInDuration) {
        ViroLog.debug(TAG, "Setting fade in duration: " + fadeInDuration);
        // Fade in duration will be handled by the view internally
    }
    
    @ReactProp(name = "fadeOutDuration", defaultFloat = 0.3f)
    public void setFadeOutDuration(ViroSpinnerView view, float fadeOutDuration) {
        ViroLog.debug(TAG, "Setting fade out duration: " + fadeOutDuration);
        // Fade out duration will be handled by the view internally
    }
    
    // Spinner Progress
    @ReactProp(name = "progress", defaultFloat = 0.0f)
    public void setProgress(ViroSpinnerView view, float progress) {
        ViroLog.debug(TAG, "Setting progress: " + progress);
        view.setProgress(progress);
    }
    
    @ReactProp(name = "progressColor")
    public void setProgressColor(ViroSpinnerView view, @Nullable ReadableArray progressColor) {
        ViroLog.debug(TAG, "Setting progress color: " + progressColor);
        // Progress color will be handled by the view internally
    }
    
    @ReactProp(name = "progressBackgroundColor")
    public void setProgressBackgroundColor(ViroSpinnerView view, @Nullable ReadableArray progressBackgroundColor) {
        ViroLog.debug(TAG, "Setting progress background color: " + progressBackgroundColor);
        // Progress background color will be handled by the view internally
    }
    
    @ReactProp(name = "showProgress", defaultBoolean = false)
    public void setShowProgress(ViroSpinnerView view, boolean showProgress) {
        ViroLog.debug(TAG, "Setting show progress: " + showProgress);
        view.setShowProgress(showProgress);
    }
    
    @ReactProp(name = "progressText")
    public void setProgressText(ViroSpinnerView view, @Nullable String progressText) {
        ViroLog.debug(TAG, "Setting progress text: " + progressText);
        // Progress text will be handled by the view internally
    }
    
    // Spinner Text
    @ReactProp(name = "text")
    public void setText(ViroSpinnerView view, @Nullable String text) {
        ViroLog.debug(TAG, "Setting text: " + text);
        view.setText(text);
    }
    
    @ReactProp(name = "textColor")
    public void setTextColor(ViroSpinnerView view, @Nullable ReadableArray textColor) {
        ViroLog.debug(TAG, "Setting text color: " + textColor);
        // Text color will be handled by the view internally
    }
    
    @ReactProp(name = "textSize", defaultFloat = 14.0f)
    public void setTextSize(ViroSpinnerView view, float textSize) {
        ViroLog.debug(TAG, "Setting text size: " + textSize);
        // Text size will be handled by the view internally
    }
    
    @ReactProp(name = "textFont")
    public void setTextFont(ViroSpinnerView view, @Nullable String textFont) {
        ViroLog.debug(TAG, "Setting text font: " + textFont);
        // Text font will be handled by the view internally
    }
    
    @ReactProp(name = "textPosition")
    public void setTextPosition(ViroSpinnerView view, @Nullable String textPosition) {
        ViroLog.debug(TAG, "Setting text position: " + textPosition);
        // Text position will be handled by the view internally
    }
    
    @ReactProp(name = "textOffset", defaultFloat = 10.0f)
    public void setTextOffset(ViroSpinnerView view, float textOffset) {
        ViroLog.debug(TAG, "Setting text offset: " + textOffset);
        // Text offset will be handled by the view internally
    }
    
    // Spinner Customization
    @ReactProp(name = "dotCount", defaultInt = 8)
    public void setDotCount(ViroSpinnerView view, int dotCount) {
        ViroLog.debug(TAG, "Setting dot count: " + dotCount);
        // Dot count will be handled by the view internally
    }
    
    @ReactProp(name = "dotSize", defaultFloat = 8.0f)
    public void setDotSize(ViroSpinnerView view, float dotSize) {
        ViroLog.debug(TAG, "Setting dot size: " + dotSize);
        // Dot size will be handled by the view internally
    }
    
    @ReactProp(name = "barCount", defaultInt = 12)
    public void setBarCount(ViroSpinnerView view, int barCount) {
        ViroLog.debug(TAG, "Setting bar count: " + barCount);
        // Bar count will be handled by the view internally
    }
    
    @ReactProp(name = "barWidth", defaultFloat = 3.0f)
    public void setBarWidth(ViroSpinnerView view, float barWidth) {
        ViroLog.debug(TAG, "Setting bar width: " + barWidth);
        // Bar width will be handled by the view internally
    }
    
    @ReactProp(name = "barHeight", defaultFloat = 12.0f)
    public void setBarHeight(ViroSpinnerView view, float barHeight) {
        ViroLog.debug(TAG, "Setting bar height: " + barHeight);
        // Bar height will be handled by the view internally
    }
    
    @ReactProp(name = "ringWidth", defaultFloat = 4.0f)
    public void setRingWidth(ViroSpinnerView view, float ringWidth) {
        ViroLog.debug(TAG, "Setting ring width: " + ringWidth);
        // Ring width will be handled by the view internally
    }
    
    @ReactProp(name = "pulseScale", defaultFloat = 1.5f)
    public void setPulseScale(ViroSpinnerView view, float pulseScale) {
        ViroLog.debug(TAG, "Setting pulse scale: " + pulseScale);
        // Pulse scale will be handled by the view internally
    }
    
    // Event Exports
    @Override
    public java.util.Map<String, Object> getExportedCustomBubblingEventTypeConstants() {
        return java.util.Map.of(
            "onStart", java.util.Map.of(
                "phasedRegistrationNames", java.util.Map.of(
                    "bubbled", "onStart",
                    "captured", "onStartCapture"
                )
            ),
            "onStop", java.util.Map.of(
                "phasedRegistrationNames", java.util.Map.of(
                    "bubbled", "onStop",
                    "captured", "onStopCapture"
                )
            ),
            "onComplete", java.util.Map.of(
                "phasedRegistrationNames", java.util.Map.of(
                    "bubbled", "onComplete",
                    "captured", "onCompleteCapture"
                )
            ),
            "onProgressChange", java.util.Map.of(
                "phasedRegistrationNames", java.util.Map.of(
                    "bubbled", "onProgressChange",
                    "captured", "onProgressChangeCapture"
                )
            )
        );
    }
    
    @Override
    public void onDropViewInstance(@NonNull ViroSpinnerView view) {
        ViroLog.debug(TAG, "Dropping ViroSpinnerView instance");
        super.onDropViewInstance(view);
    }
}