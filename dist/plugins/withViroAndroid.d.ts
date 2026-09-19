import { ConfigPlugin } from "@expo/config-plugins";
import { ViroConfigurationOptions } from "./withViro";
/**
 * Resolve the on-disk `@reactvision/react-viro/android` directory as a path
 * relative to the Android project root (where `settings.gradle` lives).
 *
 * Hardcoding `../node_modules/...` assumes react-viro is installed in the app's
 * own `node_modules`. That is false under pnpm/yarn workspaces (and npm
 * workspaces), where the package is hoisted to the monorepo root or nested
 * under `.pnpm`, so Gradle fails with "Configuring project ':gvr_common'
 * without an existing directory is not allowed". Resolving via Node follows
 * symlinks/hoisting and works in both flat and workspace layouts.
 */
export declare function resolveViroAndroidRelativePath(projectRoot: string, androidRoot: string): string;
export declare const withViroAndroid: ConfigPlugin<ViroConfigurationOptions>;
