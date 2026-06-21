"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withViroAndroid = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const insertLinesHelper_1 = require("./util/insertLinesHelper");
let viroPluginConfig = ["AR", "GVR"];
const withBranchAndroid = (config) => {
    // Directly edit MainApplication.java
    return (0, config_plugins_1.withDangerousMod)(config, [
        "android",
        async (config) => {
            let mainApplicationPath = "";
            let isJava;
            const mainApplicationPrefix = path_1.default.join(config.modRequest.platformProjectRoot, "app", "src", "main", "java", ...(config?.android?.package?.split?.(".") || []));
            const mainApplicationPathJava = path_1.default.join(mainApplicationPrefix, "MainApplication.java");
            const mainApplicationPathKotlin = path_1.default.join(mainApplicationPrefix, "MainApplication.kt");
            if (fs_1.default.existsSync(mainApplicationPathJava)) {
                isJava = true;
                mainApplicationPath = mainApplicationPathJava;
            }
            else if (fs_1.default.existsSync(mainApplicationPathKotlin)) {
                isJava = false;
                mainApplicationPath = mainApplicationPathKotlin;
            }
            else {
                throw new Error("MainApplication.kt or MainApplication.java file not found.");
            }
            fs_1.default.readFile(mainApplicationPath, "utf-8", (err, data) => {
                const packageName = config?.android?.package;
                if (isJava) {
                    data = (0, insertLinesHelper_1.insertLinesHelper)("import com.viromedia.bridge.ReactViroPackage;", `package ${packageName};`, data);
                }
                else {
                    // Handle Backticks in package names for Kotlin
                    const packageMatch = data.match(/package\s+[\w.`]+/);
                    if (!packageMatch) {
                        throw new Error("Package declaration not found in MainApplication.kt");
                    }
                    data = (0, insertLinesHelper_1.insertLinesHelper)("import com.viromedia.bridge.ReactViroPackage", packageMatch[0], data);
                }
                const viroPlugin = config?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
                if (Array.isArray(viroPlugin)) {
                    if (Array.isArray(viroPlugin[1].android?.xRMode)) {
                        viroPluginConfig = (viroPlugin[1].android?.xRMode).filter((mode) => ["AR", "GVR", "OVR_MOBILE", "QUEST"].includes(mode));
                    }
                    else if (["AR", "GVR", "OVR_MOBILE", "QUEST"].includes(viroPlugin[1]?.android?.xRMode)) {
                        viroPluginConfig = [viroPlugin[1]?.android.xRMode];
                    }
                }
                let target = "";
                for (const viroConfig of viroPluginConfig) {
                    if (isJava) {
                        target =
                            target +
                                `      packages.add(new ReactViroPackage(ReactViroPackage.ViroPlatform.${viroConfig}))\n`;
                    }
                    else {
                        // Use proper Kotlin syntax for newer formats
                        target =
                            target +
                                `            add(ReactViroPackage(ReactViroPackage.ViroPlatform.${viroConfig}))\n`;
                    }
                }
                if (isJava) {
                    data = (0, insertLinesHelper_1.insertLinesHelper)(target, "List<ReactPackage> packages = new PackageList(this).getPackages();", data);
                }
                else {
                    // Handle various MainApplication.kt formats
                    if (data.includes("// packages.add(new MyReactNativePackage());")) {
                        data = (0, insertLinesHelper_1.insertLinesHelper)(target, "// packages.add(new MyReactNativePackage());", data);
                    }
                    else if (data.includes("// add(MyReactNativePackage())")) {
                        data = (0, insertLinesHelper_1.insertLinesHelper)(target, "// add(MyReactNativePackage())", data);
                    }
                    else if (data.includes("// packages.add(MyReactNativePackage())")) {
                        // Handle newer Expo format: // packages.add(MyReactNativePackage())
                        data = (0, insertLinesHelper_1.insertLinesHelper)(target, "// packages.add(MyReactNativePackage())", data);
                    }
                    else if (data.includes("val packages = PackageList(this).packages")) {
                        // Handle newer format where packages is declared as val
                        data = (0, insertLinesHelper_1.insertLinesHelper)(target, "val packages = PackageList(this).packages", data);
                    }
                    else {
                        throw new Error("Unable to insert Android packages into package list. Please create a new issue on GitHub and reference this message! " +
                            "Expected to find one of: '// packages.add(new MyReactNativePackage());', '// add(MyReactNativePackage())', " +
                            "'// packages.add(MyReactNativePackage())', or 'val packages = PackageList(this).packages'");
                    }
                }
                fs_1.default.writeFile(mainApplicationPath, data, "utf-8", function (err) {
                    if (err)
                        console.log("Error writing MainApplication.java");
                });
            });
            return config;
        },
    ]);
};
const withViroProjectBuildGradle = (config) => (0, config_plugins_1.withProjectBuildGradle)(config, async (newConfig) => {
    newConfig.modResults.contents = newConfig.modResults.contents.replace(/minSdkVersion.*/, `minSdkVersion = 24`);
    // Ensure New Architecture is enabled
    //if (!newConfig.modResults.contents.includes("newArchEnabled=true")) {
    //  newConfig.modResults.contents +=
    //    "\n// ViroReact requires New Architecture\nnewArchEnabled=true\n";
    //}
    newConfig.modResults.contents = newConfig.modResults.contents.replace(/classpath\("com.android.tools.build:gradle.*/, `classpath('com.android.tools.build:gradle:4.1.1')`);
    return newConfig;
});
const withViroAppBuildGradle = (config) => (0, config_plugins_1.withAppBuildGradle)(config, async (config) => {
    // ViroReact New Architecture (Fabric) Dependencies
    const viroNewArchDependencies = `
    // ========================================================================
    // ViroReact New Architecture (Fabric) Dependencies
    // https://viro-community.readme.io/docs/installation-instructions
    implementation project(':gvr_common')
    implementation project(':arcore_client')
    implementation project(path: ':react_viro')
    implementation project(path: ':viro_renderer')
    implementation 'androidx.media3:media3-exoplayer:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-dash:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-hls:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-smoothstreaming:1.1.1'
    implementation 'com.google.protobuf.nano:protobuf-javanano:3.1.0'
    // Required for ARCore Geospatial API
    implementation 'com.google.android.gms:play-services-location:21.0.1'
    // ========================================================================`;
    // Add Viro dependencies for legacy architecture (fallback)
    config.modResults.contents = config.modResults.contents.replace(/implementation "com.facebook.react:react-native:\+"  \/\/ From node_modules/, `implementation "com.facebook.react:react-native:+"  // From node_modules${viroNewArchDependencies}`);
    // Add Viro dependencies for new architecture (primary)
    config.modResults.contents = config.modResults.contents.replace(/implementation\("com.facebook.react:react-android"\)/, `implementation("com.facebook.react:react-android")${viroNewArchDependencies}`);
    return config;
});
const withViroSettingsGradle = (config) => (0, config_plugins_1.withSettingsGradle)(config, async (config) => {
    config.modResults.contents += `
include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'
project(':arcore_client').projectDir = new File('../node_modules/@reactvision/react-viro/android/arcore_client')
project(':gvr_common').projectDir = new File('../node_modules/@reactvision/react-viro/android/gvr_common')
project(':viro_renderer').projectDir = new File('../node_modules/@reactvision/react-viro/android/viro_renderer')
project(':react_viro').projectDir = new File('../node_modules/@reactvision/react-viro/android/react_viro')
    `;
    return config;
});
const withViroManifest = (config) => (0, config_plugins_1.withAndroidManifest)(config, async (newConfig) => {
    const contents = newConfig.modResults;
    contents.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    // Initialize meta-data array if it doesn't exist
    if (!contents?.manifest?.application?.[0]["meta-data"]) {
        contents.manifest.application[0]["meta-data"] = [];
    }
    contents?.manifest?.application?.[0]["meta-data"]?.push({
        $: {
            "android:name": "com.google.ar.core",
            "android:value": "optional",
        },
    });
    // Add Google Cloud API key for ARCore Cloud Anchors and Geospatial API if configured
    const viroPlugin = config?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
    if (Array.isArray(viroPlugin) && viroPlugin.length > 1) {
        const pluginOptions = viroPlugin[1];
        // Resolve unified provider prop; old geospatialAnchorProvider overrides for backward compat.
        // Default to "reactvision" only when rvApiKey is present (implies RV intent) but provider
        // is not explicitly set — avoids injecting location permissions for apps with no credentials.
        const legacyOpts = pluginOptions;
        const geospatialAnchorProvider = legacyOpts.geospatialAnchorProvider
            ?? pluginOptions.provider
            ?? (pluginOptions.rvApiKey ? "reactvision" : undefined);
        if (pluginOptions.googleCloudApiKey) {
            contents?.manifest?.application?.[0]["meta-data"]?.push({
                $: {
                    "android:name": "com.google.android.ar.API_KEY",
                    "android:value": pluginOptions.googleCloudApiKey,
                },
            });
        }
        if (pluginOptions.rvApiKey) {
            contents?.manifest?.application?.[0]["meta-data"]?.push({
                $: {
                    "android:name": "com.reactvision.RVApiKey",
                    "android:value": pluginOptions.rvApiKey,
                },
            });
        }
        if (pluginOptions.rvProjectId) {
            contents?.manifest?.application?.[0]["meta-data"]?.push({
                $: {
                    "android:name": "com.reactvision.RVProjectId",
                    "android:value": pluginOptions.rvProjectId,
                },
            });
        }
        if (pluginOptions.rvEndpoint) {
            contents?.manifest?.application?.[0]["meta-data"]?.push({
                $: {
                    "android:name": "com.reactvision.RVEndpoint",
                    "android:value": pluginOptions.rvEndpoint,
                },
            });
        }
        // Add location permissions when geospatial provider is active
        if (geospatialAnchorProvider === "arcore" || geospatialAnchorProvider === "reactvision") {
            const existingPermissions = (contents.manifest["uses-permission"] || [])
                .map((p) => p.$?.["android:name"]);
            if (!existingPermissions.includes("android.permission.ACCESS_FINE_LOCATION")) {
                contents.manifest["uses-permission"].push({
                    $: { "android:name": "android.permission.ACCESS_FINE_LOCATION" },
                });
            }
            if (!existingPermissions.includes("android.permission.ACCESS_COARSE_LOCATION")) {
                contents.manifest["uses-permission"].push({
                    $: { "android:name": "android.permission.ACCESS_COARSE_LOCATION" },
                });
            }
        }
    }
    // Derive active XR modes from the config at apply-time.
    // `viroPluginConfig` (module-level) is updated by withBranchAndroid's
    // withDangerousMod callback, which runs *after* withAndroidManifest
    // callbacks — so it is still ["AR","GVR"] here. Read from config.plugins
    // directly instead.
    const activeXrModes = (() => {
        const p = (newConfig.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
        if (Array.isArray(p) && p[1]?.android?.xRMode) {
            const xrMode = p[1].android.xRMode;
            return Array.isArray(xrMode) ? xrMode : [xrMode];
        }
        return viroPluginConfig;
    })();
    if (activeXrModes.includes("GVR") ||
        activeXrModes.includes("OVR_MOBILE")) {
        contents?.manifest?.application?.[0]?.activity[0]["intent-filter"][0].category.push({
            $: {
                "android:name": "com.google.intent.category.CARDBOARD",
            },
        });
        contents?.manifest?.application?.[0]?.activity[0]["intent-filter"][0].category.push({
            $: {
                "android:name": "com.google.intent.category.DAYDREAM",
            },
        });
    }
    // android.permission.SYSTEM_ALERT_WINDOW is merged in from React Native's
    // debug manifest and is rejected by the Meta Quest Store.
    if (contents.manifest["uses-permission"]) {
        contents.manifest["uses-permission"] = contents.manifest["uses-permission"].filter((p) => p.$?.["android:name"] !== "android.permission.SYSTEM_ALERT_WINDOW");
    }
    contents.manifest.queries = [
        {
            package: [
                {
                    $: {
                        "android:name": "com.google.ar.core",
                    },
                },
            ],
        },
    ];
    contents.manifest["uses-feature"] = [];
    contents.manifest["uses-permission"].push({
        $: {
            "android:name": "android.permission.CAMERA",
        },
    });
    contents.manifest["uses-feature"].push({
        $: {
            "android:name": "android.hardware.camera",
        },
    });
    contents.manifest["uses-feature"].push({
        $: {
            "android:name": "android.hardware.camera.autofocus",
            "android:required": "false",
            "tools:replace": "required",
        },
    });
    // Keep GLES 3.0 declared (required=false) so the Quest Store validator
    // sees a graphics API. Previously tools:node="remove" silently stripped
    // this entry from the merged manifest entirely.
    contents.manifest["uses-feature"].push({
        $: {
            "android:glEsVersion": "0x00030000",
            "android:required": "false",
            "tools:replace": "required",
        },
    });
    contents.manifest["uses-feature"].push({
        $: {
            "android:name": "android.hardware.sensor.accelerometer",
            "android:required": "false",
            "tools:replace": "required",
        },
    });
    contents.manifest["uses-feature"].push({
        $: {
            "android:name": "android.hardware.sensor.gyroscope",
            "android:required": "false",
            "tools:replace": "required",
        },
    });
    // Quest-specific features and permissions — after uses-feature is initialized
    if (activeXrModes.includes("QUEST")) {
        contents.manifest["uses-feature"].push({
            $: {
                "android:name": "android.hardware.vr.headtracking",
                "android:required": "true",
                "android:version": "1",
            },
        });
        contents.manifest["uses-feature"].push({
            $: {
                "android:name": "oculus.software.handtracking",
                "android:required": "false",
            },
        });
        // XR_FB_passthrough requires this uses-feature; without it the OpenXR
        // runtime silently strips the extension. required=false so apps that
        // only render fully-virtual scenes still install on Quest 2 etc.
        contents.manifest["uses-feature"].push({
            $: {
                "android:name": "com.oculus.feature.PASSTHROUGH",
                "android:required": "false",
            },
        });
        // Required when com.oculus.permission.EYE_TRACKING is declared.
        contents.manifest["uses-feature"].push({
            $: {
                "android:name": "oculus.software.eye_tracking",
                "android:required": "false",
            },
        });
        const existingPermissions = (contents.manifest["uses-permission"] || [])
            .map((p) => p.$?.["android:name"]);
        if (!existingPermissions.includes("com.oculus.permission.HAND_TRACKING")) {
            contents.manifest["uses-permission"].push({
                $: { "android:name": "com.oculus.permission.HAND_TRACKING" },
            });
        }
        if (!existingPermissions.includes("com.oculus.permission.EYE_TRACKING")) {
            contents.manifest["uses-permission"].push({
                $: { "android:name": "com.oculus.permission.EYE_TRACKING" },
            });
        }
    }
    return newConfig;
});
// ── Quest VRActivity generation ────────────────────────────────────────────────
/**
 * When QUEST mode is active, generate VRActivity.kt in the app's android source
 * and register it in AndroidManifest with com.oculus.intent.category.VR.
 *
 * VRActivity is a ReactActivity that mounts "VRQuestScene" — a root component
 * the app must register via AppRegistry. Running in a separate Activity with the
 * VR intent category causes Horizon OS to grant exclusive OpenXR display access.
 */
const withViroQuestActivity = (config, props) => {
    // Read xRMode directly from config.plugins. We cannot rely on the
    // module-level `viroPluginConfig` here: that variable is only updated
    // when `withBranchAndroid`'s withDangerousMod callback runs (mod-apply
    // time), which is *after* this chain-time check executes. On the first
    // prebuild of a new project, viroPluginConfig still holds the default
    // ["AR", "GVR"] when this plugin is composed, and QUEST mods would be
    // silently skipped — no VRActivity.kt and no manifest entry.
    const viroPluginEntry = config?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
    let xrModes = ["AR", "GVR"];
    if (Array.isArray(viroPluginEntry)) {
        const xrMode = viroPluginEntry[1]?.android?.xRMode;
        if (Array.isArray(xrMode)) {
            xrModes = xrMode.filter((m) => ["AR", "GVR", "OVR_MOBILE", "QUEST"].includes(m));
        }
        else if (typeof xrMode === "string" &&
            ["AR", "GVR", "OVR_MOBILE", "QUEST"].includes(xrMode)) {
            xrModes = [xrMode];
        }
    }
    if (!xrModes.includes("QUEST"))
        return config;
    // 1. Generate VRActivity.kt
    config = (0, config_plugins_1.withDangerousMod)(config, [
        "android",
        async (config) => {
            const packageName = config?.android?.package ?? "";
            const packagePath = packageName.split(".");
            const activityDir = path_1.default.join(config.modRequest.platformProjectRoot, "app", "src", "main", "java", ...packagePath);
            if (!fs_1.default.existsSync(activityDir)) {
                fs_1.default.mkdirSync(activityDir, { recursive: true });
            }
            const activityPath = path_1.default.join(activityDir, "VRActivity.kt");
            // Only write if not already present (preserve manual edits)
            if (!fs_1.default.existsSync(activityPath)) {
                const kotlinContent = `package ${packageName}

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.runtime.ReactHostImpl

/**
 * VRActivity — generated by @reactvision/react-viro Expo plugin.
 * Carries com.oculus.intent.category.VR so Horizon OS grants exclusive
 * OpenXR display access. Mounts the "VRQuestScene" React root component.
 * Launch via NativeModules.VRLauncher.launchVRScene().
 *
 * Lifecycle (requires React Native >= 0.83 / Expo >= 55):
 *   VRActivity and MainActivity share one ReactHostImpl singleton. On Quest,
 *   VRActivity launches into a separate task (FLAG_ACTIVITY_NEW_TASK), so
 *   MainActivity.onPause is dispatched *later* via ActivityManager IPC —
 *   often after VRActivity.onResume has already promoted the host to RESUMED
 *   with currentActivity = VRActivity. When that delayed onPause arrives,
 *   the standard delegate calls onHostPause(MainActivity); the identity-
 *   mismatch assertion is downgraded to a warning by
 *   skipActivityIdentityAssertionOnHostPause (set in VRLauncherModule before
 *   startActivity), but the rest of onHostPause runs unconditionally:
 *   devSupport is disabled and JavaTimerManager clears its TIMERS_EVENTS
 *   callback. Result: timers / requestAnimationFrame stop, Metro Fast Refresh
 *   dies.
 *
 *   We catch this by listening for that delayed MainActivity.onPause via
 *   Application.ActivityLifecycleCallbacks.onActivityPaused(other) and re-
 *   promoting the host on the main looper. A Handler.post inside our own
 *   onResume would fire too early (the ActivityManager hasn't queued
 *   MainActivity.onPause yet), which is why we hook the actual pause event.
 *
 *   On exit, VRActivity.onPause runs while currentActivity == this, so the
 *   identity assertion passes; MainActivity.onResume then re-promotes via
 *   its standard delegate. We do *not* re-promote on a self-pause — the
 *   onActivityPaused callback skips when other === this.
 *
 * Mutual exclusion with MainActivity:
 *   Quest will happily run MainActivity (panel) and VRActivity (immersive) at
 *   the same time if the user taps the app icon in the dock while VR is
 *   running. The same Application.ActivityLifecycleCallbacks finishes self
 *   when any other Activity in this app resumes — returning the user cleanly
 *   to the panel.
 *
 * Surface cleanup on destroy:
 *   When VRActivity is destroyed we unload its React surface (reactSurface.stop()
 *   in bridgeless arch) so its component tree — including all VRT* components
 *   — is unmounted. Without this, the React surface stayed alive in the shared
 *   ReactHost across VR re-entries, and on the second/third VR launch each
 *   stale surface remounted alongside the fresh one. The C++ scene-graph
 *   resolves a click hit to a single viewTag, but multiple VRTComponents
 *   claimed it across surfaces — most with a ReactContext bound to a
 *   destroyed VRActivity. Click events to the stale ReactContexts crashed in
 *   ComponentEventDelegate as IllegalArgumentException SoftExceptions and were
 *   silently dropped, so onClick took dozens of presses to register.
 *   We still no-op the *delegate* onDestroy() so MainActivity keeps its
 *   ReactHost; we only stop the surface explicitly.
 */
class VRActivity : ReactActivity() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var lifecycleCallbacks: Application.ActivityLifecycleCallbacks? = null

    // Set true on every VRActivity.onResume; consumed by the first
    // onActivityPaused(other) that follows. One-shot — defends against the
    // single MainActivity.onPause that the NEW_TASK ordering schedules late.
    // Without one-shot semantics, every subsequent foreign pause would re-fire
    // ReactHostImpl.onHostResume, which re-fires every LifecycleEventListener
    // (AppState → "active" → ViroXRSceneNavigator's AppState handler calls
    // launchVRScene() again → visible scene flicker).
    private var expectingForeignPause = false

    override fun getMainComponentName(): String = "VRQuestScene"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            // VRActivity destruction MUST NOT tear down the shared ReactHost.
            // MainActivity is still alive (and re-foreground after VR exit) and
            // depends on the same ReactContext. The standard delegate's
            // onDestroy forwards to ReactHostImpl.onHostDestroy(VR), which
            // fires LifecycleEventListener.onHostDestroy on every native module
            // — releasing native resources MainActivity still uses. The next
            // Cmd+R reload then runs the JS bundle re-init against a partially
            // destroyed native side and fails with
            //   [runtime not ready]: TypeError: Cannot read property
            //   'EventEmitter' of undefined
            // followed by AppRegistryBinding::stopSurface failed and the
            // surface never recovers. By no-op'ing onDestroy here, host
            // destruction is left to MainActivity's standard delegate (the real
            // last activity). The surface itself is stopped explicitly in
            // VRActivity.onDestroy() below.
            override fun onDestroy() {
                // intentionally no-op — see comment above
            }
        }

    override fun onResume() {
        super.onResume()  // delegate.onResume() -> reactHost.onHostResume(this)
        expectingForeignPause = true
    }

    // onPause not overridden: the default delegate forwards to
    // reactHost.onHostPause(this) while currentActivity matches us, which is
    // what we want.

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val callbacks = object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(other: Activity) {
                if (other !== this@VRActivity && !isFinishing && !isDestroyed) {
                    finish()
                }
            }
            override fun onActivityPaused(other: Activity) {
                if (other === this@VRActivity || isFinishing || isDestroyed) return
                if (!expectingForeignPause) return
                expectingForeignPause = false
                // MainActivity.onPause was dispatched after our onResume (the
                // NEW_TASK race). The standard delegate already called
                // onHostPause(MainActivity), demoting the host to PAUSED and
                // disabling devSupport / clearing JavaTimerManager's frame
                // callback. Re-promote so VR keeps timers + Fast Refresh.
                mainHandler.post {
                    if (isFinishing || isDestroyed) return@post
                    (reactHost as? ReactHostImpl)?.onHostResume(this@VRActivity)
                }
            }
            override fun onActivityCreated(a: Activity, b: Bundle?) {}
            override fun onActivityStarted(a: Activity) {}
            override fun onActivityStopped(a: Activity) {}
            override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
            override fun onActivityDestroyed(a: Activity) {}
        }
        application.registerActivityLifecycleCallbacks(callbacks)
        lifecycleCallbacks = callbacks
    }

    override fun onDestroy() {
        // Stop the React surface attached to this VRActivity so its component
        // tree unmounts cleanly. In bridgeless arch this calls
        // reactSurface.stop() + reactSurface = null, leaving the shared
        // ReactHost intact for MainActivity. Without this the React tree from
        // each VR session piles up across re-entries and stale VRTComponents
        // intercept hit-tested viewTags with dead ReactContexts, breaking
        // onClick / onHover until you press dozens of times.
        try {
            reactDelegate?.unloadApp()
        } catch (t: Throwable) {
            android.util.Log.w("VRActivity", "reactDelegate.unloadApp() failed", t)
        }
        lifecycleCallbacks?.let { application.unregisterActivityLifecycleCallbacks(it) }
        lifecycleCallbacks = null
        mainHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
`;
                fs_1.default.writeFileSync(activityPath, kotlinContent, "utf-8");
            }
            return config;
        },
    ]);
    // 2. Cap targetSdkVersion to 34 — Meta Quest Store rejects targetSdk > 34.
    config = (0, config_plugins_1.withAppBuildGradle)(config, (config) => {
        config.modResults.contents = config.modResults.contents.replace(/targetSdk(?:Version)?\s*[=\s]\s*(\d+)/g, (match, ver) => parseInt(ver, 10) > 34 ? match.replace(ver, "34") : match);
        return config;
    });
    // 3. Add VRActivity to AndroidManifest
    config = (0, config_plugins_1.withAndroidManifest)(config, async (config) => {
        const app = config.modResults.manifest.application?.[0];
        if (!app)
            return config;
        if (!app.activity)
            app.activity = [];
        const alreadyAdded = app.activity.some((a) => a.$?.["android:name"] === ".VRActivity");
        if (!alreadyAdded) {
            app.activity.push({
                $: {
                    "android:name": ".VRActivity",
                    "android:screenOrientation": "landscape",
                    "android:exported": "false",
                    "android:configChanges": "keyboard|keyboardHidden|orientation|screenSize|uiMode",
                    "android:launchMode": "singleTask",
                },
                "intent-filter": [
                    {
                        action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
                        category: [
                            { $: { "android:name": "com.oculus.intent.category.VR" } },
                        ],
                    },
                ],
                "meta-data": [
                    {
                        $: {
                            "android:name": "com.oculus.vr.focusaware",
                            "android:value": "true",
                        },
                    },
                ],
            });
        }
        // Quest store validator requires all activities to be landscape.
        // Only apply when targeting Quest (questAppId present); AR/phone apps use portrait.
        const questAppId = props?.android?.questAppId;
        const mainActivity = app.activity?.[0];
        if (questAppId && mainActivity?.$ && mainActivity.$["android:name"] !== ".VRActivity") {
            mainActivity.$["android:screenOrientation"] = "landscape";
        }
        // Inject com.oculus.app_id into <application> for Meta Quest App Name
        if (questAppId) {
            if (!app["meta-data"])
                app["meta-data"] = [];
            const alreadyHasAppId = app["meta-data"].some((m) => m.$?.["android:name"] === "com.oculus.app_id");
            if (!alreadyHasAppId) {
                app["meta-data"].push({
                    $: {
                        "android:name": "com.oculus.app_id",
                        "android:value": questAppId,
                    },
                });
            }
        }
        return config;
    });
    return config;
};
const withViroAndroid = (config, props) => {
    config = withBranchAndroid(config, props);
    config = withViroProjectBuildGradle(config);
    config = withViroManifest(config);
    config = withViroSettingsGradle(config);
    config = withViroAppBuildGradle(config);
    config = withViroQuestActivity(config, props);
    return config;
};
exports.withViroAndroid = withViroAndroid;
