# Android Linking (You **_must_** do this - we do not yet support auto-linking)

1. In your `android/build.gradle` Bump the minimum SDK version to at least `24`, and the gradle plugin to at least `4.1.1`:

   ```groovy
   buildscript{
     ext{
       ...
       minSdkVersion = 24
       ...
     }
     ...
     dependencies{
       classpath('com.android.tools.build:gradle:4.1.1')
     }
   }
   ```

   See an [example](https://github.com/ViroCommunity/starter-kit/blob/master/android/build.gradle) here.

2. In your `android/app/build.gradle` Add the following lines to the dependencies section:

   ```groovy
   dependencies {
     implementation fileTree(dir: "libs", include: ["*.jar"])
     //noinspection GradleDynamicVersion

     implementation "com.facebook.react:react-native:+"  // From node_modules

     // Add these lines
     implementation project(':gvr_common')
     implementation project(':arcore_client')
     implementation project(path: ':react_viro')
     implementation project(path: ':viro_renderer')
     implementation 'com.google.android.exoplayer:exoplayer:2.7.1'
     implementation 'com.google.protobuf.nano:protobuf-javanano:3.0.0-alpha-7'
   ```

   See an [example](https://github.com/ViroCommunity/starter-kit/blob/master/android/app/build.gradle) here.

3. In your `android/settings.gradle` Add the following lines to the end:

   ```groovy
   include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'
   project(':arcore_client').projectDir = new File('../node_modules/@viro-community/react-viro/android/arcore_client')
   project(':gvr_common').projectDir = new File('../node_modules/@viro-community/react-viro/android/gvr_common')
   project(':viro_renderer').projectDir = new File('../node_modules/@viro-community/react-viro/android/viro_renderer')
   project(':react_viro').projectDir = new File('../node_modules/@viro-community/react-viro/android/react_viro')
   ```

   See an [example](https://github.com/ViroCommunity/starter-kit/blob/master/android/settings.gradle) here.

4. In your `android/gradle/wrapper/gradle-wrapper.properties` set the `distributionUrl` to at least 6.5:

   ```properties
   distributionUrl=https\://services.gradle.org/distributions/gradle-6.5-bin.zip
   ```

   See an [example](https://github.com/ViroCommunity/starter-kit/blob/master/android/gradle/wrapper/gradle-wrapper.properties) here.

5. Now add the Viro package to your `MainApplication.java`:

   - Add the following line to the end of the import list:

     ```java
     import com.viromedia.bridge.ReactViroPackage;
     ```

   - Add the imported package inside the `getPackages` method:

     ```java
     @Override
     protected List<ReactPackage> getPackages() {
       @SuppressWarnings("UnnecessaryLocalVariable")
       List<ReactPackage> packages = new PackageList(this).getPackages();

       // Add this line
       packages.add(new ReactViroPackage(ReactViroPackage.ViroPlatform.valueOf("AR")));

       return packages;
     }

     ```

     You can replace the string `AR` with one of the following depending on your needs: `GVR`, `OVR_MOBILE`, `AR`.

   See an [example](https://github.com/ViroCommunity/starter-kit/blob/master/android/app/src/main/java/com/myviroapp/MainApplication.java) here.

6. In your `android/app/src/main/AndroidManifest.xml`:

   **For AR**

   - Add the camera permission to the `<manifest>` node below other permissions:

     ```xml
     <uses-permission android:name="android.permission.CAMERA" />
     ```

   - Add the following line to the `<application>` node, this enables ARCore:

     ```xml
     <meta-data android:name="com.google.ar.core" android:value="optional" />
     ```

     _Note_: If you want to restrict your app to ARCore-only devices, set the `android:value` to `"required"`

   **For VR**

   - If your app supports Cardboard or Datdream, you should add them as a category to the `intent-filter` in your activity:

     ```xml
     <intent-filter>
         <action android:name="android.intent.action.MAIN" />
         <category android:name="android.intent.category.LAUNCHER" />
         <!-- Add the following line for cardboard -->
         <category android:name="com.google.intent.category.CARDBOARD" />
         <!-- Add the following line for daydream -->
         <category android:name="com.google.intent.category.DAYDREAM" />
     </intent-filter>
     ```

   - To support GearVR, you need to add the following under the `<application>` node:

     ```xml
     <meta-data android:name="com.samsung.android.vr.application.mode" android:value="vr_only"/>
     ```

   **Optional - when debugging**

   Add the following line as an attribute on the `<application>` node. This should only used when debugging and is not recommended for production (you may want to inject the value using [manifestPlaceholders](https://developer.android.com/studio/build/manifest-build-variables) set for specific [build types](https://developer.android.com/studio/build/build-variants)).

   ```xml
   <application
       android:usesCleartextTraffic="true"
       ...

   ```

   See an [example](https://github.com/ViroCommunity/starter-kit/blob/master/android/app/src/main/AndroidManifest.xml) here. This example is for AR only.

7. You're done! You can now run `npx react-native run-android` to upload the app to your device.
