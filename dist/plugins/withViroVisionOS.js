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
 *   6. Copies the 3 visionOS patch files into the project's patches/ dir
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
const PKG_ROOT = path_1.default.resolve(__dirname, "..");
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
const { getPlatformResolver } = require('${RNVISION_PLATFORMS_PKG}');
config.resolver.resolveRequest = getPlatformResolver({
  platformNameMap: { visionos: '${RNVISION_PKG}' },
});
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
  pod 'ViroReact',   :path => '../node_modules/@reactvision/react-viro/ios'
  pod 'ViroReactUI', :path => '../node_modules/@reactvision/react-viro/ios'`;
// These lines are injected INSIDE the existing post_install block (before the closing `end`).
// If no post_install block exists they are injected as a new one.
const POST_INSTALL_CONTENT = `
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
        if (!swift.includes("ViroImmersiveSpace")) {
            swift = swift.replace(/(RCTMainWindow\(moduleName:[^\n]+\n)/, "$1" +
                "            .viroImmersiveSpaceController()\n\n" +
                "        ImmersiveSpace(id: ViroImmersiveSpace.id) {\n" +
                "            ViroImmersiveSpaceView()\n" +
                "        }\n" +
                "        .immersionStyle(selection: $immersionStyle, in: .mixed, .full, .progressive)\n");
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
        const current = pkg.scripts?.postinstall ?? "";
        if (!current.includes("patch-package")) {
            pkg.scripts = pkg.scripts ?? {};
            pkg.scripts.postinstall = current
                ? `${current} && patch-package`
                : "patch-package";
            fs_1.default.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
            console.log("[withViroVisionOS] Added postinstall: patch-package");
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
const withViroVisionOS = (config) => (0, config_plugins_1.withPlugins)(config, [
    withVisionOSSetup, // 1. verify visionos/ folder + deps
    withVisionOSMetroConfig, // 2. metro.config.js visionOS resolver
    withVisionOSPodfile, // 3. Podfile: Viro pods + post_install hooks
    withVisionOSAppSwift, // 4. App.swift: moduleName "main" + ImmersiveSpace
    withVisionOSPatches, // 5. patches/ + postinstall: patch-package
    withVisionOSCompatShims, // 6. components/compat/ BlurView + LinearGradient
]);
exports.withViroVisionOS = withViroVisionOS;
exports.default = exports.withViroVisionOS;
