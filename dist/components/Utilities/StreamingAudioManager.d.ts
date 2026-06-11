/**
 * StreamingAudioManager — imperative API for streaming PCM audio.
 *
 * Typical TTS flow:
 *   StreamingAudioManager.create('tts');
 *   StreamingAudioManager.beginStreaming('tts', 24000, 1);
 *   StreamingAudioManager.play('tts');
 *   // on each TTS audio chunk:
 *   StreamingAudioManager.pushSamples('tts', base64FloatPCM);
 *   // when done:
 *   StreamingAudioManager.destroy('tts');
 */
export declare const StreamingAudioManager: {
    create: (id: string) => void;
    beginStreaming: (id: string, sampleRate: number, channels: number) => void;
    play: (id: string) => void;
    pause: (id: string) => void;
    setVolume: (id: string, volume: number) => void;
    setMuted: (id: string, muted: boolean) => void;
    pushSamples: (id: string, base64: string) => void;
    destroy: (id: string) => void;
};
