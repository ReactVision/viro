import {
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
  withDangerousMod,
  withPlugins,
  withXcodeProject,
  WarningAggregator,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import fs from "fs";
import { insertLinesHelper } from "./util/insertLinesHelper";
import { DEFAULTS, ViroConfigurationOptions } from "./withViro";

const withViroPods = (config: ExpoConfig) => {
  config = withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const root = newConfig.modRequest.platformProjectRoot;

      // Check plugin configuration options
      let cloudAnchorProvider: string | undefined;
      let geospatialAnchorProvider: string | undefined;
      let iosLinkage: "dynamic" | "static" | undefined;
      let includeARCore: boolean | undefined;
      let includeSemantics: boolean | undefined;
      if (Array.isArray(config.plugins)) {
        const pluginConfig = config?.plugins?.find(
          (plugin) =>
            Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
        );
        if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
          const options = pluginConfig[1] as ViroConfigurationOptions;
          // Resolve unified provider prop; old props override for backward compat.
          // Default to "reactvision" only when rvApiKey is present (implies RV intent).
          const defaultProvider = options.rvApiKey ? "reactvision" : undefined;
          const legacyOpts = options as { cloudAnchorProvider?: string; geospatialAnchorProvider?: string };
          cloudAnchorProvider = legacyOpts.cloudAnchorProvider ?? options.provider ?? defaultProvider;
          geospatialAnchorProvider = legacyOpts.geospatialAnchorProvider ?? options.provider ?? defaultProvider;
          iosLinkage = options.iosLinkage;
          includeARCore = options.ios?.includeARCore;
          includeSemantics = options.ios?.includeSemantics;
        }
      }

      fs.readFile(`${root}/Podfile`, "utf-8", (err, data) => {
        // Check for New Architecture environment variable
        if (
          !data.includes('ENV["RCT_NEW_ARCH_ENABLED"]') &&
          !data.includes("RCT_NEW_ARCH_ENABLED=1")
        ) {
          WarningAggregator.addWarningIOS(
            "withViroIos",
            "ViroReact requires New Architecture to be enabled. " +
              "Please set RCT_NEW_ARCH_ENABLED=1 in your ios/.xcode.env file."
          );
        }

        // ViroReact with integrated Fabric support
        let viroPods =
          `  # ViroReact with integrated New Architecture (Fabric) support\n` +
          `  # Automatically includes Fabric components when RCT_NEW_ARCH_ENABLED=1\n` +
          `  pod 'ViroReact', :path => '../node_modules/@reactvision/react-viro/ios'\n` +
          `  pod 'ViroKit', :path => '../node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/'`;

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
            `${linkageComment}\nuse_frameworks! :linkage => :${effectiveLinkage}\n`,
            "target '",
            data,
            -1
          );
        }

        // Add New Architecture enforcement
        viroPods +=
          `\n\n  # Enforce New Architecture requirement\n` +
          `  # ViroReact 2.43.1+ requires React Native New Architecture\n` +
          `  if ENV['RCT_NEW_ARCH_ENABLED'] != '1'\n` +
          `    raise "ViroReact requires New Architecture to be enabled. Please set RCT_NEW_ARCH_ENABLED=1 in ios/.xcode.env"\n` +
          `  end`;

        // Insert the pods into the Podfile
        data = insertLinesHelper(
          viroPods,
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
    end
`;

          // Insert weak linking hook inside post_install block (right after the block starts)
          data = insertLinesHelper(
            weakLinkingHook,
            "post_install do |installer|",
            data,
            1
          );
        }

        fs.writeFile(`${root}/Podfile`, data, "utf-8", function (err) {
          if (err) console.log("Error writing Podfile");
        });
      });
      return newConfig;
    },
  ]);

  return config;
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
  _props
) => {
  let savePhotosPermission = DEFAULTS.ios.savePhotosPermission;
  let photosPermission = DEFAULTS.ios.photosPermission;
  let cameraUsagePermission = DEFAULTS.ios.cameraUsagePermission;
  let microphoneUsagePermission = DEFAULTS.ios.microphoneUsagePermission;
  let locationUsagePermission = DEFAULTS.ios.locationUsagePermission;
  let googleCloudApiKey: string | undefined;
  let rvApiKey: string | undefined;
  let rvProjectId: string | undefined;
  let cloudAnchorProvider: string | undefined;
  let geospatialAnchorProvider: string | undefined;
  let includeARCore: boolean | undefined;

  if (Array.isArray(config.plugins)) {
    const pluginConfig = config?.plugins?.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
    );
    if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
      const pluginOptions = pluginConfig[1] as ViroConfigurationOptions;
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
      // Resolve unified provider prop; old props override for backward compat.
      // Default to "reactvision" only when rvApiKey is present (implies RV intent).
      const defaultProvider2 = pluginOptions.rvApiKey ? "reactvision" : undefined;
      const legacyOpts2 = pluginOptions as { cloudAnchorProvider?: string; geospatialAnchorProvider?: string };
      cloudAnchorProvider = legacyOpts2.cloudAnchorProvider ?? pluginOptions.provider ?? defaultProvider2;
      geospatialAnchorProvider = legacyOpts2.geospatialAnchorProvider ?? pluginOptions.provider ?? defaultProvider2;
      includeARCore = pluginOptions.ios?.includeARCore;
    }
  }

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

  // Add location permissions for Geospatial API
  if (geospatialAnchorProvider === "arcore" || geospatialAnchorProvider === "reactvision" || includeARCore === true) {
    config.ios.infoPlist.NSLocationWhenInUseUsageDescription =
      config.ios.infoPlist.NSLocationWhenInUseUsageDescription || locationUsagePermission;
    config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
      config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription || locationUsagePermission;
  }

  return config;
};

export const withViroIos: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  config = withPlugins(config, [[withViroPods, props]]);
  withDefaultInfoPlist(config, props);
  withEnabledBitcode(config);
  withExcludedSimulatorArchitectures(config);
  return config;
};
