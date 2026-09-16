# Co-location (multi-device shared AR)

Two or more devices in the same physical space agreeing on one coordinate frame, so content placed by one appears in the same real-world spot for the others — and their poses flowing between them over a ReactVision-hosted channel.

Co-location is two halves, and they are independent:

- **The frame.** Every device recovers the same origin. _How_ is a platform question: phones relocalise against a ReactVision cloud anchor, Quest shares a Meta spatial anchor, visionOS uses ARKit's shared coordinate space. A **frame source** abstracts the difference.
- **The channel.** Devices exchange frame-native data — where each peer is, whether they have localised — over `useViroColocation`.

Anything else the devices must agree on, placed objects, who is holding what, whose turn it is, is [replicated state](#replicated-state), a separate ordered socket over `useViroReplicatedState`.

> **Same-family only.** Phone↔phone, Quest↔Quest and Vision↔Vision. A Quest on a Meta anchor and a phone on a cloud anchor are in unrelated frames, and nothing has ever observed both, so there is no conversion between them. This is a deliberate scope decision, not an oversight — see `plans/viro-colocation-plan.md` §5 decision 6.

> **Hardware validation is in progress.** Everything below is implemented and compiles on every platform, and the frame maths and channel are unit-tested and tested on Mobile. But because they require having 2 of the same device it's not possible to fully validate Vision Pro and Meta Quest, so treat accuracy and latency as unmeasured.

---

## Quick start — phones

```tsx
import {
  ViroARCloudAnchor,
  ViroBox,
  useViroColocation,
} from "@reactvision/react-viro";

function SharedScene(props) {
  const { arSceneNavigator, cloudAnchorId } = props.sceneNavigator.viroAppProps;
  const [frame, setFrame] = useState<string | null>(null);

  // The anchor id names the frame *and* the channel room.
  const { peers, publishPose } = useViroColocation({
    roomId: cloudAnchorId,
    apiKey: "YOUR_KEY",
    projectId: "YOUR_PROJECT",
    enabled: frame !== null, // nothing to publish before the frame exists
  });

  return (
    <ViroARScene>
      <ViroARCloudAnchor
        cloudAnchorId={cloudAnchorId}
        arSceneNavigator={arSceneNavigator}
        onLocalized={(e) => setFrame(e.transform)}
      >
        {/* One metre in front of the frame origin — on every device. */}
        <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} />

        {peers.map((p) => (
          <ViroSphere key={p.peerId} radius={0.05} position={p.position} />
        ))}
      </ViroARCloudAnchor>
    </ViroARScene>
  );
}
```

Device A hosts the space with `startScan()` / `finishScan()` on the AR scene navigator; device B receives the returned `cloudAnchorId` however the app likes — QR, paste, your own backend — and both mount the component with it.

---

## The frame

### `<ViroARCloudAnchor>` — phones

| Prop               |                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cloudAnchorId`    | The anchor to localise against.                                                                                                                          |
| `arSceneNavigator` | The navigator your scene was handed. Passed explicitly — `ViroSceneContext` carries camera callbacks only, and a scene can host more than one navigator. |
| `onLocalized`      | `({ cloudAnchorId, position, rotation, scale, transform })` once the frame exists.                                                                       |
| `onLocalizeError`  | `(error, state)` on failure, timeout, or an unsupported platform (`state === "ErrorNotSupported"`).                                                      |
| `placeholder`      | Rendered only while unlocalised.                                                                                                                         |

Children are positioned by the scene graph relative to the frame origin, so **there is no coordinate maths in app code**. A child at `[0, 0, -1]` is the same physical metre on every device.

### `<ViroSharedFrame>` — any platform

`<ViroARCloudAnchor>` is this with the cloud-anchor source pre-selected. Use it directly to pick a source explicitly:

```tsx
import {
  ViroSharedFrame,
  cloudAnchorFrameSource,
  metaSpatialAnchorFrameSource,
  visionOSSharedSpaceFrameSource,
} from '@reactvision/react-viro';

const source = isQuest
  ? metaSpatialAnchorFrameSource(groupUuid, 'join')   // or 'create' on the host
  : cloudAnchorFrameSource(cloudAnchorId);

<ViroSharedFrame source={source} arSceneNavigator={nav} onLocalized={...}>
  <ViroBox position={[0, 0, -1]} />
</ViroSharedFrame>
```

Every source exposes `key` (which doubles as the channel room id), `name`, and `support` — check `support.ok` before offering the feature, since each source declares the platforms it can run on.

### Frame sources

| Source                                          | Platform     | Notes                                                                                        |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `cloudAnchorFrameSource(id)`                    | iOS, Android | SIFT relocalisation against a hosted anchor.                                                 |
| `metaSpatialAnchorFrameSource(groupUuid, mode)` | Quest        | `mode` is `"create"` on the device that publishes, `"join"` on the rest. No camera involved. |
| `visionOSSharedSpaceFrameSource(sessionId)`     | visionOS     | See the shape caveat below.                                                                  |

**visionOS is shaped differently.** ARKit aligns the **world origin itself** across participants rather than handing back an anchor to locate. So once the space converges the frame transform is identity, and content placed at a world position is already in the same physical spot everywhere. `<ViroSharedFrame>` absorbs this — the component code is unchanged — but ARKit does not move its own alignment data:

```ts
import {
  sharedSpaceNextOutgoing,
  sharedSpacePushIncoming,
} from "@reactvision/react-viro";

// Poll, and ship whatever comes back to the other participants.
const blob = await sharedSpaceNextOutgoing();
if (blob) myTransport.send(blob);

// On arrival:
await sharedSpacePushIncoming(receivedBlob);
```

Until both sides pump, the space never converges and the frame source times out.

---

## The channel

```ts
const { available, state, localPeerId, peers, error, publishPose } =
  useViroColocation({
    roomId, // same id that names the frame
    apiKey,
    projectId,
    endpoint, // optional; defaults to the production platform
    enabled, // default true
    pollMs, // default 100
  });
```

`state` is `"idle" | "joining" | "joined" | "reconnecting" | "failed"`. Each peer carries `peerId`, `position`, `rotation` (quaternion), `timestampMs` and `localized`.

Imperative equivalents exist for non-React use: `isColocationAvailable`, `joinColocation`, `leaveColocation`, `setColocationLocalPose`, `getColocationState`, `getColocationPeers`.

### The coordinate contract

**Send location-frame coordinates. Never world coordinates.**

World coordinates are per-session — each AR session picks its origin wherever tracking started — so a world position means nothing to the peer receiving it. The wire schema has no way to express one.

```ts
import {
  parseLocationTransform,
  worldToLocation,
  locationToWorld,
} from "@reactvision/react-viro";

const frame = parseLocationTransform(transformFromOnLocalized)!;

// Before sending your own object's position:
const forTheWire = worldToLocation(frame, myObjectWorldPosition);

// After receiving a peer's:
const hereInMyWorld = locationToWorld(frame, theirPosition);
```

`peers[].position` is already in the frame, so a peer marker rendered **inside** `<ViroSharedFrame>` needs no conversion at all — the scene graph does it. Conversion is only for content you keep outside the frame node.

---

## Replicated state

The channel carries frame-native data only: poses and presence. Everything else two devices must agree on, whose turn it is, which objects have been placed, who is holding what, is **replicated state**. It rides a second socket at `/functions/v1/replication/{roomId}`, with the same room id and the same credentials.

```tsx
import { useViroReplicatedState } from "@reactvision/react-viro";

const { entities, byId, claim, release, set, remove, isMine } =
  useViroReplicatedState({
    roomId, // the same id that names the frame and the channel
    apiKey,
    projectId,
    enabled: frame !== null,
    onReject: (r) => console.warn(r.reason, r.current),
  });

// Grab it, then move it. While held, nobody else can write to it.
claim("cone-3");
if (isMine("cone-3")) {
  set("cone-3", { position: [0, 0, -1] }, { optimistic: true });
}
```

Two sockets rather than two message types on one, because poses originate in C++ at frame rate and must not cross the JS bridge, while application state originates in JS and must not be lossy. One socket would make each pay the other's cost.

### The model

An entity is `{ id, fields, version, owner }`. The server orders every operation, accepts or refuses it, and broadcasts the result, so every device converges on the same state in the same order. `fields` is yours; the server never interprets it.

- **Ownership gates mutation.** `claim` takes an entity, creating it if it does not exist yet, so placing and holding is one step. While a peer owns it, only that peer may `set` or `remove` it. Two devices grabbing the same object therefore resolve: the first `claim` wins, the second is refused `already-owned` with the current value attached, so the loser renders the in-use state rather than guessing it.
- **A departing peer releases everything it held.** A device that crashes mid-grab does not lock that object for the life of the room.
- **Unowned entities are last-writer-wins.** Pass `expectVersion` to opt into optimistic concurrency instead: the write is refused `version-conflict` if the entity moved on, and the current value comes back with the refusal.
- **`optimistic` is per write and off by default.** The default costs one round trip and never shows a value that turns out not to be true. Turn it on for something being dragged, where a round trip per frame is visible.

Refusals reach `onReject` as one of `not-owner`, `version-conflict`, `already-owned`, `no-such-entity`, `malformed`, `too-many-entities` or `field-too-large`.

Limits per room: 512 entities and 16 KB of serialised fields per entity.

### Coordinates, again

**Positions stored here are location-frame coordinates, exactly like poses on the channel.** The same `worldToLocation` / `locationToWorld` conversion applies, for the same reason: a world position is per-session and means nothing to the peer receiving it.

### Nothing is persisted

Room state lives as long as the room has occupants and never reaches disk, so a server restart empties it. The channel shrugs that off with a reconnect, because the frame lives on the device. Replicated state does not: the placed objects and the shared step index are simply gone.

The recovery is on the client. Keep a local mirror of what this device created or owns, and after a reconnect re-push whatever the room came back without. The same path covers a device that merely missed updates while backgrounded.

---

## Platform support

|                     | Frame                  | Channel |
| ------------------- | ---------------------- | ------- |
| iOS / Android phone | ✅ cloud anchor        | ✅      |
| Meta Quest          | ✅ Meta spatial anchor | ✅      |
| visionOS            | ✅ ARKit shared space  | ✅      |

Cloud anchors specifically are **not** available on either headset, and structurally so: Quest's OpenXR session produces no camera image for the SIFT localiser and stubs cloud anchors outright, and visionOS builds exclude the AR subsystem entirely while gating passthrough camera access behind an enterprise entitlement. `cloudAnchorFrameSource` reports this through `support.ok === false` with the reason attached, and `<ViroARCloudAnchor>` warns once and reports `ErrorNotSupported` rather than failing slowly.

The channel and replication need no camera and work on all three.

---

## The service

Both sockets are served by ReactVision's hosted relay, the channel at `/functions/v1/colocation/{roomId}` and replication at `/functions/v1/replication/{roomId}`. `endpoint` defaults to it, so most apps pass `apiKey` and `projectId` and nothing else.

What that means in practice:

- **Rooms are scoped to your project.** The room key is your organisation, your project and the room id, so two apps that happen to pick the same room id never meet. It also means both devices must send the same `projectId`, not just the same `roomId`.
- **Room ids are case-sensitive**, at most 128 characters, and limited to `A-Za-z0-9._~:@+-`. A cloud anchor id or a Meta group uuid already fits; an id you invent yourself should stay inside that set.
- **Co-location needs a paid plan.** A free-tier organisation is refused at the handshake and the hook reports `failed`. Upgrade the team in its billing settings in ReactVision Studio.
- **Credentials go in headers**, `x-api-key` and `x-project-id`. Passing them in the query string is refused, because a key in a URL reaches proxy and server logs.
- **A restart makes every peer rejoin with a new peer id.** Other devices see the old id leave and a new one join. Key your own per-peer state on something the peer tells you, never on `peerId` surviving a reconnect. The frame is unaffected: reconnecting never re-localises.

### Running a server locally

For LAN development there is a reference implementation in the `reactvisioncca` repository under `server/`, in Deno:

```bash
cd server
deno task dev        # :8787
deno task test
```

Point devices at it with `endpoint: 'http://<your-lan-ip>:8787'`; the client turns `http://` into `ws://` itself. Use the LAN address, not `localhost`: on a phone, `localhost` is the phone.

**It is a reference, not a deployment.** Rooms live in one process's memory, so two peers only meet if they land on the same instance, and its credential check confirms the key and project id are present and nothing more. The wire contract for both sockets is `PROTOCOL.md` beside it.

---

## Troubleshooting

| Symptom                                    | Likely cause                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ErrorNotSupported` from `onLocalizeError` | Cloud anchors on a headset. Use the platform's own frame source.                                                                                                                   |
| Localisation never completes on a phone    | The space was scanned too small, or you are not looking at what was scanned. The coverage gate needs ≥40 points, ≥1 m spread and ≥5 viewpoint pairs — walk, don't rotate in place. |
| `available === false` from the hook        | ReactVisionCCA is not linked in this build, or the platform has no WebSocket transport.                                                                                            |
| Joined, but `peers` stays empty            | Both devices must use the **same `roomId`** and the **same `projectId`**: rooms are scoped per project. Against a local reference server they must also reach the same process.    |
| `failed` at once, with no reconnect        | The handshake was refused, not dropped. A free-tier organisation, a key that does not belong to that project, or a room id outside the permitted characters.                       |
| visionOS frame source times out            | Only one side is pumping alignment data. Both must call `sharedSpaceNextOutgoing` / `sharedSpacePushIncoming`.                                                                     |
| Peers appear in the wrong place            | World coordinates went on the wire. Convert with `worldToLocation` before sending.                                                                                                 |

---

## See also

- `startScan()` / `finishScan()` on the AR scene navigator: hosting a space, which is where a phone's `cloudAnchorId` comes from.
- `plans/viro-colocation-plan.md` — design rationale, the decisions taken, and what remains unvalidated.
- `PROTOCOL.md` in `reactvisioncca/server` — the wire contract for the channel and for replication, if you are replacing the server.
