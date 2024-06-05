import {
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
  withDangerousMod,
  withPlugins,
  withXcodeProject,
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

      fs.readFile(`${root}/Podfile`, "utf-8", (err, data) => {
        data = insertLinesHelper(
          `  pod 'ViroReact', :path => '../node_modules/@reactvision/react-viro/ios'\n` +
            `  pod 'ViroKit', :path => '../node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/'`,
          "post_install do |installer|",
          data,
          -1
        );

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
  props
) => {
  let savePhotosPermission = DEFAULTS.ios.savePhotosPermission;
  let photosPermission = DEFAULTS.ios.photosPermission;
  let cameraUsagePermission = DEFAULTS.ios.cameraUsagePermission;
  let microphoneUsagePermission = DEFAULTS.ios.microphoneUsagePermission;
  if (Array.isArray(config.plugins)) {
    const pluginConfig = config?.plugins?.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
    );
    if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
      const config = pluginConfig[1] as ViroConfigurationOptions;
      savePhotosPermission =
        config.ios?.savePhotosPermission || savePhotosPermission;
      photosPermission = config.ios?.photosPermission || photosPermission;
      microphoneUsagePermission =
        config.ios?.microphoneUsagePermission || microphoneUsagePermission;
      cameraUsagePermission =
        config.ios?.cameraUsagePermission || cameraUsagePermission;
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

  return config;
};

export const withViroIos: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  withPlugins(config, [[withViroPods, props]]);
  withDefaultInfoPlist(config, props);
  withEnabledBitcode(config);
  withExcludedSimulatorArchitectures(config);
  return config;
};
