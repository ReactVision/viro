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
 * Manual step (one-time, before prebuild). The template is a whole React Native project whose
 * visionOS folder is one directory inside it, so it is generated aside and that folder lifted out:
 *   npx @react-native-community/cli@latest init MyApp \
 *     --template github:ReactVision/visionos-template \
 *     --directory .visionos-template --skip-install
 *   mv .visionos-template/visionos ./visionos && rm -rf .visionos-template
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
const RNVISION_PKG = "@reactvision/react-native-visionos";
const RNVISION_PLATFORMS_PKG = "@callstack/out-of-tree-platforms";
// The visionOS Podfile autolinks through this. Expo apps do not have it — Expo ships its own
// CLI — and without it `pod install` fails inside CocoaPods with a wall of text that names the
// package only in passing.
const RN_COMMUNITY_CLI_PKG = "@react-native-community/cli";

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

// The fork can be installed under its own name, or aliased as `react-native` — an app that builds
// iOS and Android from the same package installs it that way, so there is one copy of React Native
// and one set of pods instead of two that collide. Everything that points at the fork by path has
// to follow whichever name it actually arrived under.
function resolveRNVisionSpecifier(projectRoot: string): string {
  for (const name of [RNVISION_PKG, "react-native"]) {
    const pkgJsonPath = path.join(
      projectRoot,
      "node_modules",
      ...name.split("/"),
      "package.json"
    );
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      if (pkgJson.name === RNVISION_PKG) return name;
    } catch {
      // not installed under this name
    }
  }
  return RNVISION_PKG;
}

// ─── 1. Verify visionos/ folder exists ───────────────────────────────────────

const withVisionOSSetup: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const visionosDir = path.join(projectRoot, "visionos");

      // Warn if missing deps. The fork counts as installed under either name.
      const rnVisionSpecifier = resolveRNVisionSpecifier(projectRoot);
      for (const pkg of [RNVISION_PKG, RNVISION_PLATFORMS_PKG, RN_COMMUNITY_CLI_PKG]) {
        if (pkg === RNVISION_PKG && rnVisionSpecifier !== RNVISION_PKG) continue;
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
            `    --template github:ReactVision/visionos-template \\\n` +
            `    --directory .visionos-template --skip-install\n` +
            `  mv .visionos-template/visionos ./visionos && rm -rf .visionos-template\n\n` +
            `The template is a whole React Native project — only its visionos/ folder belongs in ` +
            `an Expo app, the rest would collide with what prebuild generates.\n\n` +
            `Then re-run: expo prebuild`
        );
      }

      return newConfig;
    },
  ]);

// ─── 2. metro.config.js — visionOS platform resolver ─────────────────────────

