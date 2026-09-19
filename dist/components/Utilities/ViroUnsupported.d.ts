/**
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * One place for "this component has no native half on this platform".
 *
 * A view manager that is not registered does not degrade: `requireNativeComponent` hands React a
 * component whose native side is missing, and mounting it takes the app down. Every component
 * whose manager is excluded from a platform's renderer therefore has to decide in JS, before it
 * renders, and say so once rather than on every frame.
 */
/**
 * Logs once per component name, however many instances mount.
 *
 * @param component the Viro component that cannot render here, e.g. `"ViroARScene"`
 * @param platform  the platform it cannot render on, e.g. `"Apple Vision Pro"`
 * @param alternative what to use instead, when there is one
 */
export declare function warnUnsupported(component: string, platform: string, alternative?: string): void;
/** Test seam: forgets what has already been warned about. */
export declare function resetUnsupportedWarnings(): void;
