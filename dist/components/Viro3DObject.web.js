"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro3DObject = Viro3DObject;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroModelLoader_1 = require("./Web/viroModelLoader");
function Viro3DObject(props) {
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    // `loaded` is the hook's contentReady: the model's own animations and any
    // shader override both need its subtree to exist first.
    const node = (0, useViroNode_1.useViroNode)(props, undefined, loaded);
    const renderer = (0, ViroWebContext_1.useViroRenderer)();
    const url = (0, viroModelLoader_1.resolveModelSource)(props.source);
    const { onLoadStart, onLoadEnd, onError, type } = props;
    const resourceUrls = (props.resources ?? [])
        .map(viroModelLoader_1.resolveModelSource)
        .filter((u) => !!u);
    const resourcesKey = resourceUrls.join(",");
    (0, react_1.useEffect)(() => {
        if (!url) {
            console.warn("[Viro web] Viro3DObject: unresolved source", props.source);
            return;
        }
        let cancelled = false;
        const format = (0, viroModelLoader_1.modelFormatFor)(url, type);
        onLoadStart?.();
        (async () => {
            const [bytes, resources] = await Promise.all([
                (0, viroModelLoader_1.fetchModelBytes)(url),
                Promise.all(resourceUrls.map(async (resUrl) => ({
                    name: (0, viroModelLoader_1.resourceName)(resUrl),
                    bytes: await (0, viroModelLoader_1.fetchModelBytes)(resUrl),
                }))),
            ]);
            if (cancelled)
                return false;
            return renderer.loadModel(node, bytes, format, resources);
        })()
            .then((success) => {
            if (cancelled)
                return;
            if (success) {
                setLoaded(true);
                onLoadEnd?.(true);
            }
            else {
                onError?.(new Error("model load failed"));
            }
        })
            .catch((err) => {
            if (!cancelled)
                onError?.(err);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, url, type, resourcesKey]);
    // Morph targets, once the model's meshes exist: virocore hangs a morpher off
    // each mesh as it loads, so a weight set before that reaches nothing.
    const scene = (0, ViroWebContext_1.useViroScene)();
    const { morphTargets, morphMode, onMorphTargets } = props;
    const morphKey = morphTargets
        ? morphTargets.map((t) => `${t.target}=${t.weight}`).join(",")
        : "";
    (0, react_1.useEffect)(() => {
        if (!loaded || !morphMode)
            return;
        scene.setMorphMode(node, morphMode);
    }, [scene, node, loaded, morphMode]);
    (0, react_1.useEffect)(() => {
        if (!loaded || !morphTargets)
            return;
        for (const { target, weight } of morphTargets) {
            if (typeof target !== "string")
                continue;
            scene.setMorphTargetWeight(node, target, weight ?? 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, node, loaded, morphKey]);
    (0, react_1.useEffect)(() => {
        if (!loaded || !onMorphTargets)
            return;
        onMorphTargets(scene.getMorphTargetKeys(node));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, node, loaded]);
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children }));
}
