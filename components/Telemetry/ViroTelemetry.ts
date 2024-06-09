import { VIRO_VERSION } from "../Utilities/ViroVersion";
import { Platform } from "react-native";

export class ViroTelemetry {
  private static _isDisabled = false;
  private static _isDebugging = false;
  private static _telemetryUrl = "https://telemetry.reactvision.org";
  private static _timeout = 8000;

  /**
   * Allow a user to start debugging the telemetry to see what is sent.
   */
  public static setDebugging() {
    this._isDebugging = true;
  }

  /**
   * Allow a user to opt out of telemetry.
   */
  public static optOutTelemetry() {
    this._isDisabled = true;
  }

  public static recordTelemetry(eventName: string, payload: any = {}) {
    // Skip recording telemetry if the feature is disabled
    if (this._isDisabled) return;
    // Do not send the telemetry data if debugging. Users may use this feature
    // to preview what data would be sent.
    if (this._isDebugging) {
      console.log(
        `[telemetry] ` + JSON.stringify({ eventName, payload }, null, 2)
      );
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._timeout);

    payload = { ...payload, ...this.getAnonymousMeta() };

    fetch(`${this._telemetryUrl}/api/v1/record`, {
      method: "PUT",
      body: JSON.stringify({ eventName, payload }),
      headers: { "content-type": "application/json" },
      signal: controller.signal,
    })
      .catch((e) => console.error(e))
      .finally(() => clearTimeout(timeoutId));
  }

  private static getAnonymousMeta() {
    try {
      const traits = {
        // expo
        isExpo:
          // @ts-ignore
          Boolean(window?.expo) || false,
        sdkVersion:
          // @ts-ignore
          window?.expo?.modules?.ExponentConstants?.sdkVersion || undefined,
        androidPackage:
          // @ts-ignore
          window?.expo?.modules?.ExponentConstants?.android?.package ||
          undefined,
        iosBundleIdentifier:
          // @ts-ignore
          window?.expo?.modules?.ExponentConstants?.ios?.bundleIdentifier ||
          undefined,
        expoDebugMode:
          // @ts-ignore
          window?.expo?.modules?.ExponentConstants?.debugMode || undefined,
        isDevice:
          // @ts-ignore
          window?.expo?.modules?.ExponentConstants?.isDevice || undefined,
        // library version
        viroVersion: VIRO_VERSION,
        platform: Platform.OS,
        deviceOsVersion: Platform.Version,
        reactNativeVersion:
          Platform.constants.reactNativeVersion.major +
          "." +
          Platform.constants.reactNativeVersion.minor +
          "." +
          Platform.constants.reactNativeVersion.patch,
      };

      return traits;
    } catch (e) {
      console.error(e);
    }

    return {};
  }
}
