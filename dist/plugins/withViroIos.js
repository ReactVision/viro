"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withViroIos = exports.withDefaultInfoPlist = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const insertLinesHelper_1 = require("./util/insertLinesHelper");
const withViro_1 = require("./withViro");
const withViroPods = (config) => {
    config = (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (newConfig) => {
            const root = newConfig.modRequest.platformProjectRoot;
            // Check plugin configuration options
            let cloudAnchorProvider;
            let geospatialAnchorProvider;
            let iosLinkage;
            let includeARCore;
            if (Array.isArray(config.plugins)) {
                const pluginConfig = config?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
                if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
                    const options = pluginConfig[1];
                    cloudAnchorProvider = options.cloudAnchorProvider;
                    geospatialAnchorProvider = options.geospatialAnchorProvider;
                    iosLinkage = options.iosLinkage;
                    includeARCore = options.ios?.includeARCore;
                }
            }
            fs_1.default.readFile(`${root}/Podfile`, "utf-8", (err, data) => {
                // Check for New Architecture environment variable
                if (!data.includes('ENV["RCT_NEW_ARCH_ENABLED"]') &&
                    !data.includes("RCT_NEW_ARCH_ENABLED=1")) {
                    config_plugins_1.WarningAggregator.addWarningIOS("withViroIos", "ViroReact requires New Architecture to be enabled. " +
                        "Please set RCT_NEW_ARCH_ENABLED=1 in your ios/.xcode.env file.");
                }
                // ViroReact with integrated Fabric support
                let viroPods = `  # ViroReact with integrated New Architecture (Fabric) support\n` +
                    `  # Automatically includes Fabric components when RCT_NEW_ARCH_ENABLED=1\n` +
                    `  pod 'ViroReact', :path => '../node_modules/@reactvision/react-viro/ios'\n` +
                    `  pod 'ViroKit', :path => '../node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/'`;
                // Add ARCore pods if enabled (explicitly via includeARCore or implicitly via cloud/geospatial providers)
                // ViroKit.podspec declares these as weak_frameworks, making ARCore optional at runtime
                const needsARCoreForFeatures = cloudAnchorProvider === "arcore" || geospatialAnchorProvider === "arcore";
                const shouldIncludeARCore = includeARCore === true || needsARCoreForFeatures;
                if (shouldIncludeARCore) {
                    viroPods +=
                        `\n\n  # ARCore SDK - Cloud Anchors, Geospatial, and Scene Semantics API\n` +
                            `  # ViroKit uses weak linking for these frameworks, making ARCore optional at runtime.\n` +
                            `  # ViroKit checks availability using NSClassFromString and gracefully degrades if not present.\n` +
                            `  pod 'ARCore/CloudAnchors', '~> 1.51.0'`;
                    // Add Geospatial pod if geospatial is enabled or explicit ARCore inclusion
                    if (geospatialAnchorProvider === "arcore" || includeARCore === true) {
                        viroPods +=
                            `\n  pod 'ARCore/Geospatial', '~> 1.51.0'`;
                    }
                    // Add Semantics pod for Scene Semantics API (ML-based scene understanding)
                    viroPods +=
                        `\n  pod 'ARCore/Semantics', '~> 1.51.0'`;
                }
                // Add use_frameworks! if configured
                // User's iosLinkage setting is respected; if not set and ARCore is enabled, default to dynamic
                const effectiveLinkage = iosLinkage || (shouldIncludeARCore ? "dynamic" : undefined);
                if (effectiveLinkage) {
                    // Insert use_frameworks! before the target block
                    let linkageComment;
                    if (shouldIncludeARCore && effectiveLinkage === "static") {
                        // Warn user that static linkage may not work with ARCore
                        linkageComment = `# WARNING: ARCore SDK typically requires dynamic frameworks.\n# Static linkage is set but may cause build issues with ARCore pods.`;
                    }
                    else if (shouldIncludeARCore) {
                        linkageComment = `# Framework linkage: ${effectiveLinkage} (ARCore requires dynamic frameworks)`;
                    }
                    else {
                        linkageComment = `# Framework linkage configured via app.json (iosLinkage: "${effectiveLinkage}")`;
                    }
                    data = (0, insertLinesHelper_1.insertLinesHelper)(`${linkageComment}\nuse_frameworks! :linkage => :${effectiveLinkage}\n`, "target '", data, -1);
                }
                // Add New Architecture enforcement
                viroPods +=
                    `\n\n  # Enforce New Architecture requirement\n` +
                        `  # ViroReact 2.43.1+ requires React Native New Architecture\n` +
                        `  if ENV['RCT_NEW_ARCH_ENABLED'] != '1'\n` +
                        `    raise "ViroReact requires New Architecture to be enabled. Please set RCT_NEW_ARCH_ENABLED=1 in ios/.xcode.env"\n` +
                        `  end`;
                // Insert the pods into the Podfile
                data = (0, insertLinesHelper_1.insertLinesHelper)(viroPods, "post_install do |installer|", data, -1);
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
                    data = (0, insertLinesHelper_1.insertLinesHelper)(weakLinkingHook, "post_install do |installer|", data, 1);
                }
                fs_1.default.writeFile(`${root}/Podfile`, data, "utf-8", function (err) {
                    if (err)
                        console.log("Error writing Podfile");
                });
            });
            return newConfig;
        },
    ]);
    return config;
};
const withEnabledBitcode = (config) => (0, config_plugins_1.withXcodeProject)(config, async (newConfig) => {
    newConfig.modResults.addBuildProperty("ENABLE_BITCODE", "NO", "Release");
    return newConfig;
});
const setExcludedArchitectures = (project) => {
    const configurations = project.pbxXCBuildConfigurationSection();
    // @ts-ignore
    for (const { buildSettings } of Object.values(configurations || {})) {
        if (typeof (buildSettings === null || buildSettings === void 0
            ? void 0
            : buildSettings.PRODUCT_NAME) !== "undefined") {
            buildSettings['"EXCLUDED_ARCHS[sdk=iphonesimulator*]"'] = '"arm64"';
        }
    }
    return project;
};
const withExcludedSimulatorArchitectures = (config) => {
    return (0, config_plugins_1.withXcodeProject)(config, (newConfig) => {
        newConfig.modResults = setExcludedArchitectures(newConfig.modResults);
        return newConfig;
    });
};
const withDefaultInfoPlist = (config, _props) => {
    let savePhotosPermission = withViro_1.DEFAULTS.ios.savePhotosPermission;
    let photosPermission = withViro_1.DEFAULTS.ios.photosPermission;
    let cameraUsagePermission = withViro_1.DEFAULTS.ios.cameraUsagePermission;
    let microphoneUsagePermission = withViro_1.DEFAULTS.ios.microphoneUsagePermission;
    let locationUsagePermission = withViro_1.DEFAULTS.ios.locationUsagePermission;
    let googleCloudApiKey;
    let cloudAnchorProvider;
    let geospatialAnchorProvider;
    let includeARCore;
    if (Array.isArray(config.plugins)) {
        const pluginConfig = config?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
        if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
            const pluginOptions = pluginConfig[1];
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
            cloudAnchorProvider = pluginOptions.cloudAnchorProvider;
            geospatialAnchorProvider = pluginOptions.geospatialAnchorProvider;
            includeARCore = pluginOptions.ios?.includeARCore;
        }
    }
    if (!config.ios)
        config.ios = {};
    if (!config.ios.infoPlist)
        config.ios.infoPlist = {};
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
    // Add location permissions for Geospatial API
    if (geospatialAnchorProvider === "arcore" || includeARCore === true) {
        config.ios.infoPlist.NSLocationWhenInUseUsageDescription =
            config.ios.infoPlist.NSLocationWhenInUseUsageDescription || locationUsagePermission;
        config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
            config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription || locationUsagePermission;
    }
    return config;
};
exports.withDefaultInfoPlist = withDefaultInfoPlist;
const withViroIos = (config, props) => {
    (0, config_plugins_1.withPlugins)(config, [[withViroPods, props]]);
    (0, exports.withDefaultInfoPlist)(config, props);
    withEnabledBitcode(config);
    withExcludedSimulatorArchitectures(config);
    return config;
};
exports.withViroIos = withViroIos;
