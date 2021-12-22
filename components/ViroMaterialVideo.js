"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterialVideo = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
var NativeModules = require("react-native").NativeModules;
var createReactClass = require("create-react-class");
class ViroMaterialVideo extends react_1.default.Component {
    _component = null;
    componentWillUnmount() {
        // pause the current video texture on Android since java gc will release when it feels like it.
        if (react_native_1.Platform.OS == "android") {
            NativeModules.UIManager.dispatchViewManagerCommand((0, react_native_1.findNodeHandle)(this), NativeModules.UIManager.VRTMaterialVideo.Commands.pause, [0]);
        }
    }
    _onBufferStart(event) {
        this.props.onBufferStart && this.props.onBufferStart(event);
    }
    _onBufferEnd(event) {
        this.props.onBufferEnd && this.props.onBufferEnd(event);
    }
    _onFinish() {
        this.props.onFinish && this.props.onFinish();
    }
    _onError(event) {
        this.props.onError && this.props.onError(event);
    }
    _onUpdateTime(event) {
        this.props.onUpdateTime &&
            this.props.onUpdateTime(event.nativeEvent.currentTime, event.nativeEvent.totalTime);
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        //let materials = typeof this.props.materials === 'string' ? new Array(this.props.materials) : this.props.materials;
        let nativeProps = Object.assign({}, this.props);
        //nativeProps.materials = materials;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTMaterialVideo {...nativeProps}/>;
    }
    seekToTime(timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case "ios":
                NativeModules.VRTMaterialVideoManager.seekToTime((0, react_native_1.findNodeHandle)(this), timeInSeconds);
                break;
            case "android":
                NativeModules.UIManager.dispatchViewManagerCommand((0, react_native_1.findNodeHandle)(this), NativeModules.UIManager.VRTMaterialVideo.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    }
}
exports.ViroMaterialVideo = ViroMaterialVideo;
var VRTMaterialVideo = (0, react_native_1.requireNativeComponent)("VRTMaterialVideo", 
// @ts-ignore
ViroMaterialVideo, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onFinishViro: true,
        onErrorViro: true,
    },
});
