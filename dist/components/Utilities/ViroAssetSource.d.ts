/**
 * Copyright © 2026 ReactVision
 *
 * Asset resolution that survives visionOS.
 */
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
export declare function resolveViroAssetSource(source: any): any;
