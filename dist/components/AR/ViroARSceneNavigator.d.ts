/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARSceneNavigator
 * @flow
 */
import * as React from "react";
import { ViewProps } from "react-native";
import { ViroWorldOrigin } from "../Types/ViroEvents";
import { Viro3DPoint, ViroNativeRef, ViroScene, ViroSceneDictionary } from "../Types/ViroUtils";
type Props = ViewProps & {
    /**
     * ViroARSceneNavigator uses "scene" objects like the following to
     * describe a scene.
     */
    initialScene: {
        /**
         * The React Class to render for this scene.
         */
        scene: () => React.JSX.Element;
    };
    initialSceneKey?: string;
    autofocus?: boolean;
    /**
     * iOS only props! Note: these props may change as the underlying platforms coalesce in features.
     */
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    videoQuality?: "High" | "Low";
    numberOfTrackedImages?: number;
    viroAppProps?: any;
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
type State = {
    sceneDictionary: ViroSceneDictionary;
    sceneHistory: string[];
    currentSceneIndex: number;
};
/**
 * ViroARSceneNavigator is used to transition between multiple AR Scenes.
 */
export declare class ViroARSceneNavigator extends React.Component<Props, State> {
    _component: ViroNativeRef;
    constructor(props: Props);
    /**
     * Starts recording video of the Viro renderer and external audio
     *
     * @param fileName - name of the file (without extension)
     * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
     * @param onError - callback function that accepts an errorCode.
     */
    _startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
    /**
     * Stops recording the video of the Viro Renderer.
     *
     * returns Object w/ success, url and errorCode keys.
     * @returns Promise that resolves when the video has stopped recording.
     */
    _stopVideoRecording: () => Promise<any>;
    /**
     * Takes a screenshot of the Viro renderer
     *
     * @param fileName - name of the file (without extension)
     * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
     * returns Object w/ success, url and errorCode keys.
     */
    _takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<any>;
    /**
     * @todo document _project
     *
     * @param point
     * @returns
     */
    _project(point: Viro3DPoint): Promise<any>;
    /**
     * Gets a random tag string.
     *
     * @returns a random tag.
     */
    getRandomTag: () => string;
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
     * @todo use Typescript function overloading rather than this inaccurate solution
     * @todo document parameters
     */
    push: (param1?: ViroScene | string, param2?: ViroScene) => void;
    /**
     * Replace the top scene in the stack with the given scene. The remainder of the back
     * history is kept in the same order as before.
     *
     * Can take in either 1 or two parameters in the form:
     * replace ("sceneKey");
     * replace ("sceneKey", scene);
     * replace (scene);
     *
     * @todo use Typescript function overloading rather than this inaccurate solution
     * @todo document parameters
     */
    replace: (param1?: ViroScene | string, param2?: ViroScene) => void;
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
     * @todo use Typescript function overloading rather than this inaccurate solution
     * @todo document parameters
     */
    jump: (param1?: ViroScene | string, param2?: ViroScene) => void;
    /**
     * Pop 1 screen from the stack.
     */
    pop: () => void;
    /**
     * Pop n screens from the stack.
     *
     * @param n number of scenes to pop
     * @returns void
     */
    popN: (n: number) => void;
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     *
     * @todo TODO: Document parameters.
     */
    incrementSceneReference: (scene: ViroScene, sceneKey: string, limitOne: boolean) => void;
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     *
     * @param n number to decrement by.
     */
    decrementReferenceForLastNScenes: (n: number) => void;
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     *
     * @param sceneKey scene to insert into the stack.
     */
    addToHistory: (sceneKey: string) => void;
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front. We then update the
     * currentSceneIndex to point to the scene on the top of the history stack
     * (the most recent scene).
     *
     * @param sceneKey scene to put at the top of the stack.
     */
    reorderHistory: (sceneKey: string) => void;
    /**
     * Pops the history entries by n screens.
     *
     * @param n number of history entries to pop.
     */
    popHistoryByN(n: number): void;
    /**
     * Gets the index of a scene by the scene tag.
     *
     * @param sceneTag tag of the scene
     * @returns the index of the scene
     */
    getSceneIndex: (sceneTag: string) => number;
    /**
     * TODO: Document _unproject
     *
     * @param point
     * @returns
     */
    _unproject: (point: Viro3DPoint) => Promise<any>;
    /**
     * [iOS Only]
     *
     * Resets the tracking of the AR session.
     *
     * @param resetTracking - determines if the tracking should be reset.
     * @param removeAnchors - determines if the existing anchors should be removed too.
     */
    _resetARSession: (resetTracking: any, removeAnchors: any) => void;
    /**
     * [iOS/ARKit 1.5+ Only]
     *
     * Allows the developer to offset the current world orgin
     * by the given transformation matrix. ie. if this is called twice with the
     * position [0, 0, 1], then current world origin will be at [0, 0, 2] from its
     * initial position (it's additive, not meant to replace the existing origin)
     *
     * @param worldOrigin - a dictionary that can contain a `position` and `rotation` key with an
     *  array containing 3 floats (note: rotation is in degrees).
     */
    _setWorldOrigin: (worldOrigin: ViroWorldOrigin) => void;
    /**
     * Renders the Scene Views in the stack.
     *
     * @returns Array of rendered Scene views.
     */
    _renderSceneStackItems: () => React.JSX.Element[];
    arSceneNavigator: {
        push: (param1?: ViroScene | string, param2?: ViroScene) => void;
        pop: () => void;
        popN: (n: number) => void;
        jump: (param1?: ViroScene | string, param2?: ViroScene) => void;
        replace: (param1?: ViroScene | string, param2?: ViroScene) => void;
        startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
        stopVideoRecording: () => Promise<any>;
        takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<any>;
        resetARSession: (resetTracking: any, removeAnchors: any) => void;
        setWorldOrigin: (worldOrigin: ViroWorldOrigin) => void;
        project: (point: Viro3DPoint) => Promise<any>;
        unproject: (point: Viro3DPoint) => Promise<any>;
        viroAppProps: any;
    };
    sceneNavigator: {
        push: (param1?: ViroScene | string, param2?: ViroScene) => void;
        pop: () => void;
        popN: (n: number) => void;
        jump: (param1?: ViroScene | string, param2?: ViroScene) => void;
        replace: (param1?: ViroScene | string, param2?: ViroScene) => void;
        startVideoRecording: (fileName: string, saveToCameraRoll: boolean, onError: (errorCode: number) => void) => void;
        stopVideoRecording: () => Promise<any>;
        takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<any>;
        resetARSession: (resetTracking: any, removeAnchors: any) => void;
        setWorldOrigin: (worldOrigin: ViroWorldOrigin) => void;
        project: (point: Viro3DPoint) => Promise<any>;
        unproject: (point: Viro3DPoint) => Promise<any>;
        viroAppProps: any;
    };
    render(): React.JSX.Element;
}
export {};
