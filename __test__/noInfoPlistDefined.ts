import { DEFAULTS } from "../plugins/withViro";

export const pluginConfigs = [
  "@reactvision/react-viro",
  ["@reactvision/react-viro", { ios: {} }],
  ["@reactvision/react-viro", { android: { xRMode: ["GVR"] } }],
  ["@reactvision/react-viro", { android: { xRMode: ["GVR"] }, ios: {} }],
];

export const noInfoPlistDefinitionsAppConfigBefore: any = {
  name: "Example App Config",
  slug: "example-app-config",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  plugins: [],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.example.app.config",
    buildNumber: `${Math.floor(Number(Date.now() / 1000))}`,
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.example.app.config",
    versionCode: Math.floor(Number(Date.now() / 1000)),
  },
  extra: {
    eas: {
      projectId: "eef69c9f-ddbe-45f2-933a-51ff4f8948b9",
    },
  },
};

export const noInfoPlistDefinitionsAppConfigAfter: any = {
  name: "Example App Config",
  slug: "example-app-config",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  plugins: [],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.example.app.config",
    buildNumber: `${Math.floor(Number(Date.now() / 1000))}`,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSPhotoLibraryUsageDescription: DEFAULTS.ios.photosPermission,
      NSPhotoLibraryAddUsageDescription: DEFAULTS.ios.savePhotosPermission,
      NSCameraUsageDescription: DEFAULTS.ios.cameraUsagePermission,
      NSMicrophoneUsageDescription: DEFAULTS.ios.microphoneUsagePermission,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.example.app.config",
    versionCode: Math.floor(Number(Date.now() / 1000)),
  },
  extra: {
    eas: {
      projectId: "eef69c9f-ddbe-45f2-933a-51ff4f8948b9",
    },
  },
};
