"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVirtualJoystick = void 0;
const ViroVirtualJoystick = () => {
    if (__DEV__) {
        console.warn("[Viro web] ViroVirtualJoystick is not supported on web; rendering nothing.");
    }
    return null;
};
exports.ViroVirtualJoystick = ViroVirtualJoystick;
exports.default = exports.ViroVirtualJoystick;
