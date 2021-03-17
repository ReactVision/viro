# Installation instructions

If you are starting a new project, please consider using our [Starter Kit](https://github.com/ViroCommunity/starter-kit) as a basis for your app.

The steps below are for manually installing and linking the library to an existing React Native project. We do not yet support auto-linking.

## Install

```console
$ npm install --save @viro-community/react-viro
```

You will also need `fbjs`, which is currently an un-declared dependency of react-viro (we will look to remove this in future releases).

```console
$ npm install --save fbjs
```

## Linking (You _must_ do this - we do not support auto-linking)

If you're unsure about which file to edit or where to put specified the lines, we have added links to how this is done in our [starter-kit](https://github.com/ViroCommunity/starter-kit) repo.

## - [iOS linking](./INSTALL_IOS.md)

## - [Android linking](./INSTALL_ANDROID.md)

# **Troubleshooting**

- **It doesn't work on my iOS simulator!**

  AR _does not work on iOS simulators_. If you are getting an error that looks like:

  `ARWorldTrackingConfiguration setAutoFocusEnabled: unrecognised`

  that is expected. Sorry!

  See [running-on-device](https://reactnative.dev/docs/running-on-device) in the official react-native docs.
