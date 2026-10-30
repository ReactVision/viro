import {
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import fs from "fs";
import path from "path";
import { removeGeneratedBlock, wrapGeneratedBlock } from "./util/generatedBlock";
import { insertLinesHelper } from "./util/insertLinesHelper";
import { resolveViroOptions } from "./util/viroPluginOptions";
import { DEFAULTS, ViroConfigurationOptions } from "./withViro";

/**
 * Resolve the on-disk `@reactvision/react-viro/ios` directory as a path
 * relative to the iOS project root (where the Podfile lives).
 *
 * Hardcoding `../node_modules/...` assumes react-viro is installed in the app's
 * own `node_modules`. That is false under pnpm/yarn workspaces (and npm
 * workspaces), where the package is hoisted to the monorepo root or nested
 * under `.pnpm`, so `pod install` fails with "No podspec found for ViroKit".
 * Resolving via Node follows symlinks/hoisting and works in both flat and
 * workspace layouts.
 */
export function resolveViroIosRelativePath(projectRoot: string, iosRoot: string): string {
  const fallback = "../node_modules/@reactvision/react-viro/ios";
  try {
    const pkgJson = require.resolve("@reactvision/react-viro/package.json", {
      paths: [projectRoot],
    });
    // CocoaPods resolves :path relative to the directory of the Podfile (iosRoot).
    // Always emit POSIX separators (split on the current platform's sep and
    // re-join with "/") so the generated paths are valid on Windows too.
    return path.relative(iosRoot, path.join(path.dirname(pkgJson), "ios")).split(path.sep).join("/");
  } catch {
    return fallback;
  }
}

export interface ViroPodfileOptions {
  viroIosRoot: string;
  cloudAnchorProvider?: string;
  geospatialAnchorProvider?: string;
  iosLinkage?: "dynamic" | "static";
  includeARCore?: boolean;
  includeSemantics?: boolean;
}

const PODS_TAG = "viro-pods";
const LINKAGE_TAG = "viro-linkage";
const WEAK_LINKING_TAG = "viro-weak-linking";

// Blocks written before the begin/end markers existed. Removed so a prebuild over
// an older ios/ directory does not end up with a second copy.
const LEGACY_PODS_BLOCK =
  /^[ \t]*# ViroReact with integrated New Architecture \(Fabric\) support\n[\s\S]*?pod 'ViroKit'[^\n]*\n?(?:\n[ \t]*# ARCore SDK - Cloud Anchors[\s\S]*?pod 'ARCore\/Semantics'[^\n]*\n?)?(?:\n[ \t]*# Enforce New Architecture requirement\n[^\n]*\n[^\n]*\n[^\n]*\n[ \t]*end\n?)?/m;
const LEGACY_LINKAGE_BLOCK =
  /^(?:# WARNING: ARCore SDK typically requires dynamic frameworks\.\n# Static linkage[^\n]*\n|# Framework linkage[^\n]*\n)use_frameworks! :linkage => :\w+\n\n?/gm;
const LEGACY_WEAK_LINKING_BLOCK =
  /^[ \t]*# ViroKit ARCore weak linking - makes ARCore frameworks optional at runtime\n[\s\S]*?config\.build_settings\['OTHER_LDFLAGS'\] = other_ldflags\n[ \t]*end\n[ \t]*end\n/m;

/**
 * Returns the Podfile with Viro's pods, framework linkage and ARCore weak
 * linking hook applied. Each piece sits between begin/end markers, so running
 * it again, or with different options, replaces the previous block.
 */
export function applyViroPodfile(data: string, options: ViroPodfileOptions): string {
  const {
    viroIosRoot,
    cloudAnchorProvider,
    geospatialAnchorProvider,
    iosLinkage,
    includeARCore,
    includeSemantics,
  } = options;

  data = removeGeneratedBlock(data, PODS_TAG);
  data = removeGeneratedBlock(data, LINKAGE_TAG);
  data = removeGeneratedBlock(data, WEAK_LINKING_TAG);
  data = data
    .replace(LEGACY_PODS_BLOCK, "")
    .replace(LEGACY_LINKAGE_BLOCK, "")
    .replace(LEGACY_WEAK_LINKING_BLOCK, "");

  // ViroReact with integrated Fabric support
  let viroPods =
    `  # ViroReact with integrated New Architecture (Fabric) support\n` +
    `  # Automatically includes Fabric components when RCT_NEW_ARCH_ENABLED=1\n` +
    `  pod 'ViroReact', :path => '${viroIosRoot}'\n` +
    `  pod 'ViroKit', :path => '${viroIosRoot}/dist/ViroRenderer/'`;

  // Add ARCore pods if enabled (explicitly via includeARCore/includeSemantics or implicitly via providers)
  // ViroKit.podspec declares these as weak_frameworks, making ARCore optional at runtime
  const needsARCoreForFeatures = cloudAnchorProvider === "arcore" || geospatialAnchorProvider === "arcore";
  const shouldIncludeARCore = includeARCore === true || needsARCoreForFeatures;
  const shouldIncludeSemantics = shouldIncludeARCore || includeSemantics === true;

  if (shouldIncludeSemantics) {
    viroPods +=
      `\n\n  # ARCore SDK - Cloud Anchors, Geospatial, and Scene Semantics API\n` +
      `  # ViroKit uses weak linking for these frameworks, making ARCore optional at runtime.\n` +
      `  # ViroKit checks availability using NSClassFromString and gracefully degrades if not present.\n` +
      `  pod 'ARCore/CloudAnchors', '~> 1.51.0'`;

    // Add Geospatial pod if geospatial is enabled or full ARCore inclusion
    if (geospatialAnchorProvider === "arcore" || includeARCore === true) {
      viroPods +=
        `\n  pod 'ARCore/Geospatial', '~> 1.51.0'`;
    }

    // Add Semantics pod for Scene Semantics API (ML-based scene understanding)
    // Included whenever ARCore is present OR includeSemantics: true
    viroPods +=
      `\n  pod 'ARCore/Semantics', '~> 1.51.0'`;
  }

  // Add use_frameworks! if configured
  // User's iosLinkage setting is respected; if not set and ARCore/Semantics is enabled, default to dynamic
  const effectiveLinkage = iosLinkage || (shouldIncludeSemantics ? "dynamic" : undefined);
  if (effectiveLinkage) {
    // Insert use_frameworks! before the target block
    let linkageComment: string;
    if (shouldIncludeSemantics && effectiveLinkage === "static") {
      // Warn user that static linkage may not work with ARCore
      linkageComment = `# WARNING: ARCore SDK typically requires dynamic frameworks.\n# Static linkage is set but may cause build issues with ARCore pods.`;
    } else if (shouldIncludeSemantics) {
      linkageComment = `# Framework linkage: ${effectiveLinkage} (ARCore requires dynamic frameworks)`;
    } else {
      linkageComment = `# Framework linkage configured via app.json (iosLinkage: "${effectiveLinkage}")`;
    }
    data = insertLinesHelper(
      wrapGeneratedBlock(
        LINKAGE_TAG,
        `${linkageComment}\nuse_frameworks! :linkage => :${effectiveLinkage}`
      ),
      "target '",
      data,
      -1
    );
  }

  // Insert the pods into the Podfile
  data = insertLinesHelper(
    wrapGeneratedBlock(PODS_TAG, viroPods, "#", "  "),
    "post_install do |installer|",
    data,
    -1
  );

  // Add ViroKit ARCore weak linking post_install hook if ARCore is enabled
  if (shouldIncludeARCore) {
    const weakLinkingHook = `    # ViroKit ARCore weak linking - makes ARCore frameworks optional at runtime
    # Only applied when ARCore pods are installed to prevent linker errors
    virokit_targets = installer.pods_project.targets.select { |target|
      target.name.include?('ViroKit') ||
      target.dependencies.any? { |dep| dep.name.include?('ViroKit') }
    }

    arcore_frameworks = ['ARCoreBase', 'ARCoreGARSession', 'ARCoreCloudAnchors',
                         'ARCoreGeospatial', 'ARCoreSemantics', 'ARCoreTFShared',
                         'FBLPromises', 'GoogleDataTransport', 'GoogleUtilities',
                         'FirebaseABTesting', 'FirebaseCore', 'FirebaseCoreInternal',
                         'FirebaseInstallations', 'FirebaseRemoteConfig',
                         'FirebaseRemoteConfigInterop', 'FirebaseSharedSwift',
                         'GTMSessionFetcher', 'nanopb']

    virokit_targets.each do |target|
      target.build_configurations.each do |config|
        other_ldflags = config.build_settings['OTHER_LDFLAGS'] || ['$(inherited)']
        other_ldflags = [other_ldflags] if other_ldflags.is_a?(String)

        arcore_frameworks.each do |framework|
          unless other_ldflags.include?('-weak_framework') && other_ldflags.include?(framework)
            other_ldflags << '-weak_framework'
            other_ldflags << framework
          end
        end

        config.build_settings['OTHER_LDFLAGS'] = other_ldflags
      end
    end`;

    // Insert weak linking hook inside post_install block (right after the block starts)
    data = insertLinesHelper(
      wrapGeneratedBlock(WEAK_LINKING_TAG, weakLinkingHook, "#", "    "),
      "post_install do |installer|",
      data,
      1
    );
  }

  return data;
}

const withViroPods: ConfigPlugin<ViroConfigurationOptions> = (config, props) => {
  const options = resolveViroOptions(config, props);
  // Resolve unified provider prop; old props override for backward compat.
  // Default to "reactvision" only when rvApiKey is present (implies RV intent).
  const defaultProvider = options.rvApiKey ? "reactvision" : undefined;
  const legacyOpts = options as { cloudAnchorProvider?: string; geospatialAnchorProvider?: string };
  const cloudAnchorProvider = legacyOpts.cloudAnchorProvider ?? options.provider ?? defaultProvider;
  const geospatialAnchorProvider = legacyOpts.geospatialAnchorProvider ?? options.provider ?? defaultProvider;

  return withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const root = newConfig.modRequest.platformProjectRoot;
      const projectRoot = newConfig.modRequest.projectRoot;
      const podfilePath = path.join(root, "Podfile");

      const data = await fs.promises.readFile(podfilePath, "utf-8");
      const updated = applyViroPodfile(data, {
        viroIosRoot: resolveViroIosRelativePath(projectRoot, root),
        cloudAnchorProvider,
        geospatialAnchorProvider,
        iosLinkage: options.iosLinkage,
        includeARCore: options.ios?.includeARCore,
        includeSemantics: options.ios?.includeSemantics,
      });
      if (updated !== data) {
        await fs.promises.writeFile(podfilePath, updated, "utf-8");
      }
      return newConfig;
    },
  ]);
};

