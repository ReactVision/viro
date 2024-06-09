"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroTelemetry = void 0;
const ViroVersion_1 = require("../Utilities/ViroVersion");
const react_native_1 = require("react-native");
class ViroTelemetry {
  static _isDisabled = false;
  static _isDebugging = false;
  // TODO: use custom domain
  // private static _telemetryUrl = "https://telemetry.reactvision.org";
  static _telemetryUrl = "https://telemetry.reactvision.org";
  static _timeout = 8000;
  /**
   * Allow a user to start debugging the telemetry to see what is sent.
   */
  static setDebugging() {
    this._isDebugging = true;
  }
  /**
   * Allow a user to opt out of telemetry.
   */
  static optOutTelemetry() {
    this._isDisabled = true;
  }
  static recordTelemetry(eventName, payload = {}) {
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
  static getAnonymousMeta() {
    let isExpo = false;
    try {
      const myModule = require("expo");
      isExpo = true;
    } catch (err) {
      // send error to log file
    }
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
        viroVersion: ViroVersion_1.VIRO_VERSION,
        platform: react_native_1.Platform.OS,
        deviceOsVersion: react_native_1.Platform.Version,
        reactNativeVersion:
          react_native_1.Platform.constants.reactNativeVersion.major +
          "." +
          react_native_1.Platform.constants.reactNativeVersion.minor +
          "." +
          react_native_1.Platform.constants.reactNativeVersion.patch,
      };
      return traits;
    } catch (e) {
      console.error(e);
    }
    return {};
  }
}
exports.ViroTelemetry = ViroTelemetry;
