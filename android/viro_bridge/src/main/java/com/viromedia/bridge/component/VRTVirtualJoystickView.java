//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.

package com.viromedia.bridge.component;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.MotionEvent;
import android.view.View;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viromedia.bridge.utility.ViroEvents;

/**
 * Native virtual-joystick view. Renders an outer ring and a draggable knob; on touch
 * the knob follows the finger clamped to the ring, and the normalised stick position is
 * written directly to a VROInputState via VROVirtualControllerRegistry (JNI).
 *
 * Touch handling happens entirely on the UI thread without crossing the JS bridge, so
 * input-to-state latency is single-digit milliseconds.
 *
 * Props (set by VRTVirtualJoystickViewManager):
 *   controllerId — maps to a VROVirtualControllerRegistry entry (e.g. "p1")
 *   stickSide    — "left" (default) or "right"
 *   radius       — outer ring radius in dp (default 60)
 *   tintColor    — ARGB int (default semi-transparent white)
 */
public class VRTVirtualJoystickView extends View {

    static {
        System.loadLibrary("viro_renderer");
    }

    // --- JNI ---
    private native long nativeAcquire(String controllerId);
    private native void nativeRelease(String controllerId, long ref);
    private native void nativeSetStickL(long ref, float x, float y);
    private native void nativeSetStickR(long ref, float x, float y);

    // --- defaults ---
    private static final float DEFAULT_RADIUS_DP = 60f;
    private static final int   DEFAULT_TINT      = Color.argb(153, 255, 255, 255); // 60% white

    // --- props ---
    private String  mControllerId = null;
    private boolean mIsRight      = false;
    private float   mRadius;       // px, set from dp in setRadius()
    private int     mTintColor    = DEFAULT_TINT;

    // --- state ---
    private long    mNativeRef    = 0;
    private String  mAcquiredId   = null;
    private float   mKnobDx       = 0f;
    private float   mKnobDy       = 0f;
    private final ReactContext mReactContext;

    // --- paint ---
    private final Paint mRingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mKnobPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    public VRTVirtualJoystickView(ReactContext context) {
        super(context);
        mReactContext = context;
        mRadius = dpToPx(DEFAULT_RADIUS_DP);
        setWillNotDraw(false);
        setBackgroundColor(Color.TRANSPARENT);
        applyTint(DEFAULT_TINT);
    }

    // -------------------------------------------------------------------------
    // Props
    // -------------------------------------------------------------------------

    public void setControllerId(String id) {
        if (id != null && id.equals(mControllerId)) return;
        mControllerId = id;
        rebindRegistry();
    }

    public void setStickSide(String side) {
        mIsRight = "right".equals(side);
    }

    public void setRadius(float radiusDp) {
        mRadius = dpToPx(radiusDp > 0 ? radiusDp : DEFAULT_RADIUS_DP);
        invalidate();
    }

    public void setTintColor(int color) {
        mTintColor = color;
        applyTint(color);
        invalidate();
    }

    // -------------------------------------------------------------------------
    // Registry binding
    // -------------------------------------------------------------------------

    private void rebindRegistry() {
        releaseRegistry();
        if (mControllerId == null || mControllerId.isEmpty()) return;
        mAcquiredId = mControllerId;
        mNativeRef  = nativeAcquire(mAcquiredId);
    }

    private void releaseRegistry() {
        if (mAcquiredId != null && mNativeRef != 0) {
            writeStick(0f, 0f);
            nativeRelease(mAcquiredId, mNativeRef);
        }
        mAcquiredId = null;
        mNativeRef  = 0;
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        // Re-acquire in case the view was detached and re-attached with the same id.
        if (mControllerId != null && !mControllerId.isEmpty() && mNativeRef == 0) {
            rebindRegistry();
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        releaseRegistry();
    }

    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------

    @Override
    protected void onDraw(Canvas canvas) {
        float cx = getWidth()  / 2f;
        float cy = getHeight() / 2f;

        // Outer ring
        canvas.drawCircle(cx, cy, mRadius, mRingPaint);

        // Knob
        float knobR = mRadius * 0.4f;
        canvas.drawCircle(cx + mKnobDx, cy + mKnobDy, knobR, mKnobPaint);
    }

    // -------------------------------------------------------------------------
    // Touch handling
    // -------------------------------------------------------------------------

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_MOVE:
                updateFromTouch(event.getX(), event.getY());
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                resetKnob();
                return true;
        }
        return super.onTouchEvent(event);
    }

    private void updateFromTouch(float touchX, float touchY) {
        float cx = getWidth()  / 2f;
        float cy = getHeight() / 2f;

        float dx = touchX - cx;
        float dy = touchY - cy;
        float mag = (float) Math.sqrt(dx * dx + dy * dy);

        if (mag > mRadius && mRadius > 0) {
            float scale = mRadius / mag;
            dx *= scale;
            dy *= scale;
            mag = mRadius;
        }

        mKnobDx = dx;
        mKnobDy = dy;
        invalidate();

        // Android y-axis points DOWN; flip so "up on screen" = positive Y (game convention).
        float nx = (mRadius > 0) ? dx / mRadius : 0f;
        float ny = (mRadius > 0) ? -dy / mRadius : 0f;
        writeStick(nx, ny);
    }

    private void resetKnob() {
        mKnobDx = 0f;
        mKnobDy = 0f;
        invalidate();
        writeStick(0f, 0f);
    }

    private void writeStick(float x, float y) {
        if (mNativeRef == 0) return;
        if (mIsRight) {
            nativeSetStickR(mNativeRef, x, y);
        } else {
            nativeSetStickL(mNativeRef, x, y);
        }
        // Emit JS callback — values as strings to avoid Fabric conversions.h warnings
        WritableMap event = Arguments.createMap();
        event.putString("x", String.format("%.4f", x));
        event.putString("y", String.format("%.4f", y));
        ViroEventEmitter.emit(mReactContext, getId(), ViroEvents.ON_STICK_CHANGE, event);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void applyTint(int color) {
        mRingPaint.setColor(color);
        mRingPaint.setStyle(Paint.Style.STROKE);
        mRingPaint.setStrokeWidth(dpToPx(2f));

        mKnobPaint.setColor(color);
        mKnobPaint.setStyle(Paint.Style.FILL);
    }

    private float dpToPx(float dp) {
        return dp * getResources().getDisplayMetrics().density;
    }
}
