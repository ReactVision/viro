import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";
import { withViroAndroid } from "../plugins/withViroAndroid";
import { applyViroPodfile, withViroIos } from "../plugins/withViroIos";
import { insertLinesHelper } from "../plugins/util/insertLinesHelper";
import { resolveViroOptions } from "../plugins/util/viroPluginOptions";

const PLUGIN = "@reactvision/react-viro";

function modRequest(platform: string, modName: string, root = "/") {
  return { platform, modName, projectRoot: root, platformProjectRoot: root, introspect: false };
}

function appConfig(options?: Record<string, unknown>): any {
  return { name: "app", slug: "app", plugins: [options ? [PLUGIN, options] : PLUGIN] };
}

function baseManifest(): any {
  return {
    manifest: {
      $: {},
      "uses-permission": [],
      "uses-feature": [{ $: { "android:name": "android.hardware.location.gps" } }],
      application: [
        {
          $: {},
          activity: [{ "intent-filter": [{ category: [] }] }],
          "meta-data": [],
        },
      ],
    },
  };
}

async function runMod(config: any, platform: string, modName: string, modResults: any, root?: string) {
  const result = await config.mods[platform][modName]({
    ...config,
    modResults,
    modRequest: modRequest(platform, modName, root),
  });
  return result.modResults;
}

const names = (items: any[]) => items.map((item) => item.$["android:name"]);

describe("android manifest mod run twice", () => {
  const options = {
    googleCloudApiKey: "g-key",
    rvApiKey: "rv-1",
    rvProjectId: "project",
    rvEndpoint: "https://staging.example",
    android: { xRMode: ["GVR", "AR"] },
  };

  test("does not duplicate meta-data, launcher categories or features", async () => {
    const config: any = withViroAndroid(appConfig(options), options);
    const once = await runMod(config, "android", "manifest", baseManifest());
    const snapshot = JSON.parse(JSON.stringify(once));
    const twice = await runMod(config, "android", "manifest", once);

    expect(twice).toEqual(snapshot);
    const app = twice.manifest.application[0];
    const metaNames = names(app["meta-data"]);
    expect(new Set(metaNames).size).toBe(metaNames.length);
    expect(metaNames).toEqual(
      expect.arrayContaining([
        "com.google.ar.core",
        "com.google.android.ar.API_KEY",
        "com.reactvision.RVApiKey",
        "com.reactvision.RVProjectId",
        "com.reactvision.RVEndpoint",
      ])
    );
    const categories = names(app.activity[0]["intent-filter"][0].category);
    expect(categories).toEqual([
      "com.google.intent.category.CARDBOARD",
      "com.google.intent.category.DAYDREAM",
    ]);
    const featureKeys = twice.manifest["uses-feature"].map(
      (f: any) => f.$["android:name"] ?? f.$["android:glEsVersion"]
    );
    expect(new Set(featureKeys).size).toBe(featureKeys.length);
  });

  test("a changed rvApiKey replaces the previous one", async () => {
    const first: any = withViroAndroid(appConfig(options), options);
    const once = await runMod(first, "android", "manifest", baseManifest());
    const changed = { ...options, rvApiKey: "rv-2" };
    const second: any = withViroAndroid(appConfig(changed), changed);
    const twice = await runMod(second, "android", "manifest", once);
    const keys = twice.manifest.application[0]["meta-data"].filter(
      (m: any) => m.$["android:name"] === "com.reactvision.RVApiKey"
    );
    expect(keys.map((m: any) => m.$["android:value"])).toEqual(["rv-2"]);
  });

  test("keeps uses-feature entries declared elsewhere", async () => {
    const config: any = withViroAndroid(appConfig(options), options);
    const result = await runMod(config, "android", "manifest", baseManifest());
    expect(names(result.manifest["uses-feature"].filter((f: any) => f.$["android:name"]))).toContain(
      "android.hardware.location.gps"
    );
  });

  test("works when the plugin is registered without options", async () => {
    const config: any = withViroAndroid(appConfig(), undefined);
    const result = await runMod(config, "android", "manifest", baseManifest());
    expect(names(result.manifest.application[0]["meta-data"])).toEqual(["com.google.ar.core"]);
  });
});

describe("gradle mods run twice", () => {
  test("settings.gradle gets one Viro block, updated in place", async () => {
    const config: any = withViroAndroid(appConfig(), undefined);
    const settings = { contents: "rootProject.name = 'app'\n", language: "groovy" };
    const once = await runMod(config, "android", "settingsGradle", settings, "/proj/android");
    const twice = await runMod(config, "android", "settingsGradle", { ...once }, "/proj/android");
    expect(twice.contents).toBe(once.contents);
    expect(twice.contents.match(/include ':react_viro'/g)).toHaveLength(1);
  });

  test("settings.gradle written by an earlier version is not repeated", async () => {
    const config: any = withViroAndroid(appConfig(), undefined);
    const legacy =
      "rootProject.name = 'app'\n" +
      "\ninclude ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'\n" +
      "project(':arcore_client').projectDir = new File('../node_modules/x/android/arcore_client')\n" +
      "project(':gvr_common').projectDir = new File('../node_modules/x/android/gvr_common')\n" +
      "project(':viro_renderer').projectDir = new File('../node_modules/x/android/viro_renderer')\n" +
      "project(':react_viro').projectDir = new File('../node_modules/x/android/react_viro')\n    ";
    const result = await runMod(
      config,
      "android",
      "settingsGradle",
      { contents: legacy, language: "groovy" },
      "/proj/android"
    );
    expect(result.contents.match(/include ':react_viro'/g)).toHaveLength(1);
  });

  test("app/build.gradle gets the dependencies once", async () => {
    const config: any = withViroAndroid(appConfig(), undefined);
    const gradle = {
      contents: 'dependencies {\n    implementation("com.facebook.react:react-android")\n    other()\n}\n',
      language: "groovy",
    };
    const once = await runMod(config, "android", "appBuildGradle", gradle);
    const twice = await runMod(config, "android", "appBuildGradle", { ...once });
    expect(twice.contents).toBe(once.contents);
    expect(twice.contents.match(/project\(':gvr_common'\)/g)).toHaveLength(1);
    expect(twice.contents).toContain("other()");
  });
});

