"use strict";
/**
 * Copyright © 2026 ReactVision
 *
 * Asset resolution that survives visionOS.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveViroAssetSource = resolveViroAssetSource;
const react_native_1 = require("react-native");
/**
 * `Image.resolveAssetSource` returns `{ uri: "" }` on visionOS.
 *
 * The asset itself is registered correctly — `getAssetByID` returns a complete entry with
 * `httpServerLocation`, `hash`, `name` and `type`. What goes wrong is the resolver: `expo-asset`
 * ships `.native.js` variants that re-export React Native's real implementation next to plain `.js`
 * files that are the **web** ones, and on this platform the web build wins. Its
 * `AssetSourceResolver` reports `isLoadedFromServer()` as a hardcoded `true`, claims local assets
 * even with `expo-updates` absent, and builds malformed URLs. The empty `uri` is what comes out.
 *
 * Native then receives that empty string, resolves it against the bundle, and asks NSURLSession to
 * download the app's own *directory* — which fails as `NSURLErrorFileIsDirectory`. That is why
 * `ViroParticleEmitter` images and `ViroButton` sources silently never appeared.
 *
 * React Native's own resolver works fine here; it just is not the one being reached. So: use the
 * normal path, and when it comes back empty, rebuild the source with React Native's resolver from
 * the registry entry and the dev-server URL. Verified on device and in the Simulator.
 */
function resolveViroAssetSource(source) {
    const resolved = react_native_1.Image.resolveAssetSource(source);
    // The ordinary case on every other platform, and on visionOS once the resolver is fixed
    // upstream: nothing to repair.
    if (resolved && typeof resolved.uri === "string" && resolved.uri.length > 0) {
        return resolved;
    }
    // Only a `require()` handle can be rebuilt — an object source is whatever the caller passed.
    if (typeof source !== "number") {
        return resolved;
    }
    try {
        const { getAssetByID, } = require("@react-native/assets-registry/registry");
        const meta = getAssetByID(source);
        if (!meta) {
            return resolved;
        }
        const AssetSourceResolver = require("react-native/Libraries/Image/AssetSourceResolver").default;
        // The dev-server origin, taken the same way React Native takes it.
        const scriptURL = react_native_1.NativeModules.SourceCode?.getConstants?.().scriptURL ?? "";
        const match = scriptURL.match(/^https?:\/\/.*?\//);
        const serverUrl = match ? match[0] : null;
        // No dev server means an embedded bundle, where the bundle-relative path is correct and
        // React Native's resolver handles it from the same entry.
        return new AssetSourceResolver(serverUrl, null, meta).defaultAsset();
    }
    catch {
        // Never let asset resolution throw — a missing image should be a missing image, not a crash.
        return resolved;
    }
}
