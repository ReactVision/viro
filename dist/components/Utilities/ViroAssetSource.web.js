"use strict";
/**
 * Copyright © 2026 ReactVision
 *
 * Asset resolution on the web.
 *
 * The native file repairs `Image.resolveAssetSource` for visionOS by reaching into
 * `react-native/Libraries/Image/AssetSourceResolver`. react-native-web has no such module, and the
 * `require` is a literal, so webpack and Vite resolve it at build time and fail the bundle however
 * well the call is guarded at runtime. That is what kept the published package from bundling.
 *
 * The web resolver needs no repair: react-native-web's `Image.resolveAssetSource` returns the URL
 * the bundler emitted for a `require()`d asset, and an object source is already a URL. So this is
 * the plain path, and the browser never loads the visionOS workaround.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveViroAssetSource = resolveViroAssetSource;
const react_native_1 = require("react-native");
function resolveViroAssetSource(source) {
    return react_native_1.Image.resolveAssetSource(source);
}
