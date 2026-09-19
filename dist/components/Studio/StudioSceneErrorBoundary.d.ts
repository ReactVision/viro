import { Component, ErrorInfo, ReactNode } from "react";
interface Props {
    children: ReactNode;
    onError?: (error: Error) => void;
    renderError?: (error: Error, retry: () => void) => ReactNode;
    sceneId?: string;
}
interface State {
    hasError: boolean;
    error: Error | null;
}
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
export declare class StudioSceneErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    /**
     * Retry for the render path: re-mounting the children is the whole recovery,
     * because the scene data is already loaded. Nothing refetches.
     */
    private retry;
    render(): ReactNode;
}
export {};
