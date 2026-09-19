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
/** Called by the navigator as it renders, before its children do. */
export declare function beginSceneRootScan(): void;
/** Called by an AR scene root that is refusing to mount on visionOS. */
export declare function markARSceneRoot(): void;
/** Called by the navigator in its mount effect, after the children have rendered. */
export declare function sawARSceneRoot(): boolean;
/**
 * Takes the space over.
 *
 * Also cancels an exit another navigator scheduled on its way out. Swapping the scene on a screen
 * unmounts one navigator and mounts the next in the same commit, cleanup first, so the close is
 * always scheduled before the claim that makes it wrong.
 */
export declare function claimImmersiveSpace(candidate: symbol): void;
/** Whether this navigator is the one currently driving the space. */
export declare function ownsImmersiveSpace(candidate: symbol): boolean;
/**
 * Gives the space up.
 *
 * @returns true only when no navigator is left to drive it. A screen stack keeps the screen
 *          underneath mounted, so the one going away is usually not the last: closing then would
 *          leave the wearer in an empty room while a perfectly good scene is still attached, and
 *          the renderer falls back to it on its own.
 */
export declare function releaseImmersiveSpace(candidate: symbol): boolean;
/**
 * Closes the space, but not before the next navigator has had its chance to claim it.
 *
 * Immediately is too early: React tears the old screen down before it builds the new one, so an
 * unconditional close reads as a blink at best, and at worst lands after the reopen and leaves the
 * space shut with nothing to reopen it.
 */
export declare function scheduleImmersiveSpaceExit(exit: () => void): void;
/** Test seam: forgets the owners and any pending exit. */
export declare function resetImmersiveSpaceOwner(): void;
