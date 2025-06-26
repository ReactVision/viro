module.exports = {
  dependencies: {
    '@reactvision/react-viro': {
      platforms: {
        ios: {
          sourceDir: '../ios',
          folder: '../ios',
          podspecPath: '../ios/ViroReact.podspec',
        },
        android: {
          sourceDir: '../android',
          folder: '../android',
        },
      },
    },
  },
  // Manual component registration (no CodeGen)
  project: {
    ios: {},
    android: {},
  },
};