import * as React from "react";
import { ViewStyle } from "react-native";
interface StudioSceneNavigatorProps {
    /** UUID of the scene to load from GET /functions/v1/scenes/{sceneId} */
    sceneId: string;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    autofocus?: boolean;
    style?: ViewStyle;
    onSceneReady?: () => void;
    onError?: (err: Error) => void;
}
/**
 * Drop-in AR scene component that fetches and renders a Studio-authored scene.
 *
 * Auth is handled by the ReactVision API key wired through the Expo plugin
 * (rvProjectId in app.json). No Supabase client needed.
 *
 * Usage:
 *   <StudioSceneNavigator sceneId="abc-123-uuid" style={StyleSheet.absoluteFill} />
 */
export declare function StudioSceneNavigator({ sceneId, worldAlignment, autofocus, style, onSceneReady, onError, }: StudioSceneNavigatorProps): React.JSX.Element;
export {};
