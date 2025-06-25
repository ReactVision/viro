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
                // Add New Architecture enforcement
                viroPods +=
                    `\n\n  # Enforce New Architecture requirement\n` +
                        `  # ViroReact 2.43.1+ requires React Native New Architecture\n` +
                        `  if ENV['RCT_NEW_ARCH_ENABLED'] != '1'\n` +
                        `    raise "ViroReact requires New Architecture to be enabled. Please set RCT_NEW_ARCH_ENABLED=1 in ios/.xcode.env"\n` +
                        `  end`;
                // Insert the pods into the Podfile
                data = (0, insertLinesHelper_1.insertLinesHelper)(viroPods, "post_install do |installer|", data, -1);
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
const withDefaultInfoPlist = (config, props) => {
    let savePhotosPermission = withViro_1.DEFAULTS.ios.savePhotosPermission;
    let photosPermission = withViro_1.DEFAULTS.ios.photosPermission;
    let cameraUsagePermission = withViro_1.DEFAULTS.ios.cameraUsagePermission;
    let microphoneUsagePermission = withViro_1.DEFAULTS.ios.microphoneUsagePermission;
    if (Array.isArray(config.plugins)) {
        const pluginConfig = config?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro");
        if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
            const config = pluginConfig[1];
            savePhotosPermission =
                config.ios?.savePhotosPermission || savePhotosPermission;
            photosPermission = config.ios?.photosPermission || photosPermission;
            microphoneUsagePermission =
                config.ios?.microphoneUsagePermission || microphoneUsagePermission;
            cameraUsagePermission =
                config.ios?.cameraUsagePermission || cameraUsagePermission;
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
