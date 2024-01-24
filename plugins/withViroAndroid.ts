import {
  ConfigPlugin,
  ExportedConfigWithProps,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withPlugins,
  withProjectBuildGradle,
  withSettingsGradle,
} from "@expo/config-plugins"
import { ExpoConfig } from "@expo/config-types"
import fs from "fs"
import path from "path"
import { insertLinesHelper } from "./util/insertLinesHelper"
import { ViroConfigurationOptions, XrMode } from "./withViro"

let viroPluginConfig = ["AR"]

const withBranchAndroid: ConfigPlugin<ViroConfigurationOptions> = (config) => {
  // Directly edit MainApplication.java
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const mainApplicationPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...(config?.android?.package?.split?.(".") || []),
        "MainApplication.java"
      )

      const root = config.modRequest.platformProjectRoot
      fs.readFile(mainApplicationPath, "utf-8", (err, data) => {
        data = insertLinesHelper(
          "import com.viromedia.bridge.ReactViroPackage;",
          `package ${config?.android?.package};`,
          data
        )

        /**
         * ********************************************************************
         * Sample app.json with property config
         * Options: "AR", "GVR", "OVR_MOBILE"
         *
         * https://docs.expo.dev/guides/config-plugins/#using-a-plugin-in-your-app
         * ********************************************************************
         *
         * plugins: [
         *   [
         *     "@viro-community/react-viro",
         *     {
         *       android: {
         *         xRMode: "GVR"
         *       }
         *     }
         *   ]
         * ],
         *
         * ********************************************************************
         * Sample app.json with multiple options for Viro config
         * The default configuration is "AR"
         * ********************************************************************
         * plugins: [
         *   [
         *     "@viro-community/react-viro",
         *     {
         *       android: {
         *         xRMode: ["GVR", "AR"]
         *       }
         *     }
         *   ]
         * ],
         * ********************************************************************
         * Sample app.json without property config
         * ********************************************************************
         *
         * plugins: [ "@viro-community/react-viro" ],
         *
         */

        const viroPlugin = config?.plugins?.find(
          (plugin) =>
            Array.isArray(plugin) && plugin[0] === "@viro-community/react-viro"
        )

        if (Array.isArray(viroPlugin)) {
          if (Array.isArray(viroPlugin[1].android?.xRMode)) {
            viroPluginConfig = (
              viroPlugin[1].android?.xRMode as XrMode[]
            ).filter((mode) => ["AR", "GVR", "OVR_MOBILE"].includes(mode))
          } else if (
            ["AR", "GVR", "OVR_MOBILE"].includes(viroPlugin[1]?.android?.xRMode)
          ) {
            viroPluginConfig = [viroPlugin[1]?.android.xRMode]
          }
        }

        let target = ""
        for (const viroConfig of viroPluginConfig) {
          target =
            target +
            `      packages.add(new ReactViroPackage(ReactViroPackage.ViroPlatform.valueOf("${viroConfig}")));\n`
        }

        data = insertLinesHelper(
          target,
          "List<ReactPackage> packages = new PackageList(this).getPackages();",
          data
        )

        fs.writeFile(mainApplicationPath, data, "utf-8", function (err) {
          if (err) console.log("Error writing MainApplication.java")
        })
      })
      return config
    },
  ])

  return config
}

const withViroProjectBuildGradle = (config: ExpoConfig) =>
  withProjectBuildGradle(config, async (newConfig) => {
    newConfig.modResults.contents = newConfig.modResults.contents.replace(
      /minSdkVersion.*/,
      `minSdkVersion = 24`
    )

    newConfig.modResults.contents = newConfig.modResults.contents.replace(
      /classpath\("com.android.tools.build:gradle.*/,
      `classpath('com.android.tools.build:gradle:4.1.1')`
    )
    return newConfig
  })

const withViroAppBuildGradle = (config: ExpoConfig) =>
  withAppBuildGradle(config, async (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /implementation "com.facebook.react:react-native:\+"  \/\/ From node_modules/,
      `implementation "com.facebook.react:react-native:+"  // From node_modules

    implementation project(':gvr_common')
    implementation project(':arcore_client')
    implementation project(path: ':react_viro')
    implementation project(path: ':viro_renderer')
    implementation 'com.google.android.exoplayer:exoplayer:2.7.1'
    implementation 'com.google.protobuf.nano:protobuf-javanano:3.0.0-alpha-7'`
    )
    return config
  })

const withViroSettingsGradle = (config: ExpoConfig) =>
  withSettingsGradle(config, async (config) => {
    config.modResults.contents += `
include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'
project(':arcore_client').projectDir = new File('../node_modules/@viro-community/react-viro/android/arcore_client')
project(':gvr_common').projectDir = new File('../node_modules/@viro-community/react-viro/android/gvr_common')
project(':viro_renderer').projectDir = new File('../node_modules/@viro-community/react-viro/android/viro_renderer')
project(':react_viro').projectDir = new File('../node_modules/@viro-community/react-viro/android/react_viro')
    `
    return config
  })

const withViroManifest = (config: ExpoConfig) =>
  withAndroidManifest(
    config,
    async (newConfig: ExportedConfigWithProps<any>) => {
      const contents = newConfig.modResults
      contents.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools"

      contents?.manifest?.application?.[0]["meta-data"]?.push({
        $: {
          "android:name": "com.google.ar.core",
          "android:value": "optional",
        },
      })

      if (
        viroPluginConfig.includes("GVR") ||
        viroPluginConfig.includes("OVR_MOBILE")
      ) {
        //   <!-- Add the following line for cardboard -->
        //   <category android:name="com.google.intent.category.CARDBOARD" />
        contents?.manifest?.application?.[0]?.activity[0][
          "intent-filter"
        ][0].category.push({
          $: {
            "android:name": "com.google.intent.category.CARDBOARD",
          },
        })
        //   <!-- Add the following line for daydream -->
        //   <category android:name="com.google.intent.category.DAYDREAM" />
        contents?.manifest?.application?.[0]?.activity[0][
          "intent-filter"
        ][0].category.push({
          $: {
            "android:name": "com.google.intent.category.DAYDREAM",
          },
        })
      }

      contents.manifest.queries = [
        {
          package: [
            {
              $: {
                "android:name": "com.google.ar.core",
              },
            },
          ],
        },
      ]

      contents.manifest["uses-feature"] = []

      contents.manifest["uses-permission"].push({
        $: {
          "android:name": "android.permission.CAMERA",
        },
      })
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.camera",
        },
      })
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.camera.autofocus",
          "android:required": "false",
          "tools:replace": "required",
        },
      })

      contents.manifest["uses-feature"].push({
        $: {
          "android:glEsVersion": "0x00030000",
          "android:required": "false",
          "tools:node": "remove",
          "tools:replace": "required",
        },
      })
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.sensor.accelerometer",
          "android:required": "false",
          "tools:replace": "required",
        },
      })
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.sensor.gyroscope",
          "android:required": "false",
          "tools:replace": "required",
        },
      })

      return newConfig
    }
  )

export const withViroAndroid: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  withPlugins(config, [[withBranchAndroid, props]])
  withViroProjectBuildGradle(config)
  withViroManifest(config)
  withViroSettingsGradle(config)
  withViroAppBuildGradle(config)
  return config
}
