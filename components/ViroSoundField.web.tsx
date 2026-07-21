/**
 * Web implementation of ViroSoundField — ambient/background audio. Native uses
 * ambisonic playback; on web it plays as non-positional stereo audio (same as
 * ViroSound). `rotation` (ambisonic orientation) has no web equivalent yet.
 */
import { ViroSound, type ViroSoundProps } from "./ViroSound.web";

type Props = ViroSoundProps & { rotation?: [number, number, number] };

export function ViroSoundField(props: Props): null {
  return ViroSound(props);
}
