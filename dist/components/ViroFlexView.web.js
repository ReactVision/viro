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
 * an optional background (color or materials), sized by `style.width`/`height`,
 * that lays its children out with flexbox.
 *
 * The layout is measured, not computed here: see Web/viroFlexLayout. Each child
 * gets a node of its own, positioned at the frame the layout gave it, and its
 * measured size travels down the ViroFlexSlot context for the child to rebuild
 * its geometry from — which is the same pair native pushes onto a laid-out
 * child from VRTNode's recalcLayout.
 *
 * A child that declares `position` absolutely is still laid out; it is CSS
 * `position: absolute` that takes it out of flow, exactly as in a stylesheet.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroColor_1 = require("./Web/viroColor");
const viroMaterialRegistry_1 = require("./Web/viroMaterialRegistry");
const viroFlexLayout_1 = require("./Web/viroFlexLayout");
const ViroFlexSlotContext_1 = require("./Web/ViroFlexSlotContext");
const ViroFlexSlotContext_2 = require("./Web/ViroFlexSlotContext");
function ViroFlexView(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    // A nested FlexView is sized by the layout that placed it, as on native.
    const outerSlot = (0, ViroFlexSlotContext_2.useViroFlexSlot)();
    const width = outerSlot?.width ?? props.style?.width ?? props.width ?? 1;
    const height = outerSlot?.height ?? props.style?.height ?? props.height ?? 1;
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
    // ─── Layout ──────────────────────────────────────────────────────────────
    const childArray = (0, react_1.useMemo)(() => React.Children.toArray(props.children).filter(React.isValidElement), [props.children]);
    const childStyles = (0, react_1.useMemo)(() => childArray.map((child) => {
        const p = child.props;
        // A child's own width/height props are its intrinsic size, and a layout
        // that ignored them would collapse an image to nothing; the style wins
        // where it names the same thing, as it does in a stylesheet.
        const intrinsic = {};
        if (typeof p.width === "number") {
            intrinsic.width = p.width * viroFlexLayout_1.FLEX_POINTS_PER_METER;
        }
        if (typeof p.height === "number") {
            intrinsic.height = p.height * viroFlexLayout_1.FLEX_POINTS_PER_METER;
        }
        return { ...intrinsic, ...(p.style ?? {}) };
    }), [childArray]);
    const layoutKey = JSON.stringify([childStyles, props.style ?? null, width, height]);
    // Measured and given nodes during render, not in an effect, for the reason
    // useViroNode creates its own node in a lazy initializer: React runs a child's
    // effects before its parent's, so a slot that only existed by effect time
    // would mount every child under the container first and move it a render
    // later — which for an image or a model is a second load, not a reparent.
    const layoutRef = (0, react_1.useRef)({ key: "", slots: [] });
    if (layoutRef.current.key !== layoutKey) {
        const widthPoints = width * viroFlexLayout_1.FLEX_POINTS_PER_METER;
        const heightPoints = height * viroFlexLayout_1.FLEX_POINTS_PER_METER;
        const rects = (0, viroFlexLayout_1.measureFlexChildren)(props.style, childStyles, width, height);
        layoutRef.current = {
            key: layoutKey,
            slots: rects.map((rect) => ({
                node: scene.createNode(),
                slot: (0, viroFlexLayout_1.rectToSlot)(rect, widthPoints, heightPoints),
            })),
        };
    }
    const slots = layoutRef.current.slots;
    (0, react_1.useEffect)(() => {
        if (!container)
            return;
        // Captured here rather than read in the cleanup: by the time a cleanup runs,
        // the render that changed the layout has already replaced the ref, and the
        // nodes to tear down are this effect's own.
        const attached = layoutRef.current.slots;
        for (const { node, slot } of attached) {
            scene.setNodePosition(node, slot.position[0], slot.position[1], slot.position[2]);
            scene.addChildNode(container, node);
        }
        return () => {
            for (const { node } of attached) {
                scene.removeNodeFromParent(node);
                scene.destroyNode(node);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container, layoutKey]);
    // Nothing measured — no document, or a container with no size — so the
    // children keep the transforms they were written with rather than all
    // stacking at the container's origin.
    if (slots.length !== childArray.length) {
        return (<ViroWebContext_1.ViroParentNodeContext.Provider value={container}>
        {props.children}
      </ViroWebContext_1.ViroParentNodeContext.Provider>);
    }
    return (<>
      {childArray.map((child, i) => (<ViroWebContext_1.ViroParentNodeContext.Provider key={i} value={slots[i].node}>
          <ViroFlexSlotContext_1.ViroFlexSlotContext.Provider value={slots[i].slot}>
            {child}
          </ViroFlexSlotContext_1.ViroFlexSlotContext.Provider>
        </ViroWebContext_1.ViroParentNodeContext.Provider>))}
    </>);
}
