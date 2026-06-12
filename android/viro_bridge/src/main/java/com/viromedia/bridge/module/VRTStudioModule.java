package com.viromedia.bridge.module;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.reactvision.cca.RVHttpClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * VRTStudioModule
 *
 * Platform-independent React Native module for Studio scene/project fetching.
 * Unlike ARSceneNavigatorModule (which requires a live AR session and node handle),
 * this module reads credentials from AndroidManifest metadata and calls RVHttpClient
 * directly on a background thread — works on Quest (VR) and AR alike.
 *
 * JS usage (via VRTStudioModule.ts):
 *   NativeModules.VRTStudio.rvGetScene(sceneId) → Promise<{success, data?, error?}>
 *   NativeModules.VRTStudio.rvGetProject()      → Promise<{success, data?, error?}>
 *
 * The project ID is configured at build time by the Expo plugin and written to
 * AndroidManifest as `com.reactvision.RVProjectId`. JS does not pass it.
 */
public class VRTStudioModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME       = "VRTStudio";
    private static final String BASE_URL          = "https://platform.reactvision.xyz";
    private static final String API_KEY_META      = "com.reactvision.RVApiKey";
    private static final String PROJECT_ID_META   = "com.reactvision.RVProjectId";
    private static final int    TIMEOUT_SEC       = 30;
    private static final int    API_REQUEST_TIMEOUT_SEC = 40;

    public VRTStudioModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void rvGetScene(String sceneId, Promise promise) {
        String apiKey = readApiKey();
        if (apiKey == null) {
            resolve(promise, false, null, "com.reactvision.RVApiKey not set in AndroidManifest.xml");
            return;
        }
        String url = BASE_URL + "/functions/v1/scenes/" + encode(sceneId);
        runGet(url, apiKey, promise);
    }

    @ReactMethod
    public void rvGetProject(Promise promise) {
        String apiKey = readApiKey();
        if (apiKey == null) {
            resolve(promise, false, null, "com.reactvision.RVApiKey not set in AndroidManifest.xml");
            return;
        }
        String projectId = readMeta(PROJECT_ID_META);
        if (projectId == null) {
            resolve(promise, false, null, "com.reactvision.RVProjectId not set in AndroidManifest.xml");
            return;
        }
        String url = BASE_URL + "/functions/v1/projects/" + encode(projectId);
        runGet(url, apiKey, promise);
    }

    @ReactMethod
    public void rvGetProjectId(Promise promise) {
        promise.resolve(readMeta(PROJECT_ID_META));
    }

    /**
     * Executes a Studio API Request through the scene-api-request egress proxy.
     * JS sends the full request body ({"function_id", "variables"}) as a
     * pre-serialised string; native only transmits it.
     */
    @ReactMethod
    public void rvStudioApiRequest(String bodyJson, Promise promise) {
        String apiKey = readApiKey();
        if (apiKey == null) {
            resolve(promise, false, null, "com.reactvision.RVApiKey not set in AndroidManifest.xml");
            return;
        }
        String url = BASE_URL + "/functions/v1/scene-api-request";
        new Thread(() -> {
            try {
                String[] result = RVHttpClient.send(
                        "POST", url, apiKey,
                        "application/json",
                        bodyJson.getBytes(StandardCharsets.UTF_8),
                        API_REQUEST_TIMEOUT_SEC, null, null);
                int status = Integer.parseInt(result[0]);
                boolean ok = status >= 200 && status < 300;
                resolve(promise, ok, ok ? result[1] : null,
                        ok ? null : (result[2].isEmpty() ? result[1] : result[2]));
            } catch (Exception e) {
                resolve(promise, false, null, e.getMessage());
            }
        }).start();
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    private void runGet(String url, String apiKey, Promise promise) {
        new Thread(() -> {
            try {
                String[] result = RVHttpClient.send(
                        "GET", url, apiKey,
                        null, null,
                        TIMEOUT_SEC, null, null);
                int status = Integer.parseInt(result[0]);
                boolean ok = status >= 200 && status < 300;
                resolve(promise, ok, ok ? result[1] : null,
                        ok ? null : (result[2].isEmpty() ? result[1] : result[2]));
            } catch (Exception e) {
                resolve(promise, false, null, e.getMessage());
            }
        }).start();
    }

    private void resolve(Promise promise, boolean success, String data, String error) {
        WritableMap r = Arguments.createMap();
        r.putBoolean("success", success);
        if (success && data != null) r.putString("data", data);
        if (!success && error != null) r.putString("error", error);
        promise.resolve(r);
    }

    private String readApiKey() {
        return readMeta(API_KEY_META);
    }

    private String readMeta(String key) {
        try {
            ApplicationInfo ai = getReactApplicationContext()
                    .getPackageManager()
                    .getApplicationInfo(
                            getReactApplicationContext().getPackageName(),
                            PackageManager.GET_META_DATA);
            return ai.metaData != null ? ai.metaData.getString(key) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String encode(String s) {
        try {
            return URLEncoder.encode(s, StandardCharsets.UTF_8.name())
                    .replace("+", "%20");
        } catch (Exception e) {
            return s;
        }
    }
}
