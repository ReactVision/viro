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
/** How often the source is asked what it is doing. */
const PROGRESS_POLL_MS = 500;
/**
 * Pause before re-running a failed source. On Android a resolve issued on the
 * scene's first frame reaches the bridge before the navigator's native view
 * exists; three instant retries would spend every attempt in that same
 * millisecond.
 */
const RETRY_DELAY_MS = 1000;
/**
 * States worth another go. Everything else is a fact about the anchor, the
 * platform or the credentials, and a second attempt returns it unchanged.
 *
 * ErrorResolvingLocalizationNoMatch is the one that earns this feature: it
 * means the 30 second SIFT window closed without two consistent matches, and
 * the next window starts from wherever the user has walked to since.
 * ErrorResourceExhausted is deliberately absent — retrying a rate limit is how
 * it gets worse.
 */
const RETRYABLE = new Set([
    "ErrorResolvingLocalizationNoMatch",
    "ErrorNetworkFailure",
    "ErrorHostingServiceUnavailable",
    "ErrorInternal",
    "TaskInProgress",
]);
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
    _pollTimer;
    _retryTimer;
    _attempt = 0;
    componentDidMount() {
        this._mounted = true;
        this._acquire();
    }
    componentDidUpdate(prev) {
        if (prev.source.key !== this.props.source.key) {
            this.setState({ frame: null });
            this._attempt = 0;
            this._clearRetry();
            this._acquire();
        }
    }
    componentWillUnmount() {
        this._mounted = false;
        this._stopPolling();
        this._clearRetry();
    }
    _clearRetry = () => {
        if (this._retryTimer) {
            clearTimeout(this._retryTimer);
            this._retryTimer = undefined;
        }
    };
    _stopPolling = () => {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = undefined;
        }
    };
    _startPolling = () => {
        const { source, arSceneNavigator, onLocalizeProgress } = this.props;
        if (!source.progress || !onLocalizeProgress)
            return;
        this._stopPolling();
        this._pollTimer = setInterval(async () => {
            const requested = source.key;
            const message = await source.progress({ arSceneNavigator });
            // A poll in flight outlives the acquire that started it, and a stale one
            // would report the previous anchor's progress against the current one.
            if (!this._mounted || requested !== this.props.source.key)
                return;
            if (message) {
                this.props.onLocalizeProgress?.({ message, attempt: this._attempt });
            }
        }, PROGRESS_POLL_MS);
    };
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
        this._attempt += 1;
        this._startPolling();
        const outcome = await source.acquire({ arSceneNavigator });
        this._stopPolling();
        // Ignore an acquire that landed after unmount, or after the source changed.
        if (!this._mounted || requested !== this.props.source.key)
            return;
        if (!outcome.success) {
            const attemptsAllowed = this.props.maxAttempts ?? 3;
            const retryable = outcome.state === undefined || RETRYABLE.has(outcome.state);
            if (retryable && this._attempt < attemptsAllowed) {
                this.props.onLocalizeProgress?.({
                    message: outcome.error,
                    attempt: this._attempt,
                });
                this._retryTimer = setTimeout(() => {
                    this._retryTimer = undefined;
                    if (this._mounted && requested === this.props.source.key) {
                        this._acquire();
                    }
                }, RETRY_DELAY_MS);
                return;
            }
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
