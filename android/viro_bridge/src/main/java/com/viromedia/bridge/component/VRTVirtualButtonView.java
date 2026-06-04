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
import com.viromedia.bridge.utility.ViroEventEmitter;
import com.viromedia.bridge.utility.ViroEvents;

import java.util.HashMap;
import java.util.Map;

/**
 * Native virtual-button view. Renders a filled circle with a label; on touch-down
 * writes setButton(idx, true) to a VROInputState via VROVirtualControllerRegistry (JNI),
 * and on touch-up / cancel writes setButton(idx, false).
 *
 * Props (set by VRTVirtualButtonViewManager):
 *   controllerId — registry id (e.g. "p1")
 *   button       — "A" | "B" | "X" | "Y" | "Z" | "L1" | "R1" | "L2" | "R2" | "Start" | "Select"
 *   size         — circle diameter in dp (default 44)
 *   tintColor    — ARGB int (default semi-transparent white)
 */
public class VRTVirtualButtonView extends View {

    static {
        System.loadLibrary("viro_renderer");
    }

    // --- JNI (same native lib as VRTVirtualJoystickView) ---
    private native long nativeAcquire(String controllerId);
    private native void nativeRelease(String controllerId, long ref);
    private native void nativeSetButton(long ref, int buttonIndex, boolean pressed);

    // --- button name → DefaultButton index map ---
    private static final Map<String, Integer> BUTTON_MAP = new HashMap<>();
    static {
        BUTTON_MAP.put("A",      0);
        BUTTON_MAP.put("B",      1);
        BUTTON_MAP.put("X",      2);
        BUTTON_MAP.put("Y",      3);
        BUTTON_MAP.put("Z",      4);
        BUTTON_MAP.put("L1",     5);
        BUTTON_MAP.put("R1",     6);
        BUTTON_MAP.put("L2",     7);
        BUTTON_MAP.put("R2",     8);
        BUTTON_MAP.put("Start",  9);
        BUTTON_MAP.put("Select", 10);
    }

    // --- defaults ---
    private static final float DEFAULT_SIZE_DP = 44f;
    private static final int   DEFAULT_TINT    = Color.argb(153, 255, 255, 255);

    // --- props ---
    private String mControllerId = null;
    private String mButtonName   = "A";
    private int    mButtonIndex  = 0;
    private float  mSize;         // px
    private int    mTintColor    = DEFAULT_TINT;

    // --- state ---
    private long   mNativeRef   = 0;
    private String mAcquiredId  = null;
    private boolean mPressed    = false;
    private final ReactContext mReactContext;

    // --- paint ---
    private final Paint mCirclePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint mLabelPaint  = new Paint(Paint.ANTI_ALIAS_FLAG);

    public VRTVirtualButtonView(ReactContext context) {
        super(context);
        mReactContext = context;
        mSize = dpToPx(DEFAULT_SIZE_DP);
        setWillNotDraw(false);
        setBackgroundColor(Color.TRANSPARENT);
        applyTint(DEFAULT_TINT);
        mLabelPaint.setColor(Color.WHITE);
        mLabelPaint.setTextAlign(Paint.Align.CENTER);
    }

    // -------------------------------------------------------------------------
    // Props
    // -------------------------------------------------------------------------

    public void setControllerId(String id) {
        if (id != null && id.equals(mControllerId)) return;
        mControllerId = id;
        rebindRegistry();
    }

    public void setButton(String name) {
        mButtonName  = name != null ? name : "A";
        Integer idx  = BUTTON_MAP.get(mButtonName);
        mButtonIndex = idx != null ? idx : 0;
        invalidate();
    }

    public void setSize(float sizeDp) {
        mSize = dpToPx(sizeDp > 0 ? sizeDp : DEFAULT_SIZE_DP);
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
            nativeSetButton(mNativeRef, mButtonIndex, false);
            nativeRelease(mAcquiredId, mNativeRef);
        }
        mAcquiredId = null;
        mNativeRef  = 0;
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
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
        float r  = mSize / 2f;

        mCirclePaint.setAlpha(mPressed ? 178 : 255); // darken on press
        canvas.drawCircle(cx, cy, r, mCirclePaint);

        float fontSize = Math.max(r * 0.6f, 10f);
        mLabelPaint.setTextSize(fontSize);
        // Vertically center text
        float textY = cy - (mLabelPaint.descent() + mLabelPaint.ascent()) / 2f;
        canvas.drawText(mButtonName, cx, textY, mLabelPaint);
    }

    // -------------------------------------------------------------------------
    // Touch handling
    // -------------------------------------------------------------------------

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                mPressed = true;
                invalidate();
                writeButton(true);
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                mPressed = false;
                invalidate();
                writeButton(false);
                return true;
        }
        return super.onTouchEvent(event);
    }

    private void writeButton(boolean pressed) {
        if (mNativeRef == 0) return;
        nativeSetButton(mNativeRef, mButtonIndex, pressed);
        // Emit JS callback
        ViroEventEmitter.emit(mReactContext, getId(),
            pressed ? ViroEvents.ON_PRESS_IN : ViroEvents.ON_PRESS_OUT,
            Arguments.createMap());
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void applyTint(int color) {
        mCirclePaint.setColor(color);
        mCirclePaint.setStyle(Paint.Style.FILL);
    }

    private float dpToPx(float dp) {
        return dp * getResources().getDisplayMetrics().density;
    }
}
