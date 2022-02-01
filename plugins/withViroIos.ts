import {
  withPlugins,
  withDangerousMod,
  withXcodeProject,
  ConfigPlugin,
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
          `  pod 'ViroReact', :path => '../node_modules/@viro-community/react-viro/ios/'
    pod 'ViroKit_static_lib', :path => '../node_modules/@viro-community/react-viro/ios/dist/ViroRenderer/static_lib'
            `,
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

export const withViroIos: ConfigPlugin = (config, props) => {
  withPlugins(config, [[withViroPods, props]]);
  withEnabledBitcode(config);

  return config;
};
