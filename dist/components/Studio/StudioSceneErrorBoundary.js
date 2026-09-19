"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioSceneErrorBoundary = void 0;
const react_1 = require("react");
/**
 * Catches render/lifecycle errors in the Studio scene tree so a bad asset or a
 * node-factory throw can't take down the host app. Always reports via onError;
 * renders renderError(error, retry) if provided, else nothing (no built-in UI).
 *
 * AR-only in effect: on Quest, ViroXRSceneNavigator forwards to a separate
 * React root (VRActivity), so scene errors there are outside this boundary.
 * Native and async errors are also out of a React boundary's reach; a failed
 * scene load is caught in StudioSceneNavigator, which renders the same
 * renderError itself with a retry that refetches.
 */
class StudioSceneErrorBoundary extends react_1.Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        this.props.onError?.(error);
        console.error("[Studio] Scene render error:", error, this.props.sceneId, errorInfo.componentStack);
    }
    /**
     * Retry for the render path: re-mounting the children is the whole recovery,
     * because the scene data is already loaded. Nothing refetches.
     */
    retry = () => {
        this.setState({ hasError: false, error: null });
    };
    render() {
        if (this.state.hasError && this.state.error) {
            return this.props.renderError?.(this.state.error, this.retry) ?? null;
        }
        return this.props.children;
    }
}
exports.StudioSceneErrorBoundary = StudioSceneErrorBoundary;
