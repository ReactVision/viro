/**
 * Copyright © 2026 ReactVision
 *
 * Frame sources — where a shared coordinate frame comes from.
 *
 * Co-location needs every device in a space to agree on one origin. *How* that
 * origin is established is a platform question, not a co-location question:
 *
 *   - phones     → a resolved ReactVision cloud anchor (SIFT relocalisation)
 *   - Quest      → a shared Meta spatial anchor
 *   - visionOS   → ARKit's shared coordinate space
 *
 * The channel that carries poses between devices (`RVCCAColocationSession`)
 * never asks which of these produced the frame — it only ever moves coordinates
 * *in* the frame. This interface is that seam made explicit, so a new platform
 * is an adapter rather than a fork of the feature.
 *
 * Cross-family co-location is deliberately out of scope: a Quest on a Meta
 * anchor and a phone on a cloud anchor are in unrelated frames, and nothing has
 * observed both. See `plans/viro-colocation-plan.md` §5 decision 6.
 *
 * @providesModule ViroFrameSource
 */

"use strict";

import { ViroCloudAnchorState } from "../Types/ViroEvents";
import { isQuest, isVisionOS } from "../Utilities/ViroPlatform";
import { parseLocationTransform } from "./ViroLocationFrame";

/** Whether a source can run at all on the device it finds itself on. */
export type ViroFrameSupport = { ok: true } | { ok: false; reason: string };

/** A resolved frame, in this session's world coordinates. */
export type ViroSharedFrameValue = {
  position: [number, number, number];
  /** Euler degrees, matching ViroNode's `rotation` prop. */
  rotation: [number, number, number];
  scale: [number, number, number];
  /**
   * Opaque token for the frame. Pass to `loadWorldMeshFromFile()` as-is, or to
   * `parseLocationTransform()` when converting coordinates for another device.
   */
  transform: string;
};

export type ViroFrameOutcome =
  | { success: true; frame: ViroSharedFrameValue }
  | { success: false; error: string; state?: ViroCloudAnchorState };

/** What a source is given to do its job. */
export type ViroFrameSourceContext = {
  /** The navigator the scene was handed by its ViroXRSceneNavigator. */
  arSceneNavigator: any;
};

export interface ViroFrameSource {
  /**
   * Stable identifier for the frame this source produces.
   *
   * Doubles as the room key for the co-location channel: two devices acquiring
   * the same key are, by definition, in the same space.
   */
  readonly key: string;

  /** For logs and error messages — "cloud anchor", "Meta spatial anchor". */
  readonly name: string;

  /** Checked before `acquire()` so an unsupported platform fails immediately. */
  readonly support: ViroFrameSupport;

  acquire(ctx: ViroFrameSourceContext): Promise<ViroFrameOutcome>;
}

/**
 * Frame from a ReactVision cloud anchor — the phone path.
 *
 * Unsupported on both headsets, and structurally so rather than for want of
 * wiring: Quest's OpenXR session stubs cloud anchors and produces no camera
 * frame for the SIFT localiser to run on, and visionOS builds exclude the AR
 * subsystem entirely (zero `VROAR*` objects in the shipped library) on top of
 * gating passthrough camera access behind an enterprise entitlement.
 *
 * Use `metaSpatialAnchorFrameSource` / `visionOSSharedSpaceFrameSource` there.
 */
export function cloudAnchorFrameSource(cloudAnchorId: string): ViroFrameSource {
  return {
    key: cloudAnchorId,
    name: "cloud anchor",
    support: cloudAnchorSupport(),

    async acquire(ctx: ViroFrameSourceContext): Promise<ViroFrameOutcome> {
      const nav = ctx.arSceneNavigator;
      if (!nav?.resolveCloudAnchor) {
        return {
          success: false,
          error: "This navigator does not expose resolveCloudAnchor",
          state: "ErrorInternal",
        };
      }

      try {
        const result = await nav.resolveCloudAnchor(cloudAnchorId);
        if (!result?.success || !result.anchor) {
          return {
            success: false,
            error: result?.error ?? "Resolve failed",
            state: result?.state,
          };
        }
        const a = result.anchor;
        return {
          success: true,
          frame: {
            position: a.position,
            rotation: a.rotation,
            scale: a.scale,
            transform: a.resolvedTransform ?? "",
          },
        };
      } catch (e: any) {
        return {
          success: false,
          error: e?.message ?? String(e),
          state: "ErrorInternal",
        };
      }
    },
  };
}

/**
 * Frame from a Meta shared spatial anchor — the Quest path (CL-H).
 *
 * Nothing is uploaded and nothing is relocalised from camera imagery, which is
 * the point: Quest gives no camera frames to the SIFT localiser, but its own
 * spatial anchors already solve co-location. One device calls this with
 * `create`, the rest with `join`, and `groupId` — a UUID the app picks — names
 * the space, the frame and the co-location room all at once.
 *
 * @param groupId  UUID shared out-of-band, exactly like a cloud anchor id.
 * @param mode     `"create"` publishes a new frame; `"join"` recovers one.
 */
