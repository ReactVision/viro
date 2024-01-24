import {
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
  withDangerousMod,
  withPlugins,
  withXcodeProject,
} from "@expo/config-plugins"
import { ExpoConfig } from "@expo/config-types"
import fs from "fs"
import { insertLinesHelper } from "./util/insertLinesHelper"
import { DEFAULTS, ViroConfigurationOptions } from "./withViro"

const withViroPods = (config: ExpoConfig) => {
  config = withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const root = newConfig.modRequest.platformProjectRoot

      fs.readFile(`${root}/Podfile`, "utf-8", (err, data) => {
        data = insertLinesHelper(
          `  pod 'ViroReact', :path => '../node_modules/@viro-community/react-viro/ios'\n` +
            `  pod 'ViroKit', :path => '../node_modules/@viro-community/react-viro/ios/dist/ViroRenderer/'`,
          "post_install do |installer|",
          data,
          -1
        )

        fs.writeFile(`${root}/Podfile`, data, "utf-8", function (err) {
          if (err) console.log("Error writing Podfile")
        })
      })
      return newConfig
    },
  ])

  return config
}

const withEnabledBitcode: ConfigPlugin = (config) =>
  withXcodeProject(config, async (newConfig) => {
    newConfig.modResults.addBuildProperty("ENABLE_BITCODE", "NO", "Release")
    return newConfig
  })

const setExcludedArchitectures = (
  project: ExportedConfigWithProps<XcodeProject>["modResults"]
) => {
  const configurations = project.pbxXCBuildConfigurationSection()

  // @ts-ignore
  for (const { buildSettings } of Object.values(configurations || {})) {
    if (
      typeof (buildSettings === null || buildSettings === void 0
        ? void 0
        : buildSettings.PRODUCT_NAME) !== "undefined"
    ) {
      buildSettings['"EXCLUDED_ARCHS[sdk=iphonesimulator*]"'] = '"arm64"'
    }
  }

  return project
}

const withExcludedSimulatorArchitectures = (config: ExpoConfig) => {
  return withXcodeProject(config, (newConfig) => {
    newConfig.modResults = setExcludedArchitectures(newConfig.modResults)
    return newConfig
  })
}

const withDefaultInfoPlist: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  { ios }
) => {
  if (!config.ios) config.ios = {}
  if (!config.ios.infoPlist) config.ios.infoPlist = {}
  config.ios.infoPlist.NSPhotoLibraryUsageDescription =
    ios.photosPermission ||
    config.ios.infoPlist.NSPhotoLibraryUsageDescription ||
    DEFAULTS.ios.photosPermission
  config.ios.infoPlist.NSPhotoLibraryAddUsageDescription =
    ios.savePhotosPermission ||
    config.ios.infoPlist.NSPhotoLibraryAddUsageDescription ||
    DEFAULTS.ios.savePhotosPermission
  config.ios.infoPlist.NSCameraUsageDescription =
    ios.cameraUsagePermission ||
    config.ios.infoPlist.NSCameraUsageDescription ||
    DEFAULTS.ios.cameraUsagePermission

  return config
}

export const withViroIos: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  withPlugins(config, [[withViroPods, props]])
  withDefaultInfoPlist(config, props)
  withEnabledBitcode(config)
  withExcludedSimulatorArchitectures(config)
  return config
}
