//
//  ViroSpinnerView.java
//  ViroReact
//
//  Created for ReactVision.
//  Copyright © 2025 ReactVision. All rights reserved.
//

package com.viromedia.bridge.fabric;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.view.animation.LinearInterpolator;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.viromedia.bridge.utility.ViroLog;

/**
 * ViroSpinnerView - Loading Indicator Android View
 * 
 * This View provides comprehensive spinner functionality for ViroReact applications,
 * supporting multiple spinner types, animations, progress indication, and text labels.
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
public class ViroSpinnerView extends View {
    
    private static final String TAG = ViroLog.getTag(ViroSpinnerView.class);
    
    // Spinner types
    public enum SpinnerType {
        CIRCULAR("circular"),
        DOTS("dots"),
        BARS("bars"),
        RING("ring"),
        PULSE("pulse");
        
        private final String value;
        
        SpinnerType(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        public static SpinnerType fromString(String value) {
            for (SpinnerType type : SpinnerType.values()) {
                if (type.value.equals(value)) {
                    return type;
                }
            }
            return CIRCULAR;
        }
    }
    
    // Spinner appearance
    private SpinnerType type = SpinnerType.CIRCULAR;
    private ReadableArray color = Arguments.createArray();
    private float size = 50.0f;
    private float thickness = 4.0f;
    private float radius = 20.0f;
    private float spacing = 8.0f;
    
    // Spinner animation
    private boolean animating = false;
    private float speed = 1.0f;
    private String direction = "clockwise";
    private float duration = 1.0f;
    private String easing = "linear";
    private float delay = 0.0f;
    
    // Spinner behavior
    private boolean visible = true;
    private boolean autoHide = false;
    private float hideDelay = 0.0f;
    private float fadeInDuration = 0.3f;
    private float fadeOutDuration = 0.3f;
    
    // Spinner progress
    private float progress = 0.0f;
    private ReadableArray progressColor = Arguments.createArray();
    private ReadableArray progressBackgroundColor = Arguments.createArray();
    private boolean showProgress = false;
    private String progressText = "";
    
    // Spinner text
    private String text = "";
    private ReadableArray textColor = Arguments.createArray();
    private float textSize = 14.0f;
    private String textFont = "System";
    private String textPosition = "bottom";
    private float textOffset = 10.0f;
    
    // Spinner customization
    private int dotCount = 8;
    private float dotSize = 8.0f;
    private int barCount = 12;
    private float barWidth = 3.0f;
    private float barHeight = 12.0f;
    private float ringWidth = 4.0f;
    private float pulseScale = 1.5f;
    
    // Internal state
    private Paint spinnerPaint;
    private Paint progressPaint;
    private Paint textPaint;
    private RectF spinnerRect;
    private ValueAnimator currentAnimator;
    private float animationProgress = 0.0f;
    
    // Event handling
    private RCTEventEmitter eventEmitter;
    private int reactTag = -1;
    
    public ViroSpinnerView(@NonNull Context context) {
        super(context);
        
        ViroLog.debug(TAG, "ViroSpinnerView created");
        
        // Initialize default colors
        color = createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        progressColor = createColorArray(0.0f, 0.7f, 1.0f, 1.0f);
        progressBackgroundColor = createColorArray(0.3f, 0.3f, 0.3f, 0.3f);
        textColor = createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        
        initializePaints();
        setupSpinner();
    }
    
    private void initializePaints() {
        spinnerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        spinnerPaint.setStyle(Paint.Style.STROKE);
        spinnerPaint.setStrokeCap(Paint.Cap.ROUND);
        spinnerPaint.setStrokeWidth(thickness);
        spinnerPaint.setColor(getColorFromArray(color));
        
        progressPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        progressPaint.setStyle(Paint.Style.STROKE);
        progressPaint.setStrokeCap(Paint.Cap.ROUND);
        progressPaint.setStrokeWidth(thickness);
        progressPaint.setColor(getColorFromArray(progressColor));
        
        textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setTextSize(textSize);
        textPaint.setColor(getColorFromArray(textColor));
        
        spinnerRect = new RectF();
    }
    
    private void setupSpinner() {
        updateSpinnerGeometry();
        if (animating) {
            startAnimating();
        }
    }
    
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        updateSpinnerGeometry();
    }
    
    private void updateSpinnerGeometry() {
        float centerX = getWidth() / 2.0f;
        float centerY = getHeight() / 2.0f;
        
        spinnerRect.set(
            centerX - radius,
            centerY - radius,
            centerX + radius,
            centerY + radius
        );
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        if (!visible) {
            return;
        }
        
        float centerX = getWidth() / 2.0f;
        float centerY = getHeight() / 2.0f;
        
        // Draw spinner based on type
        switch (type) {
            case CIRCULAR:
                drawCircularSpinner(canvas, centerX, centerY);
                break;
            case DOTS:
                drawDotsSpinner(canvas, centerX, centerY);
                break;
            case BARS:
                drawBarsSpinner(canvas, centerX, centerY);
                break;
            case RING:
                drawRingSpinner(canvas, centerX, centerY);
                break;
            case PULSE:
                drawPulseSpinner(canvas, centerX, centerY);
                break;
        }
        
        // Draw progress if enabled
        if (showProgress) {
            drawProgress(canvas, centerX, centerY);
        }
        
        // Draw text if present
        if (!text.isEmpty()) {
            drawText(canvas, centerX, centerY);
        }
        
        // Draw progress text if enabled
        if (showProgress && !progressText.isEmpty()) {
            drawProgressText(canvas, centerX, centerY);
        }
    }
    
    private void drawCircularSpinner(Canvas canvas, float centerX, float centerY) {
        if (animating) {
            // Draw rotating arc
            float startAngle = animationProgress * 360;
            canvas.drawArc(spinnerRect, startAngle, 270, false, spinnerPaint);
        } else {
            // Draw full circle
            canvas.drawCircle(centerX, centerY, radius, spinnerPaint);
        }
    }
    
    private void drawDotsSpinner(Canvas canvas, float centerX, float centerY) {
        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotPaint.setColor(getColorFromArray(color));
        
        for (int i = 0; i < dotCount; i++) {
            float angle = (float) (2 * Math.PI * i / dotCount);
            float x = centerX + (radius + spacing) * (float) Math.cos(angle);
            float y = centerY + (radius + spacing) * (float) Math.sin(angle);
            
            float alpha = 1.0f;
            if (animating) {
                float delay = (float) i / dotCount;
                float animationOffset = (animationProgress + delay) % 1.0f;
                alpha = 0.3f + 0.7f * (float) Math.sin(animationOffset * Math.PI);
            }
            
            dotPaint.setAlpha((int) (255 * alpha));
            canvas.drawCircle(x, y, dotSize / 2, dotPaint);
        }
    }
    
    private void drawBarsSpinner(Canvas canvas, float centerX, float centerY) {
        Paint barPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        barPaint.setColor(getColorFromArray(color));
        
        for (int i = 0; i < barCount; i++) {
            float angle = (float) (2 * Math.PI * i / barCount);
            
            canvas.save();
            canvas.translate(centerX, centerY);
            canvas.rotate((float) Math.toDegrees(angle));
            
            float alpha = 1.0f;
            float scaleY = 1.0f;
            if (animating) {
                float delay = (float) i / barCount;
                float animationOffset = (animationProgress + delay) % 1.0f;
                alpha = 0.3f + 0.7f * (float) Math.sin(animationOffset * Math.PI);
                scaleY = 0.3f + 0.7f * (float) Math.sin(animationOffset * Math.PI);
            }
            
            barPaint.setAlpha((int) (255 * alpha));
            
            float scaledHeight = barHeight * scaleY;
            canvas.drawRect(
                -barWidth / 2,
                radius - scaledHeight / 2,
                barWidth / 2,
                radius + scaledHeight / 2,
                barPaint
            );
            
            canvas.restore();
        }
    }
    
    private void drawRingSpinner(Canvas canvas, float centerX, float centerY) {
        if (animating) {
            // Draw animated ring
            float sweepAngle = 360 * animationProgress;
            canvas.drawArc(spinnerRect, -90, sweepAngle, false, spinnerPaint);
        } else {
            // Draw full ring
            canvas.drawCircle(centerX, centerY, radius, spinnerPaint);
        }
    }
    
    private void drawPulseSpinner(Canvas canvas, float centerX, float centerY) {
        if (animating) {
            float scale = 1.0f + (pulseScale - 1.0f) * (float) Math.sin(animationProgress * Math.PI);
            float alpha = 1.0f - (float) Math.sin(animationProgress * Math.PI);
            
            Paint pulsePaint = new Paint(spinnerPaint);
            pulsePaint.setAlpha((int) (255 * alpha));
            
            canvas.drawCircle(centerX, centerY, radius * scale, pulsePaint);
        } else {
            canvas.drawCircle(centerX, centerY, radius, spinnerPaint);
        }
    }
    
    private void drawProgress(Canvas canvas, float centerX, float centerY) {
        // Draw background circle
        Paint backgroundPaint = new Paint(progressPaint);
        backgroundPaint.setColor(getColorFromArray(progressBackgroundColor));
        canvas.drawCircle(centerX, centerY, radius, backgroundPaint);
        
        // Draw progress arc
        float sweepAngle = 360 * progress;
        canvas.drawArc(spinnerRect, -90, sweepAngle, false, progressPaint);
    }
    
    private void drawText(Canvas canvas, float centerX, float centerY) {
        float textY = centerY;
        
        if ("top".equals(textPosition)) {
            textY = centerY - radius - textOffset;
        } else if ("bottom".equals(textPosition)) {
            textY = centerY + radius + textOffset + textSize;
        } else if ("center".equals(textPosition)) {
            textY = centerY + textSize / 2;
        }
        
        canvas.drawText(text, centerX, textY, textPaint);
    }
    
    private void drawProgressText(Canvas canvas, float centerX, float centerY) {
        String displayText = progressText.isEmpty() ? 
            String.format("%.0f%%", progress * 100) : progressText;
        canvas.drawText(displayText, centerX, centerY + textSize / 2, textPaint);
    }
    
    // Spinner Control Methods
    public void startAnimating() {
        ViroLog.debug(TAG, "Starting spinner animation");
        
        if (currentAnimator != null) {
            currentAnimator.cancel();
        }
        
        animating = true;
        
        currentAnimator = ValueAnimator.ofFloat(0f, 1f);
        currentAnimator.setDuration((long) (duration * 1000 / speed));
        currentAnimator.setRepeatCount(ValueAnimator.INFINITE);
        currentAnimator.setInterpolator(new LinearInterpolator());
        
        if ("counterclockwise".equals(direction)) {
            currentAnimator = ValueAnimator.ofFloat(1f, 0f);
        }
        
        currentAnimator.addUpdateListener(animation -> {
            animationProgress = (Float) animation.getAnimatedValue();
            invalidate();
        });
        
        currentAnimator.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationStart(Animator animation) {
                sendEvent("onStart", Arguments.createMap());
            }
            
            @Override
            public void onAnimationEnd(Animator animation) {
                sendEvent("onStop", Arguments.createMap());
            }
        });
        
        if (delay > 0) {
            currentAnimator.setStartDelay((long) (delay * 1000));
        }
        
        currentAnimator.start();
    }
    
    public void stopAnimating() {
        ViroLog.debug(TAG, "Stopping spinner animation");
        
        if (currentAnimator != null) {
            currentAnimator.cancel();
            currentAnimator = null;
        }
        
        animating = false;
        invalidate();
        
        if (autoHide) {
            postDelayed(this::hide, (long) (hideDelay * 1000));
        }
    }
    
    public void show() {
        ViroLog.debug(TAG, "Showing spinner");
        visible = true;
        setVisibility(VISIBLE);
        
        animate()
            .alpha(1.0f)
            .setDuration((long) (fadeInDuration * 1000))
            .start();
    }
    
    public void hide() {
        ViroLog.debug(TAG, "Hiding spinner");
        
        animate()
            .alpha(0.0f)
            .setDuration((long) (fadeOutDuration * 1000))
            .withEndAction(() -> {
                visible = false;
                setVisibility(GONE);
            })
            .start();
    }
    
    // Property Setters
    public void setType(@Nullable String type) {
        ViroLog.debug(TAG, "Setting type: " + type);
        this.type = SpinnerType.fromString(type != null ? type : "circular");
        invalidate();
    }
    
    public void setColor(@Nullable ReadableArray color) {
        ViroLog.debug(TAG, "Setting color: " + color);
        this.color = color != null ? color : createColorArray(1.0f, 1.0f, 1.0f, 1.0f);
        spinnerPaint.setColor(getColorFromArray(this.color));
        invalidate();
    }
    
    public void setSize(float size) {
        ViroLog.debug(TAG, "Setting size: " + size);
        this.size = size;
        this.radius = size / 2.5f;
        updateSpinnerGeometry();
        invalidate();
    }
    
    public void setThickness(float thickness) {
        ViroLog.debug(TAG, "Setting thickness: " + thickness);
        this.thickness = thickness;
        spinnerPaint.setStrokeWidth(thickness);
        progressPaint.setStrokeWidth(thickness);
        invalidate();
    }
    
    public void setAnimating(boolean animating) {
        ViroLog.debug(TAG, "Setting animating: " + animating);
        if (animating) {
            startAnimating();
        } else {
            stopAnimating();
        }
    }
    
    public void setSpeed(float speed) {
        ViroLog.debug(TAG, "Setting speed: " + speed);
        this.speed = speed;
        if (animating) {
            stopAnimating();
            startAnimating();
        }
    }
    
    public void setProgress(float progress) {
        ViroLog.debug(TAG, "Setting progress: " + progress);
        this.progress = Math.max(0.0f, Math.min(1.0f, progress));
        
        WritableMap eventData = Arguments.createMap();
        eventData.putDouble("progress", this.progress);
        sendEvent("onProgressChange", eventData);
        
        invalidate();
    }
    
    public void setText(@Nullable String text) {
        ViroLog.debug(TAG, "Setting text: " + text);
        this.text = text != null ? text : "";
        invalidate();
    }
    
    public void setShowProgress(boolean showProgress) {
        ViroLog.debug(TAG, "Setting show progress: " + showProgress);
        this.showProgress = showProgress;
        invalidate();
    }
    
    // State Information
    public boolean isAnimating() {
        return animating;
    }
    
    public boolean isVisible() {
        return visible;
    }
    
    public float getCurrentProgress() {
        return progress;
    }
    
    public String getSpinnerType() {
        return type.getValue();
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
            return Color.WHITE;
        }
        
        float red = (float) colorArray.getDouble(0);
        float green = (float) colorArray.getDouble(1);
        float blue = (float) colorArray.getDouble(2);
        float alpha = colorArray.size() > 3 ? (float) colorArray.getDouble(3) : 1.0f;
        
        return Color.argb(
            (int) (alpha * 255),
            (int) (red * 255),
            (int) (green * 255),
            (int) (blue * 255)
        );
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
        if (currentAnimator != null) {
            currentAnimator.cancel();
            currentAnimator = null;
        }
    }
}