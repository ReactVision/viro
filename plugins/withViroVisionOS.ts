/**
 * withViroVisionOS.ts
 *
 * Expo config plugin that wires ViroReact into a react-native-visionos project.
 *
 * Fully automated — just add to app.json and run expo prebuild:
 *   1. Installs @callstack/react-native-visionos + @callstack/out-of-tree-platforms
 *   2. Generates the visionos/ platform folder via react-native-visionos CLI
 *   3. Patches metro.config.js with the visionOS platform resolver rewrite
 *   4. Injects ViroKit + ViroReact pods into visionos/Podfile
 *   5. Patches visionos/{AppName}/{AppName}App.swift to add the ImmersiveSpace
 *      scene and .viroImmersiveSpaceController() modifier
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
 */

import {
  ConfigPlugin,
  withDangerousMod,
  withPlugins,
  WarningAggregator,
} from "@expo/config-plugins";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const PODFILE_MARKER = "# viro-visionos";
const METRO_MARKER = "// viro-visionos";
const RNVISION_PKG = "@callstack/react-native-visionos";
const RNVISION_PLATFORMS_PKG = "@callstack/out-of-tree-platforms";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPackageManager(projectRoot: string): "npm" | "yarn" | "pnpm" | "bun" {
  if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  return "npm";
}

function installCmd(pm: "npm" | "yarn" | "pnpm" | "bun", ...pkgs: string[]): string {
  const list = pkgs.join(" ");
  switch (pm) {
    case "yarn":  return `yarn add --dev ${list}`;
    case "pnpm":  return `pnpm add -D ${list}`;
    case "bun":   return `bun add -d ${list}`;
    default:      return `npm install --save-dev ${list}`;
  }
}

function isPkgInstalled(projectRoot: string, pkg: string): boolean {
  try {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")
    );
    return !!(
      pkgJson.dependencies?.[pkg] ||
      pkgJson.devDependencies?.[pkg]
    );
  } catch {
    return false;
  }
}

// ─── 1. Install deps + verify visionos/ folder exists ────────────────────────

const withVisionOSSetup: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const visionosDir = path.join(projectRoot, "visionos");
      const pm = detectPackageManager(projectRoot);

      // 1a. Install @callstack/react-native-visionos if missing
      const missingPkgs = [RNVISION_PKG, RNVISION_PLATFORMS_PKG].filter(
        (pkg) => !isPkgInstalled(projectRoot, pkg)
      );

      if (missingPkgs.length > 0) {
        console.log(`[withViroVisionOS] Installing ${missingPkgs.join(", ")}…`);
        try {
          execSync(installCmd(pm, ...missingPkgs), {
            cwd: projectRoot,
            stdio: "inherit",
          });
        } catch (e) {
          WarningAggregator.addWarningIOS(
            "withViroVisionOS",
            `Failed to install visionOS deps. Run manually:\n  ${installCmd(pm, ...missingPkgs)}`
          );
          return newConfig;
        }
      }

      // 1b. Verify visionos/ folder exists — must be created manually before prebuild
      if (!fs.existsSync(visionosDir)) {
        const appName = (config.name as string).replace(/[^a-zA-Z0-9]/g, "");
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `visionos/ folder not found. Create it once before running expo prebuild:\n\n` +
            `  npx @react-native-community/cli@latest init "${appName}" --template @callstack/visionos-template@latest --skip-install\n` +
            `  cp -r "${appName}/visionos" ./visionos\n` +
            `  rm -rf "${appName}"\n\n` +
            `Then re-run: expo prebuild --platform ios`
        );
        return newConfig;
      }

      return newConfig;
    },
  ]);
};

// ─── 2. metro.config.js — visionOS platform resolver ─────────────────────────

const METRO_PATCH = `
${METRO_MARKER} — visionOS platform resolver
const { getPlatformResolver } = require('${RNVISION_PLATFORMS_PKG}');
config.resolver.resolveRequest = getPlatformResolver({
  platformNameMap: { visionos: '${RNVISION_PKG}' },
});
`;

const withVisionOSMetroConfig: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
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
};

// ─── 3. visionos/Podfile — inject ViroKit + ViroReact ────────────────────────

