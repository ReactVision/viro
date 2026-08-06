"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimations = void 0;
/**
 * Web implementation of ViroAnimations. Instead of registering declarative
 * animations with the native module, it stores them in the web animation
 * registry, where node components resolve them by name and run a transaction.
 */
const viroAnimationRegistry_1 = require("../Web/viroAnimationRegistry");
class ViroAnimations {
    static registerAnimations(animations) {
        // Animation chains (arrays) are not supported on web yet; register single defs.
        const singles = {};
        for (const name of Object.keys(animations)) {
            const def = animations[name];
            if (!Array.isArray(def))
                singles[name] = def;
        }
        (0, viroAnimationRegistry_1.registerViroAnimations)(singles);
    }
}
exports.ViroAnimations = ViroAnimations;
