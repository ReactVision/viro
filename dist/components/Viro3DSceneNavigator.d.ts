/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro3DSceneNavigator
 * @flow
 */
import * as React from "react";
import { ViewProps } from "react-native";
import { ViroExitViroEvent } from "./Types/ViroEvents";
import { ViroNativeRef, Viro3DPoint, ViroSceneDictionary } from "./Types/ViroUtils";
import { ViroScene } from "./ViroScene";
declare type Props = ViewProps & {
    /**
     * initial scene key
     *
     * @type {string}
     */
    initialSceneKey?: string;
    /**
     * A flag to enable/disable some debug features
     */
    debug: boolean;
    viroAppProps?: any;
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
    /**
     * Called when either the user physically decides to exit vr (hits
     * the "X" buton).
     */
    onExitViro: () => void;
    /**
     * Renderer settings that can be used to enable or disable various
     * renderer capabilities and algorithms.
     */
    hdrEnabled: boolean;
    pbrEnabled: boolean;
    bloomEnabled: boolean;
    shadowsEnabled: boolean;
    multisamplingEnabled: boolean;
};
declare type State = {
    sceneDictionary: ViroSceneDictionary;
    sceneHistory: string[];
    currentSceneIndex: number;
};
/**
 * Viro3DSceneNavigator is used to transition between multiple scenes.
 */
export declare class Viro3DSceneNavigator extends React.Component<Props, State> {
    _component: ViroNativeRef;
    sceneNavigator: {
        push: (param1?: string | ViroScene | undefined, param2?: ViroScene | undefined) => void;
        pop: () => void;
        popN: (n: number) => void;
        jump: (param1?: string | ViroScene | undefined, param2?: ViroScene | undefined) => void;
        replace: (param1?: string | ViroScene | undefined, param2?: ViroScene | undefined) => void;
        recenterTracking: () => void;
        project: (point: Viro3DPoint) => Promise<any>;
        unproject: (point: Viro3DPoint) => Promise<any>;
        viroAppProps: any;
    };
    /**
     * Called from native when either the user physically decides to exit vr (hits
     * the "X" buton).
     */
    _onExitViro(_event: ViroExitViroEvent): void;
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
     * @todo: use Typescript function overloading rather than this inaccurate solution
     */
    push(param1?: ViroScene | string, param2?: ViroScene): void;
    /**
     * Replace the top scene in the stack with the given scene. The remainder of the back
     * history is kept in the same order as before.
     *
     * Can take in either 1 or two parameters in the form:
     * replace ("sceneKey");
     * replace ("sceneKey", scene);
     * replace (scene);
     *
     * @todo: use Typescript function overloading rather than this inaccurate solution
     */
    replace(param1?: ViroScene | string, param2?: ViroScene): void;
    /**
     * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
     * then push and jump to it. The back history is re-ordered such that jumped to scenes are
     * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
     *
     * Can take in either 1 or two parameters in the form:
     * jump ("sceneKey");
     * jump ("sceneKey", scene);
     * jump (scene);
     *
     * @todo: use Typescript function overloading rather than this inaccurate solution
     */
    jump(param1?: ViroScene | string, param2?: ViroScene): void;
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
    _recenterTracking(): void;
    _renderSceneStackItems(): JSX.Element[];
    _project(point: Viro3DPoint): Promise<any>;
    _unproject(point: Viro3DPoint): Promise<any>;
    render(): JSX.Element;
}
export {};
