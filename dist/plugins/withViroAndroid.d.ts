import { ConfigPlugin } from "@expo/config-plugins";
import { ViroConfigurationOptions } from "./withViro";
export declare function resolveViroAndroidRelativePath(projectRoot: string, androidRoot: string): string;
export declare const withViroAndroid: ConfigPlugin<ViroConfigurationOptions>;
