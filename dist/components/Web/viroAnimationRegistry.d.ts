/**
 * Web registry for declarative ViroAnimations (transform/opacity keyframes).
 * ViroAnimations.web.createAnimations() stores definitions here; the bridge
 * resolves an `animation` name against this registry and, if found, runs a
 * transaction (begin → set target props → commit) so the renderer interpolates.
 *
 * MVP scope: position/scale/rotation (per-axis) + opacity. color/material/
 * translate/animation-chains are follow-ups.
 */
import type { ViroSceneApi, ViroHandle } from "@reactvision/viro-web-renderer";
export interface ViroWebAnimationDef {
    duration: number;
    delay?: number;
    easing?: string;
    properties: Record<string, number | string | undefined>;
}
export declare function registerViroAnimations(animations: Record<string, ViroWebAnimationDef>): void;
export declare function getViroAnimationDef(name: string): ViroWebAnimationDef | undefined;
export interface ViroBaseTransform {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    opacity: number;
}
/**
 * Run a declarative animation on a node, starting from its current transform.
 * Returns true if `name` was a registered animation.
 */
export declare function runDeclarativeAnimation(scene: ViroSceneApi, node: ViroHandle, name: string, base: ViroBaseTransform, loop: boolean): boolean;
