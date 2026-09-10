/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroSharedFrame
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
exports.ViroSharedFrame = void 0;
const React = __importStar(require("react"));
const ViroNode_1 = require("../ViroNode");
/**
 * Renders its children in a shared coordinate frame.
 *
 * This is the co-location primitive, independent of how the frame was
 * established. Two devices mounting this with the same `source.key` in the same
 * physical space put their children in the same real-world place.
 *
 * Children are positioned by the scene graph, so a child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no per-app coordinate
 * maths, and nothing that depends on where a given session started tracking.
 *
 * `<ViroARCloudAnchor>` is this with the cloud-anchor source pre-selected.
 */
class ViroSharedFrame extends React.Component {
    state = { frame: null };
    static _unsupportedWarned = new Set();
    // Acquiring is async and the component can unmount mid-flight — a cloud
    // anchor resolve retries every AR frame until it localises or the window
    // expires, so this is a real window, not a theoretical one.
    _mounted = false;
    componentDidMount() {
        this._mounted = true;
        this._acquire();
    }
    componentDidUpdate(prev) {
        if (prev.source.key !== this.props.source.key) {
            this.setState({ frame: null });
            this._acquire();
        }
    }
    componentWillUnmount() {
        this._mounted = false;
    }
    _acquire = async () => {
        const { source, arSceneNavigator } = this.props;
        if (!source.support.ok) {
            // Warn once per source kind, not per mount: a list of shared objects
            // would otherwise produce one line each.
            if (!ViroSharedFrame._unsupportedWarned.has(source.name)) {
                console.warn(`[Viro] ViroSharedFrame: the ${source.name} frame source is not supported on this platform. ${source.support.reason}`);
                ViroSharedFrame._unsupportedWarned.add(source.name);
            }
            this.props.onLocalizeError?.(source.support.reason, "ErrorNotSupported");
            return;
        }
        const requested = source.key;
        const outcome = await source.acquire({ arSceneNavigator });
        // Ignore an acquire that landed after unmount, or after the source changed.
        if (!this._mounted || requested !== this.props.source.key)
            return;
        if (!outcome.success) {
            this.props.onLocalizeError?.(outcome.error, outcome.state);
            return;
        }
        this.setState({ frame: outcome.frame });
        this.props.onLocalized?.({
            cloudAnchorId: requested,
            position: outcome.frame.position,
            rotation: outcome.frame.rotation,
            scale: outcome.frame.scale,
            transform: outcome.frame.transform,
        });
    };
    render() {
        const { frame } = this.state;
        if (!frame) {
            return this.props.placeholder
                ? <ViroNode_1.ViroNode>{this.props.placeholder}</ViroNode_1.ViroNode>
                : null;
        }
        return (<ViroNode_1.ViroNode position={frame.position} rotation={frame.rotation} scale={frame.scale}>
        {this.props.children}
      </ViroNode_1.ViroNode>);
    }
}
exports.ViroSharedFrame = ViroSharedFrame;
