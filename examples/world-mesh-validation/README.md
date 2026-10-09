# World mesh on-device validation

The world-mesh work in [virocore#413](https://github.com/ReactVision/virocore/pull/413) and
[#414](https://github.com/ReactVision/virocore/pull/414) is covered by a host test that runs in CI
on every PR. That test drives the production pipeline, and it caught a real bug — but it feeds
synthetic frames. There is no depth sensor in it, no sensor noise, no tracking and no frame budget.

This runs the same acceptance criteria on a real device, so the last step is a command and a
readout rather than a checklist worked through by hand.

## Running it

Mount a `ViroARSceneNavigator` with `depthEnabled` and `worldMeshEnabled`, then:

```tsx
import { validateWorldMesh, formatReport } from "./worldMeshValidation";

const report = await validateWorldMesh(navigatorRef.current, {
  onProgress: (line) => console.log(line),
});
console.log(formatReport(report));
```

It tells you when to walk and when to hold still. Takes about 80 seconds.

## What it checks

| Check | Why |
|---|---|
| source is a depth source, not `"plane"` | The silent fallback to plane anchors made everything below meaningless |
| Android reports `"depth"`, not `"lidar"` | It used to claim LiDAR on phones that have none |
| the mesh accumulates | Without fusion a scan is one view |
| vertex count climbs rather than rising and falling | The single-frame symptom, seen directly |
| the walk builds ≥20,000 vertices | The acceptance figure for a 4×5 m room |
| revisiting a wall does not duplicate it | Fusion must converge, not concatenate |
| `snapshotWorldMeshToFile` writes it | This is the mesh VPS Lite uploads |
| `resetWorldMesh` empties the mesh at once | A reset that only empties the volume leaves the old room in the stats |
| and leaves nothing for VPS Lite to upload | A snapshot in that window used to attach the room just cleared |
| and then starts building again | So a second scan does not start inside the first |

A check it cannot reach a verdict on reports `?` rather than passing. An absent `resetWorldMesh`
means the JS half is not installed, not that the behaviour is fine.

## What it does not check

Frame rate and memory. Watch those in Xcode Instruments or Android Studio's profiler while this
runs: the criteria are 30 fps held on a mid-range phone and the fused volume under
`worldMeshConfig.maxMemoryMB`.

## Devices

An ARCore Depth phone (Pixel 7+, Galaxy S2x) and a LiDAR iPhone. Confirm in logcat that ARCore's
depth mode is AUTOMATIC before reading anything into an Android run.
