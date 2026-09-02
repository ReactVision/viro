import { ConfigPlugin } from "@expo/config-plugins";
import { ViroConfigurationOptions } from "./withViro";
export declare function resolveViroIosRelativePath(projectRoot: string, iosRoot: string): string;
export declare const withDefaultInfoPlist: ConfigPlugin<ViroConfigurationOptions>;
export declare const withViroIos: ConfigPlugin<ViroConfigurationOptions>;
