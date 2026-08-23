"use strict";
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
exports.StudioSounds = void 0;
const React = __importStar(require("react"));
const ViroSound_1 = require("../../ViroSound");
const ViroSpatialSound_1 = require("../../ViroSpatialSound");
/**
 * Renders every actively-playing sound from the manager, re-painting the whole
 * list on any change (like the reactive variable-text nodes). Non-looping sounds
 * remove themselves on finish; any sound removes itself on error so a clip that
 * fails to load releases a waiting step instead of stalling the sequence.
 */
const StudioSounds = ({ manager, }) => {
    const [, force] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => manager.subscribe(force), [manager]);
    return (<>
      {manager.getActive().map((s) => {
            const shared = {
                source: { uri: s.url },
                volume: s.volume,
                loop: s.loop,
                paused: false,
                onFinish: () => {
                    if (!s.loop)
                        manager.remove(s.playId);
                },
                onError: (e) => {
                    console.warn(`[Studio] Sound failed: ${s.audioAssetId} (#${s.playId})`, e?.nativeEvent?.error);
                    manager.remove(s.playId);
                },
            };
            return s.position ? (<ViroSpatialSound_1.ViroSpatialSound key={s.playId} position={s.position} {...shared}/>) : (<ViroSound_1.ViroSound key={s.playId} {...shared}/>);
        })}
    </>);
};
exports.StudioSounds = StudioSounds;
