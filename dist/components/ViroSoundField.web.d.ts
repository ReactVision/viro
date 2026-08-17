/**
 * Web implementation of ViroSoundField — ambient/background audio. Native uses
 * ambisonic playback; on web it plays as non-positional stereo audio (same as
 * ViroSound). `rotation` (ambisonic orientation) has no web equivalent yet.
 */
import { type ViroSoundProps } from "./ViroSound.web";
type Props = ViroSoundProps & {
    rotation?: [number, number, number];
};
export declare function ViroSoundField(props: Props): null;
export {};
