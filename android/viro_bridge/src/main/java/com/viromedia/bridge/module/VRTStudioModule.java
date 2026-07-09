package com.viromedia.bridge.module;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
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

    // @internal session auth for first-party apps. When set, the fetch methods
    // target this base URL with Authorization: Bearer + x-rv-client and send NO
    // x-api-key, so the server's resolveApiAuth takes the JWT path.
    // Immutable snapshot captured per call before spawning the worker thread.
    private static volatile StudioSession studioSession = null;

    private static final class StudioSession {
        final String baseUrl;
        final String accessToken;
        final String clientTag; // nullable
        StudioSession(String baseUrl, String accessToken, String clientTag) {
            this.baseUrl = baseUrl;
            this.accessToken = accessToken;
            this.clientTag = clientTag;
        }
    }

    // Transport params for the active auth mode (see resolveAuth).
    private static final class RequestAuth {
        final String baseUrl;
        final String apiKey;         // null in session mode
        final String[] headerNames;  // null in api-key mode
        final String[] headerValues;
        RequestAuth(String baseUrl, String apiKey, String[] headerNames, String[] headerValues) {
            this.baseUrl = baseUrl;
            this.apiKey = apiKey;
            this.headerNames = headerNames;
            this.headerValues = headerValues;
        }
    }

    public VRTStudioModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void rvGetScene(String sceneId, Promise promise) {
        RequestAuth auth = resolveAuth();
        if (auth == null) {
            resolve(promise, false, null, "com.reactvision.RVApiKey not set in AndroidManifest.xml");
            return;
        }
        String url = auth.baseUrl + "/functions/v1/scenes/" + encode(sceneId);
        // Watermark applies only to API-key (SDK) consumers; session auth is
        // exempt. Native-gated so a JS consumer can't strip it or opt in.
        runGet(url, auth, promise, auth.apiKey != null);
    }

    @ReactMethod
    public void rvGetProject(Promise promise) {
        RequestAuth auth = resolveAuth();
        if (auth == null) {
            resolve(promise, false, null, "com.reactvision.RVApiKey not set in AndroidManifest.xml");
            return;
        }
        String projectId = readMeta(PROJECT_ID_META);
        if (projectId == null) {
            resolve(promise, false, null, "com.reactvision.RVProjectId not set in AndroidManifest.xml");
            return;
        }
        String url = auth.baseUrl + "/functions/v1/projects/" + encode(projectId);
        runGet(url, auth, promise, false);
    }

    @ReactMethod
    public void rvGetProjectId(Promise promise) {
        promise.resolve(readMeta(PROJECT_ID_META));
    }

    // @internal — sets/clears the first-party session auth (see studioSession).
    // A map { baseUrl, accessToken, clientTag? } enables session mode; null /
    // malformed reverts to manifest RVApiKey mode.
    @ReactMethod
    public void rvSetStudioSession(ReadableMap config, Promise promise) {
        String baseUrl = config != null && config.hasKey("baseUrl")
                ? config.getString("baseUrl") : null;
        String accessToken = config != null && config.hasKey("accessToken")
                ? config.getString("accessToken") : null;
        if (baseUrl == null || baseUrl.isEmpty() || accessToken == null || accessToken.isEmpty()) {
            studioSession = null;
            promise.resolve(null);
            return;
        }
        while (baseUrl.endsWith("/")) baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        String clientTag = config.hasKey("clientTag") ? config.getString("clientTag") : null;
        studioSession = new StudioSession(baseUrl, accessToken, clientTag);
        promise.resolve(null);
    }

    /**
     * Executes a Studio API Request through the scene-api-request egress proxy.
     * JS sends the full request body ({"function_id", "variables"}) as a
     * pre-serialised string; native only transmits it.
     */
    @ReactMethod
    public void rvStudioApiRequest(String bodyJson, Promise promise) {
        RequestAuth auth = resolveAuth();
        if (auth == null) {
            resolve(promise, false, null, "com.reactvision.RVApiKey not set in AndroidManifest.xml");
            return;
        }
        String url = auth.baseUrl + "/functions/v1/scene-api-request";
        new Thread(() -> {
            try {
                String[] result = RVHttpClient.send(
                        "POST", url, auth.apiKey,
                        "application/json",
                        bodyJson.getBytes(StandardCharsets.UTF_8),
                        API_REQUEST_TIMEOUT_SEC, auth.headerNames, auth.headerValues);
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

    private void runGet(String url, RequestAuth auth, Promise promise, boolean parseWatermark) {
        new Thread(() -> {
            try {
                String[] result = RVHttpClient.send(
                        "GET", url, auth.apiKey,
                        null, null,
                        TIMEOUT_SEC, auth.headerNames, auth.headerValues);
                int status = Integer.parseInt(result[0]);
                boolean ok = status >= 200 && status < 300;
                if (parseWatermark && ok) {
                    RVStudioWatermarkState.getInstance().updateFromSceneJson(result[1]);
                }
                resolve(promise, ok, ok ? result[1] : null,
                        ok ? null : (result[2].isEmpty() ? result[1] : result[2]));
            } catch (Exception e) {
                resolve(promise, false, null, e.getMessage());
            }
        }).start();
    }

    // Session (if set) wins over the manifest key: sends Bearer + optional marker
    // with apiKey=null so RVHttpClient omits x-api-key and the server takes the
    // JWT path. Returns null when neither a session nor a manifest key exists.
    private RequestAuth resolveAuth() {
        StudioSession session = studioSession;
        if (session != null) {
            String[] names;
            String[] values;
            if (session.clientTag != null && !session.clientTag.isEmpty()) {
                names  = new String[]{"Authorization", "x-rv-client"};
                values = new String[]{"Bearer " + session.accessToken, session.clientTag};
            } else {
                names  = new String[]{"Authorization"};
                values = new String[]{"Bearer " + session.accessToken};
            }
            return new RequestAuth(session.baseUrl, null, names, values);
        }
        String apiKey = readApiKey();
        if (apiKey == null) return null;
        return new RequestAuth(BASE_URL, apiKey, null, null);
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
