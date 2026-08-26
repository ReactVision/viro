"use strict";
/**
 * withViroVisionOS.ts
 *
 * Expo config plugin that wires ViroReact into a react-native-visionos project.
 *
 * What it automates (run once via `expo prebuild`):
 *   1. Verifies / warns about the visionos/ platform folder
 *   2. Patches metro.config.js with the visionOS platform resolver
 *   3. Injects ViroKit + ViroReact pods + post_install hooks into visionos/Podfile
 *   4. Ensures App.swift uses moduleName "main" (required by Expo's registerRootComponent)
 *   5. Patches App.swift with the ImmersiveSpace scene
 *   6. Copies the bundled visionOS patch files into the project's patches/ dir
 *   7. Adds postinstall: patch-package to package.json scripts
 *   8. Copies BlurView + LinearGradient compat shims into components/compat/
 *
 * Usage in app.json:
 *   {
 *     "plugins": [
 *       ["@reactvision/react-viro", { ... }],
 *       "@reactvision/react-viro/plugins/withViroVisionOS"
 *     ]
 *   }
 *
 * After expo prebuild:
 *   cd visionos && pod install
 *   Open visionos/{AppName}.xcworkspace in Xcode → build for xros Simulator
 *
 * Manual step (one-time, before prebuild):
 *   npx @react-native-community/cli@latest init MyApp \
 *     --template @callstack/visionos-template@latest \
 *     --directory visionos --skip-install
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withViroVisionOS = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ─── Constants ────────────────────────────────────────────────────────────────
const PODFILE_MARKER = "# viro-visionos";
const METRO_MARKER = "// viro-visionos";
const RNVISION_PKG = "@callstack/react-native-visionos";
const RNVISION_PLATFORMS_PKG = "@callstack/out-of-tree-platforms";
// Path inside this package where bundled assets live (resolved at runtime).
// This file is compiled to dist/plugins/, and plugins/withViroVisionOS.js is a one-line
// forwarder to it — so at runtime __dirname is <pkg>/dist/plugins, not <pkg>/plugins.
// Resolving one level up lands in dist/, where patches/ does not exist: they are source
// files, not TypeScript output, so they are never copied there. Two levels up is the package
// root under both layouts, because nothing else sits between.
const PKG_ROOT = path_1.default.resolve(__dirname, "..", "..");
const BUNDLED_PATCHES_DIR = path_1.default.join(PKG_ROOT, "patches", "visionos");
const BUNDLED_SHIMS_DIR = path_1.default.join(PKG_ROOT, "shims");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPkgInstalled(projectRoot, pkg) {
    try {
        const pkgJson = JSON.parse(fs_1.default.readFileSync(path_1.default.join(projectRoot, "package.json"), "utf-8"));
        return !!(pkgJson.dependencies?.[pkg] || pkgJson.devDependencies?.[pkg]);
    }
    catch {
        return false;
    }
}
// ─── 1. Verify visionos/ folder exists ───────────────────────────────────────
const withVisionOSSetup = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const visionosDir = path_1.default.join(projectRoot, "visionos");
        // Warn if missing deps
        for (const pkg of [RNVISION_PKG, RNVISION_PLATFORMS_PKG]) {
            if (!isPkgInstalled(projectRoot, pkg)) {
                config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `${pkg} is not installed. Add it to devDependencies:\n` +
                    `  npm install --save-dev ${pkg}`);
            }
        }
        if (!fs_1.default.existsSync(visionosDir)) {
            const appName = config.name.replace(/[^a-zA-Z0-9]/g, "");
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `visionos/ folder not found. Create it once before running expo prebuild:\n\n` +
                `  npx @react-native-community/cli@latest init "${appName}" \\\n` +
                `    --template @callstack/visionos-template@latest \\\n` +
                `    --directory visionos --skip-install\n\n` +
                `Then re-run: expo prebuild`);
        }
        return newConfig;
    },
]);
// ─── 2. metro.config.js — visionOS platform resolver ─────────────────────────
const METRO_PATCH = `
${METRO_MARKER} — visionOS platform resolver

// Viro loads these through \`require()\`, and Metro treats anything not in assetExts as source.
// Without this, \`<ViroLightingEnvironment source={require('./env.hdr')} />\` fails the bundle with
// "Unable to resolve ./env.hdr" before a single frame is drawn — which is a confusing first
// experience for a file that is plainly an asset.
const VIRO_ASSET_EXTS = ['glb', 'gltf', 'hdr', 'obj', 'mtl', 'vrx'];
for (const ext of VIRO_ASSET_EXTS) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

const path = require('path');
const { getPlatformResolver } = require('${RNVISION_PLATFORMS_PKG}');
const viroPlatformResolver = getPlatformResolver({
  platformNameMap: { visionos: '${RNVISION_PKG}' },
});

// Device builds run their own Metro from the Xcode build phase, which reads this file and
// nothing else — tsconfig \`paths\` are applied by the Expo dev server, not by that instance.
// A project using the \`@/\` alias therefore builds in the Simulator and fails on device with
// "Unable to resolve module @/...". Resolving it here covers both.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    return viroPlatformResolver(
      context,
      path.resolve(__dirname, moduleName.slice(2)),
      platform
    );
  }
  return viroPlatformResolver(context, moduleName, platform);
};
`;
const withVisionOSMetroConfig = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const metroPath = path_1.default.join(projectRoot, "metro.config.js");
        if (!fs_1.default.existsSync(metroPath)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", "metro.config.js not found — skipping visionOS resolver patch.");
            return newConfig;
        }
        let metro = fs_1.default.readFileSync(metroPath, "utf-8");
        if (metro.includes(METRO_MARKER))
            return newConfig; // idempotent
        metro = metro.replace("module.exports = config;", METRO_PATCH + "\nmodule.exports = config;");
        fs_1.default.writeFileSync(metroPath, metro, "utf-8");
        return newConfig;
    },
]);
// ─── 3. visionos/Podfile — ViroKit + ViroReact + post_install ────────────────
const VIRO_PODS = `
  ${PODFILE_MARKER}
  pod 'ViroKit',     :path => '../node_modules/@reactvision/react-viro/ios/dist/ViroRendererVisionOS/'
  pod 'ViroReact',   :path => '../node_modules/@reactvision/react-viro/ios', :modular_headers => true
  pod 'ViroReactUI', :path => '../node_modules/@reactvision/react-viro/ios'`;
// These lines are injected INSIDE the existing post_install block (before the closing `end`).
// If no post_install block exists they are injected as a new one.
const POST_INSTALL_CONTENT = `
    # ${PODFILE_MARKER}: UIKit back into every pod's prefix header
    # CocoaPods writes each pod's -prefix.pch from a case on the platform name that knows
    # :ios, :tvos and :osx but not visionOS, so on xros the pch falls through with nothing but
    # Foundation. Pods that reach for a UIKit type without importing UIKit compile on iOS purely
    # because the pch handed it over, and fail here. The __OBJC__ guard is CocoaPods' own, so the
    # C and C++ sources in those same pods are untouched.
    Dir.glob("#{installer.sandbox.root}/Target Support Files/*/*-prefix.pch").each do |pch|
      content = File.read(pch)
      next if content.include?('UIKit/UIKit.h')
      patched = content.sub("#import <Foundation/Foundation.h>",
                            "#import <Foundation/Foundation.h>\\n#import <UIKit/UIKit.h>")
      next if patched == content
      FileUtils.chmod('u+w', pch)
      File.write(pch, patched)
    end
    # ${PODFILE_MARKER}: fmt consteval fix for Apple Clang 16
    fmt_base_h = "#{installer.sandbox.root}/fmt/include/fmt/base.h"
    if File.exist?(fmt_base_h)
      content = File.read(fmt_base_h)
      patched = content.gsub('#  define FMT_CONSTEVAL consteval', '#  define FMT_CONSTEVAL constexpr')
      if patched != content
        FileUtils.chmod('u+w', fmt_base_h)
        File.write(fmt_base_h, patched)
      end
    end
    # ${PODFILE_MARKER}: C++20 + Hermes JSI headers for all targets
    hermes_jsi_path = "#{installer.sandbox.root}/hermes-engine/API/jsi"
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        existing = cfg.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)'
        cfg.build_settings['HEADER_SEARCH_PATHS'] = "#{existing} \\"#{hermes_jsi_path}\\""
      end
    end`;
const withVisionOSPodfile = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const podfilePath = path_1.default.join(projectRoot, "visionos", "Podfile");
        if (!fs_1.default.existsSync(podfilePath)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", "visionos/Podfile not found — Viro pods were not injected.");
            return newConfig;
        }
        let podfile = fs_1.default.readFileSync(podfilePath, "utf-8");
        const alreadyPatched = podfile.includes(PODFILE_MARKER);
        // ── 3a0. Both React Native source flags, set in the Podfile itself ──
        //
        // Neither default works on visionOS, and forgetting either fails in a way that does not
        // name the cause:
        //
        //   RCT_USE_PREBUILT_RNCORE=0 — React core ships as a prebuilt xcframework with ios,
        //     ios-simulator and maccatalyst slices and no xros slice, so `import React` fails
        //     inside React Native's own RCTRootViewRepresentable.swift.
        //   RCT_USE_RN_DEP=0 — same story for folly, glog and fmt.
        //
        // Set here rather than documented as a shell prefix, because a Podfile that only builds
        // when invoked a particular way is a trap. `||=` leaves an explicit override alone.
        if (!podfile.includes("RCT_USE_PREBUILT_RNCORE")) {
            podfile = podfile.replace(/^(platform :visionos[^\n]*\n)/m, `$1\n# ${PODFILE_MARKER}: build React Native from source — no xros slice is published\n` +
                `ENV['RCT_USE_PREBUILT_RNCORE'] ||= '0'\n` +
                `ENV['RCT_USE_RN_DEP'] ||= '0'\n`);
        }
        // ── 3a. Inject Viro pods inside the main target block ──
        if (!alreadyPatched) {
            podfile = podfile.replace(/^(target '[^']+' do)([\s\S]*?)^end/m, (_, header, body) => `${header}${body}${VIRO_PODS}\nend`);
        }
        // ── 3b. Ensure config[:reactNativePath] is set correctly ──
        if (!podfile.includes("config[:reactNativePath]")) {
            podfile = podfile.replace(/(config = use_native_modules!\n)/, `$1  config[:reactNativePath] = '../node_modules/${RNVISION_PKG}'\n`);
        }
        // ── 3c. Inject post_install content ──
        if (!podfile.includes(`# ${PODFILE_MARKER}: fmt consteval fix`)) {
            if (podfile.includes("post_install do |installer|")) {
                // Inject inside existing post_install block, before its closing end
                podfile = podfile.replace(/(post_install do \|installer\|)([\s\S]*?)(^  end)/m, (_, open, body, close) => `${open}${body}${POST_INSTALL_CONTENT}\n${close}`);
            }
            else {
                // No post_install block — append one before the target's closing end
                podfile = podfile.replace(/^end\s*$/m, `  post_install do |installer|\n${POST_INSTALL_CONTENT}\n  end\nend\n`);
            }
        }
        fs_1.default.writeFileSync(podfilePath, podfile, "utf-8");
        return newConfig;
    },
]);
// ─── 4. App.swift — moduleName: "main" + ImmersiveSpace ──────────────────────
const withVisionOSAppSwift = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const projectName = config.name.replace(/[^a-zA-Z0-9]/g, "");
        // Try both App.swift (Expo template) and {AppName}App.swift (CLI template)
        const candidates = [
            path_1.default.join(projectRoot, "visionos", projectName, "App.swift"),
            path_1.default.join(projectRoot, "visionos", projectName, `${projectName}App.swift`),
        ];
        const appSwiftPath = candidates.find((p) => fs_1.default.existsSync(p));
        if (!appSwiftPath) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `Could not find App.swift in visionos/${projectName}/. ` +
                `Ensure RCTMainWindow uses moduleName: "main" and add the ViroImmersiveSpace scene manually.`);
            return newConfig;
        }
        let swift = fs_1.default.readFileSync(appSwiftPath, "utf-8");
        // ── 4a. Fix moduleName to "main" (Expo registers root component as "main") ──
        swift = swift.replace(/RCTMainWindow\s*\(\s*moduleName\s*:\s*"[^"]*"\s*\)/, `RCTMainWindow(moduleName: "main")`);
        // ── 4b. Add import ViroReact ──
        if (!swift.includes("import ViroReactUI")) {
            swift = swift.replace("import SwiftUI", "import SwiftUI\nimport ViroReactUI");
        }
        // ── 4c. Add @State for immersionStyle ──
        if (!swift.includes("immersionStyle")) {
            swift = swift.replace(/(\n(\s+)var body: some Scene)/, "\n$2@State private var immersionStyle: ImmersionStyle = .mixed$1");
        }
        // ── 4d. Add .viroImmersiveSpaceController() + ImmersiveSpace ──
        // viroImmersiveSpaceController() is a View modifier, not a Scene one — it reads
        // openImmersiveSpace out of the environment, which only a View can do. RCTMainWindow is a
        // Scene, so the modifier goes on the React Native root view instead, via the contentView
        // initializer the fork provides for exactly this.
        if (!swift.includes("ViroImmersiveSpace")) {
            swift = swift.replace(/RCTMainWindow\(moduleName:\s*"main"\)\n/, 'RCTMainWindow(moduleName: "main") { rootView in\n' +
                "            rootView.viroImmersiveSpaceController()\n" +
                "        }\n\n" +
                "        ImmersiveSpace(id: ViroImmersiveSpace.id) {\n" +
                "            ViroImmersiveSpaceView()\n" +
                "        }\n" +
                // .progressive is deliberately absent. Declaring support for it changes the contract:
                // CompositorServices then requires presenting through the drawable's render
                // context, and rejects encodePresent with "BUG IN CLIENT: cannot present
                // drawable: need to use drawable render context when supporting progressive
                // style" — killing the process seconds after the space opens. Viro's renderer
                // uses encodePresent, so the styles it offers are the ones it can actually
                // present. Re-add this only together with the render-context path.
                "        .immersionStyle(selection: $immersionStyle, in: .mixed, .full)\n");
        }
        fs_1.default.writeFileSync(appSwiftPath, swift, "utf-8");
        return newConfig;
    },
]);
// ─── 5. patches/ — copy bundled visionOS patches + wire patch-package ─────────
const withVisionOSPatches = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const patchesDir = path_1.default.join(projectRoot, "patches");
        if (!fs_1.default.existsSync(BUNDLED_PATCHES_DIR)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", "Bundled visionOS patches not found in the @reactvision/react-viro package. " +
                "Please file an issue at https://github.com/ReactVision/react-viro/issues");
            return newConfig;
        }
        // ── 5a. Copy each patch file (skip if user already has a newer version) ──
        if (!fs_1.default.existsSync(patchesDir))
            fs_1.default.mkdirSync(patchesDir, { recursive: true });
        for (const file of fs_1.default.readdirSync(BUNDLED_PATCHES_DIR)) {
            const dest = path_1.default.join(patchesDir, file);
            if (!fs_1.default.existsSync(dest)) {
                fs_1.default.copyFileSync(path_1.default.join(BUNDLED_PATCHES_DIR, file), dest);
                console.log(`[withViroVisionOS] Copied patch: ${file}`);
            }
        }
        // ── 5b. Ensure patch-package is wired as postinstall ──
        const pkgPath = path_1.default.join(projectRoot, "package.json");
        const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, "utf-8"));
        let pkgChanged = false;
        const current = pkg.scripts?.postinstall ?? "";
        if (!current.includes("patch-package")) {
            pkg.scripts = pkg.scripts ?? {};
            pkg.scripts.postinstall = current
                ? `${current} && patch-package`
                : "patch-package";
            pkgChanged = true;
            console.log("[withViroVisionOS] Added postinstall: patch-package");
        }
        // The postinstall above invokes patch-package, so it has to be installed — otherwise the
        // very next `npm install` fails on a command that is not there, and the patches this step
        // just copied are never applied.
        const hasPatchPackage = pkg.devDependencies?.["patch-package"] ?? pkg.dependencies?.["patch-package"];
        if (!hasPatchPackage) {
            pkg.devDependencies = pkg.devDependencies ?? {};
            pkg.devDependencies["patch-package"] = "^8.0.0";
            pkgChanged = true;
            console.log("[withViroVisionOS] Added devDependency: patch-package — run your package manager's install");
        }
        if (pkgChanged) {
            fs_1.default.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
        }
        return newConfig;
    },
]);
// ─── 6. components/compat/ — copy BlurView + LinearGradient shims ─────────────
const SHIM_FILES = ["BlurView.tsx", "LinearGradient.tsx"];
const withVisionOSCompatShims = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const compatDir = path_1.default.join(projectRoot, "components", "compat");
        if (!fs_1.default.existsSync(BUNDLED_SHIMS_DIR)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", "Bundled shims not found in the @reactvision/react-viro package.");
            return newConfig;
        }
        if (!fs_1.default.existsSync(compatDir)) {
            fs_1.default.mkdirSync(compatDir, { recursive: true });
        }
        const copied = [];
        for (const file of SHIM_FILES) {
            const src = path_1.default.join(BUNDLED_SHIMS_DIR, file);
            const dest = path_1.default.join(compatDir, file);
            if (!fs_1.default.existsSync(src))
                continue;
            if (!fs_1.default.existsSync(dest)) {
                fs_1.default.copyFileSync(src, dest);
                copied.push(file);
            }
        }
        if (copied.length > 0) {
            console.log(`[withViroVisionOS] Copied compat shims: ${copied.join(", ")}`);
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", "visionOS compat shims installed at components/compat/.\n" +
                "Replace these imports in any file that uses them:\n" +
                "  expo-blur            → @/components/compat/BlurView\n" +
                "  expo-linear-gradient → @/components/compat/LinearGradient");
        }
        return newConfig;
    },
]);
// ─── Main export ──────────────────────────────────────────────────────────────
// ─── 7. visionos/{App}/Info.plist — allow more than one scene ─────────────────
//
// Opening an ImmersiveSpace requires UIApplicationSupportsMultipleScenes = YES. The visionOS
// template ships it as NO, and SwiftUI then refuses at runtime with:
//
//   "Unable to open an immersive space when the app does not support multiple scenes."
//
// It is a silent failure from JavaScript's point of view: enterImmersiveSpace() resolves, no
// exception is raised, and the scene simply never appears. Every Viro app on visionOS needs
// this, so it is set here rather than left as a manual step.
const withVisionOSInfoPlist = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const projectName = config.name.replace(/[^a-zA-Z0-9]/g, "");
        const plistPath = path_1.default.join(projectRoot, "visionos", projectName, "Info.plist");
        if (!fs_1.default.existsSync(plistPath)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `Could not find visionos/${projectName}/Info.plist. Set ` +
                `UIApplicationSceneManifest.UIApplicationSupportsMultipleScenes to true manually, ` +
                `or the ImmersiveSpace will refuse to open.`);
            return newConfig;
        }
        const plist = fs_1.default.readFileSync(plistPath, "utf-8");
        // The key lives inside UIApplicationSceneManifest and is written by the template as
        // <false/> on the line after the key. Only that occurrence is rewritten.
        const updated = plist.replace(/(<key>UIApplicationSupportsMultipleScenes<\/key>\s*)<false\/>/, "$1<true/>");
        // ARKit authorisation strings. The renderer starts a WorldTrackingProvider and, where the
        // hardware has it, a HandTrackingProvider. On a device, starting a provider without the
        // matching usage description does not degrade — it raises
        // NSInternalInconsistencyException and terminates the app the moment the immersive space
        // opens. The Simulator never surfaces this, because it has no hand tracking and the
        // provider is never started, so the whole class of failure is invisible until hardware.
        let withUsage = updated;
        const usageKeys = [
            [
                "NSWorldSensingUsageDescription",
                "Places your scene relative to the room around you.",
            ],
            [
                "NSHandsTrackingUsageDescription",
                "Lets you point at and select objects in your scene with your hands.",
            ],
        ];
        for (const [key, description] of usageKeys) {
            if (withUsage.includes(`<key>${key}</key>`))
                continue;
            withUsage = withUsage.replace(/<dict>/, `<dict>\n\t<key>${key}</key>\n\t<string>${description}</string>`);
        }
        if (withUsage !== updated) {
            console.log("[withViroVisionOS] Added the ARKit usage descriptions to Info.plist");
        }
        const finalPlist = withUsage;
        if (finalPlist !== plist) {
            fs_1.default.writeFileSync(plistPath, finalPlist, "utf-8");
        }
        else if (!/<key>UIApplicationSupportsMultipleScenes<\/key>\s*<true\/>/.test(plist)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `Could not set UIApplicationSupportsMultipleScenes in visionos/${projectName}/Info.plist. ` +
                `Set it to true manually, or the ImmersiveSpace will refuse to open.`);
        }
        return newConfig;
    },
]);
// ─── 8. visionos/{App}/AppDelegate.swift — Expo's entry point and imports ─────
//
// The Callstack visionOS template is a bare React Native template: it asks Metro for
// `index`, and it does not import ReactAppDependencyProvider. An Expo app serves its entry
// through a virtual module instead, which `expo prebuild` writes into the iOS AppDelegate as
// `.expo/.virtual-metro-entry` — but prebuild does not manage the visionos/ folder's copy.
//
// Left alone, the app launches, connects to Metro, and sits on its loading spinner forever:
// Metro answers "Unable to resolve module ./index" and nothing surfaces in the UI.
const withVisionOSAppDelegate = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const projectName = config.name.replace(/[^a-zA-Z0-9]/g, "");
        const appDelegatePath = path_1.default.join(projectRoot, "visionos", projectName, "AppDelegate.swift");
        if (!fs_1.default.existsSync(appDelegatePath)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `Could not find visionos/${projectName}/AppDelegate.swift. If the app hangs on its ` +
                `loading screen, point jsBundleURL(forBundleRoot:) at ".expo/.virtual-metro-entry".`);
            return newConfig;
        }
        let swift = fs_1.default.readFileSync(appDelegatePath, "utf-8");
        const before = swift;
        swift = swift.replace(/jsBundleURL\(forBundleRoot:\s*"index"\)/, 'jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")');
        // RCTAppDependencyProvider lives in its own module, and the bare template never imports it.
        if (swift.includes("RCTAppDependencyProvider") &&
            !swift.includes("import ReactAppDependencyProvider")) {
            swift = swift.replace(/^(import React_RCTAppDelegate\n)/m, "$1import ReactAppDependencyProvider\n");
        }
        if (swift !== before) {
            fs_1.default.writeFileSync(appDelegatePath, swift, "utf-8");
            console.log("[withViroVisionOS] Pointed AppDelegate at the Expo entry point");
        }
        return newConfig;
    },
]);
// ─── 9. visionos/*.xcodeproj — the React Native bundling phase, for Expo ──────
//
// The Callstack template's phase is a bare React Native one: it runs react-native-xcode.sh with
// no ENTRY_FILE, which defaults to index.js, and it bundles in every configuration.
//
// Neither suits an Expo app, and both only bite on device — the Simulator loads from the dev
// server and never runs this phase in anger:
//
//   * ENTRY_FILE  — an Expo project has no index.js. The build fails with
//     "ResourceNotFoundError: The resource `.../index.js` was not found."
//   * SKIP_BUNDLING — embedding a Debug bundle also trips Metro's
//     "Unexpected module with full source map found", and expo prebuild's own iOS phase skips
//     bundling in Debug for the same reason.
//
// The entry is resolved the Expo way but the bundling is left to the React Native CLI: the fork's
// script passes --resolver-option for the visionos platform extension, which @expo/cli rejects.
const withVisionOSBundlePhase = (config) => (0, config_plugins_1.withDangerousMod)(config, [
    "ios",
    async (newConfig) => {
        const projectRoot = newConfig.modRequest.projectRoot;
        const projectName = config.name.replace(/[^a-zA-Z0-9]/g, "");
        const pbxPath = path_1.default.join(projectRoot, "visionos", `${projectName}.xcodeproj`, "project.pbxproj");
        if (!fs_1.default.existsSync(pbxPath)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", `Could not find visionos/${projectName}.xcodeproj/project.pbxproj — the React Native ` +
                `bundling phase was left as the template wrote it. Device builds will fail on ` +
                `index.js not being found.`);
            return newConfig;
        }
        const pbx = fs_1.default.readFileSync(pbxPath, "utf-8");
        if (pbx.includes("resolveAppEntry"))
            return newConfig; // idempotent
        // Anchor on the template's own first line. An earlier draft anchored on
        // `export PROJECT_ROOT=...`, which the template does not contain at all — it came
        // from the hand-edit this step replaces, so it would never have matched.
        const anchor = String.raw `set -e\n`;
        if (!pbx.includes(anchor)) {
            config_plugins_1.WarningAggregator.addWarningIOS("withViroVisionOS", "The visionOS bundling phase does not look like the Callstack template's. Set " +
                "ENTRY_FILE via expo/scripts/resolveAppEntry and SKIP_BUNDLING=1 in Debug by hand.");
            return newConfig;
        }
        const injected = anchor +
            String.raw `\n` +
            String.raw `export PROJECT_ROOT=\"$PROJECT_DIR\"/..\n` +
            String.raw `\n` +
            String.raw `if [[ \"$CONFIGURATION\" = *Debug* ]]; then\n  export SKIP_BUNDLING=1\nfi\n` +
            String.raw `\n` +
            String.raw `if [[ -z \"$ENTRY_FILE\" ]]; then\n` +
            String.raw `  export ENTRY_FILE=\"$(\"$NODE_BINARY\" -e \"require('expo/scripts/resolveAppEntry')\" \"$PROJECT_ROOT\" ios absolute | tail -n 1)\"\nfi\n`;
        fs_1.default.writeFileSync(pbxPath, pbx.replace(anchor, injected), "utf-8");
        console.log("[withViroVisionOS] Pointed the bundling phase at Expo's entry point");
        return newConfig;
    },
]);
const withViroVisionOS = (config) => (0, config_plugins_1.withPlugins)(config, [
    withVisionOSSetup, // 1. verify visionos/ folder + deps
    withVisionOSMetroConfig, // 2. metro.config.js visionOS resolver
    withVisionOSPodfile, // 3. Podfile: Viro pods + post_install hooks
    withVisionOSAppSwift, // 4. App.swift: moduleName "main" + ImmersiveSpace
    withVisionOSPatches, // 5. patches/ + postinstall: patch-package
    withVisionOSCompatShims, // 6. components/compat/ BlurView + LinearGradient
    withVisionOSInfoPlist, // 7. Info.plist: allow multiple scenes (ImmersiveSpace)
    withVisionOSAppDelegate, // 8. AppDelegate.swift: Expo entry point + imports
    withVisionOSBundlePhase, // 9. Xcode bundling phase: Expo entry + skip bundling in Debug
]);
exports.withViroVisionOS = withViroVisionOS;
exports.default = exports.withViroVisionOS;
