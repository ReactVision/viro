"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDENTITY = void 0;
exports.isVec3 = isVec3;
exports.multiply = multiply;
exports.invert = invert;
exports.transformPoint = transformPoint;
exports.rotateDirection = rotateDirection;
exports.fromPositionEuler = fromPositionEuler;
exports.fromPositionQuat = fromPositionQuat;
exports.toNodeTransform = toNodeTransform;
exports.toPositionQuat = toPositionQuat;
exports.normaliseQuat = normaliseQuat;
exports.quatToEuler = quatToEuler;
exports.parseOriginFields = parseOriginFields;
exports.dragSurfaceFromSceneToWorld = dragSurfaceFromSceneToWorld;
const ViroLocationFrame_1 = require("../../AR/ViroLocationFrame");
function isVec3(v) {
    return (Array.isArray(v) &&
        v.length === 3 &&
        v.every((n) => typeof n === "number" && Number.isFinite(n)));
}
exports.IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
function multiply(a, b) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c * 4 + r] =
                a[r] * b[c * 4] +
                    a[4 + r] * b[c * 4 + 1] +
                    a[8 + r] * b[c * 4 + 2] +
                    a[12 + r] * b[c * 4 + 3];
        }
    }
    return out;
}
function invert(m) {
    return (0, ViroLocationFrame_1.invertTransform)(m);
}
function transformPoint(m, p) {
    return (0, ViroLocationFrame_1.locationToWorld)(m, p);
}
function rotateDirection(m, d) {
    return (0, ViroLocationFrame_1.transformDirection)(m, d);
}
/** A pose as ViroNode props describe it (the renderer's Z·Y·X Euler order). */
function fromPositionEuler(position, rotationDegrees, scale = [1, 1, 1]) {
    const cx = Math.cos(rotationDegrees[0] * RAD);
    const sx = Math.sin(rotationDegrees[0] * RAD);
    const cy = Math.cos(rotationDegrees[1] * RAD);
    const sy = Math.sin(rotationDegrees[1] * RAD);
    const cz = Math.cos(rotationDegrees[2] * RAD);
    const sz = Math.sin(rotationDegrees[2] * RAD);
    const r = [
        [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
        [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
        [-sy, cy * sx, cy * cx],
    ];
    return fromRows(r, position, scale);
}
function fromPositionQuat(position, q) {
    const [x, y, z, w] = q;
    const r = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ];
    return fromRows(r, position, [1, 1, 1]);
}
function fromRows(r, position, scale) {
    return [
        r[0][0] * scale[0],
        r[1][0] * scale[0],
        r[2][0] * scale[0],
        0,
        r[0][1] * scale[1],
        r[1][1] * scale[1],
        r[2][1] * scale[1],
        0,
        r[0][2] * scale[2],
        r[1][2] * scale[2],
        r[2][2] * scale[2],
        0,
        position[0],
        position[1],
        position[2],
        1,
    ];
}
/** Rows of the rotation with each axis's scale divided out. */
function rotationRows(m) {
    const sx = Math.hypot(m[0], m[1], m[2]) || 1;
    const sy = Math.hypot(m[4], m[5], m[6]) || 1;
    const sz = Math.hypot(m[8], m[9], m[10]) || 1;
    return {
        r: [
            [m[0] / sx, m[4] / sy, m[8] / sz],
            [m[1] / sx, m[5] / sy, m[9] / sz],
            [m[2] / sx, m[6] / sy, m[10] / sz],
        ],
        scale: [sx, sy, sz],
    };
}
function toNodeTransform(m) {
    const { r, scale } = rotationRows(m);
    const cy = Math.hypot(r[0][0], r[1][0]);
    const y = Math.atan2(-r[2][0], cy);
    let x;
    let z;
    if (cy > 1e-6) {
        x = Math.atan2(r[2][1], r[2][2]);
        z = Math.atan2(r[1][0], r[0][0]);
    }
    else {
        // Gimbal lock: X and Z turn about the same axis, so both go into Z.
        x = 0;
        z = Math.atan2(-r[0][1], r[1][1]);
    }
    return {
        position: [m[12], m[13], m[14]],
        rotation: [x * DEG, y * DEG, z * DEG],
        scale,
    };
}
/** Position and unit quaternion [x, y, z, w]; any scale is dropped. */
function toPositionQuat(m) {
    const { r } = rotationRows(m);
    const trace = r[0][0] + r[1][1] + r[2][2];
    let q;
    if (trace > 0) {
        const s = Math.sqrt(trace + 1) * 2;
        q = [
            (r[2][1] - r[1][2]) / s,
            (r[0][2] - r[2][0]) / s,
            (r[1][0] - r[0][1]) / s,
            s / 4,
        ];
    }
    else if (r[0][0] > r[1][1] && r[0][0] > r[2][2]) {
        const s = Math.sqrt(1 + r[0][0] - r[1][1] - r[2][2]) * 2;
        q = [
            s / 4,
            (r[0][1] + r[1][0]) / s,
            (r[0][2] + r[2][0]) / s,
            (r[2][1] - r[1][2]) / s,
        ];
    }
    else if (r[1][1] > r[2][2]) {
        const s = Math.sqrt(1 + r[1][1] - r[0][0] - r[2][2]) * 2;
        q = [
            (r[0][1] + r[1][0]) / s,
            s / 4,
            (r[1][2] + r[2][1]) / s,
            (r[0][2] - r[2][0]) / s,
        ];
    }
    else {
        const s = Math.sqrt(1 + r[2][2] - r[0][0] - r[1][1]) * 2;
        q = [
            (r[0][2] + r[2][0]) / s,
            (r[1][2] + r[2][1]) / s,
            s / 4,
            (r[1][0] - r[0][1]) / s,
        ];
    }
    return { p: [m[12], m[13], m[14]], q: normaliseQuat(q) ?? [0, 0, 0, 1] };
}
function normaliseQuat(q) {
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    if (!(n > 1e-6))
        return null;
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
function quatToEuler(q) {
    return toNodeTransform(fromPositionQuat([0, 0, 0], q)).rotation;
}
function isFiniteTuple(v, length) {
    return (Array.isArray(v) &&
        v.length === length &&
        v.every((n) => typeof n === "number" && Number.isFinite(n)));
}
/** The `scene:origin` fields as a scene-to-location matrix, null when malformed. */
function parseOriginFields(fields) {
    if (!isFiniteTuple(fields.p, 3) || !isFiniteTuple(fields.q, 4))
        return null;
    const q = normaliseQuat(fields.q);
    if (!q)
        return null;
    return fromPositionQuat(fields.p, q);
}
/**
 * The plane a shared origin sits on, in world space. A plane anchor's local +Y
 * is its surface normal, and the origin keeps the anchor's orientation.
 */
function dragSurfaceFromSceneToWorld(sceneToWorld) {
    const { r } = rotationRows(sceneToWorld);
    const normal = [r[0][1], r[1][1], r[2][1]];
    return {
        normal,
        distance: normal[0] * sceneToWorld[12] +
            normal[1] * sceneToWorld[13] +
            normal[2] * sceneToWorld[14],
    };
}
