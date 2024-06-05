import { DEFAULTS } from "../plugins/withViro";

const TEST_TEXT = "This is not the default text.";

export const infoPlistDefinedTestPluginConfigs = [
  {
    config: [
      "@reactvision/react-viro",
      { ios: { photosPermission: TEST_TEXT } },
    ],
    afterInfoPlist: {
      NSPhotoLibraryUsageDescription: TEST_TEXT,
      NSPhotoLibraryAddUsageDescription: DEFAULTS.ios.savePhotosPermission,
      NSCameraUsageDescription: DEFAULTS.ios.cameraUsagePermission,
      NSMicrophoneUsageDescription: DEFAULTS.ios.microphoneUsagePermission,
    },
  },
  {
    config: [
      "@reactvision/react-viro",
      { ios: { savePhotosPermission: TEST_TEXT } },
    ],
    afterInfoPlist: {
      NSPhotoLibraryUsageDescription: DEFAULTS.ios.photosPermission,
      NSPhotoLibraryAddUsageDescription: TEST_TEXT,
      NSCameraUsageDescription: DEFAULTS.ios.cameraUsagePermission,
      NSMicrophoneUsageDescription: DEFAULTS.ios.microphoneUsagePermission,
    },
  },
  {
    config: [
      "@reactvision/react-viro",
      { ios: { cameraUsagePermission: TEST_TEXT } },
    ],
    afterInfoPlist: {
      NSPhotoLibraryUsageDescription: DEFAULTS.ios.photosPermission,
      NSPhotoLibraryAddUsageDescription: DEFAULTS.ios.savePhotosPermission,
      NSCameraUsageDescription: TEST_TEXT,
      NSMicrophoneUsageDescription: DEFAULTS.ios.microphoneUsagePermission,
    },
  },
  {
    config: [
      "@reactvision/react-viro",
      { ios: { microphoneUsagePermission: TEST_TEXT } },
    ],
    afterInfoPlist: {
      NSPhotoLibraryUsageDescription: DEFAULTS.ios.photosPermission,
      NSPhotoLibraryAddUsageDescription: DEFAULTS.ios.savePhotosPermission,
      NSCameraUsageDescription: DEFAULTS.ios.cameraUsagePermission,
      NSMicrophoneUsageDescription: TEST_TEXT,
    },
  },
  {
    config: [
      "@reactvision/react-viro",
      {
        ios: {
          microphoneUsagePermission: TEST_TEXT,
          photosPermission: TEST_TEXT,
          savePhotosPermission: TEST_TEXT,
          cameraUsagePermission: TEST_TEXT,
        },
      },
    ],
    afterInfoPlist: {
      NSPhotoLibraryUsageDescription: TEST_TEXT,
      NSPhotoLibraryAddUsageDescription: TEST_TEXT,
      NSCameraUsageDescription: TEST_TEXT,
      NSMicrophoneUsageDescription: TEST_TEXT,
    },
  },
];

export const infoPlistDefinedAppConfigBefore: any = {
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

export const infoPlistDefinedAppConfigAfter: any = {
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
