/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSound
 * @flow
 */
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("react-native");
var resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var react_1 = __importDefault(require("react"));
var prop_types_1 = __importDefault(require("prop-types"));
var ViroProps_1 = require("./Utilities/ViroProps");
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var SoundModule = NativeModules.VRTSoundModule;
var ViroSound = createReactClass({
    statics: {
        preloadSounds: function (soundMap /*:{[key: string]: string}*/) {
            return __awaiter(this, void 0, void 0, function () {
                var results, _a, _b, _i, index, response;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            results = {};
                            _a = [];
                            for (_b in soundMap)
                                _a.push(_b);
                            _i = 0;
                            _d.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 4];
                            index = _a[_i];
                            return [4 /*yield*/, SoundModule.preloadSounds((_c = {}, _c[index] = soundMap[index], _c))];
                        case 2:
                            response = _d.sent();
                            results[response.key] = { result: response.result, msg: response.msg };
                            _d.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/, results];
                    }
                });
            });
        },
        unloadSounds: function (soundKeys /*: [string]*/) {
            SoundModule.unloadSounds(soundKeys);
        }
    },
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        // Source can either be a String referencing a preloaded file, a web uri, or a
        // local js file (using require())
        source: prop_types_1.default.oneOfType([
            prop_types_1.default.string,
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./sound.mp3')
            prop_types_1.default.number,
        ]).isRequired, paused: prop_types_1.default.bool, loop: prop_types_1.default.bool, muted: prop_types_1.default.bool, volume: prop_types_1.default.number, onFinish: prop_types_1.default.func, onError: prop_types_1.default.func }),
    _onFinish: function (event /*: Event*/) {
        this.props.onFinish && this.props.onFinish(event);
    },
    _onError: function (event /*: Event*/) {
        this.props.onError && this.props.onError(event);
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroSound", this.props);
        var soundSrc = this.props.source;
        if (typeof soundSrc === 'number') {
            soundSrc = resolveAssetSource_1.default(soundSrc);
        }
        else if (typeof soundSrc === 'string') {
            soundSrc = { name: soundSrc };
        }
        var nativeProps = Object.assign({}, this.props);
        nativeProps.source = soundSrc;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onErrorViro = this._onError;
        nativeProps.ref = function (component) { _this._component = component; };
        return (<VRTSound {...nativeProps}/>);
    },
    seekToTime: function (timeInSeconds) {
        switch (react_native_1.Platform.OS) {
            case 'ios':
                NativeModules.VRTSoundManager.seekToTime(react_native_1.findNodeHandle(this), timeInSeconds);
                break;
            case 'android':
                NativeModules.UIManager.dispatchViewManagerCommand(react_native_1.findNodeHandle(this), NativeModules.UIManager.VRTSound.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    },
});
var VRTSound = react_native_1.requireNativeComponent('VRTSound', ViroSound, {
    nativeOnly: {
        onFinishViro: true,
        onErrorViro: true,
    }
});
module.exports = ViroSound;
module.exports.VRTSound = VRTSound;
