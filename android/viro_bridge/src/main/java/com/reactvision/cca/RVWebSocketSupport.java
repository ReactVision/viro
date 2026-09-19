// Copyright © 2026 ReactVision. All rights reserved.
// Proprietary and Confidential
//
// Availability probe for RVWebSocket, deliberately kept in its own class.
//
// RVWebSocket references okhttp3 types directly. Loading it on a runtime where
// OkHttp is absent risks NoClassDefFoundError during verification, so the check
// cannot live there — this class touches nothing but Class.forName.
//
// OkHttp is a compileOnly dependency: React Native ships it on Android, so it is
// present in every real consumer, but the standalone AAR must not force it.
//
// CANONICAL COPY. Vendored verbatim into viro's viro_bridge alongside
// RVHttpClient — edit here, then re-copy.

package com.reactvision.cca;

public final class RVWebSocketSupport {

    private RVWebSocketSupport() {}

    private static Boolean cached;

    /** True when OkHttp is on the runtime classpath and RVWebSocket can be used. */
    public static synchronized boolean isAvailable() {
        if (cached != null) return cached;
        try {
            Class.forName("okhttp3.OkHttpClient");
            cached = Boolean.TRUE;
        } catch (Throwable t) {
            cached = Boolean.FALSE;
        }
        return cached;
    }
}
