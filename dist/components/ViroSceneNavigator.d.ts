import * as React from "react";
import { ViewProps, NativeSyntheticEvent } from "react-native";
import { ViroExitViroEvent } from "./Types/ViroEvents";
import { Viro3DPoint } from "./Types/ViroUtils";
import { ViroSceneDictionary } from "./Types/ViroUtils";
import { ViroScene } from "./ViroScene";
declare type Props = ViewProps & {
    initialSceneKey?: string;
    /**
     * Calling vrModeEnabled allows switching to and from VR mode.
     * When set to false, it transitions back to pre-VR (mono) mode.
     * When set to true, we set thie view into a full VR mode.
     * This is set to true by default.
     *
     * @deprecated This property was unused.
     */
    vrModeEnabled?: boolean;
    /**
     * A flag to enable/disable some debug features
     */
    debug?: boolean;
    /**
     * ViroSceneNavigator uses "scene" objects like the following to
     * describe a scene.
     */
    initialScene: {
        /**
         * The React Class to render for this scene.
         */
        scene: ViroScene;
    };
    viroAppProps?: any;
    /**
     * Called when either the user physically decides to exit vr (hits
     * the "X" buton).
     */
    onExitViro?: () => void;
};
declare type State = {
    sceneDictionary: ViroSceneDictionary;
    sceneHistory: string[];
    currentSceneIndex: number;
};
/**
 * ##### DEPRECATION WARNING - ViroSceneNavigator may be removed in future releases. Use ViroVRSceneNavigator instead #####
 * ViroSceneNavigator is used to transition between multiple scenes.
 *
 * @deprecated
 */
export declare class ViroSceneNavigator extends React.Component<Props, State> {
    _component: any;
    sceneNavigator: {
        push: (param1?: string | ViroScene | undefined, param2?: string | ViroScene | undefined) => void;
        pop: () => void;
        popN: (n: number) => void;
        jump: (param1?: string | ViroScene | undefined, param2?: string | ViroScene | undefined) => void;
        replace: (param1?: string | ViroScene | undefined, param2?: string | ViroScene | undefined) => void;
        recenterTracking: () => void;
        project: (point: Viro3DPoint) => Promise<any>;
        unproject: (point: Viro3DPoint) => Promise<any>;
        viroAppProps: any;
    };
    /**
     * Called from native when either the user physically decides to exit vr (hits
     * the "X" buton).
     */
    _onExitViro: (_event: NativeSyntheticEvent<ViroExitViroEvent>) => void;
    constructor(props: Props);
    getRandomTag(): string;
    /**
     * Pushes a scene and reference it with the given key if provided.
     * If the scene has been previously pushed, we simply show the scene again.
     * Note that the back history order of which scenes were pushed is preserved.
     * Also note that scenes are reference counted and only a unique set of
     * scenes are stored and mapped to within sceneDictionary.
     *
     * Can take in either 1 or two parameters in the form:
     * push ("sceneKey");
     * push ("sceneKey", scene);
     * push (scene);
     *
     * @todo add typescript to overload the function, rather than the string | ViroScene typings
     */
    push(param1?: string | ViroScene, param2?: string | ViroScene): void;
    /**
     * Replace the top scene in the stack with the given scene. The remainder of the back
     * history is kept in the same order as before.
     *
     * Can take in either 1 or two parameters in the form:
     * replace ("sceneKey");
     * replace ("sceneKey", scene);
     * replace (scene);
     *
     * @todo add typescript to overload the function, rather than the string | ViroScene typings
     */
    replace(param1?: string | ViroScene, param2?: string | ViroScene): void;
    /**
     * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
     * then push and jump to it. The back history is re-ordered such that jumped to scenes are
     * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
     *
     * Can take in either 1 or two parameters in the form:
     * jump ("sceneKey");
     * jump ("sceneKey", scene);
     * jump (scene);
     */
    jump(param1?: string | ViroScene, param2?: string | ViroScene): void;
    pop(): void;
    popN(n: number): void;
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     */
    incrementSceneReference(scene: ViroScene, sceneKey: string, limitOne: boolean): void;
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     */
    decrementReferenceForLastNScenes(n: number): void;
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     */
    addToHistory(sceneKey: string): void;
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front. We then update the
     * currentSceneIndex to point to the scene on the top of the history stack
     * (the most recent scene).
     */
    reorderHistory(sceneKey: string): void;
    popHistoryByN(n: number): void;
    getSceneIndex(sceneTag: string): number;
    _project(point: Viro3DPoint): Promise<any>;
    _unproject(point: Viro3DPoint): Promise<any>;
    _recenterTracking(): void;
    _renderSceneStackItems(): JSX.Element[];
    render(): JSX.Element;
}
export {};
