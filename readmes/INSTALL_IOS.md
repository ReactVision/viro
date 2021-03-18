# iOS Linking (You **_must_** do this - we do not yet support auto-linking)

1. Add the following lines to your `ios/Podfile` below `use_react_native!(:path => config["reactNativePath"])`:

   ```yaml
   pod 'ViroReact', :path => '../node_modules/@viro-community/react-viro/ios/'
   pod 'ViroKit_static_lib', :path => '../node_modules/@viro-community/react-viro/ios/dist/ViroRenderer/static_lib'
   ```

   See this [example](https://github.com/ViroCommunity/starter-kit/blob/master/ios/Podfile)

2. Install the iOS native pods by running:

   ```console
   $ npx pod-install
   ```

   or inside the `ios` directory...

   ```console
   $ pod install
   ```

3. If you are going to be doing any AR then you will need to request permissions for using the camera in the `ios/APP_NAME/info.plist` by adding the following:

   ```xml
       <key>NSCameraUsageDescription</key>
       <string>The camera is needed for AR functionality</string>
   ```

   The `string` can be more appropriate to the needs of your app.

   See an [exmple](https://github.com/ViroCommunity/starter-kit/blob/master/ios/myviroapp/Info.plist#L40) here.

4. You're done! You can now run `npx react-native ios`.

   Remember, if you are using AR, you _need to run on a [real device](https://reactnative.dev/docs/running-on-device)_.
