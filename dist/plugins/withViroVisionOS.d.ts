/**
 * withViroVisionOS.ts
 *
 * Expo config plugin that wires ViroReact into a react-native-visionos project.
 *
 * What it automates (run once via `expo prebuild`):
 *   1. Verifies / warns about the visionos/ platform folder
 *   2. Patches metro.config.js with the visionOS platform resolver
 *   3. Injects ViroKit + ViroReact pods + post_install hooks into visionos/Podfile
 *   4. Ensures App.swift uses moduleName "main" (required by Expo's registerRootComponent)
 *   5. Patches App.swift with the ImmersiveSpace scene
 *   6. Copies the 3 visionOS patch files into the project's patches/ dir
 *   7. Adds postinstall: patch-package to package.json scripts
 *   8. Copies BlurView + LinearGradient compat shims into components/compat/
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
 *
 * Manual step (one-time, before prebuild):
 *   npx @react-native-community/cli@latest init MyApp \
 *     --template @callstack/visionos-template@latest \
 *     --directory visionos --skip-install
 */
import { ConfigPlugin } from "@expo/config-plugins";
export declare const withViroVisionOS: ConfigPlugin;
export default withViroVisionOS;
