"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroParticleEmitter = ViroParticleEmitter;
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
function shapeEnum(shape) {
    switch ((shape ?? "").toLowerCase()) {
        case "box":
            return viro_web_renderer_1.ViroParticleSpawnShape.Box;
        case "sphere":
            return viro_web_renderer_1.ViroParticleSpawnShape.Sphere;
        default:
            return viro_web_renderer_1.ViroParticleSpawnShape.Point;
    }
}
const asVec3 = (a) => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0];
const asPair = (a, d = 0) => [a?.[0] ?? d, a?.[1] ?? a?.[0] ?? d];
function ViroParticleEmitter(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const node = (0, useViroNode_1.useViroNode)(props);
    const url = (0, viroImageLoader_1.resolveImageSource)(props.image?.source);
    const texRef = (0, react_1.useRef)(0);
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    // Build the emitter once the sprite texture is ready.
    (0, react_1.useEffect)(() => {
        if (!node || !url)
            return;
        let cancelled = false;
        (0, viroImageLoader_1.loadImageRGBA)(url)
            .then((img) => {
            if (cancelled)
                return;
            const p = propsRef.current;
            const texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
            texRef.current = texture;
            const sb = p.spawnBehavior ?? {};
            const vel = p.particlePhysics?.velocity;
            scene.createParticleEmitter(node, texture, {
                particleWidth: p.image?.width ?? 0.1,
                particleHeight: p.image?.height ?? 0.1,
                maxParticles: sb.maxParticles,
                emissionRatePerSecond: asPair(sb.emissionRatePerSecond, 10),
                particleLifetime: asPair(sb.particleLifetime, 2000),
                spawnShape: shapeEnum(sb.spawnVolume?.shape),
                spawnParams: asVec3(sb.spawnVolume?.params),
                velocityMin: asVec3(vel?.min),
                velocityMax: asVec3(vel?.max ?? vel?.min),
            });
            scene.setParticleEmitterRun(node, p.run !== false);
        })
            .catch(() => { });
        return () => {
            cancelled = true;
            if (texRef.current) {
                scene.destroyTexture(texRef.current);
                texRef.current = 0;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, url]);
    // Run/pause toggling.
    (0, react_1.useEffect)(() => {
        if (node)
            scene.setParticleEmitterRun(node, props.run !== false);
    }, [scene, node, props.run]);
    return null;
}
