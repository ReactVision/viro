import { describe, expect, test } from "@jest/globals";
import {
  removeExcludedSimulatorArchitectures,
  withDefaultInfoPlist,
  withViroTelemetryInfoPlist,
} from "../plugins/withViroIos";
import { withViroAndroid } from "../plugins/withViroAndroid";
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

describe("telemetry option", () => {
  const TELEMETRY_META = "com.reactvision.ViroTelemetryEnabled";

  function appConfig(telemetry?: boolean): any {
    return { name: "app", slug: "app", plugins: [["@reactvision/react-viro", { telemetry }]] };
  }

  function modRequest(platform: string, modName: string) {
    return { platform, modName, projectRoot: "/", platformProjectRoot: "/", introspect: false };
  }

  async function infoPlistAfter(telemetry: boolean | undefined, before: Record<string, unknown>) {
    const config: any = withViroTelemetryInfoPlist(appConfig(telemetry));
    const result = await config.mods.ios.infoPlist({
      ...config,
      modResults: { ...before },
      modRequest: modRequest("ios", "infoPlist"),
    });
    return result.modResults;
  }

  async function telemetryMetaAfter(telemetry: boolean | undefined, before: string[]) {
    const config: any = withViroAndroid(appConfig(telemetry), { telemetry });
    const manifest = {
      manifest: {
        $: {},
        "uses-permission": [],
        application: [
          {
            $: {},
            activity: [{ "intent-filter": [{ category: [] }] }],
            "meta-data": before.map((value) => ({
              $: { "android:name": TELEMETRY_META, "android:value": value },
            })),
          },
        ],
      },
    };
    const result = await config.mods.android.manifest({
      ...config,
      modResults: manifest,
      modRequest: modRequest("android", "manifest"),
    });
    return result.modResults.manifest.application[0]["meta-data"]
      .filter((meta: any) => meta.$["android:name"] === TELEMETRY_META)
      .map((meta: any) => meta.$["android:value"]);
  }

  test("false turns the ping off in Info.plist and the manifest", async () => {
    expect((await infoPlistAfter(false, {})).ViroTelemetryEnabled).toBe(false);
    expect(await telemetryMetaAfter(false, ["false"])).toEqual(["false"]);
  });

  test("true or omitted removes what an earlier prebuild wrote", async () => {
    for (const telemetry of [true, undefined]) {
      expect(await infoPlistAfter(telemetry, { ViroTelemetryEnabled: false })).not.toHaveProperty(
        "ViroTelemetryEnabled"
      );
      expect(await telemetryMetaAfter(telemetry, ["false"])).toEqual([]);
    }
  });
});

describe("simulator architectures", () => {
  const KEY = '"EXCLUDED_ARCHS[sdk=iphonesimulator*]"';

  function projectWith(settings: Record<string, string>[]): any {
    const section: Record<string, unknown> = {};
    settings.forEach((buildSettings, index) => {
      section[`ID${index}`] = { isa: "XCBuildConfiguration", buildSettings };
      section[`ID${index}_comment`] = "Debug";
    });
    return { pbxXCBuildConfigurationSection: () => section };
  }

  test("removes the arm64 exclusion earlier versions wrote, and keeps any other value", () => {
    const project = projectWith([
      { PRODUCT_NAME: "app", [KEY]: '"arm64"' },
      { PRODUCT_NAME: "app", [KEY]: "arm64" },
      { PRODUCT_NAME: "app", [KEY]: '"x86_64"' },
      { PRODUCT_NAME: "app" },
    ]);
    const section = removeExcludedSimulatorArchitectures(project).pbxXCBuildConfigurationSection();
    expect(section.ID0.buildSettings).not.toHaveProperty(KEY);
    expect(section.ID1.buildSettings).not.toHaveProperty(KEY);
    expect(section.ID2.buildSettings[KEY]).toBe('"x86_64"');
    expect(section.ID3.buildSettings).toEqual({ PRODUCT_NAME: "app" });
  });
});

describe("Quest permissions", () => {
  async function permissionsAfter(xRMode: string[]) {
    const props = { android: { xRMode } };
    const config: any = withViroAndroid(
      { name: "app", slug: "app", plugins: [["@reactvision/react-viro", props]] } as any,
      props as any
    );
    const result = await config.mods.android.manifest({
      ...config,
      modResults: {
        manifest: {
          $: {},
          "uses-permission": [],
          application: [{ $: {}, activity: [{ "intent-filter": [{ category: [] }] }] }],
        },
      },
      modRequest: {
        platform: "android",
        modName: "manifest",
        projectRoot: "/",
        platformProjectRoot: "/",
        introspect: false,
      },
    });
    return result.modResults.manifest["uses-permission"].map((p: any) => p.$);
  }

  test("a Quest build declares both hand tracking names and removes WRITE_EXTERNAL_STORAGE", async () => {
    const permissions = await permissionsAfter(["AR", "QUEST"]);
    expect(permissions).toContainEqual({ "android:name": "com.oculus.permission.HAND_TRACKING" });
    expect(permissions).toContainEqual({ "android:name": "horizonos.permission.HAND_TRACKING" });
    expect(permissions).toContainEqual({
      "android:name": "android.permission.WRITE_EXTERNAL_STORAGE",
      "tools:node": "remove",
    });
  });

  test("a phone build leaves WRITE_EXTERNAL_STORAGE alone", async () => {
    const names = (await permissionsAfter(["AR"])).map((p: any) => p["android:name"]);
    expect(names).not.toContain("android.permission.WRITE_EXTERNAL_STORAGE");
  });
});