const metroPatch = (rnVisionSpecifier: string) => `
${METRO_MARKER} — visionOS platform resolver

// Viro loads these through \`require()\`, and Metro treats anything not in assetExts as source.
// Without this, \`<ViroLightingEnvironment source={require('./env.hdr')} />\` fails the bundle with
// "Unable to resolve ./env.hdr" before a single frame is drawn — which is a confusing first
// experience for a file that is plainly an asset.
// Without visionos in resolver.platforms, Metro never tries a module's \`.native.js\` variant on
// this platform, so any package shipping one silently resolves to its **web** build. expo-asset is
// how this surfaces: its web AssetSourceResolver returns an empty uri, and every require()'d image
// reaches the native side with no URL at all.
config.resolver.platforms = [...new Set([...(config.resolver.platforms ?? []), 'visionos'])];

const VIRO_ASSET_EXTS = ['glb', 'gltf', 'hdr', 'obj', 'mtl', 'vrx'];
for (const ext of VIRO_ASSET_EXTS) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// Prefixed, all of it: this block is appended to a config file that was written without knowing
// about it, and \`const path = require('path')\` at the top of a Metro config is close to
// universal. A second \`const path\` in the same scope is a SyntaxError that nothing catches until
// the bundler runs — which no native build does, so it survives every compile and fails on launch.
const viroNodePath = require('path');
const { getPlatformResolver: viroGetPlatformResolver } = require('${RNVISION_PLATFORMS_PKG}');
const viroPlatformResolver = viroGetPlatformResolver({
  platformNameMap: { visionos: '${rnVisionSpecifier}' },
});

// Device builds run their own Metro from the Xcode build phase, which reads this file and
// nothing else — tsconfig \`paths\` are applied by the Expo dev server, not by that instance.
// A project using the \`@/\` alias therefore builds in the Simulator and fails on device with
// "Unable to resolve module @/...". Resolving it here covers both.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    return viroPlatformResolver(
      context,
      viroNodePath.resolve(__dirname, moduleName.slice(2)),
      platform
    );
  }
  return viroPlatformResolver(context, moduleName, platform);
};
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
      const patch = metroPatch(resolveRNVisionSpecifier(projectRoot));

      if (metro.includes(METRO_MARKER)) {
        // Replaced rather than skipped. Skipping is the obvious reading of "idempotent" and it is
        // wrong here: a config patched by an older version of this plugin keeps whatever that
        // version got wrong forever, and the block is ours to own from the marker to the export.
        const start = metro.indexOf(METRO_MARKER);
        const end = metro.indexOf("module.exports = config;", start);
        if (end === -1) {
          WarningAggregator.addWarningIOS(
            "withViroVisionOS",
            "metro.config.js carries the visionOS block but no `module.exports = config;` after " +
              "it — left as is, so nothing is cut in half. Re-add the export and prebuild again."
          );
          return newConfig;
        }
        metro = metro.slice(0, start) + patch.replace(/^\n/, "") + "\n" + metro.slice(end);
      } else {
        metro = metro.replace(
          "module.exports = config;",
          patch + "\nmodule.exports = config;"
        );
      }

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

      // Read before touching anything: the deployment-target fix below writes PODFILE_MARKER, and
      // computing this afterwards would report an unpatched Podfile as already patched and skip
      // injecting the Viro pods entirely.
      const alreadyPatched = podfile.includes(PODFILE_MARKER);

      // Raise the deployment target if the folder predates the template pinning it.
      //
      // ViroReactUI.podspec requires visionos 26.0 — ViroKit calls queryDrawables() and
      // computeProjection(viewIndex:) with no availability fallback — and CocoaPods refuses the
      // pod below it with "required a higher minimum deployment target". The template pins 26.0
      // now, but nobody regenerates a visionos/ folder they already have, so it is fixed here too.
      if (/^platform :visionos, min_visionos_version_supported/m.test(podfile)) {
        podfile = podfile.replace(
          /^platform :visionos, min_visionos_version_supported/m,
          `platform :visionos, '26.0' ${PODFILE_MARKER}: ViroReactUI requires 26.0`
        );
        console.log(
          "[withViroVisionOS] Raised the visionOS deployment target to 26.0 (ViroReactUI requires it)"
        );
      }

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
        podfile = podfile.replace(
          /^(platform :visionos[^\n]*\n)/m,
          `$1\n# ${PODFILE_MARKER}: build React Native from source — no xros slice is published\n` +
            `ENV['RCT_USE_PREBUILT_RNCORE'] ||= '0'\n` +
            `ENV['RCT_USE_RN_DEP'] ||= '0'\n`
        );
      }

      // ── 3a. Inject Viro pods inside the main target block ──
      if (!alreadyPatched) {
        podfile = podfile.replace(
          /^(target '[^']+' do)([\s\S]*?)^end/m,
          (_, header, body) => `${header}${body}${VIRO_PODS}\nend`
        );
      }

      // ── 3a-bis. Repoint the react_native_pods.rb require ──
      //
      // The generated Podfile resolves this script through whatever package the template was
      // built against. That name is not ours, so after installing this fork `pod install` dies
      // with "Cannot find module '<other-scope>/react-native-visionos/scripts/react_native_pods.rb'"
      // before a single pod is written — a confusing first failure, and one no amount of
      // reactNativePath configuration fixes, because it happens while the Podfile is being read.
      const rnVisionSpecifier = resolveRNVisionSpecifier(projectRoot);
      podfile = podfile.replace(
        /"@[a-z0-9-]+\/react-native-visionos\/scripts\/react_native_pods\.rb"/g,
        `"${rnVisionSpecifier}/scripts/react_native_pods.rb"`
      );

      // ── 3b. Point config[:reactNativePath] at where the fork actually is ──
      //
      // Rewritten rather than only added when absent: the template ships the line already, spelled
      // with the package's own name. An app that installs the fork under the `react-native` alias
      // has no such directory, and CocoaPods then reads a Podfile that autolinks against a path
      // that is not there.
      const reactNativePathLine = `config[:reactNativePath] = '../node_modules/${rnVisionSpecifier}'`;
      if (podfile.includes("config[:reactNativePath]")) {
        podfile = podfile.replace(
          /config\[:reactNativePath\] = '[^']*'/g,
          reactNativePathLine
        );
      } else {
        podfile = podfile.replace(
          /(config = use_native_modules!\n)/,
          `$1  ${reactNativePathLine}\n`
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
            // .progressive is deliberately absent. Declaring support for it changes the contract:
            // CompositorServices then requires presenting through the drawable's render
            // context, and rejects encodePresent with "BUG IN CLIENT: cannot present
            // drawable: need to use drawable render context when supporting progressive
            // style" — killing the process seconds after the space opens. Viro's renderer
            // uses encodePresent, so the styles it offers are the ones it can actually
            // present. Re-add this only together with the render-context path.
            "        .immersionStyle(selection: $immersionStyle, in: .mixed, .full)\n"
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
      let pkgChanged = false;

      const current: string = pkg.scripts?.postinstall ?? "";
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
      const hasPatchPackage =
        pkg.devDependencies?.["patch-package"] ?? pkg.dependencies?.["patch-package"];
      if (!hasPatchPackage) {
        pkg.devDependencies = pkg.devDependencies ?? {};
        pkg.devDependencies["patch-package"] = "^8.0.0";
        pkgChanged = true;
        console.log(
          "[withViroVisionOS] Added devDependency: patch-package — run your package manager's install"
        );
      }

      if (pkgChanged) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      }

      return newConfig;
    },
  ]);

