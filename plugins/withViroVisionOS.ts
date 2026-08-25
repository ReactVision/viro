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

import {
  ConfigPlugin,
  withDangerousMod,
  withPlugins,
  WarningAggregator,
} from "@expo/config-plugins";
import fs from "fs";
import path from "path";

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
const PKG_ROOT = path.resolve(__dirname, "..", "..");
const BUNDLED_PATCHES_DIR = path.join(PKG_ROOT, "patches", "visionos");
const BUNDLED_SHIMS_DIR = path.join(PKG_ROOT, "shims");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPkgInstalled(projectRoot: string, pkg: string): boolean {
  try {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")
    );
    return !!(pkgJson.dependencies?.[pkg] || pkgJson.devDependencies?.[pkg]);
  } catch {
    return false;
  }
}

// ─── 1. Verify visionos/ folder exists ───────────────────────────────────────

const withVisionOSSetup: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const visionosDir = path.join(projectRoot, "visionos");

      // Warn if missing deps
      for (const pkg of [RNVISION_PKG, RNVISION_PLATFORMS_PKG]) {
        if (!isPkgInstalled(projectRoot, pkg)) {
          WarningAggregator.addWarningIOS(
            "withViroVisionOS",
            `${pkg} is not installed. Add it to devDependencies:\n` +
              `  npm install --save-dev ${pkg}`
          );
        }
      }

      if (!fs.existsSync(visionosDir)) {
        const appName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `visionos/ folder not found. Create it once before running expo prebuild:\n\n` +
            `  npx @react-native-community/cli@latest init "${appName}" \\\n` +
            `    --template @callstack/visionos-template@latest \\\n` +
            `    --directory visionos --skip-install\n\n` +
            `Then re-run: expo prebuild`
        );
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

const withVisionOSMetroConfig: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const metroPath = path.join(projectRoot, "metro.config.js");

      if (!fs.existsSync(metroPath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "metro.config.js not found — skipping visionOS resolver patch."
        );
        return newConfig;
      }

      let metro = fs.readFileSync(metroPath, "utf-8");
      if (metro.includes(METRO_MARKER)) return newConfig; // idempotent

      metro = metro.replace(
        "module.exports = config;",
        METRO_PATCH + "\nmodule.exports = config;"
      );

      fs.writeFileSync(metroPath, metro, "utf-8");
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

const withVisionOSPodfile: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, "visionos", "Podfile");

      if (!fs.existsSync(podfilePath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "visionos/Podfile not found — Viro pods were not injected."
        );
        return newConfig;
      }

      let podfile = fs.readFileSync(podfilePath, "utf-8");
      const alreadyPatched = podfile.includes(PODFILE_MARKER);

      // ── 3a. Inject Viro pods inside the main target block ──
      if (!alreadyPatched) {
        podfile = podfile.replace(
          /^(target '[^']+' do)([\s\S]*?)^end/m,
          (_, header, body) => `${header}${body}${VIRO_PODS}\nend`
        );
      }

      // ── 3b. Ensure config[:reactNativePath] is set correctly ──
      if (!podfile.includes("config[:reactNativePath]")) {
        podfile = podfile.replace(
          /(config = use_native_modules!\n)/,
          `$1  config[:reactNativePath] = '../node_modules/${RNVISION_PKG}'\n`
        );
      }

      // ── 3c. Inject post_install content ──
      if (!podfile.includes(`# ${PODFILE_MARKER}: fmt consteval fix`)) {
        if (podfile.includes("post_install do |installer|")) {
          // Inject inside existing post_install block, before its closing end
          podfile = podfile.replace(
            /(post_install do \|installer\|)([\s\S]*?)(^  end)/m,
            (_, open, body, close) =>
              `${open}${body}${POST_INSTALL_CONTENT}\n${close}`
          );
        } else {
          // No post_install block — append one before the target's closing end
          podfile = podfile.replace(
            /^end\s*$/m,
            `  post_install do |installer|\n${POST_INSTALL_CONTENT}\n  end\nend\n`
          );
        }
      }

      fs.writeFileSync(podfilePath, podfile, "utf-8");
      return newConfig;
    },
  ]);

// ─── 4. App.swift — moduleName: "main" + ImmersiveSpace ──────────────────────

const withVisionOSAppSwift: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const projectName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");

      // Try both App.swift (Expo template) and {AppName}App.swift (CLI template)
      const candidates = [
        path.join(projectRoot, "visionos", projectName, "App.swift"),
        path.join(
          projectRoot,
          "visionos",
          projectName,
          `${projectName}App.swift`
        ),
      ];
      const appSwiftPath = candidates.find((p) => fs.existsSync(p));

      if (!appSwiftPath) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `Could not find App.swift in visionos/${projectName}/. ` +
            `Ensure RCTMainWindow uses moduleName: "main" and add the ViroImmersiveSpace scene manually.`
        );
        return newConfig;
      }

      let swift = fs.readFileSync(appSwiftPath, "utf-8");

      // ── 4a. Fix moduleName to "main" (Expo registers root component as "main") ──
      swift = swift.replace(
        /RCTMainWindow\s*\(\s*moduleName\s*:\s*"[^"]*"\s*\)/,
        `RCTMainWindow(moduleName: "main")`
      );

      // ── 4b. Add import ViroReact ──
      if (!swift.includes("import ViroReactUI")) {
        swift = swift.replace("import SwiftUI", "import SwiftUI\nimport ViroReactUI");
      }

      // ── 4c. Add @State for immersionStyle ──
      if (!swift.includes("immersionStyle")) {
        swift = swift.replace(
          /(\n(\s+)var body: some Scene)/,
          "\n$2@State private var immersionStyle: ImmersionStyle = .mixed$1"
        );
      }

      // ── 4d. Add .viroImmersiveSpaceController() + ImmersiveSpace ──
      // viroImmersiveSpaceController() is a View modifier, not a Scene one — it reads
      // openImmersiveSpace out of the environment, which only a View can do. RCTMainWindow is a
      // Scene, so the modifier goes on the React Native root view instead, via the contentView
      // initializer the fork provides for exactly this.
      if (!swift.includes("ViroImmersiveSpace")) {
        swift = swift.replace(
          /RCTMainWindow\(moduleName:\s*"main"\)\n/,
          'RCTMainWindow(moduleName: "main") { rootView in\n' +
            "            rootView.viroImmersiveSpaceController()\n" +
            "        }\n\n" +
            "        ImmersiveSpace(id: ViroImmersiveSpace.id) {\n" +
            "            ViroImmersiveSpaceView()\n" +
            "        }\n" +
            "        .immersionStyle(selection: $immersionStyle, in: .mixed, .full, .progressive)\n"
        );
      }

      fs.writeFileSync(appSwiftPath, swift, "utf-8");
      return newConfig;
    },
  ]);

