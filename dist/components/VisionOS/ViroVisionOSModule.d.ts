/**
 * ViroVisionOSModule
 *
 * JavaScript API for controlling the visionOS ImmersiveSpace.
 * On iOS / Android the calls are no-ops (module returns false / resolves silently).
 *
 * ── Host-app setup required ──────────────────────────────────────────────────
 *
 * 1. Add the ImmersiveSpace to your SwiftUI App struct (visionOS only):
 *
 *    #if os(visionOS)
 *    import ViroReact
 *    #endif
 *
 *    @main struct MyApp: App {
 *      var body: some Scene {
 *        WindowGroup {
 *          ContentView()
 *            #if os(visionOS)
 *            .viroImmersiveSpaceController()
 *            #endif
 *        }
 *        #if os(visionOS)
 *        ImmersiveSpace(id: "ViroImmersive") {
 *          ViroImmersiveSpaceView()
 *        }
 *        .immersionStyle(selection: .constant(.mixed), in: .mixed, .full)
 *        #endif
 *      }
 *    }
 *
 * 2. Call from JavaScript:
 *
 *    import { ViroVisionOSModule } from '@reactvision/react-viro';
 *
 *    await ViroVisionOSModule.enterImmersiveSpace('mixed');
 *    // ... render Viro scene inside ImmersiveSpace ...
 *    await ViroVisionOSModule.exitImmersiveSpace();
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * Immersion styles Viro can present.
 *
 * "progressive" is absent on purpose. Declaring it on the ImmersiveSpace changes what
 * CompositorServices requires: presentation must then go through the drawable's render context,
 * and encodePresent — which this renderer uses — is rejected outright with "BUG IN CLIENT:
 * cannot present drawable: need to use drawable render context when supporting progressive
 * style", aborting the process seconds after the space opens. Supporting it means implementing
 * the render-context path first.
 */
export type ImmersiveSpaceStyle = "mixed" | "full";
/**
 * Returns true if the app is running on Apple Vision Pro (visionOS).
 * Uses the native module constant; falls back to Platform.isVision when
 * available (React Native 0.83+).
 */
export declare function isVisionOS(): boolean;
/**
 * Opens the Viro ImmersiveSpace on visionOS.
 *
 * @param style  "mixed" (default) — virtual content blended over passthrough
 *               "full"  — fully virtual, passthrough hidden
 */
export declare function enterImmersiveSpace(style?: ImmersiveSpaceStyle): Promise<boolean>;
/**
 * Dismisses the Viro ImmersiveSpace and returns to the window layer.
 */
export declare function exitImmersiveSpace(): Promise<boolean>;
/** Convenience object matching the typical NativeModules pattern. */
export declare const ViroVisionOSModule: {
    readonly isVisionOS: typeof isVisionOS;
    readonly enterImmersiveSpace: typeof enterImmersiveSpace;
    readonly exitImmersiveSpace: typeof exitImmersiveSpace;
};
