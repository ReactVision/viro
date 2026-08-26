/**
 * True when running on the web platform (react-native-web). Web uses the
 * WASM/WebGL2 renderer via @reactvision/viro-web-renderer and the .web.tsx
 * bridge instead of the native view managers.
 */
export declare const isWeb: boolean;
export declare const isQuest: boolean;
/**
 * True when this app build includes the OpenXR VR native module (i.e. the
 * Quest variant of react-viro is registered in `MainApplication`). Does NOT
 * imply the current device is a Quest — for that, use `isQuest`.
 *
 * Useful when you need to decide whether `ViroVRSceneNavigator` *could* render
 * if you forced VR mode (e.g., for in-app build diagnostics).
 */
export declare const hasOpenXRSupport: boolean;
