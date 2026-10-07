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
import com.viro.core.ReactVisionAuth;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

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
    // BASE_URL's database region, sent as x-region so its edge functions run
    // beside the database instead of nearest the device. A session on another
    // base URL is pinned only when it brings its own functionRegion.
    private static final String FUNCTION_REGION   = "eu-west-2";
    private static final String API_KEY_META      = "com.reactvision.RVApiKey";
    private static final String PROJECT_ID_META   = "com.reactvision.RVProjectId";
    private static final int    TIMEOUT_SEC       = 30;
    private static final int    API_REQUEST_TIMEOUT_SEC = 40;

    // @internal session auth for first-party apps (e.g. StudioGo). When set, the
    // fetch methods target this base URL with Authorization: Bearer + x-rv-client
    // and send NO x-api-key, so the server's resolveApiAuth takes the JWT path.
    // Immutable snapshot captured per call before spawning the worker thread.
    private static volatile StudioSession studioSession = null;

    private static final class StudioSession {
        final String baseUrl;
        final String accessToken;
        final String clientTag; // nullable
        final String functionRegion; // nullable
        StudioSession(String baseUrl, String accessToken, String clientTag, String functionRegion) {
            this.baseUrl = baseUrl;
            this.accessToken = accessToken;
            this.clientTag = clientTag;
            this.functionRegion = functionRegion;
        }
    }

    // Transport params for the active auth mode (see resolveAuth).
    private static final class RequestAuth {
        final String baseUrl;
        final String apiKey;         // null in session mode
        final String[] headerNames;  // the credential in session mode, plus x-region when one resolves
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

    // @internal True while a first-party session is set (see studioSession).
    public static boolean hasStudioSession() {
        return studioSession != null;
    }

    // @internal — sets/clears the first-party session auth (see studioSession).
    // A map { baseUrl, accessToken, clientTag?, functionRegion? } enables session mode; null /
    // malformed reverts to manifest RVApiKey mode. The renderer keeps its own
    // copy, which cloud anchors and the co-location channel read.
    @ReactMethod
    public void rvSetStudioSession(ReadableMap config, Promise promise) {
        String baseUrl = config != null && config.hasKey("baseUrl")
                ? config.getString("baseUrl") : null;
        String accessToken = config != null && config.hasKey("accessToken")
                ? config.getString("accessToken") : null;
        if (baseUrl == null || baseUrl.isEmpty() || accessToken == null || accessToken.isEmpty()) {
            studioSession = null;
            pushSessionToRenderer(null);
            promise.resolve(null);
            return;
        }
        while (baseUrl.endsWith("/")) baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        String clientTag = config.hasKey("clientTag") ? config.getString("clientTag") : null;
        String functionRegion = config.hasKey("functionRegion") && !config.isNull("functionRegion")
                ? config.getString("functionRegion") : null;
        StudioSession session = new StudioSession(baseUrl, accessToken, clientTag, functionRegion);
        studioSession = session;
        pushSessionToRenderer(session);
        promise.resolve(null);
    }

    // @internal Credentials for JS clients that talk to the platform or the
    // relay directly: { mode, baseUrl, headers, projectId }, projectId being the
    // manifest RVProjectId in every mode.
    @ReactMethod
    public void rvGetAuthHeaders(Promise promise) {
        RequestAuth auth = resolveAuth();
        WritableMap headers = Arguments.createMap();
        WritableMap r = Arguments.createMap();
        if (auth == null) {
            r.putString("mode", "none");
            r.putNull("baseUrl");
        } else {
            r.putString("mode", auth.apiKey != null ? "api_key" : "session");
            r.putString("baseUrl", auth.baseUrl);
            if (auth.apiKey != null) headers.putString("x-api-key", auth.apiKey);
            for (int i = 0; i < auth.headerNames.length; i++) {
                headers.putString(auth.headerNames[i], auth.headerValues[i]);
            }
        }
        r.putMap("headers", headers);
        String projectId = readMeta(PROJECT_ID_META);
        if (projectId != null) r.putString("projectId", projectId);
        else r.putNull("projectId");
        promise.resolve(r);
    }

    // @internal Project the ReactVision cloud anchor provider files anchors
    // under, overriding RVProjectId. null or empty clears the override.
    @ReactMethod
    public void rvSetCloudAnchorProject(String projectId, Promise promise) {
        try {
            ReactVisionAuth.setProjectId(projectId);
        } catch (Throwable ignored) {
            // See pushSessionToRenderer.
        }
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
                String[] result = send(
                        "POST", url, auth,
                        "application/json",
                        bodyJson.getBytes(StandardCharsets.UTF_8),
                        API_REQUEST_TIMEOUT_SEC);
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
                String[] result = send("GET", url, auth, null, null, TIMEOUT_SEC);
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

    // What the gateway answers when it never reached a function. With a non-JSON
    // body (every platform function answers JSON) nothing ran, so a resend cannot
    // run a request twice. 500, 504, 520, 524 and 546 are left out: a function may
    // have run before any of them.
    private static boolean undelivered(String status, String body) {
        switch (status) {
            case "502": case "503": case "521": case "522": case "523": case "525": case "526": case "530":
                return body == null || !body.trim().startsWith("{");
            default:
                return false;
        }
    }

    // The platform does not fail a pinned region over, so an undelivered pinned
    // request is sent once more without x-region.
    private static String[] send(String method, String url, RequestAuth auth,
                                 String contentType, byte[] body, int timeoutSec) {
        String[] result = RVHttpClient.send(method, url, auth.apiKey, contentType, body,
                timeoutSec, auth.headerNames, auth.headerValues);
        int region = Arrays.asList(auth.headerNames).indexOf("x-region");
        if (region < 0 || !undelivered(result[0], result[1])) return result;
        List<String> names  = new ArrayList<>(Arrays.asList(auth.headerNames));
        List<String> values = new ArrayList<>(Arrays.asList(auth.headerValues));
        names.remove(region);
        values.remove(region);
        return RVHttpClient.send(method, url, auth.apiKey, contentType, body, timeoutSec,
                names.toArray(new String[0]), values.toArray(new String[0]));
    }

    // Session (if set) wins over the manifest key: sends Bearer + optional marker
    // with apiKey=null so RVHttpClient omits x-api-key and the server takes the
    // JWT path. Returns null when neither a session nor a manifest key exists.
    private RequestAuth resolveAuth() {
        StudioSession session = studioSession;
        if (session != null) {
            List<String> names  = new ArrayList<>();
            List<String> values = new ArrayList<>();
            names.add("Authorization");
            values.add("Bearer " + session.accessToken);
            if (session.clientTag != null && !session.clientTag.isEmpty()) {
                names.add("x-rv-client");
                values.add(session.clientTag);
            }
            String region = session.functionRegion;
            if ((region == null || region.isEmpty()) && BASE_URL.equals(session.baseUrl)) {
                region = FUNCTION_REGION;
            }
            if (region != null && !region.isEmpty()) {
                names.add("x-region");
                values.add(region);
            }
            return new RequestAuth(session.baseUrl, null,
                    names.toArray(new String[0]), values.toArray(new String[0]));
        }
        String apiKey = readApiKey();
        if (apiKey == null) return null;
        return new RequestAuth(BASE_URL, apiKey,
                new String[]{"x-region"}, new String[]{FUNCTION_REGION});
    }

    // Throwable, not Exception: a missing renderer library surfaces as
    // UnsatisfiedLinkError or NoClassDefFoundError, and the JS-side session must
    // still work for the fetch methods above.
    private static void pushSessionToRenderer(StudioSession session) {
        try {
            if (session == null) {
                ReactVisionAuth.clearSession();
            } else {
                ReactVisionAuth.setSession(session.baseUrl, session.accessToken, session.clientTag,
                        session.functionRegion);
            }
        } catch (Throwable ignored) {
        }
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
            String v = ai.metaData != null ? ai.metaData.getString(key) : null;
            return (v != null && !v.isEmpty()) ? v : null;
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
