# Release Notes

## v3.0.1

**Shared coordinate frames on Meta Quest.** Two headsets can now agree on where the room is, so a co-located session on Quest places content in the same spot for everyone in it.

Quest uses Meta's spatial anchors rather than a ReactVision cloud anchor: the OpenXR session produces no camera image for the SIFT localiser, and Meta's anchors already solve the problem sensor-fused. `create` publishes an anchor to a group uuid and `join` recovers it, both through OpenXR alone. Verified on a Quest 3.

The other half of co-location — the channel and replicated state — already ran on Quest, and phone sessions are unchanged. This completes the headset path; `metaSpatialAnchorFrameSource` did not reach the runtime in 3.0.0.

### Using it

```tsx
import { ViroSharedFrame, metaSpatialAnchorFrameSource } from "@reactvision/react-viro";

// The headset that publishes the room:
<ViroSharedFrame source={metaSpatialAnchorFrameSource(roomUuid, "create")} />

// Every other headset joining it:
<ViroSharedFrame source={metaSpatialAnchorFrameSource(roomUuid, "join")} />
```

Two requirements, both of which report themselves rather than failing quietly:

**Your scene must be rooted in `ViroARScene`.** Co-location means agreeing on a room, and a fully virtual scene has no room to agree on — no AR session, no anchor to share. Under a `ViroScene` root the call answers *"Co-location needs a mixed-reality scene"*.

**Your app needs the config plugin**, which now declares `horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA`. Run `expo prebuild` after upgrading so the manifest picks it up.

Co-location remains same-family: a Quest on a Meta anchor and a phone on a cloud anchor are in unrelated frames, and nothing has ever observed both. That is a scope decision rather than a gap. Full API in `docs/CO_LOCATION.md`, Quest specifics in `docs/QUEST_SETUP.md` §7d.

### Also in this release

The renderer changes this depends on are in `@reactvision/virocore` 3.0.1, which ships inside this package as prebuilt binaries — there is nothing to install separately.

**`onCloudAnchorStateChange` was removed from `ViroARSceneNavigator`.** The prop was declared but never wired to anything on either platform, so setting it did nothing. Cloud anchor state was and remains available three ways, depending on what you are asking: `hostCloudAnchor()` and `resolveCloudAnchor()` resolve with `state`; `getCloudAnchorStatus()` reports progress while a resolve is running, with a `message` that separates downloading from searching from waiting on a second match; and `rvGetCloudAnchor(anchorId)` gives the current state of an anchor you did not just touch. See `docs/VPS_LITE.md`.

`ViroCloudAnchorStateChangeEvent` stays exported and deprecated, so an existing import still compiles.

Nothing else changed.
