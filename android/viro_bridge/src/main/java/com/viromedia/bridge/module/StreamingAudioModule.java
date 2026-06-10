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

package com.viromedia.bridge.module;

import android.util.Base64;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.internal.StreamingAudioPlayer;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HashMap;

/**
 * VRTStreamingAudio — React Native native module for streaming PCM audio.
 *
 * JS usage (via StreamingAudioManager.ts):
 *   StreamingAudioManager.create('player1');
 *   StreamingAudioManager.beginStreaming('player1', 32000, 1);
 *   StreamingAudioManager.play('player1');
 *   StreamingAudioManager.pushSamples('player1', base64FloatPCM);
 *   StreamingAudioManager.destroy('player1');
 */
@ReactModule(name = "VRTStreamingAudio")
public class StreamingAudioModule extends ReactContextBaseJavaModule {

    private final HashMap<String, StreamingAudioPlayer> mPlayers = new HashMap<>();

    public StreamingAudioModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "VRTStreamingAudio";
    }

    @ReactMethod
    public void create(String playerId) {
        mPlayers.put(playerId, new StreamingAudioPlayer());
    }

    @ReactMethod
    public void beginStreaming(String playerId, int sampleRate, int channels) {
        StreamingAudioPlayer p = mPlayers.get(playerId);
        if (p != null) p.beginStreaming(sampleRate, channels);
    }

    @ReactMethod
    public void play(String playerId) {
        StreamingAudioPlayer p = mPlayers.get(playerId);
        if (p != null) p.play();
    }

    @ReactMethod
    public void pause(String playerId) {
        StreamingAudioPlayer p = mPlayers.get(playerId);
        if (p != null) p.pause();
    }

    @ReactMethod
    public void setVolume(String playerId, float volume) {
        StreamingAudioPlayer p = mPlayers.get(playerId);
        if (p != null) p.setVolume(volume);
    }

    @ReactMethod
    public void setMuted(String playerId, boolean muted) {
        StreamingAudioPlayer p = mPlayers.get(playerId);
        if (p != null) p.setMuted(muted);
    }

    /**
     * Push interleaved float32 PCM samples encoded as base64 (little-endian IEEE 754).
     * JS side: btoa(String.fromCharCode(...new Uint8Array(float32Array.buffer)))
     */
    @ReactMethod
    public void pushSamples(String playerId, String base64Samples) {
        StreamingAudioPlayer p = mPlayers.get(playerId);
        if (p == null) return;

        byte[] bytes = Base64.decode(base64Samples, Base64.NO_WRAP);
        float[] floats = new float[bytes.length / 4];
        ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(floats);
        p.write(floats);
    }

    @ReactMethod
    public void destroy(String playerId) {
        StreamingAudioPlayer p = mPlayers.remove(playerId);
        if (p != null) p.destroy();
    }
}
