/**
 * withViroVisionOS.ts
 *
 * Expo config plugin that adds a visionOS target to your app's Xcode project.
 *
 * What it does:
 *   1. Writes the SwiftUI App entry point (ViroVisionApp.swift) into the target folder
 *   2. Adds a visionOS pod target to the Podfile
 *   3. Creates a visionOS Xcode target in the .pbxproj with correct SDK + build settings
 *
 * Usage in app.json:
 *   {
 *     "plugins": [
 *       ["@reactvision/react-viro", { ... }],
 *       "@reactvision/react-viro/plugins/withViroVisionOS"
 *     ]
 *   }
 *
 * After running `expo prebuild`, run `pod install` in ios/ then build the
 * <AppName>Vision target in Xcode targeting the visionOS simulator.
 */
import { ConfigPlugin } from "@expo/config-plugins";
export declare const withViroVisionOS: ConfigPlugin;
export default withViroVisionOS;
