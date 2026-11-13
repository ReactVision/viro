# Installation instructions

Requires React Native 0.88 (Expo SDK 58) with the New Architecture (Fabric). Apple Vision Pro apps stay on the React Native 0.86 visionOS fork until it is rebased onto 0.88. The recommended path is Expo (Dev Client) with the `@reactvision/react-viro` config plugin, which does the native wiring below for you.

If you are starting a new project, please consider using our [Expo + TypeScript starter kit](https://github.com/ReactVision/expo-starter-kit-typescript) as a basis for your app.

The steps below are for manually installing and linking the library to an existing React Native project. We do not yet support auto-linking.

## Install

#### NPM

```console
$ npm install --save @reactvision/react-viro
```

#### Yarn

```console
$ yarn add @reactvision/react-viro
```

## » [General Instructions](https://viro-community.readme.io/docs/installation-instructions#installation-instructions)

## OS Linking (You _must_ do this - we do not support auto-linking)

If you're unsure about which file to edit or where to put specified the lines, see how this is done in our [Expo + TypeScript starter kit](https://github.com/ReactVision/expo-starter-kit-typescript).

## » [iOS linking](https://viro-community.readme.io/docs/installation-instructions#ios-linking-you-must-do-this---we-do-not-yet-support-auto-linking)

## » [Android linking](https://viro-community.readme.io/docs/installation-instructions#android-linking-you-must-do-this---we-do-not-yet-support-auto-linking)

## Expo Plugin

## » [General Instructions](https://viro-community.readme.io/docs/integrating-with-expo#installation-instructions)

## » [Android Options](https://viro-community.readme.io/docs/integrating-with-expo#android-options)

## » [iOS Options](https://viro-community.readme.io/docs/integrating-with-expo#ios-options)

## » [Running your Expo app](https://viro-community.readme.io/docs/integrating-with-expo#running-your-expo-app)

## Examples

Please note that these examples are a bit old, the code targets an older version of viro before ReactVision took over the project. They will be updated soon!

## » [AR](https://viro-community.readme.io/docs/examples#ar-examples)

## » [VR](https://viro-community.readme.io/docs/examples#vr-examples)

## » [Tutorials](https://viro-community.readme.io/docs/examples#tutorials)

# **Troubleshooting**

- **It doesn't work on my iOS simulator!**

  Apps using Viro build and run in the iOS Simulator, but ARKit has no simulator support, so an AR scene needs a device.

  See [running-on-device](https://reactnative.dev/docs/running-on-device) in the official react-native docs.
