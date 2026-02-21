/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARPlaneSelector
 */
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
exports.ViroARPlaneSelector = void 0;
const React = __importStar(require("react"));
const ViroMaterials_1 = require("../Material/ViroMaterials");
const ViroNode_1 = require("../ViroNode");
const ViroQuad_1 = require("../ViroQuad");
const ViroPolygon_1 = require("../ViroPolygon");
const ViroARPlane_1 = require("./ViroARPlane");
/**
 * Displays detected AR planes and lets the user tap to select one.
 *
 * Wire up via scene-level anchor events:
 *
 *   const selectorRef = useRef<ViroARPlaneSelector>(null);
 *
 *   <ViroARScene
 *     anchorDetectionTypes={["planesHorizontal", "planesVertical"]}
 *     onAnchorFound={(a) => selectorRef.current?.handleAnchorFound(a)}
 *     onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}
 *     onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
 *   >
 *     <ViroARPlaneSelector ref={selectorRef} alignment="Both" onPlaneSelected={...}>
 *       <MyContent />
 *     </ViroARPlaneSelector>
 *   </ViroARScene>
 */
class ViroARPlaneSelector extends React.Component {
    state = {
        selectedPlaneId: null,
        planes: new Map(),
    };
    // ---------------------------------------------------------------------------
    // Public API — call these from ViroARScene anchor event props via ref
    // ---------------------------------------------------------------------------
    handleAnchorFound = (anchor) => {
        if (anchor.type !== "plane")
            return;
        if (!this._passesAlignmentFilter(anchor))
            return;
        if (this.props.onPlaneDetected) {
            const accepted = this.props.onPlaneDetected(anchor);
            if (accepted === false)
                return;
        }
        this.setState((prev) => {
            const next = new Map(prev.planes);
            next.set(anchor.anchorId, anchor);
            return { planes: next };
        });
    };
    handleAnchorUpdated = (anchor) => {
        if (anchor.type !== "plane")
            return;
        this.setState((prev) => {
            if (!prev.planes.has(anchor.anchorId))
                return null;
            const next = new Map(prev.planes);
            next.set(anchor.anchorId, anchor);
            return { planes: next };
        });
    };
    handleAnchorRemoved = (anchor) => {
        if (!anchor?.anchorId)
            return;
        const { anchorId } = anchor;
        this.setState((prev) => {
            if (!prev.planes.has(anchorId))
                return null;
            const next = new Map(prev.planes);
            next.delete(anchorId);
            return {
                planes: next,
                selectedPlaneId: prev.selectedPlaneId === anchorId ? null : prev.selectedPlaneId,
            };
        });
        this.props.onPlaneRemoved?.(anchorId);
    };
    /** Reset the selection so the user can pick a different plane. */
    reset = () => {
        this.setState({ selectedPlaneId: null });
    };
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    _passesAlignmentFilter = (anchor) => {
        const { alignment } = this.props;
        if (!alignment || alignment === "Both")
            return true;
        if (!anchor.alignment)
            return false;
        if (alignment === "Horizontal")
            return anchor.alignment.includes("Horizontal");
        if (alignment === "Vertical")
            return anchor.alignment.includes("Vertical");
        return anchor.alignment === alignment;
    };
    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    render() {
        return <ViroNode_1.ViroNode>{this._renderPlanes()}</ViroNode_1.ViroNode>;
    }
    _renderPlanes() {
        const { selectedPlaneId, planes } = this.state;
        const materialName = this.props.material ?? "ViroARPlaneSelector_Translucent";
        const elements = [];
        planes.forEach((anchor, anchorId) => {
            const isSelected = selectedPlaneId === anchorId;
            // Show all planes until one is selected; after selection hide others.
            const surfaceOpacity = selectedPlaneId === null || isSelected ? 1 : 0;
            const vertices3D = anchor.vertices;
            const vertices2D = vertices3D && vertices3D.length >= 3
                ? vertices3D.map(([x, _y, z]) => [
                    x,
                    z,
                ])
                : undefined;
            // ViroPolygon renders in XY; vertices are in XZ — rotate to align.
            const polygonRotation = [-90, 0, 0];
            const useActualShape = this.props.useActualShape !== false &&
                vertices2D !== undefined &&
                vertices2D.length >= 3;
            // Click handler — only attached when click selection is enabled.
            const clickHandlerProps = this.props.disableClickSelection
                ? {}
                : {
                    onClickState: (clickState) => {
                        // clickState 3 = CLICKED (click down + up on same target)
                        if (clickState === 3) {
                            const plane = this.state.planes.get(anchorId);
                            if (plane) {
                                this.setState({ selectedPlaneId: anchorId }, () => {
                                    this.props.onPlaneSelected?.(plane);
                                });
                            }
                        }
                    },
                };
            const visual = useActualShape ? (<ViroPolygon_1.ViroPolygon key={`poly-${anchorId}`} vertices={vertices2D} holes={[]} materials={[materialName]} {...clickHandlerProps} position={[0, 0, 0]} rotation={polygonRotation} opacity={surfaceOpacity}/>) : (<ViroQuad_1.ViroQuad key={`quad-${anchorId}`} materials={[materialName]} {...clickHandlerProps} position={[0, 0, 0]} width={anchor.width ?? 0.5} height={anchor.height ?? 0.5} rotation={polygonRotation} opacity={surfaceOpacity}/>);
            elements.push(<ViroARPlane_1.ViroARPlane key={anchorId} anchorId={anchorId} minWidth={this.props.minWidth ?? 0} minHeight={this.props.minHeight ?? 0} onAnchorUpdated={(a) => this.handleAnchorUpdated(a)}>
          {visual}
          {isSelected && this.props.children != null && (<ViroNode_1.ViroNode>{this.props.children}</ViroNode_1.ViroNode>)}
        </ViroARPlane_1.ViroARPlane>);
        });
        return elements;
    }
}
exports.ViroARPlaneSelector = ViroARPlaneSelector;
ViroMaterials_1.ViroMaterials.createMaterials({
    ViroARPlaneSelector_Translucent: {
        lightingModel: "Constant",
        diffuseColor: "rgba(0, 122, 255, 0.5)",
        blendMode: "Alpha",
        cullMode: "None",
        writesToDepthBuffer: false,
    },
});
