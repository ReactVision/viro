import { ConfigPlugin } from "@expo/config-plugins";
import { ViroConfigurationOptions } from "./withViro";
/**
 * Resolve the on-disk `@reactvision/react-viro/ios` directory as a path
 * relative to the iOS project root (where the Podfile lives).
 *
 * Hardcoding `../node_modules/...` assumes react-viro is installed in the app's
 * own `node_modules`. That is false under pnpm/yarn workspaces (and npm
 * workspaces), where the package is hoisted to the monorepo root or nested
 * under `.pnpm`, so `pod install` fails with "No podspec found for ViroKit".
 * Resolving via Node follows symlinks/hoisting and works in both flat and
 * workspace layouts.
 */
export declare function resolveViroIosRelativePath(projectRoot: string, iosRoot: string): string;
export declare const withDefaultInfoPlist: ConfigPlugin<ViroConfigurationOptions>;
export declare const withViroIos: ConfigPlugin<ViroConfigurationOptions>;
