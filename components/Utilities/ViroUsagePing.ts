import * as React from "react";
import { readUsageInfo } from "./ViroUsageInfo";
import { VIRO_VERSION } from "./ViroVersion";

const ENDPOINT =
  "https://xyvpofhebevmdnrujnhx.supabase.co/functions/v1/register-device";
// Public by nature: it only keeps casual traffic off the endpoint.
const TOKEN = "3oKY0sbd6H46zDQwQhxCR4aAgJ8k79";
const MAX_FEATURES = 32;

export type ViroUsageNavigator = "ar" | "3d" | "vr" | "scene" | "xr";

export type ViroUsageFeatures = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ViroUsageInfo = {
  install_id: string | null;
  app_id: string | null;
  platform: string | null;
  os_version: string | null;
  device_model: string | null;
  app_version: string | null;
  app_build: string | null;
  rn_version: string | null;
  has_rv_credentials: boolean | null;
  rv_project_id: string | null;
  features: ViroUsageFeatures;
};

let telemetryEnabled = true;

/**
 * The usage ping every scene navigator sends when it mounts. Applies on every platform,
 * including web, and must be set before the first navigator mounts. The native
 * `ViroTelemetryEnabled` flag (Expo plugin option `telemetry: false`) also turns it off.
 */
export const ViroTelemetry = {
  setEnabled(enabled: boolean): void {
    telemetryEnabled = Boolean(enabled);
  },
  /** The JS switch only. The native flag is read each time a navigator mounts. */
  isEnabled(): boolean {
    return telemetryEnabled;
  },
};

// ViroXRSceneNavigator sets this around the navigator it renders, so one XR mount is one ping.
export const ViroUsagePingSuppressed = React.createContext(false);

function uuidV4(): string {
  const crypto = (globalThis as any).crypto;
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// By code point: a surrogate pair split in half is not valid text and fails the insert.
function truncate(value: string, max: number): string {
  return value.length <= max ? value : Array.from(value).slice(0, max).join("");
}

function clip(value: string | null, max: number): string | null {
  return typeof value === "string" && value.length > 0 ? truncate(value, max) : null;
}

function cleanFeatures(features: ViroUsageFeatures): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const key of Object.keys(features)) {
    if (count >= MAX_FEATURES) break;
    const value = features[key];
    if (typeof value === "string") out[key] = truncate(value, 100);
    else if (typeof value === "boolean" || value === null) out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else continue;
    count++;
  }
  return out;
}

/** Sends one usage ping, off the render path. Every failure is swallowed. */
export function sendViroUsagePing(
  navigator: ViroUsageNavigator,
  features: ViroUsageFeatures = {}
): void {
  if (!telemetryEnabled || typeof fetch !== "function") return;
  Promise.resolve()
    .then(() => readUsageInfo(uuidV4))
    .then((info) => {
      if (!info || !telemetryEnabled) return;
      const installId = clip(info.install_id, 200);
      const appId = clip(info.app_id, 200);
      if (!installId || !appId || !info.platform) return;
      const body = {
        v: 2,
        ping_id: uuidV4(),
        install_id: installId,
        app_id: appId,
        platform: info.platform,
        navigator,
        os_version: clip(info.os_version, 100),
        device_model: clip(info.device_model, 100),
        app_version: clip(info.app_version, 50),
        app_build: clip(info.app_build, 50),
        viro_version: VIRO_VERSION.slice(0, 50),
        rn_version: clip(info.rn_version, 50),
        is_dev: typeof __DEV__ !== "undefined" && __DEV__ === true,
        has_rv_credentials: info.has_rv_credentials,
        rv_project_id: clip(info.rv_project_id, 100),
        features: cleanFeatures({ ...features, ...info.features }),
      };
      return fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(body),
      });
    })
    .catch(() => undefined);
}

export function useViroUsagePing(
  navigator: ViroUsageNavigator,
  features?: ViroUsageFeatures
): void {
  const suppressed = React.useContext(ViroUsagePingSuppressed);
  React.useEffect(() => {
    if (!suppressed) sendViroUsagePing(navigator, features);
  }, []);
}
