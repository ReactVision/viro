// Copyright © 2026 ReactVision. All rights reserved.
// Proprietary and Confidential
//
// Android WebSocket for the co-location frame channel, called from C++ via JNI
// (NetworkSocket_Android.cpp). Backed by OkHttp, which React Native already
// ships on Android — declared compileOnly so the standalone AAR does not force
// it. Probe RVWebSocketSupport.isAvailable() before loading this class.
//
// Reconnect and backoff live here rather than in C++ so the policy matches the
// iOS transport, which uses dispatch_after for the same purpose.
//
// CANONICAL COPY. Vendored verbatim into viro's viro_bridge alongside
// RVHttpClient — edit here, then re-copy.

package com.reactvision.cca;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public final class RVWebSocket extends WebSocketListener {

    // Mirrors kBackoffSeconds in NetworkSocket_iOS.mm. Capped rather than
    // unbounded: a device that left coverage should rejoin promptly on return,
    // and the location frame is already known locally so reconnecting is cheap.
    private static final long[] BACKOFF_MS = { 500, 1000, 2000, 4000, 8000 };
    private static final int    MAX_ATTEMPTS = BACKOFF_MS.length;

    private static final ScheduledExecutorService SCHEDULER =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "rvcca-ws-retry");
                t.setDaemon(true);
                return t;
            });

    private final long     nativeHandle;
    private final String   url;
    private final String[] headerNames;
    private final String[] headerValues;

    private final OkHttpClient client;
    private final AtomicBoolean closed  = new AtomicBoolean(false);
    private final AtomicInteger attempt = new AtomicInteger(0);

    private volatile WebSocket socket;

    public RVWebSocket(long nativeHandle, String url,
                       String[] headerNames, String[] headerValues) {
        this.nativeHandle = nativeHandle;
        this.url          = url;
        this.headerNames  = headerNames;
        this.headerValues = headerValues;

        // No read timeout: an idle frame channel is normal — peers may be still.
        // OkHttp's own ping keeps the connection alive and detects a dead link.
        this.client = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .build();
    }

    public void connect() {
        if (closed.get()) return;
        Request.Builder b = new Request.Builder().url(url);
        if (headerNames != null && headerValues != null) {
            for (int i = 0; i < headerNames.length && i < headerValues.length; i++) {
                if (headerNames[i] != null && headerValues[i] != null) {
                    b.addHeader(headerNames[i], headerValues[i]);
                }
            }
        }
        socket = client.newWebSocket(b.build(), this);
    }

    public boolean send(String text) {
        WebSocket s = socket;
        return s != null && !closed.get() && s.send(text);
    }

    public void close() {
        if (!closed.compareAndSet(false, true)) return;
        WebSocket s = socket;
        if (s != null) s.close(1000, null);
        socket = null;
    }

    // -----------------------------------------------------------------------
    // WebSocketListener
    // -----------------------------------------------------------------------

    @Override
    public void onOpen(WebSocket webSocket, Response response) {
        if (closed.get()) return;
        attempt.set(0);
        nativeOnOpen(nativeHandle);
    }

    @Override
    public void onMessage(WebSocket webSocket, String text) {
        if (closed.get()) return;
        nativeOnMessage(nativeHandle, text);
    }

    @Override
    public void onClosed(WebSocket webSocket, int code, String reason) {
        handleDrop(reason == null || reason.isEmpty() ? ("closed " + code) : reason);
    }

    @Override
    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
        handleDrop(t.getMessage() == null ? t.toString() : t.getMessage());
    }

    private void handleDrop(String reason) {
        if (closed.get()) return;

        int n = attempt.getAndIncrement();
        boolean willRetry = n < MAX_ATTEMPTS;
        nativeOnClosed(nativeHandle, reason, willRetry);

        if (!willRetry) return;

        socket = null;
        SCHEDULER.schedule(() -> { if (!closed.get()) connect(); },
                           BACKOFF_MS[Math.min(n, BACKOFF_MS.length - 1)],
                           TimeUnit.MILLISECONDS);
    }

    // -----------------------------------------------------------------------
    // Native callbacks — implemented in NetworkSocket_Android.cpp
    // -----------------------------------------------------------------------

    private static native void nativeOnOpen(long handle);
    private static native void nativeOnMessage(long handle, String text);
    private static native void nativeOnClosed(long handle, String reason, boolean willRetry);
}
