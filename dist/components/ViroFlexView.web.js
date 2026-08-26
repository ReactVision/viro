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
exports.ViroFlexView = ViroFlexView;
/**
 * Web implementation of ViroFlexView — a rectangular container in 3D space with
 * an optional background (color or materials), sized by `style.width`/`height`.
 * Children render under the container node.
 *
 * MVP scope: sized container + background + children. Automatic flexbox layout
 * (flexDirection/justifyContent/alignItems/padding) is a follow-up — children
 * position themselves via their own transform for now.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroColor_1 = require("./Web/viroColor");
const viroMaterialRegistry_1 = require("./Web/viroMaterialRegistry");
function ViroFlexView(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const width = props.style?.width ?? props.width ?? 1;
    const height = props.style?.height ?? props.height ?? 1;
    const backgroundColor = props.style?.backgroundColor;
    const materialName = Array.isArray(props.materials) ? props.materials[0] : props.materials;
    const container = (0, useViroNode_1.useViroNode)(props);
    // Background quad (a child node) from backgroundColor or a named material.
    const bgRef = (0, react_1.useRef)({
        node: 0,
        geo: 0,
        material: 0,
    });
    (0, react_1.useEffect)(() => {
        if (!container || (!backgroundColor && !materialName))
            return;
        const node = scene.createNode();
        const geo = scene.createSurface(width, height);
        scene.setNodeGeometry(node, geo);
        let material = 0;
        if (materialName) {
            material = (0, viroMaterialRegistry_1.createMaterialFromRegistry)(scene, materialName);
        }
        else if (backgroundColor) {
            material = scene.createMaterial();
            scene.setMaterialLightingModel(material, viro_web_renderer_1.ViroLightingModel.Constant);
            const [r, g, b, a] = (0, viroColor_1.parseColorToRGBA)(backgroundColor);
            scene.setMaterialDiffuseColor(material, r, g, b, a);
        }
        if (material)
            scene.setGeometryMaterial(geo, material);
        scene.addChildNode(container, node);
        bgRef.current = { node, geo, material };
        return () => {
            const bg = bgRef.current;
            scene.removeNodeFromParent(bg.node);
            if (bg.material)
                scene.destroyMaterial(bg.material);
            if (bg.geo)
                scene.destroyGeometry(bg.geo);
            if (bg.node)
                scene.destroyNode(bg.node);
            bgRef.current = { node: 0, geo: 0, material: 0 };
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container, width, height, backgroundColor, materialName]);
    return (<ViroWebContext_1.ViroParentNodeContext.Provider value={container}>
      {props.children}
    </ViroWebContext_1.ViroParentNodeContext.Provider>);
}