// ─── 6. components/compat/ — copy BlurView + LinearGradient shims ─────────────

// Each shim replaces one Expo package that does not work on visionOS. Copying a shim into an app
// that does not depend on that package leaves a file importing something absent — two TypeScript
// errors in code the app never imports — so each is gated on the dependency it stands in for.
const SHIM_FILES: { file: string; requires: string }[] = [
  { file: "BlurView.tsx", requires: "expo-blur" },
  { file: "LinearGradient.tsx", requires: "expo-linear-gradient" },
];

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

      // Created lazily: an app depending on neither package should not be left with an empty
      // components/compat/ directory it never asked for.
      const copied: string[] = [];
      for (const { file, requires } of SHIM_FILES) {
        if (!isPkgInstalled(projectRoot, requires)) continue;
        const src = path.join(BUNDLED_SHIMS_DIR, file);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(compatDir, file);
        if (fs.existsSync(dest)) continue;
        if (!fs.existsSync(compatDir)) {
          fs.mkdirSync(compatDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
        copied.push(file);
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

      // ARKit authorisation strings. The renderer starts a WorldTrackingProvider and, where the
      // hardware has it, a HandTrackingProvider. On a device, starting a provider without the
      // matching usage description does not degrade — it raises
      // NSInternalInconsistencyException and terminates the app the moment the immersive space
      // opens. The Simulator never surfaces this, because it has no hand tracking and the
      // provider is never started, so the whole class of failure is invisible until hardware.
      let withUsage = updated;
      const usageKeys: [string, string][] = [
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
        if (withUsage.includes(`<key>${key}</key>`)) continue;
        withUsage = withUsage.replace(
          /<dict>/,
          `<dict>\n\t<key>${key}</key>\n\t<string>${description}</string>`
        );
      }
      if (withUsage !== updated) {
        console.log("[withViroVisionOS] Added the ARKit usage descriptions to Info.plist");
      }
      const finalPlist = withUsage;

      if (finalPlist !== plist) {
        fs.writeFileSync(plistPath, finalPlist, "utf-8");
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


// ─── 8. visionos/{App}/AppDelegate.swift — Expo's entry point and imports ─────
//
// The Callstack visionOS template is a bare React Native template: it asks Metro for
// `index`, and it does not import ReactAppDependencyProvider. An Expo app serves its entry
// through a virtual module instead, which `expo prebuild` writes into the iOS AppDelegate as
// `.expo/.virtual-metro-entry` — but prebuild does not manage the visionos/ folder's copy.
//
// Left alone, the app launches, connects to Metro, and sits on its loading spinner forever:
// Metro answers "Unable to resolve module ./index" and nothing surfaces in the UI.
const withVisionOSAppDelegate: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const projectName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");
      const appDelegatePath = path.join(
        projectRoot,
        "visionos",
        projectName,
        "AppDelegate.swift"
      );

      if (!fs.existsSync(appDelegatePath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `Could not find visionos/${projectName}/AppDelegate.swift. If the app hangs on its ` +
            `loading screen, point jsBundleURL(forBundleRoot:) at ".expo/.virtual-metro-entry".`
        );
        return newConfig;
      }

      let swift = fs.readFileSync(appDelegatePath, "utf-8");
      const before = swift;

      swift = swift.replace(
        /jsBundleURL\(forBundleRoot:\s*"index"\)/,
        'jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")'
      );

      // RCTAppDependencyProvider lives in its own module, and the bare template never imports it.
      if (
        swift.includes("RCTAppDependencyProvider") &&
        !swift.includes("import ReactAppDependencyProvider")
      ) {
        swift = swift.replace(
          /^(import React_RCTAppDelegate\n)/m,
          "$1import ReactAppDependencyProvider\n"
        );
      }

      if (swift !== before) {
        fs.writeFileSync(appDelegatePath, swift, "utf-8");
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
const withVisionOSBundlePhase: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const projectName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");
      const pbxPath = path.join(
        projectRoot,
        "visionos",
        `${projectName}.xcodeproj`,
        "project.pbxproj"
      );

      if (!fs.existsSync(pbxPath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `Could not find visionos/${projectName}.xcodeproj/project.pbxproj — the React Native ` +
            `bundling phase was left as the template wrote it. Device builds will fail on ` +
            `index.js not being found.`
        );
        return newConfig;
      }

      let pbx = fs.readFileSync(pbxPath, "utf-8");

      // The template's phase runs scripts out of whatever visionOS package it was generated
      // against, which is not this fork. Every such path is repointed, not just
      // react-native-xcode.sh: the phase also references with-environment.sh directly, and an
      // earlier version of this rule rewrote only the first on the assumption that the second was
      // sourced relative to it. It is not, so the build died with "with-environment.sh: No such
      // file or directory" after compiling everything.
      //
      // The pattern matches this package's own scope too, where the replacement is a no-op.
      const stalePackagePath = /@[a-z0-9-]+\/react-native-visionos\//g;
      const repointed = pbx.replace(
        stalePackagePath,
        `${resolveRNVisionSpecifier(projectRoot)}/`
      );
      if (repointed !== pbx) {
        pbx = repointed;
        fs.writeFileSync(pbxPath, pbx, "utf-8");
        console.log("[withViroVisionOS] Repointed the bundling phase at this fork's scripts");
      }

      if (pbx.includes("resolveAppEntry")) return newConfig; // idempotent

      // Anchor on the template's own first line. An earlier draft anchored on
      // `export PROJECT_ROOT=...`, which the template does not contain at all — it came
      // from the hand-edit this step replaces, so it would never have matched.
      const anchor = String.raw`set -e\n`;
      if (!pbx.includes(anchor)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "The visionOS bundling phase does not look like the Callstack template's. Set " +
            "ENTRY_FILE via expo/scripts/resolveAppEntry and SKIP_BUNDLING=1 in Debug by hand."
        );
        return newConfig;
      }

      const injected =
        anchor +
        String.raw`\n` +
        String.raw`export PROJECT_ROOT=\"$PROJECT_DIR\"/..\n` +
        String.raw`\n` +
        String.raw`if [[ \"$CONFIGURATION\" = *Debug* ]]; then\n  export SKIP_BUNDLING=1\nfi\n` +
        String.raw`\n` +
        String.raw`if [[ -z \"$ENTRY_FILE\" ]]; then\n` +
        String.raw`  export ENTRY_FILE=\"$(\"$NODE_BINARY\" -e \"require('expo/scripts/resolveAppEntry')\" \"$PROJECT_ROOT\" ios absolute | tail -n 1)\"\nfi\n`;

      fs.writeFileSync(pbxPath, pbx.replace(anchor, injected), "utf-8");
      console.log("[withViroVisionOS] Pointed the bundling phase at Expo's entry point");
      return newConfig;
    },
  ]);

// ─── 10. visionos/{App}/Fonts — icon fonts the app draws with ────────────────
//
// `@expo/vector-icons` draws a glyph as <Text> in a font it asks expo-font to register at
// runtime. The visionOS target has no Expo modules — its Podfile installs React Native and Viro,
// nothing else — so that registration is a no-op stub and every icon renders as a blank box. The
// platform has a second way in, which needs no native module: a font listed in UIAppFonts and
// present in the bundle is registered by the system before any JS runs.
//
// Only the families the project actually imports are copied. The full set is 3.9 MB and an app
// typically draws from one or two of them.
const VECTOR_ICON_FAMILIES = [
  "AntDesign", "Entypo", "EvilIcons", "Feather", "FontAwesome", "FontAwesome5_Brands",
  "FontAwesome5_Regular", "FontAwesome5_Solid", "FontAwesome6_Brands", "FontAwesome6_Regular",
  "FontAwesome6_Solid", "Fontisto", "Foundation", "Ionicons", "MaterialCommunityIcons",
  "MaterialIcons", "Octicons", "SimpleLineIcons", "Zocial",
];

function collectSourceText(dir: string, acc: string[], depth = 0): void {
  if (depth > 6 || !fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceText(full, acc, depth + 1);
    } else if (/\.(t|j)sx?$/.test(entry.name)) {
      try {
        acc.push(fs.readFileSync(full, "utf-8"));
      } catch {
        // unreadable file; nothing to scan
      }
    }
  }
}

