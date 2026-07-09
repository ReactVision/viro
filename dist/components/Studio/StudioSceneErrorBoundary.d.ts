import { Component, ErrorInfo, ReactNode } from "react";
interface Props {
    children: ReactNode;
    onError?: (error: Error) => void;
    renderError?: (error: Error) => ReactNode;
    sceneId?: string;
}
interface State {
    hasError: boolean;
    error: Error | null;
}
/**
 * Catches render/lifecycle errors in the Studio scene tree so a bad asset or a
 * node-factory throw can't take down the host app. Always reports via onError;
 * renders renderError(error) if provided, else nothing (no built-in UI).
 *
 * AR-only in effect: on Quest, ViroXRSceneNavigator forwards to a separate
 * React root (VRActivity), so scene errors there are outside this boundary.
 * Native and async errors are also out of a React boundary's reach — async
 * scene-load failures route through onError in StudioSceneNavigator instead.
 */
export declare class StudioSceneErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    render(): ReactNode;
}
export {};
