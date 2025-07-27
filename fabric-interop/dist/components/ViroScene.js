"use strict";
/**
 * ViroScene
 *
 * A scene component that manages a 3D scene with scene lifecycle management.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroScene = void 0;
const react_1 = __importStar(require("react"));
const ViroUtils_1 = require("./ViroUtils");
const NativeViro_1 = require("../NativeViro");
/**
 * ViroScene is a 3D scene component that manages scene lifecycle and contains other Viro components.
 */
const ViroScene = (props) => {
    var _a;
    const sceneId = (0, react_1.useRef)((0, NativeViro_1.generateNodeId)());
    // Convert common props to the format expected by the native code
    const nativeProps = {
        ...(0, ViroUtils_1.convertCommonProps)(props),
        postProcessEffects: props.postProcessEffects,
        soundRoom: props.soundRoom,
        physicsWorld: props.physicsWorld,
    };
    // Create the scene node using our enhanced scene management
    const nodeId = (0, ViroUtils_1.useViroNode)("scene", nativeProps);
    // Scene lifecycle management
    (0, react_1.useEffect)(() => {
        // Create the scene with our scene manager
        (0, NativeViro_1.createScene)(sceneId.current, "scene", nativeProps);
        // Activate the scene
        (0, NativeViro_1.activateScene)(sceneId.current);
        // Cleanup when unmounting
        return () => {
            // Deactivate and destroy the scene
            (0, NativeViro_1.deactivateScene)(sceneId.current);
            (0, NativeViro_1.destroyScene)(sceneId.current);
        };
    }, []);
    // Update scene properties when they change
    (0, react_1.useEffect)(() => {
        // Scene properties are updated through the node system
        // The scene manager will handle the lifecycle
    }, [nativeProps]);
    // Register event handlers using our new event system
    (0, ViroUtils_1.useViroEventListeners)(nodeId, {
        onHover: props.onHover,
        onClick: props.onClick,
        onClickState: props.onClickState,
        onTouch: props.onTouch,
        onScroll: props.onScroll,
        onSwipe: props.onSwipe,
        onDrag: props.onDrag,
        onPinch: props.onPinch,
        onRotate: props.onRotate,
        onFuse: typeof props.onFuse === "function"
            ? props.onFuse
            : (_a = props.onFuse) === null || _a === void 0 ? void 0 : _a.callback,
        onCollision: props.onCollision,
        onTransformUpdate: props.onTransformUpdate,
    });
    // Scene lifecycle event handlers
    (0, ViroUtils_1.useViroEventListeners)(nodeId, {
        onLoadStart: props.onSceneLoadStart,
        onLoadEnd: props.onSceneLoadEnd,
        onError: props.onSceneError,
    });
    // Provide the scene node ID as context for children
    return (<ViroUtils_1.ViroContextProvider value={nodeId}>{props.children}</ViroUtils_1.ViroContextProvider>);
};
exports.ViroScene = ViroScene;
//# sourceMappingURL=ViroScene.js.map