const withVisionOSIconFonts: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const projectName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");
      const visionosDir = path.join(projectRoot, "visionos");
      if (!fs.existsSync(visionosDir)) return newConfig;

      let fontsSource: string;
      try {
        fontsSource = path.join(
          path.dirname(
            require.resolve("@expo/vector-icons/package.json", {
              paths: [projectRoot],
            })
          ),
          "build",
          "vendor",
          "react-native-vector-icons",
          "Fonts"
        );
      } catch {
        return newConfig; // the app does not use vector icons
      }
      if (!fs.existsSync(fontsSource)) return newConfig;

      const sources: string[] = [];
      for (const dir of ["app", "components", "src"]) {
        collectSourceText(path.join(projectRoot, dir), sources);
      }
      const text = sources.join("\n");
      const used = VECTOR_ICON_FAMILIES.filter(
        (family) =>
          text.includes(`@expo/vector-icons/${family}`) ||
          new RegExp(`\\b${family}\\b`).test(text)
      );
      if (used.length === 0) return newConfig;

      const fontsTarget = path.join(visionosDir, projectName, "Fonts");
      fs.mkdirSync(fontsTarget, { recursive: true });
      const copied: string[] = [];
      for (const family of used) {
        const from = path.join(fontsSource, `${family}.ttf`);
        if (!fs.existsSync(from)) continue;
        fs.copyFileSync(from, path.join(fontsTarget, `${family}.ttf`));
        copied.push(`${family}.ttf`);
      }
      // Fonts the app ships itself, which expo-font would have embedded on iOS.
      const appFonts = path.join(projectRoot, "assets", "fonts");
      if (fs.existsSync(appFonts)) {
        for (const name of fs.readdirSync(appFonts)) {
          if (!/\.(ttf|otf)$/i.test(name)) continue;
          fs.copyFileSync(path.join(appFonts, name), path.join(fontsTarget, name));
          copied.push(name);
        }
      }
      if (copied.length === 0) return newConfig;

      // ── the Xcode target has to copy them ──
      //
      // Added as a folder reference rather than one entry per file: the folder's contents are
      // copied whole, so a family added later needs no second edit here.
      const pbxPath = path.join(
        visionosDir,
        `${projectName}.xcodeproj`,
        "project.pbxproj"
      );
      if (fs.existsSync(pbxPath)) {
        let pbx = fs.readFileSync(pbxPath, "utf-8");
        if (!pbx.includes("/* Fonts */")) {
          const fileRefId = "VIR0F0NT5000000000000001";
          const buildFileId = "VIR0F0NT5000000000000002";
          pbx = pbx.replace(
            /(\/\* Begin PBXFileReference section \*\/\n)/,
            `$1\t\t${fileRefId} /* Fonts */ = {isa = PBXFileReference; lastKnownFileType = folder; name = Fonts; path = ${projectName}/Fonts; sourceTree = "<group>"; };\n`
          );
          pbx = pbx.replace(
            /(\/\* Begin PBXBuildFile section \*\/\n)/,
            `$1\t\t${buildFileId} /* Fonts in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* Fonts */; };\n`
          );
          // Into the app target's Resources phase, found by the asset catalog it already copies.
          pbx = pbx.replace(
            /(\n\t\t\t\t[A-Z0-9]+ \/\* Images\.xcassets in Resources \*\/,)/,
            `$1\n\t\t\t\t${buildFileId} /* Fonts in Resources */,`
          );
          // And into the group beside the asset catalog, so it is visible in Xcode.
          pbx = pbx.replace(
            /(\n\t\t\t\t[A-Z0-9]+ \/\* Images\.xcassets \*\/,)/,
            `$1\n\t\t\t\t${fileRefId} /* Fonts */,`
          );
          if (pbx.includes("Fonts in Resources")) {
            fs.writeFileSync(pbxPath, pbx, "utf-8");
            console.log(
              `[withViroVisionOS] Bundled the icon fonts with the visionOS target: ${copied.join(", ")}`
            );
          } else {
            WarningAggregator.addWarningIOS(
              "withViroVisionOS",
              "Could not add visionos/Fonts to the Xcode target's Resources phase. Drag the " +
                "Fonts folder into the target in Xcode, or icons will render as blank boxes."
            );
          }
        }
      }

      // ── and the system has to be told which files they are ──
      const plistPath = path.join(visionosDir, projectName, "Info.plist");
      if (fs.existsSync(plistPath)) {
        const plist = fs.readFileSync(plistPath, "utf-8");
        if (!plist.includes("<key>UIAppFonts</key>")) {
          const entries = copied
            .map((name) => `\t\t<string>Fonts/${name}</string>`)
            .join("\n");
          const updated = plist.replace(
            /<dict>/,
            `<dict>\n\t<key>UIAppFonts</key>\n\t<array>\n${entries}\n\t</array>`
          );
          if (updated !== plist) fs.writeFileSync(plistPath, updated, "utf-8");
        }
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
    withVisionOSAppDelegate,   // 8. AppDelegate.swift: Expo entry point + imports
    withVisionOSBundlePhase,   // 9. Xcode bundling phase: Expo entry + skip bundling in Debug
    withVisionOSIconFonts,     // 10. Fonts/: icon fonts in the bundle + UIAppFonts
  ]);

export default withViroVisionOS;
