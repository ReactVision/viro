// Copyright © 2026 ReactVision. All rights reserved.
package com.viromedia.bridge.component;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.ViroContext;
import com.viromedia.bridge.component.node.VRTNode;
import com.viromedia.bridge.utility.ViroEventEmitter;

/**
 * Headless VRTNode that fires per-frame JS callbacks via VROGameLoopListener.
 * Mount it anywhere inside a ViroARScene/ViroScene to start the loop.
 *
 * Props: onUpdate, onLateUpdate, onFixedUpdate, fixedHz
 */
public class VRTGameLoopView extends VRTNode {

    static {
        System.loadLibrary("viro_renderer");
    }

    private long         mListenerRef   = 0;
    private long         mContextRef    = 0;
    private float        mFixedHz       = 0.f;
    private final ReactContext mReactContext;

    public VRTGameLoopView(ReactContext reactContext) {
        super(reactContext);
        mReactContext = reactContext;
    }

    // ── Props ─────────────────────────────────────────────────────────────────

    public void setFixedHz(float hz) {
        mFixedHz = hz;
        if (mListenerRef != 0) {
            nativeSetFixedHz(mListenerRef, hz);
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void setViroContext(ViroContext context) {
        super.setViroContext(context);
        if (mListenerRef != 0) return;

        mContextRef  = context.getNativeRef();
        mListenerRef = nativeCreate(mContextRef);
        if (mListenerRef == 0) return;

        if (mFixedHz > 0.f) {
            nativeSetFixedHz(mListenerRef, mFixedHz);
        }
    }

    @Override
    public void onTearDown() {
        if (mListenerRef != 0) {
            nativeDestroy(mListenerRef, mContextRef);
            mListenerRef = 0;
        }
        super.onTearDown();
    }

    // ── JNI callbacks (called from VROGameLoop_JNI.cpp render thread → main thread) ─

    public void notifyUpdate(float dt, float elapsed) {
        WritableMap event = Arguments.createMap();
        event.putDouble("dt", dt);
        event.putDouble("elapsed", elapsed);
        ViroEventEmitter.emit(mReactContext, getId(), "onUpdate", event);
    }

    public void notifyLateUpdate(float dt, float elapsed) {
        WritableMap event = Arguments.createMap();
        event.putDouble("dt", dt);
        event.putDouble("elapsed", elapsed);
        ViroEventEmitter.emit(mReactContext, getId(), "onLateUpdate", event);
    }

    public void notifyFixedUpdate(float dt) {
        WritableMap event = Arguments.createMap();
        event.putDouble("dt", dt);
        ViroEventEmitter.emit(mReactContext, getId(), "onFixedUpdate", event);
    }

    // ── JNI ──────────────────────────────────────────────────────────────────

    private native long nativeCreate(long contextRef);
    private native void nativeDestroy(long listenerRef, long contextRef);
    private native void nativeSetFixedHz(long listenerRef, float hz);
}
