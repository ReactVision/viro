import {
  ConfigPlugin,
  ExportedConfigWithProps,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withPlugins,
  withProjectBuildGradle,
  withSettingsGradle,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import fs from "fs";
import path from "path";
import { insertLinesHelper } from "./util/insertLinesHelper";
import { ViroConfigurationOptions, XrMode } from "./withViro";
let viroPluginConfig = ["AR", "GVR"];

const withBranchAndroid: ConfigPlugin<ViroConfigurationOptions> = (config) => {
  // Directly edit MainApplication.java
  return withDangerousMod(config, [
    "android",
    async (config) => {
      let mainApplicationPath = "";
      let isJava: boolean;
      const mainApplicationPrefix = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...(config?.android?.package?.split?.(".") || [])
      );
      const mainApplicationPathJava = path.join(
        mainApplicationPrefix,
        "MainApplication.java"
      );
      const mainApplicationPathKotlin = path.join(
        mainApplicationPrefix,
        "MainApplication.kt"
      );
      if (fs.existsSync(mainApplicationPathJava)) {
        isJava = true;
        mainApplicationPath = mainApplicationPathJava;
      } else if (fs.existsSync(mainApplicationPathKotlin)) {
        isJava = false;
        mainApplicationPath = mainApplicationPathKotlin;
      } else {
        throw new Error(
          "MainApplication.kt or MainApplication.java file not found."
        );
      }

      fs.readFile(mainApplicationPath, "utf-8", (err, data) => {
        if (isJava) {
          data = insertLinesHelper(
            "import com.viromedia.bridge.ReactViroPackage;",
            `package ${config?.android?.package};`,
            data
          );
        } else {
          data = insertLinesHelper(
            "import com.viromedia.bridge.ReactViroPackage",
            `package ${config?.android?.package}`,
            data
          );
        }

        const viroPlugin = config?.plugins?.find(
          (plugin) =>
            Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
        );

        if (Array.isArray(viroPlugin)) {
          if (Array.isArray(viroPlugin[1].android?.xRMode)) {
            viroPluginConfig = (
              viroPlugin[1].android?.xRMode as XrMode[]
            ).filter((mode) => ["AR", "GVR", "OVR_MOBILE"].includes(mode));
          } else if (
            ["AR", "GVR", "OVR_MOBILE"].includes(viroPlugin[1]?.android?.xRMode)
          ) {
            viroPluginConfig = [viroPlugin[1]?.android.xRMode];
          }
        }

        let target = "";
        for (const viroConfig of viroPluginConfig) {
          if (isJava) {
            target =
              target +
              `      packages.add(new ReactViroPackage(ReactViroPackage.ViroPlatform.${viroConfig}))\n`;
          } else {
            target =
              target +
              `              packages.add(ReactViroPackage(ReactViroPackage.ViroPlatform.${viroConfig}))\n`;
          }
        }

        if (isJava) {
          data = insertLinesHelper(
            target,
            "List<ReactPackage> packages = new PackageList(this).getPackages();",
            data
          );
        } else {
          if (data.includes("// packages.add(new MyReactNativePackage());")) {
            // console.log("[VIRO]: \n" + target);
            /**
             * ================================================================
             * HACK/EXPO PREBIULD BUG
             * ================================================================
             *
             * ```
             * // DOESN'T WORK - EXPO SDK 50 `npx expo prebuild` RESULT
             * override fun getPackages(): List<ReactPackage> {
             *   // Packages that cannot be autolinked yet can be added manually here, for example:
             *   // packages.add(new MyReactNativePackage());
             *   PackageList(this).packages.apply {
             *     add(ReactViroPackage(ReactViroPackage.ViroPlatform.GVR))
             *   }
             *   return PackageList(this).packages
             * }
             *
             * // DOES WORK - REACT NATIVE STARTER KIT 0.73.4
             * override fun getPackages(): List<ReactPackage> =
             *   PackageList(this).packages.apply {
             *     // Packages that cannot be autolinked yet can be added manually here, for example:
             *     // add(MyReactNativePackage())
             *     // https://viro-community.readme.io/docs/installation-instructions#5-now-add-the-viro-package-to-your-mainapplication
             *     // add(ReactViroPackage(ReactViroPackage.ViroPlatform.OVR_MOBILE))
             *     add(ReactViroPackage(ReactViroPackage.ViroPlatform.GVR))
             *     // add(ReactViroPackage(ReactViroPackage.ViroPlatform.AR))
             *   }
             * ```
             */
            /*
            data = data.replace(
              `override fun getPackages(): List<ReactPackage> {
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(new MyReactNativePackage());
            return PackageList(this).packages
          }`,
              `override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }`
            );*/
            data = insertLinesHelper(
              target,
              "// packages.add(new MyReactNativePackage());",
              data
            );
          } else if (data.includes("// add(MyReactNativePackage())")) {
            // console.log("[VIRO]: \n" + target);
            data = insertLinesHelper(
              target,
              "// add(MyReactNativePackage())",
              data
            );
          } else {
            throw new Error(
              "Unable to insert Android packages into package list. Please create a new issue on GitHub and reference this message!"
            );
          }
          // data = insertLinesHelper(
          //   target,
          //   "// packages.add(new MyReactNativePackage());",
          //   data
          // );
        }

        fs.writeFile(mainApplicationPath, data, "utf-8", function (err) {
          if (err) console.log("Error writing MainApplication.java");
        });
      });
      return config;
    },
  ]);
};