export function metaSpatialAnchorFrameSource(
  groupId: string,
  mode: "create" | "join" = "join"
): ViroFrameSource {
  return {
    key: groupId,
    name: "Meta spatial anchor",
    // Platform-level only. Whether the runtime actually exposes group sharing
    // cannot be answered synchronously from JS, so that surfaces as an acquire
    // error rather than a support flag — see the `acquire` failure below.
    support: isQuest
      ? { ok: true }
      : {
          ok: false,
          reason:
            "Meta shared spatial anchors exist only on Quest. Use a cloud anchor on phones, or the visionOS shared space.",
        },

    async acquire(ctx: ViroFrameSourceContext): Promise<ViroFrameOutcome> {
      const nav = ctx.arSceneNavigator;
      const fn = mode === "create" ? nav?.rvCreateSharedFrame : nav?.rvJoinSharedFrame;
      if (!fn) {
        return {
          success: false,
          error: "This navigator does not expose shared frames",
          state: "ErrorInternal",
        };
      }

      try {
        const result = await fn(groupId);
        if (!result?.success) {
          return {
            success: false,
            error: result?.error ?? "Shared frame failed",
            state: "ErrorInternal",
          };
        }
        return {
          success: true,
          frame: {
            // The anchor sits at the reference-space origin, so the pose the
            // native side returns is the frame; position and rotation are read
            // back out of it rather than reported separately.
            ...decomposeCsv(result.transform ?? ""),
            transform: result.transform ?? "",
          },
        };
      } catch (e: any) {
        return {
          success: false,
          error: e?.message ?? String(e),
          state: "ErrorInternal",
        };
      }
    },
  };
}

/** Identity, column-major — visionOS's frame, once the space converges. */
const IDENTITY_CSV = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

/**
 * Frame from ARKit's shared coordinate space — the visionOS path (CL-I).
 *
 * Shaped differently from the other two, and the difference is the whole point:
 * phone and Quest hand back an anchor to locate, whereas visionOS aligns the
 * **world origin itself** across participants. So there is no transform to
 * apply — once the space converges the frame is identity, and content placed at
 * a world position is already in the same physical spot everywhere.
 *
 * ARKit does not move the alignment data. Poll
 * `ViroVisionOSModule.sharedSpaceNextOutgoing()` and deliver whatever it
 * returns to the other participants, over whatever transport the app already
 * has; they call `sharedSpacePushIncoming()`. Until both sides pump, the space
 * never converges and this never resolves.
 *
 * @param sessionId  Names the co-location room. Not used by ARKit, which
 *                   discovers participants itself — it exists so the channel
 *                   has a room key, like the other sources.
 * @param timeoutMs  How long to wait for convergence before giving up.
 */
export function visionOSSharedSpaceFrameSource(
  sessionId: string,
  timeoutMs: number = 30000
): ViroFrameSource {
  return {
    key: sessionId,
    name: "visionOS shared space",
    support: isVisionOS
      ? { ok: true }
      : {
          ok: false,
          reason:
            "ARKit shared coordinate spaces exist only on visionOS. Use a cloud anchor on phones, or a Meta spatial anchor on Quest.",
        },

    async acquire(): Promise<ViroFrameOutcome> {
      // Imported lazily: this module is loaded on every platform, and the
      // visionOS module pulls in native lookups that are pointless elsewhere.
      const { sharedSpaceState } = await import("../VisionOS/ViroVisionOSModule");

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const state = await sharedSpaceState();

        if (!state.supported) {
          return {
            success: false,
            error: "This device cannot join a shared coordinate space",
            state: "ErrorNotSupported",
          };
        }
        if (state.sharing) {
          return {
            success: true,
            frame: {
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              transform: IDENTITY_CSV,
            },
          };
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      return {
        success: false,
        error:
          "Timed out waiting for the shared coordinate space. Are both devices exchanging alignment data?",
        state: "ErrorInternal",
      };
    },
  };
}

/**
 * Position and Euler rotation from a column-major transform CSV.
 *
 * Cloud anchors get these from native, which already decomposed them; a shared
 * frame arrives as the matrix alone, so the same numbers are recovered here
 * rather than adding a second native shape for one platform.
 */
function decomposeCsv(csv: string): {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
} {
  const t = parseLocationTransform(csv);
  if (!t) {
    return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  }

  const len = (a: number, b: number, c: number) => Math.hypot(t[a], t[b], t[c]);
  const sx = len(0, 1, 2) || 1;
  const sy = len(4, 5, 6) || 1;
  const sz = len(8, 9, 10) || 1;

  // Rotation matrix with scale divided out, then ZYX Euler in degrees to match
  // ViroNode's `rotation` prop.
  const m00 = t[0] / sx, m01 = t[4] / sy, m02 = t[8] / sz;
  const m10 = t[1] / sx, m11 = t[5] / sy, m12 = t[9] / sz;
  const m20 = t[2] / sx, m21 = t[6] / sy, m22 = t[10] / sz;

  const deg = 180 / Math.PI;
  let rx: number, ry: number, rz: number;

  // |m20| ~ 1 is gimbal lock: m00/m11 stop carrying yaw and roll separately, so
  // roll is pinned to 0 and the whole rotation is folded into yaw.
  if (Math.abs(m20) < 0.999999) {
    ry = Math.asin(-m20);
    rx = Math.atan2(m21, m22);
    rz = Math.atan2(m10, m00);
  } else {
    ry = m20 > 0 ? -Math.PI / 2 : Math.PI / 2;
    rx = Math.atan2(-m01, m11);
    rz = 0;
  }

  return {
    position: [t[12], t[13], t[14]],
    rotation: [rx * deg, ry * deg, rz * deg],
    scale: [sx, sy, sz],
  };
}

function cloudAnchorSupport(): ViroFrameSupport {
  if (isQuest) {
    return {
      ok: false,
      reason:
        "Meta Quest has no camera frames for the SIFT localiser and OpenXR stubs cloud anchors.",
    };
  }
  if (isVisionOS) {
    return {
      ok: false,
      reason:
        "visionOS builds exclude the AR subsystem, and passthrough camera access needs an enterprise entitlement.",
    };
  }
  return { ok: true };
}
