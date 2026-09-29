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
    private final String[] initialHeaders;   // name, value, name, value

    private final OkHttpClient client;
    private final AtomicBoolean closed  = new AtomicBoolean(false);
    private final AtomicBoolean started = new AtomicBoolean(false);
    private final AtomicInteger attempt = new AtomicInteger(0);

    private volatile WebSocket socket;
    private volatile boolean   nativeHeadersLinked = true;

    public RVWebSocket(long nativeHandle, String url,
                       String[] headerNames, String[] headerValues) {
        this.nativeHandle   = nativeHandle;
        this.url            = url;
        this.initialHeaders = interleave(headerNames, headerValues);

        // No read timeout: an idle frame channel is normal — peers may be still.
        // OkHttp's own ping keeps the connection alive and detects a dead link.
        this.client = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .build();
    }

    public void connect() {
        if (closed.get()) return;

        // Native built the constructor's headers just before the first attempt.
        // A reconnect asks again, so a session token refreshed meanwhile is sent.
        String[] headers = started.getAndSet(true) ? reconnectHeaders() : initialHeaders;
        if (headers == null) return;   // the native socket is gone

        Request.Builder b = new Request.Builder().url(url);
        for (int i = 0; i + 1 < headers.length; i += 2) {
            if (headers[i] != null && headers[i + 1] != null) b.addHeader(headers[i], headers[i + 1]);
        }
        socket = client.newWebSocket(b.build(), this);
    }

    private String[] reconnectHeaders() {
        if (!nativeHeadersLinked) return initialHeaders;
        try {
            return nativeHeaders(nativeHandle);
        } catch (UnsatisfiedLinkError e) {
            // A libreactvisioncca older than nativeHeaders: keep the first headers
            // rather than let the retry task die and never reconnect.
            nativeHeadersLinked = false;
            return initialHeaders;
        }
    }

    private static String[] interleave(String[] names, String[] values) {
        if (names == null || values == null) return new String[0];
        int n = Math.min(names.length, values.length);
        String[] out = new String[n * 2];
        for (int i = 0; i < n; i++) {
            out[2 * i]     = names[i];
            out[2 * i + 1] = values[i];
        }
        return out;
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
        // Keyed on the reason, not the code: 1008 also carries rate-limited,
        // too-large and slow-consumer, and all three are meant to reconnect.
        // Only auth-revoked is the relay ending this session for good.
        handleDrop(reason == null || reason.isEmpty() ? ("closed " + code) : reason,
                   "auth-revoked".equals(reason));
    }

    @Override
    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
        int status = response == null ? 0 : response.code();
        String reason = t.getMessage() == null ? t.toString() : t.getMessage();
        if (status != 0) reason = reason + " (HTTP " + status + ")";
        handleDrop(reason, isTerminalStatus(status));
    }

    /**
     * A refusal is an answer, not a blip.
     *
     * The relay says 400 for a malformed room, 401 for an unknown key and 403
     * for the wrong project or an unpaid organisation, and every retry gets the
     * same answer 15.5 s later. Mirrors isTerminalStatus in NetworkSocket_iOS.mm.
     *
     * Deliberately not 404: during a relay deploy the platform's own router
     * answers 404 until the container is listening, so that one is exactly the
     * case where backing off and trying again is right.
     */
    private static boolean isTerminalStatus(int status) {
        return status == 400 || status == 401 || status == 403;
    }

    private void handleDrop(String reason, boolean terminal) {
        if (closed.get()) return;

        int n = attempt.getAndIncrement();
        boolean willRetry = !terminal && n < MAX_ATTEMPTS;
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
    private static native String[] nativeHeaders(long handle);
}
