/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroARCloudAnchor
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
exports.ViroARCloudAnchor = void 0;
const React = __importStar(require("react"));
const ViroFrameSource_1 = require("./ViroFrameSource");
const ViroSharedFrame_1 = require("./ViroSharedFrame");
/**
 * Renders its children in a resolved cloud anchor's location frame.
 *
 * Two devices that mount this with the same `cloudAnchorId` in the same
 * physical space put their children in the same real-world place, because both
 * frames are recovered from the same hosted map. A child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no coordinate maths in
 * app code.
 *
 * ```tsx
 * <ViroARCloudAnchor
 *   cloudAnchorId={id}
 *   arSceneNavigator={props.arSceneNavigator}
 *   onLocalized={(e) => setFrame(e.transform)}
 * >
 *   <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} />
 * </ViroARCloudAnchor>
 * ```
 *
 * This is `<ViroSharedFrame>` with the cloud-anchor source pre-selected. On a
 * headset, use the platform's own source instead — cloud anchors are
 * unsupported there and this reports `ErrorNotSupported` rather than failing
 * slowly. See `ViroFrameSource`.
 */
class ViroARCloudAnchor extends React.Component {
    // Rebuilt only when the id changes: the source is compared by `key`, so a new
    // object every render would restart acquisition on each parent update.
    _source = (0, ViroFrameSource_1.cloudAnchorFrameSource)(this.props.cloudAnchorId);
    _sourceId = this.props.cloudAnchorId;
    get source() {
        if (this._sourceId !== this.props.cloudAnchorId) {
            this._sourceId = this.props.cloudAnchorId;
            this._source = (0, ViroFrameSource_1.cloudAnchorFrameSource)(this.props.cloudAnchorId);
        }
        return this._source;
    }
    render() {
        return (<ViroSharedFrame_1.ViroSharedFrame source={this.source} arSceneNavigator={this.props.arSceneNavigator} onLocalized={this.props.onLocalized} onLocalizeError={this.props.onLocalizeError} placeholder={this.props.placeholder}>
        {this.props.children}
      </ViroSharedFrame_1.ViroSharedFrame>);
    }
}
exports.ViroARCloudAnchor = ViroARCloudAnchor;