describe("Podfile", () => {
  const podfile = [
    "platform :ios, '15.1'",
    "target 'app' do",
    "  use_react_native!(:path => config[:reactNativePath])",
    "",
    "  post_install do |installer|",
    "    react_native_post_install(installer)",
    "  end",
    "end",
    "",
  ].join("\n");
  const base = { viroIosRoot: "../node_modules/@reactvision/react-viro/ios" };

  test("applying twice gives the same Podfile", () => {
    for (const options of [
      base,
      { ...base, iosLinkage: "dynamic" as const },
      { ...base, cloudAnchorProvider: "arcore", geospatialAnchorProvider: "arcore" },
    ]) {
      const once = applyViroPodfile(podfile, options);
      expect(applyViroPodfile(once, options)).toBe(once);
      expect(once.match(/pod 'ViroReact'/g)).toHaveLength(1);
    }
  });

  test("a changed option replaces the earlier block", () => {
    const dynamic = applyViroPodfile(podfile, { ...base, iosLinkage: "dynamic" });
    const arcore = applyViroPodfile(dynamic, { ...base, includeARCore: true, iosLinkage: "static" });
    expect(arcore.match(/use_frameworks!/g)).toHaveLength(1);
    expect(arcore).toContain("use_frameworks! :linkage => :static");
    expect(arcore).toContain("pod 'ARCore/Geospatial'");
    const plain = applyViroPodfile(arcore, base);
    expect(plain).not.toContain("ARCore");
    expect(plain).not.toContain("use_frameworks!");
    expect(plain).not.toContain("weak_framework");
    expect(plain).toBe(applyViroPodfile(podfile, base));
  });

  test("does not require New Architecture in the Podfile", () => {
    expect(applyViroPodfile(podfile, base)).not.toContain("raise");
  });

  test("replaces the block an earlier version wrote, including its New Architecture check", () => {
    const legacy = podfile.replace(
      "\n  post_install",
      `  # ViroReact with integrated New Architecture (Fabric) support
  # Automatically includes Fabric components when RCT_NEW_ARCH_ENABLED=1
  pod 'ViroReact', :path => '../node_modules/@reactvision/react-viro/ios'
  pod 'ViroKit', :path => '../node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/'

  # Enforce New Architecture requirement
  # ViroReact 2.43.1+ requires React Native New Architecture
  if ENV['RCT_NEW_ARCH_ENABLED'] != '1'
    raise "ViroReact requires New Architecture to be enabled. Please set RCT_NEW_ARCH_ENABLED=1 in ios/.xcode.env"
  end

  post_install`
    );
    const result = applyViroPodfile(legacy, base);
    expect(result.match(/pod 'ViroReact'/g)).toHaveLength(1);
    expect(result).not.toContain("raise");
  });

  test("throws when the insertion anchor is missing", () => {
    expect(() => applyViroPodfile("platform :ios\n", base)).toThrow(/Unable to find/);
    expect(() => insertLinesHelper("x", "missing", "a\nb")).toThrow(/Unable to find/);
  });

  test("the dangerous mod awaits file access and is repeatable", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viro-podfile-"));
    try {
      const config: any = withViroIos(appConfig(), undefined);
      const run = () =>
        config.mods.ios.dangerous({
          ...config,
          modResults: {},
          modRequest: modRequest("ios", "dangerous", dir),
        });
      await expect(run()).rejects.toThrow(/ENOENT/);
      fs.writeFileSync(path.join(dir, "Podfile"), podfile);
      await run();
      const once = fs.readFileSync(path.join(dir, "Podfile"), "utf-8");
      await run();
      expect(fs.readFileSync(path.join(dir, "Podfile"), "utf-8")).toBe(once);
      expect(once.match(/pod 'ViroReact'/g)).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("plugin options", () => {
  test("props win over the config.plugins entry", () => {
    expect(resolveViroOptions(appConfig({ rvApiKey: "a" }), { rvApiKey: "b" }).rvApiKey).toBe("b");
  });

  test("falls back to config.plugins, and to empty options without any", () => {
    expect(resolveViroOptions(appConfig({ rvApiKey: "a" })).rvApiKey).toBe("a");
    expect(resolveViroOptions({ plugins: [[PLUGIN]] })).toEqual({});
    expect(resolveViroOptions({})).toEqual({});
  });

  test("withViroAndroid reads the props it is called with", async () => {
    const props = { rvApiKey: "from-props" };
    const config: any = withViroAndroid({ name: "app", slug: "app" } as any, props);
    const result = await runMod(config, "android", "manifest", baseManifest());
    const meta = result.manifest.application[0]["meta-data"].find(
      (m: any) => m.$["android:name"] === "com.reactvision.RVApiKey"
    );
    expect(meta.$["android:value"]).toBe("from-props");
  });
});
