"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro3DObject = Viro3DObject;
/**
 * Web implementation of Viro3DObject — loads a GLB/glTF/VRX model into a node.
 * Fetches the model bytes, writes them to the WASM virtual FS, and invokes the
 * native loader. Transform props apply to the containing node.
 *
 * Model animations become available after load; drive them via ViroAnimations
 * (follow-up). OBJ and external-resource glTF are not supported yet.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroModelLoader_1 = require("./Web/viroModelLoader");
function Viro3DObject(props) {
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    // Pass `loaded` as animationReady so the model's animations start once loaded.
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
    return (<ViroWebContext_1.ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroWebContext_1.ViroParentNodeContext.Provider>);
}
