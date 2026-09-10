// Copyright © 2026 ReactVision. All rights reserved.
//
// React Native module for the co-location frame channel.
//
// Not part of ARSceneNavigatorModule: the channel needs no AR scene, only a
// room id and poses. Keeping it independent is what lets the same JS API work
// on a platform whose AR subsystem does not exist.

package com.viromedia.bridge.module;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.ColocationSession;

import java.util.List;

public class VRTColocationModule extends ReactContextBaseJavaModule {

    public VRTColocationModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "VRTColocationModule";
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            promise.resolve(ColocationSession.getInstance().isAvailable());
        } catch (Throwable t) {
            // A missing native library surfaces here as UnsatisfiedLinkError.
            // Unavailable is the honest answer, not a rejected promise.
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void join(final String roomId, final String apiKey, final String projectId,
                     final String endpoint, final Promise promise) {
        try {
            ColocationSession.getInstance().join(roomId, apiKey, projectId, endpoint,
                    (success, error) -> {
                        WritableMap r = Arguments.createMap();
                        r.putBoolean("success", success);
                        if (!success) r.putString("error", error);
                        promise.resolve(r);
                    });
        } catch (Throwable t) {
            WritableMap r = Arguments.createMap();
            r.putBoolean("success", false);
            r.putString("error", String.valueOf(t.getMessage()));
            promise.resolve(r);
        }
    }

    @ReactMethod
    public void leave(Promise promise) {
        try { ColocationSession.getInstance().leave(); } catch (Throwable ignored) {}
        promise.resolve(true);
    }

    /** Pose as 16 comma-separated floats, column-major, in the location frame. */
    @ReactMethod
    public void setLocalPose(String csv, Promise promise) {
        try { ColocationSession.getInstance().setLocalPose(csv); } catch (Throwable ignored) {}
        promise.resolve(true);
    }

    @ReactMethod
    public void getState(Promise promise) {
        WritableMap r = Arguments.createMap();
        try {
            ColocationSession s = ColocationSession.getInstance();
            r.putInt("state", s.getState());
            r.putString("localPeerId", s.getLocalPeerId());
        } catch (Throwable t) {
            r.putInt("state", ColocationSession.STATE_IDLE);
            r.putString("localPeerId", "");
        }
        promise.resolve(r);
    }

    @ReactMethod
    public void getPeers(Promise promise) {
        WritableArray out = Arguments.createArray();
        try {
            List<ColocationSession.Peer> peers = ColocationSession.getInstance().getPeers();
            for (ColocationSession.Peer p : peers) {
                WritableMap m = Arguments.createMap();
                m.putString("peerId", p.peerId);
                WritableArray pos = Arguments.createArray();
                for (float v : p.position) pos.pushDouble(v);
                WritableArray rot = Arguments.createArray();
                for (float v : p.rotation) rot.pushDouble(v);
                m.putArray("position", pos);
                m.putArray("rotation", rot);
                m.putDouble("timestampMs", p.timestampMs);
                m.putBoolean("localized", p.localized);
                out.pushMap(m);
            }
        } catch (Throwable ignored) {
            // An empty list is the right answer when the channel is not there.
        }
        promise.resolve(out);
    }
}