const withVisionOSPodfile: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, "visionos", "Podfile");

      if (!fs.existsSync(podfilePath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          "visionos/Podfile not found after setup — Viro pods were not injected."
        );
        return newConfig;
      }

      let podfile = fs.readFileSync(podfilePath, "utf-8");
      if (podfile.includes(PODFILE_MARKER)) return newConfig; // idempotent

      // Remove :app_path from use_react_native! to skip codegen.
      // @callstack/react-native-visionos lags behind the project's react-native
      // version and the bundled codegen tools cannot parse newer RN specs.
      // ViroReact uses RCT macros (not turbo modules) so codegen is not needed.
      podfile = podfile.replace(
        /use_react_native!\(\s*\n(\s*:path\s*=>[^\n]+),?\s*\n\s*#[^\n]*\n\s*:app_path\s*=>[^\n]+\n(\s*\))/m,
        "use_react_native!(\n$1\n$2"
      );

      const viroPods = [
        "",
        `  ${PODFILE_MARKER}`,
        `  pod 'ViroKit', :path => '../node_modules/@reactvision/react-viro/ios/dist/ViroRendererVisionOS/'`,
        `  pod 'ViroReact', :path => '../node_modules/@reactvision/react-viro/ios'`,
      ].join("\n");

      // Inject inside the first target block (the main app target).
      podfile = podfile.replace(
        /^(target '[^']+' do)([\s\S]*?)^end/m,
        (_, header, body) => `${header}${body}${viroPods}\nend`
      );

      fs.writeFileSync(podfilePath, podfile, "utf-8");
      return newConfig;
    },
  ]);
};

// ─── 4. visionos/{AppName}/{AppName}App.swift — inject ImmersiveSpace ─────────

const withVisionOSAppSwift: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const projectRoot = newConfig.modRequest.projectRoot;
      const projectName = (config.name as string).replace(/\s+/g, "");
      const appSwiftPath = path.join(
        projectRoot,
        "visionos",
        projectName,
        `${projectName}App.swift`
      );

      if (!fs.existsSync(appSwiftPath)) {
        WarningAggregator.addWarningIOS(
          "withViroVisionOS",
          `${appSwiftPath} not found — add these manually to your App struct:\n` +
            "  1. import ViroReact\n" +
            "  2. @State private var immersionStyle: ImmersionStyle = .mixed\n" +
            "  3. .viroImmersiveSpaceController() on your WindowGroup root view\n" +
            "  4. ImmersiveSpace(id: ViroImmersiveSpace.id) { ViroImmersiveSpaceView() }\n" +
            "       .immersionStyle(selection: $immersionStyle, in: .mixed, .full, .progressive)"
        );
        return newConfig;
      }

      let swift = fs.readFileSync(appSwiftPath, "utf-8");
      if (swift.includes("ViroImmersiveSpace")) return newConfig; // idempotent

      // 4a. Add import ViroReact
      if (!swift.includes("import ViroReact")) {
        swift = swift.replace("import SwiftUI", "import SwiftUI\nimport ViroReact");
      }

      // 4b. Add @State for immersionStyle before `var body`
      if (!swift.includes("immersionStyle")) {
        swift = swift.replace(
          /(\n(\s+)var body: some Scene)/,
          "\n$2@State private var immersionStyle: ImmersionStyle = .mixed$1"
        );
      }

      // 4c. Add .viroImmersiveSpaceController() + ImmersiveSpace after WindowGroup
      if (!swift.includes("viroImmersiveSpaceController")) {
        swift = swift.replace(
          /(WindowGroup\s*\{[\s\S]*?\}\s*\n)/,
          "$1" +
            "            .viroImmersiveSpaceController()\n\n" +
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
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const withViroVisionOS: ConfigPlugin = (config) => {
  return withPlugins(config, [
    withVisionOSSetup,        // installs deps + generates visionos/ folder
    withVisionOSMetroConfig,  // patches metro.config.js
    withVisionOSPodfile,      // injects ViroKit + ViroReact into visionos/Podfile
    withVisionOSAppSwift,     // patches App.swift with ImmersiveSpace
  ]);
};

export default withViroVisionOS;