const withEnabledBitcode: ConfigPlugin = (config) =>
  withXcodeProject(config, async (newConfig) => {
    newConfig.modResults.addBuildProperty("ENABLE_BITCODE", "NO", "Release");
    return newConfig;
  });

const setExcludedArchitectures = (
  project: ExportedConfigWithProps<XcodeProject>["modResults"]
) => {
  const configurations = project.pbxXCBuildConfigurationSection();

  // @ts-ignore
  for (const { buildSettings } of Object.values(configurations || {})) {
    if (
      typeof (buildSettings === null || buildSettings === void 0
        ? void 0
        : buildSettings.PRODUCT_NAME) !== "undefined"
    ) {
      buildSettings['"EXCLUDED_ARCHS[sdk=iphonesimulator*]"'] = '"arm64"';
    }
  }

  return project;
};

const withExcludedSimulatorArchitectures = (config: ExpoConfig) => {
  return withXcodeProject(config, (newConfig) => {
    newConfig.modResults = setExcludedArchitectures(newConfig.modResults);
    return newConfig;
  });
};

export const withDefaultInfoPlist: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  let savePhotosPermission = DEFAULTS.ios.savePhotosPermission;
  let photosPermission = DEFAULTS.ios.photosPermission;
  let cameraUsagePermission = DEFAULTS.ios.cameraUsagePermission;
  let microphoneUsagePermission = DEFAULTS.ios.microphoneUsagePermission;
  let locationUsagePermission = DEFAULTS.ios.locationUsagePermission;
  let googleCloudApiKey: string | undefined;
  let rvApiKey: string | undefined;
  let rvProjectId: string | undefined;
  let rvEndpoint: string | undefined;
  let cloudAnchorProvider: string | undefined;
  let geospatialAnchorProvider: string | undefined;
  let includeARCore: boolean | undefined;

  const pluginOptions = resolveViroOptions(config, props);
  savePhotosPermission =
    pluginOptions.ios?.savePhotosPermission || savePhotosPermission;
  photosPermission = pluginOptions.ios?.photosPermission || photosPermission;
  microphoneUsagePermission =
    pluginOptions.ios?.microphoneUsagePermission || microphoneUsagePermission;
  cameraUsagePermission =
    pluginOptions.ios?.cameraUsagePermission || cameraUsagePermission;
  locationUsagePermission =
    pluginOptions.ios?.locationUsagePermission || locationUsagePermission;
  googleCloudApiKey = pluginOptions.googleCloudApiKey;
  rvApiKey = pluginOptions.rvApiKey;
  rvProjectId = pluginOptions.rvProjectId;
  rvEndpoint = pluginOptions.rvEndpoint;
  // Resolve unified provider prop; old props override for backward compat.
  // Default to "reactvision" only when rvApiKey is present (implies RV intent).
  const defaultProvider2 = pluginOptions.rvApiKey ? "reactvision" : undefined;
  const legacyOpts2 = pluginOptions as { cloudAnchorProvider?: string; geospatialAnchorProvider?: string };
  cloudAnchorProvider = legacyOpts2.cloudAnchorProvider ?? pluginOptions.provider ?? defaultProvider2;
  geospatialAnchorProvider = legacyOpts2.geospatialAnchorProvider ?? pluginOptions.provider ?? defaultProvider2;
  includeARCore = pluginOptions.ios?.includeARCore;

  if (!config.ios) config.ios = {};
  if (!config.ios.infoPlist) config.ios.infoPlist = {};
  config.ios.infoPlist.NSPhotoLibraryUsageDescription =
    config.ios.infoPlist.NSPhotoLibraryUsageDescription || photosPermission;
  config.ios.infoPlist.NSPhotoLibraryAddUsageDescription =
    config.ios.infoPlist.NSPhotoLibraryAddUsageDescription ||
    savePhotosPermission;
  config.ios.infoPlist.NSCameraUsageDescription =
    config.ios.infoPlist.NSCameraUsageDescription || cameraUsagePermission;
  config.ios.infoPlist.NSMicrophoneUsageDescription =
    config.ios.infoPlist.NSMicrophoneUsageDescription ||
    microphoneUsagePermission;

  // Add Google Cloud API key for ARCore Cloud Anchors and Geospatial API (iOS)
  if (googleCloudApiKey) {
    config.ios.infoPlist.GARAPIKey = googleCloudApiKey;
  }

  // Add ReactVision credentials for ReactVision Cloud Anchors and Geospatial API (iOS)
  if (rvApiKey) {
    config.ios.infoPlist.RVApiKey = rvApiKey;
  }
  if (rvProjectId) {
    config.ios.infoPlist.RVProjectId = rvProjectId;
  }
  if (rvEndpoint) {
    config.ios.infoPlist.RVEndpoint = rvEndpoint;
  }

  // Add location permissions for Geospatial API
  if (geospatialAnchorProvider === "arcore" || geospatialAnchorProvider === "reactvision" || includeARCore === true) {
    config.ios.infoPlist.NSLocationWhenInUseUsageDescription =
      config.ios.infoPlist.NSLocationWhenInUseUsageDescription || locationUsagePermission;
    config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
      config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription || locationUsagePermission;
  }

  return config;
};

// A mod rather than config.ios.infoPlist, which is merged over an existing Info.plist and so
// can add a key but never remove one.
export const withViroTelemetryInfoPlist = (config: ExpoConfig, props?: ViroConfigurationOptions) => {
  const options = resolveViroOptions(config, props);
  return withInfoPlist(config, (newConfig) => {
    if (options.telemetry === false) {
      newConfig.modResults.ViroTelemetryEnabled = false;
    } else {
      delete newConfig.modResults.ViroTelemetryEnabled;
    }
    return newConfig;
  });
};

export const withViroIos: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  config = withViroPods(config, props);
  withDefaultInfoPlist(config, props);
  config = withViroTelemetryInfoPlist(config, props);
  withEnabledBitcode(config);
  withExcludedSimulatorArchitectures(config);
  return config;
};
