"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioSceneErrorBoundary = void 0;
const react_1 = require("react");
/**
 * Catches render/lifecycle errors in the Studio scene tree so a bad asset or a
 * node-factory throw can't take down the host app. Always reports via onError;
 * renders renderError(error) if provided, else nothing (no built-in UI).
 *
 * AR-only in effect: on Quest, ViroXRSceneNavigator forwards to a separate
 * React root (VRActivity), so scene errors there are outside this boundary.
 * Native and async errors are also out of a React boundary's reach; async
 * scene-load failures route through onError in StudioSceneNavigator instead.
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
    render() {
        if (this.state.hasError && this.state.error) {
            return this.props.renderError?.(this.state.error) ?? null;
        }
        return this.props.children;
    }
}
exports.StudioSceneErrorBoundary = StudioSceneErrorBoundary;
