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
const ViroNode_1 = require("../ViroNode");
/**
 * Renders its children in a resolved cloud anchor's **location frame**.
 *
 * This is the co-location primitive. Two devices that mount this with the same
 * `cloudAnchorId` in the same physical space put their children in the same
 * real-world place, because both frames are recovered from the same hosted map.
 *
 * Children are positioned by the scene graph, so a child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no per-app coordinate
 * maths, and nothing that depends on where a given session happened to start
 * tracking.
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
 */
class ViroARCloudAnchor extends React.Component {
    state = { anchor: null };
    // Resolve is async and the component can unmount mid-flight — a resolve keeps
    // retrying every AR frame until it localises or the window expires, so this is
    // a real window, not a theoretical one.
    _mounted = false;
    componentDidMount() {
        this._mounted = true;
        this._resolve();
    }
    componentDidUpdate(prev) {
        if (prev.cloudAnchorId !== this.props.cloudAnchorId) {
            this.setState({ anchor: null });
            this._resolve();
        }
    }
    componentWillUnmount() {
        this._mounted = false;
    }
    _resolve = async () => {
        const { cloudAnchorId, arSceneNavigator } = this.props;
        if (!cloudAnchorId || !arSceneNavigator)
            return;
        const requested = cloudAnchorId;
        let result;
        try {
            result = await arSceneNavigator.resolveCloudAnchor(cloudAnchorId);
        }
        catch (e) {
            if (this._mounted && requested === this.props.cloudAnchorId) {
                this.props.onLocalizeError?.(e?.message ?? String(e), "ErrorInternal");
            }
            return;
        }
        // Ignore a resolve that landed after unmount, or after cloudAnchorId moved on.
        if (!this._mounted || requested !== this.props.cloudAnchorId)
            return;
        if (!result?.success || !result.anchor) {
            this.props.onLocalizeError?.(result?.error ?? "Resolve failed", result?.state);
            return;
        }
        const anchor = result.anchor;
        this.setState({ anchor });
        this.props.onLocalized?.({
            cloudAnchorId: anchor.cloudAnchorId ?? requested,
            position: anchor.position,
            rotation: anchor.rotation,
            scale: anchor.scale,
            transform: anchor.resolvedTransform ?? "",
        });
    };
    render() {
        const { anchor } = this.state;
        if (!anchor) {
            return this.props.placeholder ? <ViroNode_1.ViroNode>{this.props.placeholder}</ViroNode_1.ViroNode> : null;
        }
        return (<ViroNode_1.ViroNode position={anchor.position} rotation={anchor.rotation} scale={anchor.scale}>
        {this.props.children}
      </ViroNode_1.ViroNode>);
    }
}
exports.ViroARCloudAnchor = ViroARCloudAnchor;
