"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroFlexSlotContext = void 0;
exports.useViroFlexSlot = useViroFlexSlot;
/**
 * The frame a ViroFlexView measured for one of its children.
 *
 * Native pushes the same two things onto a laid-out child — a position and a
 * size — from VRTNode's recalcLayout. Position is applied by the container here
 * (it wraps each child in a node it owns), so what travels through the context
 * is the size, which only the child itself can act on: a quad, an image and a
 * text block each rebuild different geometry from it.
 *
 * Null outside a ViroFlexView, which is the common case: a child then keeps the
 * width and height it was written with.
 */
const react_1 = require("react");
exports.ViroFlexSlotContext = (0, react_1.createContext)(null);
function useViroFlexSlot() {
    return (0, react_1.useContext)(exports.ViroFlexSlotContext);
}
