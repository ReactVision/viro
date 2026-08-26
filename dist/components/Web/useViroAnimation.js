"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroAnimation = useViroAnimation;
/**
 * Drives a node's animation from the Viro `animation` prop
 * ({ name, run, loop, onStart, onFinish }). Resolves the name against two
 * systems:
 *   1. A declarative ViroAnimation (registered via ViroAnimations) → runs a
 *      transaction from the node's current transform.
 *   2. Otherwise a model animation (skeletal/keyframe) → node->getAnimation.
 *
 * `ready` gates model animations (which only exist after a model loads). If
 * `name` is omitted or "*", the model's first animation is used.
 */
const react_1 = require("react");
const ViroWebContext_1 = require("./ViroWebContext");
const viroAnimationRegistry_1 = require("./viroAnimationRegistry");
function useViroAnimation(node, animation, base, ready) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const renderer = (0, ViroWebContext_1.useViroRenderer)();
    const name = animation?.name;
    const run = animation?.run;
    const loop = animation?.loop;
    const baseKey = `${base.position.join()}|${base.rotation.join()}|${base.scale.join()}|${base.opacity}`;
    (0, react_1.useEffect)(() => {
        if (!ready || !animation)
            return;
        renderer.setNodeAnimationHandlers(node, {
            onStart: animation.onStart,
            onFinish: animation.onFinish,
        });
        if (run !== false) {
            // Try a registered declarative animation first, then a model animation.
            if (!name || !(0, viroAnimationRegistry_1.runDeclarativeAnimation)(scene, node, name, base, !!loop)) {
                let animName = name;
                if (!animName || animName === "*") {
                    animName = scene.getAnimationKeys(node)[0];
                }
                if (animName) {
                    scene.startAnimation(node, animName, !!loop);
                }
            }
        }
        else {
            scene.pauseAnimation(node);
        }
        return () => {
            renderer.clearNodeAnimationHandlers(node);
            scene.stopAnimation(node, false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, ready, name, run, loop, baseKey]);
}
