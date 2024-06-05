# Installation instructions

If you are starting a new project, please consider using our [Starter Kit](https://github.com/ViroCommunity/starter-kit) as a basis for your app.

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

If you're unsure about which file to edit or where to put specified the lines, we have added links to how this is done in our [starter-kit](https://github.com/ViroCommunity/starter-kit) repo.

## » [iOS linking](https://viro-community.readme.io/docs/installation-instructions#ios-linking-you-must-do-this---we-do-not-yet-support-auto-linking)

## » [Android linking](https://viro-community.readme.io/docs/installation-instructions#android-linking-you-must-do-this---we-do-not-yet-support-auto-linking)

## Expo Plugin

## » [General Instructions](https://viro-community.readme.io/docs/integrating-with-expo#installation-instructions)

## » [Android Options](https://viro-community.readme.io/docs/integrating-with-expo#android-options)

## » [iOS Options](https://viro-community.readme.io/docs/integrating-with-expo#ios-options)

## » [Running your Expo app](https://viro-community.readme.io/docs/integrating-with-expo#running-your-expo-app)

## Examples

Please note that these examples are a bit old, the code targets an older version of viro before the ReactVision took over the project. They will be updated soon!

## » [AR](https://viro-community.readme.io/docs/examples#ar-examples)

## » [VR](https://viro-community.readme.io/docs/examples#vr-examples)

## » [Tutorials](https://viro-community.readme.io/docs/examples#tutorials)

# **Troubleshooting**

- **It doesn't work on my iOS simulator!**

  AR _does not work on iOS simulators_. If you are getting an error that looks like:

  `ARWorldTrackingConfiguration setAutoFocusEnabled: unrecognised`

  that is expected. Sorry!

  See [running-on-device](https://reactnative.dev/docs/running-on-device) in the official react-native docs.
