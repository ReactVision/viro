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
const ViroPlatform_1 = require("../Utilities/ViroPlatform");
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
