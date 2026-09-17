/**
 * Copyright © 2026 ReactVision
 *
 * Co-location rooms — the short code people actually type.
 *
 * A room is what several devices join to share one AR space, and until this
 * existed the only way to name one was the uuid of the frame it was built on.
 * That is fine for two devices in one app and impossible to read out loud, so a
 * room now has a six-character code and a row of its own on the platform.
 *
 * The room also carries *how* its devices establish the frame, which is what
 * lets a joining device pick the right frame source without being told: the
 * host creates a room for the frame it has (a hosted cloud anchor on phones, a
 * Meta group on Quest, nothing at all on visionOS), and the joiner reads it
 * back off the code.
 *
 * These calls go to the platform, not to the relay. The relay carries poses and
 * replicated state; rooms are ordinary REST, one request before a session
 * starts.
 *
 * @providesModule ViroColocationRooms
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODE_ALPHABET = void 0;
exports.normaliseJoinCode = normaliseJoinCode;
exports.formatJoinCode = formatJoinCode;
exports.createColocationRoom = createColocationRoom;
exports.lookupColocationRoom = lookupColocationRoom;
const DEFAULT_ENDPOINT = "https://platform.reactvision.xyz";
/**
 * The 30 characters a code can hold. O and 0, I and 1 and L, and U against V
 * are all left out so a code read off a screen at arm's length is unambiguous.
 * The platform mints them; this copy exists so a typo costs no request.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
exports.CODE_ALPHABET = CODE_ALPHABET;
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{6,8}$/;
/** What someone typed, as the platform stores it, or null if it cannot be a code. */
function normaliseJoinCode(input) {
    const stripped = input.replace(/[\s-]+/g, "").toUpperCase();
    return CODE_PATTERN.test(stripped) ? stripped : null;
}
/** `K7M2QX` as `K7M 2QX`, which is how it is shown and read out. */
function formatJoinCode(code) {
    const half = Math.ceil(code.length / 2);
    return `${code.slice(0, half)} ${code.slice(half)}`;
}
/**
 * Create a room for a frame this device has already established, and get back
 * the code for the others to type.
 */
async function createColocationRoom(config, frame) {
    const body = {
        frame_kind: frame.frameKind,
        name: frame.name,
    };
    if (frame.frameKind === "cloud_anchor")
        body.cloud_anchor_id = frame.cloudAnchorId;
    if (frame.frameKind === "meta_group")
        body.frame_ref = frame.frameRef;
    return await request(config, "POST", "/rooms", body);
}
/** Look a room up by the code someone typed. */
async function lookupColocationRoom(config, code) {
    const normalised = normaliseJoinCode(code);
    if (!normalised) {
        return {
            success: false,
            error: "That is not a join code. Codes are six characters.",
            code: "INVALID_JOIN_CODE",
        };
    }
    return await request(config, "GET", `/rooms/${normalised}`);
}
async function request(config, method, path, body) {
    const base = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "");
    const url = `${base}/functions/v1/colocation${path}`;
    let response;
    try {
        response = await fetch(url, {
            method,
            headers: {
                "content-type": "application/json",
                "x-api-key": config.apiKey,
                "x-project-id": config.projectId,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }
    catch (e) {
        return { success: false, error: e?.message ?? "Network request failed" };
    }
    let parsed = null;
    try {
        parsed = await response.json();
    }
    catch {
        // Falls through to the status-only message below.
    }
    if (!response.ok || !parsed?.room) {
        return {
            success: false,
            error: parsed?.error?.message ?? `Request failed (${response.status})`,
            code: parsed?.error?.code,
        };
    }
    return { success: true, room: toRoom(parsed.room) };
}
function toRoom(raw) {
    return {
        id: String(raw.id),
        roomId: String(raw.room_id ?? raw.id),
        joinCode: raw.join_code ?? null,
        frameKind: raw.frame_kind ?? null,
        cloudAnchorId: raw.cloud_anchor_id ?? null,
        frameRef: raw.frame_ref ?? null,
        name: raw.name ?? null,
    };
}
