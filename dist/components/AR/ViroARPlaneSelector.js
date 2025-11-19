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
var _planePrefix = "ViroARPlaneSelector_Plane_";
/**
 * This component wraps the logic required to enable user selection
 * of an AR plane. This currently only allows for 1 plane to be selected,
 * but could easily be modified to allow for more planes.
 */
class ViroARPlaneSelector extends React.Component {
    _component = null;
    state = {
        selectedPlaneId: null,
        foundARPlanes: new Map(),
    };
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARPlaneSelector", this.props);
        return <ViroNode_1.ViroNode>{this._getARPlanes()}</ViroNode_1.ViroNode>;
    }
    _getARPlanes() {
        const arPlanes = [];
        const detectBothAlignments = this.props.alignment === "Both" || !this.props.alignment;
        // Determine which alignments to detect
        const alignmentsToDetect = [];
        if (detectBothAlignments) {
            alignmentsToDetect.push("Horizontal", "Vertical");
        }
        else if (this.props.alignment) {
            // Type assertion safe here because we know it's not "Both" due to detectBothAlignments check
            alignmentsToDetect.push(this.props.alignment);
        }
        // Create detector ViroARPlane components for each alignment type
        // These don't have anchorId set initially, but will discover and track planes
        // We add visual children based on detected plane data
        const detectorsPerAlignment = 25; // 25 detectors per alignment type
        alignmentsToDetect.forEach((alignment) => {
            for (let i = 0; i < detectorsPerAlignment; i++) {
                const detectorKey = `${_planePrefix}detector_${alignment}_${i}`;
                // Check if this detector has discovered a plane
                // We'll match by checking if any plane in foundARPlanes has this alignment
                // and hasn't been assigned to a previous detector
                // Note: ARCore returns "HorizontalUpward", "HorizontalDownward", etc.
                // so we need to check if alignment starts with the requested type
                const detectedPlanes = Array.from(this.state.foundARPlanes.entries()).filter(([_id, plane]) => {
                    if (alignment === "Horizontal") {
                        return plane.alignment.includes("Horizontal");
                    }
                    else if (alignment === "Vertical") {
                        return plane.alignment.includes("Vertical");
                    }
                    return plane.alignment === alignment;
                });
                const planeData = detectedPlanes[i]?.[1];
                const anchorId = detectedPlanes[i]?.[0];
                const hasPlaneData = !!planeData;
                // Extract visual rendering data if plane detected
                let visualElement = null;
                if (hasPlaneData) {
                    const isSelected = this.state.selectedPlaneId === anchorId;
                    const surfaceWidth = planeData.width || 0.5;
                    const surfaceHeight = planeData.height || 0.5;
                    const vertices3D = planeData.vertices;
                    // Convert 3D vertices to 2D based on plane alignment
                    // ViroARPlane provides vertices in the plane's LOCAL coordinate system
                    // where the plane is always in the XZ plane. The anchor handles world orientation.
                    // Always extract [x, z] since vertices are in the plane's local XZ plane
                    const vertices2D = vertices3D && vertices3D.length >= 3
                        ? vertices3D.map(([x, _y, z]) => [
                            x,
                            z,
                        ])
                        : undefined;
                    // Rotation for ViroPolygon:
                    // ViroPolygon renders in XY plane by default, vertices are provided in XZ
                    // Need to rotate to map XZ plane to XY rendering plane
                    const polygonRotation = [-90, 0, 0];
                    const isVisible = this.state.selectedPlaneId === null || isSelected;
                    // Use actual plane shapes (ViroPolygon with vertices)
                    const forceQuadForAndroid = false; // Now using actual shapes on Android
                    const useActualShape = !forceQuadForAndroid &&
                        this.props.useActualShape !== false &&
                        vertices2D &&
                        vertices2D.length >= 3;
                    const finalOpacity = isSelected ? 0 : isVisible ? 1 : 0;
                    visualElement = useActualShape ? (<ViroPolygon_1.ViroPolygon key={`polygon-${anchorId}`} vertices={vertices2D} holes={[]} materials={["ViroARPlaneSelector_Translucent"]} {...(!this.props.disableClickSelection && {
                        onClickState: (clickState, position, source) => this._getOnClickSurface(anchorId, {
                            clickState,
                            position,
                            source,
                        }),
                    })} position={[0, 0, 0]} rotation={polygonRotation} opacity={finalOpacity}/>) : (<ViroQuad_1.ViroQuad key={`quad-${anchorId}`} materials={["ViroARPlaneSelector_Translucent"]} {...(!this.props.disableClickSelection && {
                        onClickState: (clickState, position, source) => this._getOnClickSurface(anchorId, {
                            clickState,
                            position,
                            source,
                        }),
                    })} position={[0, 0, 0]} width={surfaceWidth} height={surfaceHeight} rotation={polygonRotation} opacity={finalOpacity}/>);
                }
                arPlanes.push(<ViroARPlane_1.ViroARPlane key={detectorKey} minWidth={this.props.minWidth || 0} minHeight={this.props.minHeight || 0} alignment={alignment} anchorId={hasPlaneData ? anchorId : undefined} onAnchorFound={(anchor) => {
                        this._onARPlaneUpdated(anchor);
                    }} onAnchorUpdated={(anchor) => {
                        this._onARPlaneUpdated(anchor);
                    }}>
            {visualElement}
            {hasPlaneData && this.props.children && (<ViroNode_1.ViroNode opacity={this.state.selectedPlaneId === anchorId ? 1 : 0}>
                {this.props.children}
              </ViroNode_1.ViroNode>)}
          </ViroARPlane_1.ViroARPlane>);
            }
        });
        return arPlanes;
    }
    _getOnClickSurface = (anchorId, event) => {
        if (event.clickState < 3) {
            return;
        }
        // Get the plane data before updating state to avoid race conditions
        const selectedPlane = this.state.foundARPlanes.get(anchorId);
        if (!selectedPlane) {
            console.warn("ViroARPlaneSelector: Cannot select plane - plane data not found");
            return;
        }
        // Update state and call callback with the captured data
        this.setState({ selectedPlaneId: anchorId }, () => {
            this._onPlaneSelected(selectedPlane);
        });
    };
    _onARPlaneUpdated = (anchor) => {
        if (!anchor.anchorId) {
            console.warn("ViroARPlaneSelector: Anchor missing anchorId");
            return;
        }
        const updateMap = {
            anchorId: anchor.anchorId,
            type: anchor.type || "plane",
            position: anchor.position,
            rotation: anchor.rotation,
            scale: anchor.scale,
            center: anchor.center,
            width: anchor.width,
            height: anchor.height,
            alignment: anchor.alignment,
            classification: anchor.classification,
            vertices: anchor.vertices,
        };
        // Update or add plane in Map
        this.setState((prevState) => {
            const newPlanes = new Map(prevState.foundARPlanes);
            newPlanes.set(anchor.anchorId, updateMap);
            return { foundARPlanes: newPlanes };
        });
        // Call validation callback if provided
        if (this.props.onPlaneDetected) {
            this.props.onPlaneDetected(updateMap);
        }
    };
    _onPlaneSelected = (updateMap) => {
        this.props.onPlaneSelected && this.props.onPlaneSelected(updateMap);
    };
    /**
     * This function allows the user to reset the surface and select a new plane.
     */
    reset = () => {
        this.setState({
            selectedPlaneId: null,
        });
    };
}
exports.ViroARPlaneSelector = ViroARPlaneSelector;
ViroMaterials_1.ViroMaterials.createMaterials({
    ViroARPlaneSelector_Translucent: {
        lightingModel: "Constant",
        diffuseColor: "rgba(0, 122, 255, 0.5)", // Bright blue with 50% opacity for better visibility
        blendMode: "Alpha",
        cullMode: "None", // Render both sides for better Android compatibility
        writesToDepthBuffer: false,
    },
});
