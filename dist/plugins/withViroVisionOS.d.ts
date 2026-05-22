/**
 * withViroVisionOS.ts
 *
 * Expo config plugin that wires ViroReact into a react-native-visionos project.
 *
 * Fully automated — just add to app.json and run expo prebuild:
 *   1. Installs @callstack/react-native-visionos + @callstack/out-of-tree-platforms
 *   2. Generates the visionos/ platform folder via react-native-visionos CLI
 *   3. Patches metro.config.js with the visionOS platform resolver rewrite
 *   4. Injects ViroKit + ViroReact pods into visionos/Podfile
 *   5. Patches visionos/{AppName}/{AppName}App.swift to add the ImmersiveSpace
 *      scene and .viroImmersiveSpaceController() modifier
 *
 * Usage in app.json:
 *   {
 *     "plugins": [
 *       ["@reactvision/react-viro", { ... }],
 *       "@reactvision/react-viro/plugins/withViroVisionOS"
 *     ]
 *   }
 *
 * After expo prebuild:
 *   cd visionos && pod install
 *   Open visionos/{AppName}.xcworkspace in Xcode → build for xros Simulator
 */
import { ConfigPlugin } from "@expo/config-plugins";
export declare const withViroVisionOS: ConfigPlugin;
export default withViroVisionOS;
