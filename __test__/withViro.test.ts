import { describe, expect, test } from "@jest/globals";
import { withDefaultInfoPlist } from "../plugins/withViroIos";
import {
  noInfoPlistDefinitionsAppConfigAfter,
  noInfoPlistDefinitionsAppConfigBefore,
  pluginConfigs,
} from "./noInfoPlistDefined";
import {
  infoPlistDefinedAppConfigAfter,
  infoPlistDefinedAppConfigBefore,
  infoPlistDefinedTestPluginConfigs,
} from "./infoPlistDefined";

describe("withViro", () => {
  test("should correctly set InfoPlist config if no InfoPlist values are configured", () => {
    for (const configuration of pluginConfigs) {
      noInfoPlistDefinitionsAppConfigBefore.plugins = [configuration];
      noInfoPlistDefinitionsAppConfigAfter.plugins = [configuration];
      expect(
        withDefaultInfoPlist(
          noInfoPlistDefinitionsAppConfigBefore,
          undefined as any
        )
      ).toStrictEqual(noInfoPlistDefinitionsAppConfigAfter);
    }
  });

  test("should correctly set InfoPlist config if InfoPlist values are configured", () => {
    for (const scenario of infoPlistDefinedTestPluginConfigs) {
      infoPlistDefinedAppConfigBefore.ios.infoPlist = undefined;
      infoPlistDefinedAppConfigBefore.plugins = [scenario.config];
      infoPlistDefinedAppConfigAfter.plugins = [scenario.config];
      infoPlistDefinedAppConfigAfter.ios.infoPlist = scenario.afterInfoPlist;
      expect(
        withDefaultInfoPlist(infoPlistDefinedAppConfigBefore, undefined as any)
      ).toStrictEqual(infoPlistDefinedAppConfigAfter);
    }
  });

  // TODO: Testing that withViro updates files correctly (Podfile, Android files, etc.)
});
