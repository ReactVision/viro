"use strict";
/**
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Whether a navigator's scene has anything to show in the visionOS ImmersiveSpace.
 *
 * `ViroXRSceneNavigator` opens the space when it mounts, because on visionOS the space — not the
 * React Native window — is the render surface. An AR-rooted scene has nothing to put in it: the AR
 * view managers are excluded from the visionOS renderer, so `ViroARScene` refuses to mount there
 * and renders null. Opening the space anyway dims the room around the wearer and shows them an
 * empty world, which is worse than the warning that explains it.
 *
 * Which of the two it is cannot be known from the props: an app passes a component, and whether
 * that component roots in `ViroARScene` or `ViroScene` is only settled when it renders. React
 * renders a parent before its children and runs effects the other way round, so by the time the
 * navigator's mount effect runs, the scene root has already rendered and said which it is. The
 * navigator opens a scan when it renders and reads the answer in that effect.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginSceneRootScan = beginSceneRootScan;
exports.markARSceneRoot = markARSceneRoot;
exports.sawARSceneRoot = sawARSceneRoot;
let sawARRoot = false;
/** Called by the navigator as it renders, before its children do. */
function beginSceneRootScan() {
    sawARRoot = false;
}
/** Called by an AR scene root that is refusing to mount on visionOS. */
function markARSceneRoot() {
    sawARRoot = true;
}
/** Called by the navigator in its mount effect, after the children have rendered. */
function sawARSceneRoot() {
    return sawARRoot;
}
