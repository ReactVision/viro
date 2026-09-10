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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudAnchorFrameSource = cloudAnchorFrameSource;
exports.metaSpatialAnchorFrameSource = metaSpatialAnchorFrameSource;
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
const ViroLocationFrame_1 = require("./ViroLocationFrame");
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
function cloudAnchorFrameSource(cloudAnchorId) {
    return {
        key: cloudAnchorId,
        name: "cloud anchor",
        support: cloudAnchorSupport(),
        async acquire(ctx) {
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
            }
            catch (e) {
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
function metaSpatialAnchorFrameSource(groupId, mode = "join") {
    return {
        key: groupId,
        name: "Meta spatial anchor",
        // Platform-level only. Whether the runtime actually exposes group sharing
        // cannot be answered synchronously from JS, so that surfaces as an acquire
        // error rather than a support flag — see the `acquire` failure below.
        support: ViroPlatform_1.isQuest
            ? { ok: true }
            : {
                ok: false,
                reason: "Meta shared spatial anchors exist only on Quest. Use a cloud anchor on phones, or the visionOS shared space.",
            },
        async acquire(ctx) {
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
            }
            catch (e) {
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
 * Position and Euler rotation from a column-major transform CSV.
 *
 * Cloud anchors get these from native, which already decomposed them; a shared
 * frame arrives as the matrix alone, so the same numbers are recovered here
 * rather than adding a second native shape for one platform.
 */
function decomposeCsv(csv) {
    const t = (0, ViroLocationFrame_1.parseLocationTransform)(csv);
    if (!t) {
        return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
    }
    const len = (a, b, c) => Math.hypot(t[a], t[b], t[c]);
    const sx = len(0, 1, 2) || 1;
    const sy = len(4, 5, 6) || 1;
    const sz = len(8, 9, 10) || 1;
    // Rotation matrix with scale divided out, then ZYX Euler in degrees to match
    // ViroNode's `rotation` prop.
    const m00 = t[0] / sx, m01 = t[4] / sy, m02 = t[8] / sz;
    const m10 = t[1] / sx, m11 = t[5] / sy, m12 = t[9] / sz;
    const m20 = t[2] / sx, m21 = t[6] / sy, m22 = t[10] / sz;
    const deg = 180 / Math.PI;
    let rx, ry, rz;
    // |m20| ~ 1 is gimbal lock: m00/m11 stop carrying yaw and roll separately, so
    // roll is pinned to 0 and the whole rotation is folded into yaw.
    if (Math.abs(m20) < 0.999999) {
        ry = Math.asin(-m20);
        rx = Math.atan2(m21, m22);
        rz = Math.atan2(m10, m00);
    }
    else {
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
function cloudAnchorSupport() {
    if (ViroPlatform_1.isQuest) {
        return {
            ok: false,
            reason: "Meta Quest has no camera frames for the SIFT localiser and OpenXR stubs cloud anchors.",
        };
    }
    if (ViroPlatform_1.isVisionOS) {
        return {
            ok: false,
            reason: "visionOS builds exclude the AR subsystem, and passthrough camera access needs an enterprise entitlement.",
        };
    }
    return { ok: true };
}
