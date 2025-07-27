/**
 * Viro3DSceneNavigator
 *
 * Component for transitioning between multiple scenes in a 3D environment.
 */
import * as React from "react";
import { ViewProps } from "react-native";
import { ViroScene } from "./ViroScene";
type Props = ViewProps & {
    /**
     * initial scene key
     */
    initialSceneKey?: string;
    /**
     * A flag to enable/disable some debug features
     */
    debug?: boolean;
    viroAppProps?: any;
    /**
     * ViroSceneNavigator uses "scene" objects like the following to
     * describe a scene.
     */
    initialScene: {
        /**
         * The React Component to render for this scene.
         */
        scene: typeof ViroScene;
        passProps?: any;
    };
    /**
     * Called when either the user physically decides to exit vr (hits
     * the "X" button).
     */
    onExitViro?: () => void;
    /**
     * Renderer settings that can be used to enable or disable various
     * renderer capabilities and algorithms.
     */
    hdrEnabled?: boolean;
    pbrEnabled?: boolean;
    bloomEnabled?: boolean;
    shadowsEnabled?: boolean;
    multisamplingEnabled?: boolean;
};
/**
 * Viro3DSceneNavigator is used to transition between multiple scenes.
 */
export declare function Viro3DSceneNavigator(props: Props): React.ReactElement;
export {};
//# sourceMappingURL=Viro3DSceneNavigator.d.ts.map