import { NativeModules, Platform } from "react-native";
import type { ViroUsageInfo } from "./ViroUsagePing";

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function reactNativeVersion(): string | null {
  const version = (Platform.constants as any)?.reactNativeVersion;
  if (typeof version?.major !== "number") return null;
  return `${version.major}.${version.minor}.${version.patch}`;
}

// Null skips the ping: no native module (new JS on an older binary) or telemetry turned off natively.
export async function readUsageInfo(
  _newId: () => string
): Promise<ViroUsageInfo | null> {
  const usageModule = NativeModules.VRTUsageModule;
  if (typeof usageModule?.getUsageInfo !== "function") return null;
  const info = await usageModule.getUsageInfo();
  if (!info || info.telemetry_enabled === false) return null;
  return {
    install_id: text(info.install_id),
    app_id: text(info.app_id),
    platform: text(info.platform),
    os_version: text(info.os_version),
    device_model: text(info.device_model),
    app_version: text(info.app_version),
    app_build: text(info.app_build),
    rn_version: reactNativeVersion(),
    has_rv_credentials:
      typeof info.has_rv_credentials === "boolean" ? info.has_rv_credentials : null,
    rv_project_id: text(info.rv_project_id),
    features: {},
  };
}
