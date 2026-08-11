# VPS-Lite (geo-anchored persistent AR)

Room/building-scale persistent AR anchors, discoverable by GPS, with an optional attached mesh for occlusion + physics. This is **v1** of ReactVision's VPS work — self-contained "island" anchors you localize to when nearby, not a continuous unified map. No server SfM, no drift-correction fusion loop; it reuses the existing cloud-anchor host/resolve pipeline almost entirely. Full design rationale and the v2 (Niantic-style) roadmap live in the workspace plan docs (`viro-vps-lite-v1-plan.md`, `viro-vps-niantic-plan.md`) — this page is the API reference for what's actually implemented.

Four workstreams, all shipped:

- **WS-A — Scan session API.** `startScan()`/`finishScan()` define their own location frame instead of requiring a pre-placed anchor, and aren't capped to a small radius — you can scan a whole room.
- **WS-B — GPS-tagged cloud anchors.** Anchors hosted via `finishScan()` (or the existing `hostCloudAnchor()`) carry GPS coordinates; discovery (`nearby`/`list`) is a backend query — see the ReactVision cloud-anchor REST API, not covered here.
- **WS-C — Mesh attach.** Serialize the live world mesh to a file, upload it as a cloud-anchor asset, and re-attach it on resolve for occlusion + physics.
- **WS-D — GPS accuracy gating.** `getEarthTrackingState()` reports a real `Localizing → Enabled` transition gated on horizontal accuracy, instead of claiming `Enabled` the instant a provider object exists; `isLocationAccuracyReduced()` surfaces iOS 14+ "Precise Location off" / Android coarse-only-location explicitly, since GPS accuracy never converges in that case.