// ─── 5. patches/ — copy bundled visionOS patches + wire patch-package ─────────

const withVisionOSPatches: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const patchesDir = path.join(projectRoot, "patches");

      if (!fs.existsSync(BUNDLED_PATCHES_DIR)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "Bundled visionOS patches not found in the @reactvision/react-viro package. " +
            "Please file an issue at https://github.com/ReactVision/react-viro/issues"
        );
        return newConfig;
      }

      // ── 5a. Copy each patch file (skip if user already has a newer version) ──
      if (!fs.existsSync(patchesDir)) fs.mkdirSync(patchesDir, { recursive: true });

      for (const file of fs.readdirSync(BUNDLED_PATCHES_DIR)) {
        const dest = path.join(patchesDir, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(BUNDLED_PATCHES_DIR, file), dest);
          console.log(`[withViroVisionOS] Copied patch: ${file}`);
        }
      }

      // ── 5b. Ensure patch-package is wired as postinstall ──
      const pkgPath = path.join(projectRoot, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const current: string = pkg.scripts?.postinstall ?? "";
      if (!current.includes("patch-package")) {
        pkg.scripts = pkg.scripts ?? {};
        pkg.scripts.postinstall = current
          ? `${current} && patch-package`
          : "patch-package";
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
        console.log("[withViroVisionOS] Added postinstall: patch-package");
      }

      return newConfig;
    },
  ]);

// ─── 6. components/compat/ — copy BlurView + LinearGradient shims ─────────────

const SHIM_FILES = ["BlurView.tsx", "LinearGradient.tsx"];

const withVisionOSCompatShims: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const compatDir = path.join(projectRoot, "components", "compat");

      if (!fs.existsSync(BUNDLED_SHIMS_DIR)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "Bundled shims not found in the @reactvision/react-viro package."
        );
        return newConfig;
      }

      if (!fs.existsSync(compatDir)) {
        fs.mkdirSync(compatDir, { recursive: true });
      }

      const copied: string[] = [];
      for (const file of SHIM_FILES) {
        const src = path.join(BUNDLED_SHIMS_DIR, file);
        const dest = path.join(compatDir, file);
        if (!fs.existsSync(src)) continue;
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          copied.push(file);
        }
      }

      if (copied.length > 0) {
        console.log(
          `[withViroVisionOS] Copied compat shims: ${copied.join(", ")}`
        );
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "visionOS compat shims installed at components/compat/.\n" +
            "Replace these imports in any file that uses them:\n" +
            "  expo-blur            → @/components/compat/BlurView\n" +
            "  expo-linear-gradient → @/components/compat/LinearGradient"
        );
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
const withVisionOSInfoPlist: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const projectName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");
      const plistPath = path.join(
        projectRoot,
        "visionos",
        projectName,
        "Info.plist"
      );

      if (!fs.existsSync(plistPath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `Could not find visionos/${projectName}/Info.plist. Set ` +
            `UIApplicationSceneManifest.UIApplicationSupportsMultipleScenes to true manually, ` +
            `or the ImmersiveSpace will refuse to open.`
        );
        return newConfig;
      }

      const plist = fs.readFileSync(plistPath, "utf-8");
      // The key lives inside UIApplicationSceneManifest and is written by the template as
      // <false/> on the line after the key. Only that occurrence is rewritten.
      const updated = plist.replace(
        /(<key>UIApplicationSupportsMultipleScenes<\/key>\s*)<false\/>/,
        "$1<true/>"
      );

      if (updated !== plist) {
        fs.writeFileSync(plistPath, updated, "utf-8");
      } else if (!/<key>UIApplicationSupportsMultipleScenes<\/key>\s*<true\/>/.test(plist)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `Could not set UIApplicationSupportsMultipleScenes in visionos/${projectName}/Info.plist. ` +
            `Set it to true manually, or the ImmersiveSpace will refuse to open.`
        );
      }

      return newConfig;
    },
  ]);

export const withViroVisionOS: ConfigPlugin = (config) =>
  withPlugins(config, [
    withVisionOSSetup,         // 1. verify visionos/ folder + deps
    withVisionOSMetroConfig,   // 2. metro.config.js visionOS resolver
    withVisionOSPodfile,       // 3. Podfile: Viro pods + post_install hooks
    withVisionOSAppSwift,      // 4. App.swift: moduleName "main" + ImmersiveSpace
    withVisionOSPatches,       // 5. patches/ + postinstall: patch-package
    withVisionOSCompatShims,   // 6. components/compat/ BlurView + LinearGradient
    withVisionOSInfoPlist,     // 7. Info.plist: allow multiple scenes (ImmersiveSpace)
  ]);

export default withViroVisionOS;
