import {
  withPlugins,
  withDangerousMod,
  withXcodeProject,
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import fs from "fs";
import { insertLinesHelper } from "./util/insertLinesHelper";

const withViroPods = (config: ExpoConfig) => {
  config = withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const root = newConfig.modRequest.platformProjectRoot;

      fs.readFile(`${root}/Podfile`, "utf-8", (err, data) => {
        data = insertLinesHelper(
          `  pod 'ViroReact', :path => '../node_modules/@viro-community/react-viro/ios/'\n` +
            `  pod 'ViroKit', :path => '../node_modules/@viro-community/react-viro/ios/dist/ViroRenderer/'`,
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

const withEnabledBitcode = (config: ExpoConfig) =>
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

export const withViroIos: ConfigPlugin = (config, props) => {
  withPlugins(config, [[withViroPods, props]]);
  withEnabledBitcode(config);
  withExcludedSimulatorArchitectures(config);
  return config;
};
