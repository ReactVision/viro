/**
 * Shared Web Audio context for spatial sound. Lazily created (browsers require a
 * user gesture to resume it; callers should catch play() rejections).
 */
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}