const withViroProjectBuildGradle = (config: ExpoConfig) =>
  withProjectBuildGradle(config, async (newConfig) => {
    newConfig.modResults.contents = newConfig.modResults.contents.replace(
      /minSdkVersion.*/,
      `minSdkVersion = 24`
    );

    newConfig.modResults.contents = newConfig.modResults.contents.replace(
      /classpath\("com.android.tools.build:gradle.*/,
      `classpath('com.android.tools.build:gradle:4.1.1')`
    );
    return newConfig;
  });

const withViroAppBuildGradle = (config: ExpoConfig) =>
  withAppBuildGradle(config, async (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /implementation "com.facebook.react:react-native:\+"  \/\/ From node_modules/,
      `implementation "com.facebook.react:react-native:+"  // From node_modules

    // ========================================================================
    // https://viro-community.readme.io/docs/installation-instructions#2-in-your-androidappbuildgradle-add-the-following-lines-to-the-dependencies-section
    implementation project(':gvr_common')
    implementation project(':arcore_client')
    implementation project(path: ':react_viro')
    implementation project(path: ':viro_renderer')
    implementation 'androidx.media3:media3-exoplayer:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-dash:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-hls:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-smoothstreaming:1.1.1'
    implementation 'com.google.protobuf.nano:protobuf-javanano:3.1.0'
    // ========================================================================`
    );
    config.modResults.contents = config.modResults.contents.replace(
      /implementation\("com.facebook.react:react-android"\)/,
      `implementation("com.facebook.react:react-android")

    // =====================================r===================================
    // https://viro-community.readme.io/docs/installation-instructions#2-in-your-androidappbuildgradle-add-the-following-lines-to-the-dependencies-section
    implementation project(':gvr_common')
    implementation project(':arcore_client')
    implementation project(path: ':react_viro')
    implementation project(path: ':viro_renderer')
    implementation 'androidx.media3:media3-exoplayer:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-dash:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-hls:1.1.1'
    implementation 'androidx.media3:media3-exoplayer-smoothstreaming:1.1.1'
    implementation 'com.google.protobuf.nano:protobuf-javanano:3.1.0'
    // ========================================================================
    `
    );
    return config;
  });

const withViroSettingsGradle = (config: ExpoConfig) =>
  withSettingsGradle(config, async (config) => {
    config.modResults.contents += `
include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'
project(':arcore_client').projectDir = new File('../node_modules/@reactvision/react-viro/android/arcore_client')
project(':gvr_common').projectDir = new File('../node_modules/@reactvision/react-viro/android/gvr_common')
project(':viro_renderer').projectDir = new File('../node_modules/@reactvision/react-viro/android/viro_renderer')
project(':react_viro').projectDir = new File('../node_modules/@reactvision/react-viro/android/react_viro')
    `;
    return config;
  });

const withViroManifest = (config: ExpoConfig) =>
  withAndroidManifest(
    config,
    async (newConfig: ExportedConfigWithProps<any>) => {
      const contents = newConfig.modResults;
      contents.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

      contents?.manifest?.application?.[0]["meta-data"]?.push({
        $: {
          "android:name": "com.google.ar.core",
          "android:value": "optional",
        },
      });

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
        });
        //   <!-- Add the following line for daydream -->
        //   <category android:name="com.google.intent.category.DAYDREAM" />
        contents?.manifest?.application?.[0]?.activity[0][
          "intent-filter"
        ][0].category.push({
          $: {
            "android:name": "com.google.intent.category.DAYDREAM",
          },
        });
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
      ];

      contents.manifest["uses-feature"] = [];

      contents.manifest["uses-permission"].push({
        $: {
          "android:name": "android.permission.CAMERA",
        },
      });
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.camera",
        },
      });
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.camera.autofocus",
          "android:required": "false",
          "tools:replace": "required",
        },
      });

      contents.manifest["uses-feature"].push({
        $: {
          "android:glEsVersion": "0x00030000",
          "android:required": "false",
          "tools:node": "remove",
          "tools:replace": "required",
        },
      });
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.sensor.accelerometer",
          "android:required": "false",
          "tools:replace": "required",
        },
      });
      contents.manifest["uses-feature"].push({
        $: {
          "android:name": "android.hardware.sensor.gyroscope",
          "android:required": "false",
          "tools:replace": "required",
        },
      });

      return newConfig;
    }
  );

export const withViroAndroid: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  withPlugins(config, [[withBranchAndroid, props]]);
  withViroProjectBuildGradle(config);
  withViroManifest(config);
  withViroSettingsGradle(config);
  withViroAppBuildGradle(config);
  return config;
};
