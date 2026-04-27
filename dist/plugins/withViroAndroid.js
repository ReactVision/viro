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
    // Enforce New Architecture requirement
    if (!newConfig.modResults.contents.includes("newArchEnabled=true")) {
        config_plugins_1.WarningAggregator.addWarningAndroid("withViroAndroid", "ViroReact requires New Architecture to be enabled. " +
            'Please add "newArchEnabled=true" to your android/gradle.properties file.');
    }
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
    if (viroPluginConfig.includes("GVR") ||
        viroPluginConfig.includes("OVR_MOBILE")) {
        //   <!-- Add the following line for cardboard -->
        //   <category android:name="com.google.intent.category.CARDBOARD" />
        contents?.manifest?.application?.[0]?.activity[0]["intent-filter"][0].category.push({
            $: {
                "android:name": "com.google.intent.category.CARDBOARD",
            },
        });
        //   <!-- Add the following line for daydream -->
        //   <category android:name="com.google.intent.category.DAYDREAM" />
        contents?.manifest?.application?.[0]?.activity[0]["intent-filter"][0].category.push({
            $: {
                "android:name": "com.google.intent.category.DAYDREAM",
            },
        });
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
    contents.manifest["uses-feature"].push({
        $: {
            "android:glEsVersion": "0x00030000",
            "android:required": "false",
            "tools:node": "remove",
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
    if (viroPluginConfig.includes("QUEST")) {
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
const withViroQuestActivity = (config) => {
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
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * VRActivity — generated by @reactvision/react-viro Expo plugin.
 * Carries com.oculus.intent.category.VR so Horizon OS grants exclusive
 * OpenXR display access. Mounts the "VRQuestScene" React root component.
 * Launch via NativeModules.VRLauncher.launchVRScene().
 *
 * Uses DefaultReactActivityDelegate directly (no ReactActivityDelegateWrapper).
 * The Expo wrapper is unnecessary for a VR-only activity that has no Expo
 * module lifecycle of its own. VRLauncherModule.launchVRScene() runs
 * dangerouslyForceOverride before startActivity, restoring the New Architecture
 * feature flags so DefaultReactActivityDelegate takes the bridgeless path.
 *
 * Mutual exclusion with MainActivity:
 *   Quest will happily run MainActivity (panel) and VRActivity (immersive) at
 *   the same time if the user taps the app icon in the dock while VR is
 *   running. We register an Application.ActivityLifecycleCallbacks here that
 *   finishes self when *any other* Activity in this app resumes — returning
 *   the user cleanly to the panel.
 */
class VRActivity : ReactActivity() {

    private var lifecycleCallbacks: Application.ActivityLifecycleCallbacks? = null

    override fun getMainComponentName(): String = "VRQuestScene"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val callbacks = object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(other: Activity) {
                if (other !== this@VRActivity && !isFinishing && !isDestroyed) {
                    finish()
                }
            }
            override fun onActivityCreated(a: Activity, b: Bundle?) {}
            override fun onActivityStarted(a: Activity) {}
            override fun onActivityPaused(a: Activity) {}
            override fun onActivityStopped(a: Activity) {}
            override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
            override fun onActivityDestroyed(a: Activity) {}
        }
        application.registerActivityLifecycleCallbacks(callbacks)
        lifecycleCallbacks = callbacks
    }

    override fun onDestroy() {
        lifecycleCallbacks?.let { application.unregisterActivityLifecycleCallbacks(it) }
        lifecycleCallbacks = null
        super.onDestroy()
    }
}
`;
                fs_1.default.writeFileSync(activityPath, kotlinContent, "utf-8");
            }
            return config;
        },
    ]);
    // 2. Add VRActivity to AndroidManifest
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
            });
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
