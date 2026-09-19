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

let sawARRoot = false;

/** Called by the navigator as it renders, before its children do. */
export function beginSceneRootScan(): void {
  sawARRoot = false;
}

/** Called by an AR scene root that is refusing to mount on visionOS. */
export function markARSceneRoot(): void {
  sawARRoot = true;
}

/** Called by the navigator in its mount effect, after the children have rendered. */
export function sawARSceneRoot(): boolean {
  return sawARRoot;
}

/**
 * ── Ownership ────────────────────────────────────────────────────────────────
 *
 * The ImmersiveSpace is one surface for the whole app, the way VRActivity is on Quest, and Quest
 * tracks that with a single `setVRActive` / `isVRActive` flag. This is the same idea: several
 * navigators can be mounted at once — a screen stack keeps the one underneath alive — and only
 * the last to claim it is driving the space. One that is not must neither reopen it nor close it
 * on the way out.
 */

const owners: symbol[] = [];
let pendingExit: ReturnType<typeof setTimeout> | null = null;

/**
 * Takes the space over.
 *
 * Also cancels an exit another navigator scheduled on its way out. Swapping the scene on a screen
 * unmounts one navigator and mounts the next in the same commit, cleanup first, so the close is
 * always scheduled before the claim that makes it wrong.
 */
export function claimImmersiveSpace(candidate: symbol): void {
  if (pendingExit !== null) {
    clearTimeout(pendingExit);
    pendingExit = null;
  }
  const existing = owners.indexOf(candidate);
  if (existing !== -1) owners.splice(existing, 1);
  owners.push(candidate);
}

/** Whether this navigator is the one currently driving the space. */
export function ownsImmersiveSpace(candidate: symbol): boolean {
  return owners.length > 0 && owners[owners.length - 1] === candidate;
}

/**
 * Gives the space up.
 *
 * @returns true only when no navigator is left to drive it. A screen stack keeps the screen
 *          underneath mounted, so the one going away is usually not the last: closing then would
 *          leave the wearer in an empty room while a perfectly good scene is still attached, and
 *          the renderer falls back to it on its own.
 */
export function releaseImmersiveSpace(candidate: symbol): boolean {
  const at = owners.indexOf(candidate);
  if (at === -1) return false;
  owners.splice(at, 1);
  return owners.length === 0;
}

/**
 * Closes the space, but not before the next navigator has had its chance to claim it.
 *
 * Immediately is too early: React tears the old screen down before it builds the new one, so an
 * unconditional close reads as a blink at best, and at worst lands after the reopen and leaves the
 * space shut with nothing to reopen it.
 */
export function scheduleImmersiveSpaceExit(exit: () => void): void {
  if (pendingExit !== null) clearTimeout(pendingExit);
  pendingExit = setTimeout(() => {
    pendingExit = null;
    if (owners.length === 0) exit();
  }, 0);
}

/** Test seam: forgets the owners and any pending exit. */
export function resetImmersiveSpaceOwner(): void {
  owners.length = 0;
  if (pendingExit !== null) {
    clearTimeout(pendingExit);
    pendingExit = null;
  }
}
