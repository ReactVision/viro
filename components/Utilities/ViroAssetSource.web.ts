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
 * react-native-web has no `Image.resolveAssetSource` either, so calling it throws. The web
 * components take a URL string or `{ uri }` (see `Web/viroImageLoader.ts`) and read them as they
 * come, so the source passes through untouched. A `require()`d asset id is not supported on the web.
 */

export function resolveViroAssetSource(source: any): any {
  return source;
}
