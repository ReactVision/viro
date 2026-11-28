package com.viromedia.bridge.utility;

import android.util.Log;

/**
 * Verbose logging of controller input as it crosses the bridge, for finding where a
 * click is lost between the renderer and JavaScript. Off by default. Turn it on with
 *
 *   adb shell setprop log.tag.ViroInput VERBOSE
 *
 * and read it with `adb logcat -s ViroInput`.
 */
public final class ViroInputLog {
    public static final String TAG = "ViroInput";

    private ViroInputLog() {}

    public static boolean isEnabled() {
        return Log.isLoggable(TAG, Log.VERBOSE);
    }

    public static void v(String message) {
        if (Log.isLoggable(TAG, Log.VERBOSE)) {
            Log.v(TAG, message);
        }
    }
}
