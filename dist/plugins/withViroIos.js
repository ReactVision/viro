"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withViroIos = void 0;
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
                data = (0, insertLinesHelper_1.insertLinesHelper)(`  pod 'ViroReact', :path => '../node_modules/@viro-community/react-viro/ios'\n` +
                    `  pod 'ViroKit', :path => '../node_modules/@viro-community/react-viro/ios/dist/ViroRenderer/'`, "post_install do |installer|", data, -1);
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
const withDefaultInfoPlist = (config, { ios }) => {
    if (!config.ios)
        config.ios = {};
    if (!config.ios.infoPlist)
        config.ios.infoPlist = {};
    config.ios.infoPlist.NSPhotoLibraryUsageDescription =
        ios.photosPermission ||
            config.ios.infoPlist.NSPhotoLibraryUsageDescription ||
            withViro_1.DEFAULTS.ios.photosPermission;
    config.ios.infoPlist.NSPhotoLibraryAddUsageDescription =
        ios.savePhotosPermission ||
            config.ios.infoPlist.NSPhotoLibraryAddUsageDescription ||
            withViro_1.DEFAULTS.ios.savePhotosPermission;
    config.ios.infoPlist.NSCameraUsageDescription =
        ios.cameraUsagePermission ||
            config.ios.infoPlist.NSCameraUsageDescription ||
            withViro_1.DEFAULTS.ios.cameraUsagePermission;
    return config;
};
const withViroIos = (config, props) => {
    (0, config_plugins_1.withPlugins)(config, [[withViroPods, props]]);
    withDefaultInfoPlist(config, props);
    withEnabledBitcode(config);
    withExcludedSimulatorArchitectures(config);
    return config;
};
exports.withViroIos = withViroIos;