> **Requires `provider="reactvision"`** on `ViroARSceneNavigator` (it's the default). None of this is available on `provider="arcore"` — ARCore's own Geospatial API has no scan-session or mesh-attach concept, and its earth-tracking-state gating is separate (see the WS-D note below).

---

## Quick start — scan → host → resolve → occlude

The imperative API lives on the object your scene component receives via `viroAppProps`/the `arSceneNavigator` context (same pattern as `hostCloudAnchor`), **not** on a raw `ViroARSceneNavigator` ref directly from outside the tree.

```tsx
// 1. Scan the space (WS-A) — no tapped anchor needed.
sceneNavigator.startScan();
// ...user walks around the room...
const { success, cloudAnchorId, locationTransform } = await sceneNavigator.finishScan(30 /* ttlDays */);

// 2. Snapshot the world mesh and attach it to the hosted anchor (WS-C).
if (success) {
  const { filePath } = await sceneNavigator.snapshotWorldMeshToFile(locationTransform);
  // upload filePath via rvUploadAsset() -> rvAttachAssetToCloudAnchor(cloudAnchorId, ...)
}

// 3. Later, on any device: resolve, download the mesh asset, load it back.
const resolved = await sceneNavigator.resolveCloudAnchor(cloudAnchorId);
const localMeshPath = await downloadAsset(resolved.anchor.assets[0].fileUrl); // app-provided
await sceneNavigator.loadWorldMeshFromFile(localMeshPath, resolved.anchor.resolvedTransform);
```

`finishScan()` is the "1-scan degenerate case" of `hostCloudAnchor()` — same cloud pipeline, but the content lands in the scan's own **location frame** instead of relative to a placed `ARAnchor`. That's why `snapshotWorldMeshToFile`/`loadWorldMeshFromFile` take an explicit transform string argument rather than deriving one from an anchor.

---

## API reference

### `startScan(): void`

Begin a room/building-scale scan. Call this before walking the space; nothing needs to be tapped/placed first (contrast with `hostCloudAnchor()`, which hosts a single already-placed `ARAnchor`).

### `finishScan(ttlDays?: number): Promise<ViroFinishScanResult>`

Finish the scan and host it to the cloud — same backend pipeline as `hostCloudAnchor()`.

| Param | Type | Default | Description |
|---|---|---|---|
| `ttlDays` | `number` | `1` | Clamped to `[1, 365]`. With API-key auth the effective max is 1 day; keyless auth allows up to 365 — see `hostCloudAnchor`'s docs. |

```ts
type ViroFinishScanResult = {
  success: boolean;
  cloudAnchorId?: string;
  locationTransform?: string; // pass to snapshotWorldMeshToFile
  error?: string;
};
```

Failure here almost always means insufficient scan coverage (not enough tracked points, not enough viewpoint spread) — walk more of the space and retry rather than assuming it's a network/auth error.

### `snapshotWorldMeshToFile(locationTransform: string): Promise<ViroWorldMeshSnapshotResult>`

Serializes the currently-tracked world mesh (ARKit LiDAR / ARCore depth) to a local cache file, in the given location frame. `locationTransform` **must** be `finishScan()`'s result — there's no placed anchor to derive a transform from otherwise.

```ts
type ViroWorldMeshSnapshotResult = { success: boolean; filePath?: string; error?: string };
```

Upload `filePath`'s bytes yourself via `rvUploadAsset()` → `rvAttachAssetToCloudAnchor()` to persist it on the hosted anchor. Mesh attach is optional — a scan/anchor with no mesh is still fully usable for placement, just without occlusion/physics.

### `loadWorldMeshFromFile(filePath: string, resolvedTransform: string): Promise<ViroWorldMeshLoadResult>`

Loads a mesh snapshot back and attaches it for physics collision + visual occlusion. Requires `worldMeshEnabled` set on the navigator (`setWorldMeshEnabled(true)` / the `worldMeshEnabled` prop).

| Param | Description |
|---|---|
| `filePath` | Local path to the downloaded mesh bytes — **you** download the asset's `fileUrl` (from `rvGetCloudAnchor()`'s `assets`) yourself; this method never touches the network. |
| `resolvedTransform` | `resolveCloudAnchor()`'s result's `anchor.resolvedTransform` — the mesh is positioned relative to this, not to `locationTransform` (that's only meaningful on the hosting device). |

```ts
type ViroWorldMeshLoadResult = { success: boolean; error?: string };
```

### `setWorldMeshEnabled(enabled: boolean): void`

Gate for whether `loadWorldMeshFromFile`'s attached mesh actually renders/collides. Off by default.

### Geospatial / GPS accuracy (WS-D)

These aren't VPS-Lite-specific — they apply to any use of `provider="reactvision"`'s geospatial mode — but the gating behavior below is new in this workstream and worth calling out explicitly, since it changes what a correct integration needs to handle.

#### `getEarthTrackingState(): Promise<ViroEarthTrackingStateResult>`

```ts
type ViroEarthTrackingStateResult = { state: "Stopped" | "Localizing" | "Enabled" | "Paused" };
```

- **`Stopped`** — geospatial mode isn't enabled, or no provider is configured.
- **`Localizing`** — a GPS fix exists but hasn't yet crossed the accuracy threshold (15 m horizontal accuracy). This is expected and can last from a few seconds to about a minute on a cold start — show a "locating…" state, don't treat it as an error.
- **`Enabled`** — accuracy threshold crossed; safe to place/expect geospatial anchors to land accurately.
- **`Paused`** — tracking temporarily unavailable (e.g. app backgrounded).

Before this fix, `Enabled` could be reported the instant a tracking provider object existed, regardless of whether the GPS fix was anywhere near accurate — silently hiding the real convergence wait. If you see `Enabled` reported faster than a device's GPS could plausibly have converged, that's the bug this workstream closed; it's gated identically now on **both** the ReactVision and the ARCore geospatial provider paths.

#### `isLocationAccuracyReduced(): Promise<ViroLocationAccuracyResult>`

```ts
type ViroLocationAccuracyResult = { reduced: boolean };
```

`true` when the user granted only **approximate** location — iOS 14+ with "Precise Location" toggled off, or Android with `ACCESS_COARSE_LOCATION` but not `ACCESS_FINE_LOCATION`. In that state, `horizontalAccuracy` stays at the kilometer scale and **`getEarthTrackingState()` will sit in `Localizing` forever** — there is no fix-quality signal that will ever cross the threshold. Check this explicitly and show the user an actionable error ("enable Precise Location for this app") instead of a silent, unexplained hang.

On iOS this also triggers an automatic one-time `requestTemporaryFullAccuracyAuthorization` prompt (requires an `NSLocationTemporaryUsageDescriptionDictionary` entry in `Info.plist` — the `ReactVisionCCA` config plugin adds one under the key `ReactVisionVPSAccuracy`); if the user still declines, `reduced` stays `true`.

#### `setGeospatialModeEnabled(enabled: boolean): void`

Starts/stops geospatial tracking. Must be called before `getEarthTrackingState()`/`isLocationAccuracyReduced()` return anything meaningful.

---

## Developer test harness

`showcase/components/ar-examples/vps-lite-test.tsx` is a raw-buttons developer harness (deliberately unpolished — it logs every method's raw JSON result to an on-screen scroll rather than driving a real UI) exercising the full flow: `startScan → finishScan → snapshotWorldMeshToFile → loadWorldMeshFromFile` (the last step self-loops, loading its own just-saved mesh back using its own `locationTransform` as a stand-in for a resolved anchor's transform, to validate the round-trip without a second device). Use it as a live reference for call order and expected result shapes.

**Scan coverage matters.** `startScan()` doesn't gather anything by itself — walk/move the device around the space *between* `startScan()` and `finishScan()`. Calling them back-to-back without moving will make `finishScan()` fail with an insufficient-coverage error, which is expected, not a bug.

---

## Platform support

| Capability | iOS | Android |
|---|---|---|
| `startScan`/`finishScan` (WS-A) | ✅ | ✅ |
| Mesh snapshot/attach (WS-C) | ✅ (LiDAR devices) | ✅ (ARCore depth) |
| GPS accuracy gating (WS-D) | ✅ | ✅ |
| `provider="arcore"` (Google's own Geospatial API) | Scan session / mesh-attach: ❌ (ARCore-only concepts, no ReactVision equivalent needed since Google hosts the map) | Same |

## Migration & gotchas

- **`finishScan()` is not `hostCloudAnchor()`.** They share a backend pipeline, but `finishScan()`'s content lands in the scan's own location frame, not relative to a placed `ARAnchor`. Don't mix `locationTransform` (hosting-side, from `finishScan`) with `resolvedTransform` (resolving-side, from `resolveCloudAnchor`) — they're conceptually parallel but come from different calls and aren't interchangeable.
- **Mesh attach is optional.** Skipping WS-C entirely still gives you a fully working geo-anchored anchor for placement; you just lose occlusion/physics against real-world geometry.
- **`Localizing` can legitimately last up to ~a minute on a cold GPS fix** — this is expected CoreLocation/FusedLocation warm-up time, not a bug in the SDK. Warm up geospatial mode (`setGeospatialModeEnabled(true)`) as early as convenient in your flow rather than only right before you need a fix.
